from fastapi.testclient import TestClient

from app.errors import RagError
from app.main import app, get_rag_service
from app.models import QueryResponse

client = TestClient(app)


def test_health_returns_service_identity() -> None:
    response = client.get("/health", headers={"x-request-id": "rag-health-test"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "rag"}
    assert response.headers["x-request-id"] == "rag-health-test"


def test_readiness_exposes_configuration_state_without_secrets() -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json()["service"] == "rag"
    assert "gemini_api_key" not in response.text


class UnconfiguredRagService:
    async def query(self, question: str) -> QueryResponse:
        raise RagError(503, "RAG_PROVIDER_NOT_CONFIGURED", "The knowledge provider is not configured.")


def test_query_requires_provider_configuration() -> None:
    app.dependency_overrides[get_rag_service] = lambda: UnconfiguredRagService()
    try:
        response = client.post(
            "/v1/query",
            json={"question": "What is the documented procedure?"},
            headers={"x-request-id": "rag-query-test"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "RAG_PROVIDER_NOT_CONFIGURED",
        "message": "The knowledge provider is not configured.",
        "requestId": "rag-query-test",
    }

