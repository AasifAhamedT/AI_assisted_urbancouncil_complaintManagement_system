from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "ai-classifier"
    service_host: str = "127.0.0.1"
    service_port: int = Field(default=8001, ge=1, le=65535)
    log_level: str = "INFO"
    classifier_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_classification_model: str = ""
    classification_prompt_version: str = "complaint-category-v1"
    request_timeout_seconds: int = Field(default=20, gt=0, le=120)

    @property
    def provider_configured(self) -> bool:
        return bool(
            self.classifier_provider == "gemini"
            and self.gemini_api_key
            and self.gemini_classification_model
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

