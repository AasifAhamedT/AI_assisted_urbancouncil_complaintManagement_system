from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "rag"
    service_host: str = "127.0.0.1"
    service_port: int = Field(default=8002, ge=1, le=65535)
    log_level: str = "INFO"
    gemini_api_key: str = ""
    gemini_generation_model: str = ""
    gemini_embedding_model: str = ""
    chroma_persist_directory: Path = Path("./chroma_data")
    authorized_document_directory: Path = Path("./authorized_documents")
    top_k_results: int = Field(default=5, ge=1, le=20)
    max_document_bytes: int = Field(default=10_000_000, ge=1, le=25_000_000)
    chunk_size_characters: int = Field(default=1200, ge=300, le=4000)
    chunk_overlap_characters: int = Field(default=180, ge=0, le=1000)
    embedding_dimensions: int = Field(default=768, ge=128, le=3072)
    maximum_retrieval_distance: float = Field(default=0.45, ge=0, le=2)
    request_timeout_seconds: int = Field(default=30, ge=1, le=120)

    @property
    def provider_configured(self) -> bool:
        return bool(
            self.gemini_api_key
            and self.gemini_generation_model
            and self.gemini_embedding_model
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

