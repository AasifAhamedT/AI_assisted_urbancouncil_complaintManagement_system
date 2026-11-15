# AI Classification Service

FastAPI and Pydantic service for advisory Gemini complaint-category recommendations. It accepts only backend-supplied active categories, validates structured output, and never selects a Department or makes the final administrative decision.

```powershell
cd services\ai-classifier
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8001
```

Set `GEMINI_API_KEY` and `GEMINI_CLASSIFICATION_MODEL` only in the ignored local `.env`. Do not commit or send the key through the public API, frontend, Postman collection, or chat.

