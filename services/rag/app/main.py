from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.errors import RagError
from app.models import DocumentListResponse, DocumentResponse, QueryRequest, QueryResponse
from app.request_context import RequestContextMiddleware
from app.service import RagService, create_rag_service

settings = get_settings()

app = FastAPI(
    title="Smart Urban Council RAG Service",
    version="0.2.0",
)
app.add_middleware(RequestContextMiddleware)


@lru_cache
def get_rag_service() -> RagService:
    return create_rag_service(get_settings())


@app.exception_handler(RagError)
async def rag_error_handler(request: Request, error: RagError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"error": {
        "code": error.code,
        "message": error.message,
        "requestId": getattr(request.state, "request_id", "unknown"),
    }})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": {
        "code": "VALIDATION_ERROR",
        "message": "The knowledge request is invalid.",
        "requestId": getattr(request.state, "request_id", "unknown"),
        "details": [{
            "field": ".".join(str(part) for part in issue["loc"] if part not in {"body", "query"}),
            "message": issue["msg"],
        } for issue in error.errors()],
    }})


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


@app.get("/v1/documents", response_model=DocumentListResponse, tags=["Knowledge"])
def list_documents(service: Annotated[RagService, Depends(get_rag_service)]) -> DocumentListResponse:
    return DocumentListResponse(documents=service.list_documents())


async def ingest_upload(
    *, document_id: str | None, title: str, actor_user_id: str,
    version_note: str | None, file: UploadFile, service: RagService, configuration: Settings,
) -> DocumentResponse:
    content = await file.read(configuration.max_document_bytes + 1)
    return DocumentResponse(document=await service.ingest(
        document_id=document_id,
        title=title,
        actor_user_id=actor_user_id,
        original_filename=file.filename or "",
        media_type=(file.content_type or "").casefold(),
        content=content,
        version_note=version_note,
    ))


@app.post("/v1/documents", response_model=DocumentResponse, status_code=201, tags=["Knowledge"])
async def create_document(
    title: Annotated[str, Form(min_length=3, max_length=200)],
    actor_user_id: Annotated[str, Form(min_length=36, max_length=36)],
    file: Annotated[UploadFile, File()],
    service: Annotated[RagService, Depends(get_rag_service)],
    configuration: Annotated[Settings, Depends(get_settings)],
    version_note: Annotated[str | None, Form(max_length=500)] = None,
) -> DocumentResponse:
    return await ingest_upload(document_id=None, title=title, actor_user_id=actor_user_id,
        version_note=version_note, file=file, service=service, configuration=configuration)


@app.post("/v1/documents/{document_id}/versions", response_model=DocumentResponse, status_code=201, tags=["Knowledge"])
async def create_document_version(
    document_id: str,
    title: Annotated[str, Form(min_length=3, max_length=200)],
    actor_user_id: Annotated[str, Form(min_length=36, max_length=36)],
    file: Annotated[UploadFile, File()],
    service: Annotated[RagService, Depends(get_rag_service)],
    configuration: Annotated[Settings, Depends(get_settings)],
    version_note: Annotated[str | None, Form(max_length=500)] = None,
) -> DocumentResponse:
    return await ingest_upload(document_id=document_id, title=title, actor_user_id=actor_user_id,
        version_note=version_note, file=file, service=service, configuration=configuration)


@app.post("/v1/documents/{document_id}/deactivate", response_model=DocumentResponse, tags=["Knowledge"])
def deactivate_document(
    document_id: str,
    service: Annotated[RagService, Depends(get_rag_service)],
) -> DocumentResponse:
    return DocumentResponse(document=service.deactivate(document_id))


@app.post("/v1/query", response_model=QueryResponse, tags=["Knowledge"])
async def query_knowledge(
    payload: QueryRequest,
    service: Annotated[RagService, Depends(get_rag_service)],
) -> QueryResponse:
    return await service.query(payload.question)

