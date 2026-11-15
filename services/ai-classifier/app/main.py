from functools import lru_cache

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.classifier import ClassificationService, create_classification_service
from app.config import get_settings
from app.errors import ClassificationError
from app.models import ClassificationRequest, ClassificationResponse
from app.request_context import RequestContextMiddleware

settings = get_settings()

app = FastAPI(
    title="Smart Urban Council AI Classification Service",
    version="0.1.0",
)
app.add_middleware(RequestContextMiddleware)


@lru_cache
def get_classification_service() -> ClassificationService:
    return create_classification_service(get_settings())


@app.exception_handler(ClassificationError)
async def classification_error_handler(request: Request, error: ClassificationError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "requestId": getattr(request.state, "request_id", "unknown"),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The classification request is invalid.",
                "requestId": getattr(request.state, "request_id", "unknown"),
                "details": [
                    {
                        "field": ".".join(str(part) for part in issue["loc"] if part != "body"),
                        "message": issue["msg"],
                    }
                    for issue in error.errors()
                ],
            }
        },
    )


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


@app.post("/v1/classify", response_model=ClassificationResponse, tags=["Classification"])
async def classify_complaint(
    payload: ClassificationRequest,
    service: ClassificationService = Depends(get_classification_service),
) -> ClassificationResponse:
    return ClassificationResponse(recommendation=await service.classify(payload))

