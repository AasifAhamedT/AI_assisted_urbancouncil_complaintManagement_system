from __future__ import annotations

import asyncio
from typing import Protocol

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import Settings
from app.errors import ClassificationError
from app.models import (
    ClassificationRecommendation,
    ClassificationRequest,
    ModelRecommendation,
)
from app.prompt import SYSTEM_INSTRUCTION, build_classification_prompt


class ClassificationStrategy(Protocol):
    provider: str
    model_name: str
    prompt_version: str

    async def classify(self, request: ClassificationRequest) -> ModelRecommendation: ...


class GeminiClassifier:
    provider = "gemini"

    def __init__(self, settings: Settings, client: genai.Client | None = None) -> None:
        self.model_name = settings.gemini_classification_model
        self.prompt_version = settings.classification_prompt_version
        self._timeout_seconds = settings.request_timeout_seconds
        self._client = client or genai.Client(api_key=settings.gemini_api_key)

    async def classify(self, request: ClassificationRequest) -> ModelRecommendation:
        try:
            async with asyncio.timeout(self._timeout_seconds):
                response = await self._client.aio.models.generate_content(
                    model=self.model_name,
                    contents=build_classification_prompt(request),
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_json_schema=ModelRecommendation.model_json_schema(),
                        temperature=0.1,
                    ),
                )
        except TimeoutError as error:
            raise ClassificationError(504, "AI_PROVIDER_TIMEOUT", "The classification provider timed out.") from error
        except errors.ClientError as error:
            status = int(getattr(error, "code", 502) or 502)
            if status == 429:
                raise ClassificationError(503, "AI_PROVIDER_RATE_LIMITED", "The classification provider is temporarily rate limited.") from error
            raise ClassificationError(502, "AI_PROVIDER_REJECTED_REQUEST", "The classification provider rejected the request.") from error
        except errors.APIError as error:
            raise ClassificationError(502, "AI_PROVIDER_ERROR", "The classification provider could not complete the request.") from error
        except Exception as error:
            raise ClassificationError(502, "AI_PROVIDER_UNAVAILABLE", "The classification provider is unavailable.") from error

        try:
            if isinstance(response.parsed, ModelRecommendation):
                return response.parsed
            if isinstance(response.parsed, dict):
                return ModelRecommendation.model_validate(response.parsed)
            return ModelRecommendation.model_validate_json(response.text or "")
        except (ValidationError, ValueError) as error:
            raise ClassificationError(502, "AI_INVALID_RESPONSE", "The classification provider returned an invalid response.") from error


class ClassificationService:
    def __init__(self, strategy: ClassificationStrategy) -> None:
        self._strategy = strategy

    async def classify(self, request: ClassificationRequest) -> ClassificationRecommendation:
        result = await self._strategy.classify(request)
        choices = {choice.id: choice for choice in request.categories}
        category = choices.get(result.recommended_category_id)
        if category is None:
            raise ClassificationError(
                422,
                "AI_UNSUPPORTED_CATEGORY",
                "The provider recommendation was not one of the supplied active categories.",
            )
        return ClassificationRecommendation(
            recommended_category_id=category.id,
            recommended_category_name=category.name,
            explanation=result.explanation,
            confidence_estimate=result.confidence_estimate,
            confidence_is_calibrated=False,
            is_ambiguous=result.is_ambiguous,
            requires_clarification=result.requires_clarification,
            clarification_question=result.clarification_question,
            provider=self._strategy.provider,
            model_name=self._strategy.model_name,
            prompt_version=self._strategy.prompt_version,
            sanitized_response=result.model_dump(mode="json"),
        )


def create_classification_service(settings: Settings) -> ClassificationService:
    if settings.classifier_provider != "gemini":
        raise ClassificationError(500, "AI_PROVIDER_UNSUPPORTED", "The configured classifier provider is unsupported.")
    if not settings.provider_configured:
        raise ClassificationError(503, "AI_PROVIDER_NOT_CONFIGURED", "The classification provider is not configured.")
    return ClassificationService(GeminiClassifier(settings))
