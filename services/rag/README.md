# RAG Service

FastAPI authorized-document retrieval service for Phase 16. It validates and extracts PDF, DOCX, and UTF-8 text documents, creates Gemini embeddings, stores active chunks in ChromaDB, generates grounded answers, validates citations, and abstains when support is insufficient.

The service does not connect to any complaint database. The Express gateway is the authenticated public boundary: Citizens query approved content, while only Administrators manage document versions and activation state.

```powershell
cd services\rag
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8002
```

Before starting the service, configure `GEMINI_API_KEY`, `GEMINI_GENERATION_MODEL`, and `GEMINI_EMBEDDING_MODEL` in the private `.env`. Runtime vectors and authorized document files are excluded from Git.

Quality checks:

```powershell
.\.venv\Scripts\ruff.exe check app tests
.\.venv\Scripts\mypy.exe app
.\.venv\Scripts\pytest.exe -q
```

