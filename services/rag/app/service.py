from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from app.chunker import DocumentChunker
from app.config import Settings
from app.errors import RagError
from app.extractor import DocumentExtractor
from app.models import (
    Citation,
    DocumentVersion,
    KnowledgeDocument,
    QueryResponse,
)
from app.provider import GeminiRagProvider, RagProvider
from app.repository import AuthorizedDocumentStore, DocumentManifestRepository
from app.vector_store import ChromaVectorStore, RetrievedChunk, VectorStore

ABSTENTION = "I could not find enough support in the authorized Council documents to answer that question."


class RagService:
    def __init__(
        self,
        settings: Settings,
        repository: DocumentManifestRepository,
        document_store: AuthorizedDocumentStore,
        vector_store: VectorStore,
        provider: RagProvider | None,
        extractor: DocumentExtractor | None = None,
        chunker: DocumentChunker | None = None,
    ) -> None:
        self._settings = settings
        self._repository = repository
        self._document_store = document_store
        self._vectors = vector_store
        self._provider = provider
        self._extractor = extractor or DocumentExtractor()
        self._chunker = chunker or DocumentChunker(
            settings.chunk_size_characters,
            settings.chunk_overlap_characters,
        )

    def list_documents(self) -> list[KnowledgeDocument]:
        return self._repository.list_documents()

    async def ingest(
        self,
        *,
        document_id: str | None,
        title: str,
        actor_user_id: str,
        original_filename: str,
        media_type: str,
        content: bytes,
        version_note: str | None,
    ) -> KnowledgeDocument:
        provider = self._require_provider()
        self._extractor.validate(original_filename, media_type, content, self._settings.max_document_bytes)
        now = datetime.now(UTC)
        existing = self._repository.get(document_id) if document_id else None
        if document_id and existing is None:
            raise RagError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document not found.")
        identifier = document_id or str(uuid4())
        version_number = max((item.version for item in existing.versions), default=0) + 1 if existing else 1
        version = DocumentVersion(
            version=version_number,
            original_filename=original_filename,
            media_type=media_type,
            size_bytes=len(content),
            checksum_sha256=sha256(content).hexdigest(),
            status="PROCESSING",
            chunk_count=0,
            version_note=version_note,
            failure_code=None,
            created_by_user_id=actor_user_id,
            created_at=now,
            completed_at=None,
        )
        document = KnowledgeDocument(
            id=identifier,
            title=title.strip(),
            is_active=existing.is_active if existing else False,
            current_version=existing.current_version if existing else None,
            created_by_user_id=existing.created_by_user_id if existing else actor_user_id,
            created_at=existing.created_at if existing else now,
            updated_at=now,
            versions=[*(existing.versions if existing else []), version],
        )
        self._repository.save(document)
        try:
            self._document_store.save(identifier, version_number, original_filename, content)
            units = self._extractor.extract(media_type, content)
            chunks = self._chunker.chunk(identifier, document.title, version_number, units)
            if not chunks:
                raise RagError(422, "DOCUMENT_HAS_NO_TEXT", "The document does not contain extractable text.")
            embeddings = await provider.embed_documents([item.text for item in chunks])
            self._vectors.replace_document(chunks, embeddings)
            completed = datetime.now(UTC)
            ready = version.model_copy(update={
                "status": "READY",
                "chunk_count": len(chunks),
                "completed_at": completed,
            })
            document = document.model_copy(update={
                "is_active": True,
                "current_version": version_number,
                "updated_at": completed,
                "versions": [*document.versions[:-1], ready],
            })
            self._repository.save(document)
            return document
        except Exception as error:
            failed_at = datetime.now(UTC)
            failure_code = error.code if isinstance(error, RagError) else "DOCUMENT_INGESTION_FAILED"
            failed = version.model_copy(update={
                "status": "FAILED",
                "failure_code": failure_code,
                "completed_at": failed_at,
            })
            self._repository.save(document.model_copy(update={
                "updated_at": failed_at,
                "versions": [*document.versions[:-1], failed],
            }))
            if isinstance(error, RagError):
                raise
            raise RagError(500, "DOCUMENT_INGESTION_FAILED", "The document could not be ingested.") from error

    def deactivate(self, document_id: str) -> KnowledgeDocument:
        document = self._repository.get(document_id)
        if document is None:
            raise RagError(404, "KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document not found.")
        self._vectors.remove_document(document_id)
        updated = document.model_copy(update={"is_active": False, "updated_at": datetime.now(UTC)})
        self._repository.save(updated)
        return updated

    async def query(self, question: str) -> QueryResponse:
        provider = self._require_provider()
        embedding = await provider.embed_query(question)
        matches = self._vectors.query(embedding, self._settings.top_k_results)
        eligible = [item for item in matches if item.distance <= self._settings.maximum_retrieval_distance]
        if not eligible:
            return self._abstention(provider)
        generated = await provider.generate(question, [item.chunk for item in eligible])
        allowed = {item.chunk.id: item for item in eligible}
        cited_ids = list(dict.fromkeys(generated.cited_chunk_ids))
        if not generated.supported or not cited_ids or any(item not in allowed for item in cited_ids):
            return self._abstention(provider)
        citations = [self._citation(allowed[item]) for item in cited_ids]
        return QueryResponse(
            answer=generated.answer,
            abstained=False,
            citations=citations,
            provider=provider.provider,
            model_name=provider.generation_model,
        )

    def _require_provider(self) -> RagProvider:
        if self._provider is None:
            raise RagError(503, "RAG_PROVIDER_NOT_CONFIGURED", "The knowledge provider is not configured.")
        return self._provider

    def _abstention(self, provider: RagProvider) -> QueryResponse:
        return QueryResponse(
            answer=ABSTENTION,
            abstained=True,
            citations=[],
            provider=provider.provider,
            model_name=provider.generation_model,
        )

    def _citation(self, match: RetrievedChunk) -> Citation:
        chunk = match.chunk
        excerpt = chunk.text if len(chunk.text) <= 300 else f"{chunk.text[:297].rstrip()}..."
        return Citation(
            document_id=chunk.document_id,
            document_title=chunk.document_title,
            version=chunk.version,
            location=chunk.location,
            excerpt=excerpt,
        )


def create_rag_service(settings: Settings) -> RagService:
    provider: RagProvider | None = GeminiRagProvider(settings) if settings.provider_configured else None
    return RagService(
        settings=settings,
        repository=DocumentManifestRepository(settings.authorized_document_directory),
        document_store=AuthorizedDocumentStore(settings.authorized_document_directory),
        vector_store=ChromaVectorStore(settings.chroma_persist_directory),
        provider=provider,
    )
