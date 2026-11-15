from fastapi.testclient import TestClient

from app.main import app

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


def test_query_requires_provider_configuration() -> None:
    response = client.post(
        "/v1/query",
        json={"question": "What is the documented procedure?"},
        headers={"x-request-id": "rag-query-test"},
    )

    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "RAG_PROVIDER_NOT_CONFIGURED",
        "message": "The knowledge provider is not configured.",
        "requestId": "rag-query-test",
    }

