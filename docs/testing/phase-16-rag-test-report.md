# Phase 16 RAG Test Report

Status: implementation and automated checks complete; private Gemini configuration and live role/browser verification pending.

## Automated coverage

- Express query schema accepts only a bounded question and rejects extra private-complaint fields.
- Administrator upload metadata is strict and bounded.
- Upload validation rejects executable types and mismatched filename/media/signature combinations.
- The authenticated actor ID, not a client-supplied identity, is forwarded for document audit.
- Unauthenticated document management returns `401`.
- FastAPI ingestion records a ready version, checksum, chunk count, current version, and active state.
- Deactivation removes the document from vector retrieval and marks it inactive without deleting audit history.
- Weak retrieval support returns the fixed abstention.
- Valid grounded output returns source/version/location citations.
- Invented model citation IDs are rejected and converted to abstention.
- Missing provider configuration returns a structured `503` without exposing secrets.
- Ruff and strict mypy pass for the RAG service.

## Live verification remaining

After configuring the private RAG Gemini values:

1. Start FastAPI on port 8002, Express on 4000, and React on 5173.
2. Confirm Administrator integration status reports RAG reachable and configured.
3. Ingest a clearly labelled academic verification document with no personal or official-policy claims.
4. Verify the Administrator sees version 1, `READY`, checksum, chunk count, and active state.
5. Ask one supported Citizen question and verify citation title/version/location.
6. Ask one unsupported question and verify explicit abstention with no citations.
7. Verify Department Account query and document-management requests return `403`.
8. Upload a new version and verify earlier content is no longer returned.
9. Deactivate the document and verify it no longer supports new answers.
10. Verify desktop/mobile layout and browser console output.
