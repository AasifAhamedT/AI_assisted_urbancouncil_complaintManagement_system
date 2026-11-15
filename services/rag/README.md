# RAG Service

FastAPI shell for the future authorized-document chatbot. Phase 9 integrates its validated readiness contract with the public API and propagates `X-Request-ID`; ingestion and chat remain Phase 16.

```powershell
cd services\rag
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8002
```

