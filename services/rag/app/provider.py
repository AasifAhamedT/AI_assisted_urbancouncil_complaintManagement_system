from __future__ import annotations

import asyncio
from typing import Protocol

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.chunker import TextChunk
from app.config import Settings
from app.errors import RagError
from app.models import GeneratedAnswer


class RagProvider(Protocol):
    provider: str
    generation_model: str

    async def embed_documents(self, values: list[str]) -> list[list[float]]: ...
    async def embed_query(self, value: str) -> list[float]: ...
    async def generate(self, question: str, chunks: list[TextChunk]) -> GeneratedAnswer: ...


class GeminiRagProvider:
    provider = "gemini"

    def __init__(self, settings: Settings, client: genai.Client | None = None) -> None:
        self.generation_model = settings.gemini_generation_model
        self._embedding_model = settings.gemini_embedding_model
        self._embedding_dimensions = settings.embedding_dimensions
        self._timeout_seconds = settings.request_timeout_seconds
        self._client = client or genai.Client(api_key=settings.gemini_api_key)

    async def embed_documents(self, values: list[str]) -> list[list[float]]:
        return await self._embed(values, "RETRIEVAL_DOCUMENT")

    async def embed_query(self, value: str) -> list[float]:
        embeddings = await self._embed([value], "RETRIEVAL_QUERY")
        return embeddings[0]

    async def _embed(self, values: list[str], task_type: str) -> list[list[float]]:
        embeddings: list[list[float]] = []
        try:
            for offset in range(0, len(values), 100):
                batch = values[offset:offset + 100]
                async with asyncio.timeout(self._timeout_seconds):
                    response = await self._client.aio.models.embed_content(
                        model=self._embedding_model,
                        contents=batch,
                        config=types.EmbedContentConfig(
                            task_type=task_type,
                            output_dimensionality=self._embedding_dimensions,
                        ),
                    )
                embeddings.extend(list(item.values or []) for item in (response.embeddings or []))
        except TimeoutError as error:
            raise RagError(504, "RAG_PROVIDER_TIMEOUT", "The knowledge provider timed out.") from error
        except errors.APIError as error:
            raise RagError(502, "RAG_PROVIDER_UNAVAILABLE", "The knowledge provider is unavailable.") from error
        except Exception as error:
            raise RagError(502, "RAG_PROVIDER_UNAVAILABLE", "The knowledge provider is unavailable.") from error
        if len(embeddings) != len(values) or any(not item for item in embeddings):
            raise RagError(502, "RAG_EMBEDDING_INVALID", "The knowledge provider returned invalid embeddings.")
        return embeddings

    async def generate(self, question: str, chunks: list[TextChunk]) -> GeneratedAnswer:
        context = "\n\n".join(
            f"[{item.id}] Source: {item.document_title}, version {item.version}, {item.location}\n{item.text}"
            for item in chunks
        )
        try:
            async with asyncio.timeout(self._timeout_seconds):
                response = await self._client.aio.models.generate_content(
                    model=self.generation_model,
                    contents=f"Question:\n{question}\n\nAuthorized context:\n{context}",
                    config=types.GenerateContentConfig(
                        system_instruction=(
                            "Answer only from the supplied authorized context. Do not use outside knowledge, "
                            "invent Council procedures, responsibilities, contacts, policy, or complaint data. "
                            "Set supported=false when the context is insufficient. When supported, cite only "
                            "the exact chunk identifiers that support the answer."
                        ),
                        response_mime_type="application/json",
                        response_json_schema=GeneratedAnswer.model_json_schema(),
                        temperature=0.0,
                    ),
                )
        except TimeoutError as error:
            raise RagError(504, "RAG_PROVIDER_TIMEOUT", "The knowledge provider timed out.") from error
        except errors.APIError as error:
            raise RagError(502, "RAG_PROVIDER_UNAVAILABLE", "The knowledge provider is unavailable.") from error
        except Exception as error:
            raise RagError(502, "RAG_PROVIDER_UNAVAILABLE", "The knowledge provider is unavailable.") from error
        try:
            if isinstance(response.parsed, GeneratedAnswer):
                return response.parsed
            if isinstance(response.parsed, dict):
                return GeneratedAnswer.model_validate(response.parsed)
            return GeneratedAnswer.model_validate_json(response.text or "")
        except (ValidationError, ValueError) as error:
            raise RagError(502, "RAG_ANSWER_INVALID", "The knowledge provider returned an invalid answer.") from error
