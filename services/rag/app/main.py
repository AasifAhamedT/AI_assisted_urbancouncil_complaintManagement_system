from fastapi import FastAPI

from app.config import get_settings
from app.request_context import RequestContextMiddleware

settings = get_settings()

app = FastAPI(
    title="Smart Urban Council RAG Service",
    version="0.1.0",
)
app.add_middleware(RequestContextMiddleware)


@app.get("/health", tags=["Operations"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.get("/ready", tags=["Operations"])
def readiness() -> dict[str, str | bool]:
    return {
        "status": "ready" if settings.provider_configured else "configuration_required",
        "service": settings.service_name,
        "provider_configured": settings.provider_configured,
    }

