from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


IngestionStatus = Literal["PROCESSING", "READY", "FAILED"]


class DocumentVersion(ApiModel):
    version: int = Field(ge=1)
    original_filename: str = Field(min_length=1, max_length=255)
    media_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(ge=1)
    checksum_sha256: str = Field(min_length=64, max_length=64)
    status: IngestionStatus
    chunk_count: int = Field(default=0, ge=0)
    version_note: str | None = Field(default=None, max_length=500)
    failure_code: str | None = Field(default=None, max_length=100)
    created_by_user_id: str = Field(min_length=36, max_length=36)
    created_at: datetime
    completed_at: datetime | None = None


class KnowledgeDocument(ApiModel):
    id: str = Field(min_length=36, max_length=36)
    title: str = Field(min_length=3, max_length=200)
    is_active: bool
    current_version: int | None = Field(default=None, ge=1)
    created_by_user_id: str = Field(min_length=36, max_length=36)
    created_at: datetime
    updated_at: datetime
    versions: list[DocumentVersion]

    @model_validator(mode="after")
    def current_version_is_ready(self) -> KnowledgeDocument:
        if self.current_version is None:
            return self
        matching = [item for item in self.versions if item.version == self.current_version]
        if len(matching) != 1 or matching[0].status != "READY":
            raise ValueError("The current document version must identify one ready version.")
        return self


class DocumentListResponse(ApiModel):
    documents: list[KnowledgeDocument]


class DocumentResponse(ApiModel):
    document: KnowledgeDocument


class QueryRequest(ApiModel):
    question: str = Field(min_length=3, max_length=1000)


class Citation(ApiModel):
    document_id: str
    document_title: str
    version: int
    location: str
    excerpt: str = Field(max_length=500)


class QueryResponse(ApiModel):
    answer: str = Field(min_length=1, max_length=5000)
    abstained: bool
    citations: list[Citation]
    provider: str
    model_name: str


class GeneratedAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=5000)
    supported: bool
    cited_chunk_ids: list[str] = Field(max_length=10)
