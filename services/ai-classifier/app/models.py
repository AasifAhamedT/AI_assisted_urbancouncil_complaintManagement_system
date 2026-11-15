from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class CategoryChoice(ApiModel):
    id: str = Field(min_length=36, max_length=36)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=1000)


class ClassificationRequest(ApiModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=20, max_length=20_000)
    categories: list[CategoryChoice] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def choices_are_unique(self) -> ClassificationRequest:
        ids = [choice.id for choice in self.categories]
        names = [choice.name.casefold() for choice in self.categories]
        if len(ids) != len(set(ids)) or len(names) != len(set(names)):
            raise ValueError("Category identifiers and names must be unique.")
        return self


class ModelRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommended_category_id: str = Field(min_length=36, max_length=36)
    explanation: str = Field(min_length=10, max_length=1000)
    confidence_estimate: float | None = Field(default=None, ge=0, le=1)
    is_ambiguous: bool
    requires_clarification: bool
    clarification_question: str | None = Field(default=None, min_length=5, max_length=500)

    @model_validator(mode="after")
    def clarification_is_consistent(self) -> ModelRecommendation:
        if self.requires_clarification and not self.clarification_question:
            raise ValueError("A clarification question is required when clarification is requested.")
        if not self.requires_clarification and self.clarification_question is not None:
            raise ValueError("A clarification question is allowed only when clarification is requested.")
        return self


class ClassificationRecommendation(ApiModel):
    recommended_category_id: str
    recommended_category_name: str
    explanation: str
    confidence_estimate: float | None
    confidence_is_calibrated: bool = False
    is_ambiguous: bool
    requires_clarification: bool
    clarification_question: str | None
    provider: str
    model_name: str
    prompt_version: str
    sanitized_response: dict[str, object]


class ClassificationResponse(ApiModel):
    recommendation: ClassificationRecommendation
