from fastapi.testclient import TestClient

from app.classifier import ClassificationService
from app.main import app, get_classification_service
from app.models import ClassificationRequest, ModelRecommendation

CATEGORY_ID = "40000000-0000-4000-8000-000000000001"


class FakeStrategy:
    provider = "test-provider"
    model_name = "test-model"
    prompt_version = "test-prompt-v1"

    def __init__(self, category_id: str = CATEGORY_ID) -> None:
        self.category_id = category_id

    async def classify(self, _request: ClassificationRequest) -> ModelRecommendation:
        return ModelRecommendation(
            recommended_category_id=self.category_id,
            explanation="The complaint text describes uncollected solid waste.",
            confidence_estimate=0.82,
            is_ambiguous=False,
            requires_clarification=False,
            clarification_question=None,
        )


def request_body() -> dict[str, object]:
    return {
        "title": "Uncollected household waste",
        "description": "Waste has not been collected from this street for several days.",
        "categories": [
            {
                "id": CATEGORY_ID,
                "name": "Solid Waste Management",
                "description": "Waste collection and disposal concerns.",
            }
        ],
    }


def test_classification_returns_validated_allowed_category() -> None:
    app.dependency_overrides[get_classification_service] = lambda: ClassificationService(
        FakeStrategy()
    )
    try:
        response = TestClient(app).post(
            "/v1/classify",
            json=request_body(),
            headers={"x-request-id": "classification-test"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    recommendation = response.json()["recommendation"]
    assert recommendation["recommendedCategoryId"] == CATEGORY_ID
    assert recommendation["recommendedCategoryName"] == "Solid Waste Management"
    assert recommendation["confidenceIsCalibrated"] is False
    assert response.headers["x-request-id"] == "classification-test"


def test_service_rejects_provider_category_outside_allow_list() -> None:
    app.dependency_overrides[get_classification_service] = lambda: ClassificationService(
        FakeStrategy("90000000-0000-4000-8000-000000000009")
    )
    try:
        response = TestClient(app).post("/v1/classify", json=request_body())
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "AI_UNSUPPORTED_CATEGORY"


def test_request_rejects_duplicate_category_choices() -> None:
    body = request_body()
    body["categories"] = [body["categories"][0], body["categories"][0]]  # type: ignore[index]
    app.dependency_overrides[get_classification_service] = lambda: ClassificationService(
        FakeStrategy()
    )
    try:
        response = TestClient(app).post("/v1/classify", json=body)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
