from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_service_identity() -> None:
    response = client.get("/health", headers={"x-request-id": "ai-health-test"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-classifier"}
    assert response.headers["x-request-id"] == "ai-health-test"


def test_readiness_exposes_configuration_state_without_secrets() -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json()["service"] == "ai-classifier"
    assert "gemini_api_key" not in response.text

