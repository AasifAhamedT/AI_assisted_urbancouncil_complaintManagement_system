from pathlib import Path

import pytest

from app.chunker import TextChunk
from app.config import Settings
from app.errors import RagError
from app.models import GeneratedAnswer
from app.repository import AuthorizedDocumentStore, DocumentManifestRepository
from app.service import ABSTENTION, RagService
from app.vector_store import RetrievedChunk


class FakeProvider:
    provider = "test-provider"
    generation_model = "test-model"

    def __init__(self) -> None:
        self.answer = GeneratedAnswer(
            answer="Applications are accepted at the documented service desk.",
            supported=True,
            cited_chunk_ids=[],
        )

    async def embed_documents(self, values: list[str]) -> list[list[float]]:
        return [[float(index + 1), 0.5] for index, _value in enumerate(values)]

    async def embed_query(self, value: str) -> list[float]:
        return [1.0, 0.5]

    async def generate(self, question: str, chunks: list[TextChunk]) -> GeneratedAnswer:
        return self.answer


class FakeVectorStore:
    def __init__(self) -> None:
        self.chunks: list[TextChunk] = []
        self.matches: list[RetrievedChunk] = []
        self.removed: list[str] = []

    def replace_document(self, chunks: list[TextChunk], embeddings: list[list[float]]) -> None:
        assert len(chunks) == len(embeddings)
        self.chunks = chunks

    def remove_document(self, document_id: str) -> None:
        self.removed.append(document_id)
        self.chunks = [item for item in self.chunks if item.document_id != document_id]

    def query(self, embedding: list[float], limit: int) -> list[RetrievedChunk]:
        return self.matches[:limit]


def build_service(tmp_path: Path) -> tuple[RagService, FakeProvider, FakeVectorStore]:
    settings = Settings(
        gemini_api_key="test-key",
        gemini_generation_model="test-generation",
        gemini_embedding_model="test-embedding",
        authorized_document_directory=tmp_path / "documents",
        chroma_persist_directory=tmp_path / "chroma",
        chunk_size_characters=300,
        chunk_overlap_characters=30,
        maximum_retrieval_distance=0.45,
    )
    provider = FakeProvider()
    vectors = FakeVectorStore()
    service = RagService(
        settings=settings,
        repository=DocumentManifestRepository(settings.authorized_document_directory),
        document_store=AuthorizedDocumentStore(settings.authorized_document_directory),
        vector_store=vectors,
        provider=provider,
    )
    return service, provider, vectors


@pytest.mark.asyncio
async def test_ingestion_records_ready_version_and_deactivation_removes_vectors(tmp_path: Path) -> None:
    service, _provider, vectors = build_service(tmp_path)
    document = await service.ingest(
        document_id=None,
        title="Academic verification procedure",
        actor_user_id="10000000-0000-4000-8000-000000000003",
        original_filename="procedure.txt",
        media_type="text/plain",
        content=b"Applications are accepted at the documented service desk during the listed hours.",
        version_note="Initial approved test version",
    )

    assert document.is_active is True
    assert document.current_version == 1
    assert document.versions[0].status == "READY"
    assert document.versions[0].chunk_count == 1
    assert len(vectors.chunks) == 1

    inactive = service.deactivate(document.id)
    assert inactive.is_active is False
    assert vectors.removed == [document.id]


@pytest.mark.asyncio
async def test_query_returns_only_validated_citations(tmp_path: Path) -> None:
    service, provider, vectors = build_service(tmp_path)
    chunk = TextChunk(
        id="doc:v1:00001",
        document_id="20000000-0000-4000-8000-000000000001",
        document_title="Service procedure",
        version=1,
        location="Page 2",
        text="Applications are accepted at the service desk.",
    )
    vectors.matches = [RetrievedChunk(chunk=chunk, distance=0.2)]
    provider.answer = provider.answer.model_copy(update={"cited_chunk_ids": [chunk.id]})

    result = await service.query("Where are applications accepted?")

    assert result.abstained is False
    assert result.citations[0].document_title == "Service procedure"
    assert result.citations[0].location == "Page 2"


@pytest.mark.asyncio
async def test_query_abstains_for_weak_or_forged_support(tmp_path: Path) -> None:
    service, provider, vectors = build_service(tmp_path)
    chunk = TextChunk(
        id="doc:v1:00001",
        document_id="20000000-0000-4000-8000-000000000001",
        document_title="Service procedure",
        version=1,
        location="Page 2",
        text="Applications are accepted at the service desk.",
    )
    vectors.matches = [RetrievedChunk(chunk=chunk, distance=0.8)]
    weak = await service.query("What is the Mayor's private telephone number?")
    assert weak.abstained is True
    assert weak.answer == ABSTENTION

    vectors.matches = [RetrievedChunk(chunk=chunk, distance=0.2)]
    provider.answer = provider.answer.model_copy(update={"cited_chunk_ids": ["invented:chunk"]})
    forged = await service.query("Where are applications accepted?")
    assert forged.abstained is True
    assert forged.citations == []


@pytest.mark.asyncio
async def test_provider_configuration_is_required_for_ingestion(tmp_path: Path) -> None:
    settings = Settings(
        authorized_document_directory=tmp_path / "documents",
        chroma_persist_directory=tmp_path / "chroma",
    )
    service = RagService(
        settings=settings,
        repository=DocumentManifestRepository(settings.authorized_document_directory),
        document_store=AuthorizedDocumentStore(settings.authorized_document_directory),
        vector_store=FakeVectorStore(),
        provider=None,
    )
    with pytest.raises(RagError, match="not configured") as raised:
        await service.ingest(
            document_id=None,
            title="Test document",
            actor_user_id="10000000-0000-4000-8000-000000000003",
            original_filename="test.txt",
            media_type="text/plain",
            content=b"Valid text content",
            version_note=None,
        )
    assert raised.value.status_code == 503
