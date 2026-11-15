from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, cast

import chromadb
from chromadb.api.types import Embeddings

from app.chunker import TextChunk


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: TextChunk
    distance: float


class VectorStore(Protocol):
    def replace_document(self, chunks: list[TextChunk], embeddings: list[list[float]]) -> None: ...
    def remove_document(self, document_id: str) -> None: ...
    def query(self, embedding: list[float], limit: int) -> list[RetrievedChunk]: ...


class ChromaVectorStore:
    def __init__(self, persist_directory: Path) -> None:
        persist_directory.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(persist_directory.resolve()))
        self._collection = client.get_or_create_collection(
            "authorized_knowledge",
            metadata={"hnsw:space": "cosine"},
        )

    def replace_document(self, chunks: list[TextChunk], embeddings: list[list[float]]) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("Each chunk must have exactly one embedding.")
        document_id = chunks[0].document_id if chunks else ""
        existing = self._collection.get(where={"document_id": document_id}, include=[])
        old_ids = existing.get("ids", [])
        self._collection.upsert(
            ids=[item.id for item in chunks],
            documents=[item.text for item in chunks],
            embeddings=cast(Embeddings, embeddings),
            metadatas=[{
                "document_id": item.document_id,
                "document_title": item.document_title,
                "version": item.version,
                "location": item.location,
            } for item in chunks],
        )
        new_ids = {item.id for item in chunks}
        obsolete = [item for item in old_ids if item not in new_ids]
        if obsolete:
            self._collection.delete(ids=obsolete)

    def remove_document(self, document_id: str) -> None:
        self._collection.delete(where={"document_id": document_id})

    def query(self, embedding: list[float], limit: int) -> list[RetrievedChunk]:
        result = self._collection.query(
            query_embeddings=cast(Embeddings, [embedding]), n_results=limit,
            include=["documents", "metadatas", "distances"],
        )
        ids = (result.get("ids") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        retrieved: list[RetrievedChunk] = []
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances, strict=True):
            if text is None or metadata is None or distance is None:
                continue
            document_id = metadata.get("document_id")
            document_title = metadata.get("document_title")
            version = metadata.get("version")
            location = metadata.get("location")
            if not isinstance(document_id, str) or not isinstance(document_title, str):
                continue
            if not isinstance(version, int) or not isinstance(location, str):
                continue
            retrieved.append(RetrievedChunk(
                chunk=TextChunk(
                    id=str(chunk_id), document_id=document_id,
                    document_title=document_title, version=version,
                    location=location, text=str(text),
                ),
                distance=float(distance),
            ))
        return retrieved
