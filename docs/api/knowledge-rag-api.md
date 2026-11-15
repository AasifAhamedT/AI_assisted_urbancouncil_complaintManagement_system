# Knowledge and RAG API

Phase 16 exposes authorized public-information retrieval through the Express gateway. The browser never calls Gemini, ChromaDB, or FastAPI directly. The RAG service has no complaint database connection and receives no complaint identifiers or complaint content.

Base path: `/api/v1/knowledge`

## Authorization

| Operation | Citizen | Department Account | Administrator |
|---|---:|---:|---:|
| Ask a grounded question | Allowed | Denied (`403`) | Allowed for verification |
| List knowledge documents | Denied | Denied | Allowed |
| Create a document/version | Denied | Denied | Allowed |
| Deactivate a document | Denied | Denied | Allowed |

Every endpoint requires `Authorization: Bearer <access-token>`. The authenticated Administrator user ID is forwarded internally as audit metadata; actor identity is never accepted from the browser.

## Ask a grounded question

`POST /api/v1/knowledge/query`

Headers:

```text
Authorization: Bearer <access-token>
Content-Type: application/json
X-Request-ID: optional-correlation-id
```

Body:

```json
{
  "question": "Where does the approved document say applications are submitted?"
}
```

Successful grounded response (`200`):

```json
{
  "data": {
    "result": {
      "answer": "...",
      "abstained": false,
      "citations": [
        {
          "documentId": "uuid",
          "documentTitle": "Approved service guide",
          "version": 1,
          "location": "Page 2",
          "excerpt": "..."
        }
      ],
      "provider": "gemini",
      "modelName": "configured-model"
    }
  }
}
```

When retrieved context is weak, the model reports unsupported content, or a returned citation is not one of the retrieved chunks, the response remains `200` with `abstained: true`, a fixed non-invented message, and an empty citation list.

Negative cases: invalid body `400`; missing/expired authentication `401`; Department Account `403`; provider not configured/unavailable `503`; provider timeout `504`.

## List document versions

`GET /api/v1/knowledge/documents`

Administrator only. Returns each logical document, active/current version state, every ingestion attempt, checksum, chunk count, audit actor, timestamps, and bounded failure code. It does not return document file content or embeddings.

## Create an authorized document

`POST /api/v1/knowledge/documents?title=<encoded-title>&versionNote=<optional-note>`

Administrator only.

Headers:

```text
Authorization: Bearer <administrator-access-token>
Content-Type: application/pdf
X-Filename: approved-guide.pdf
```

The raw request body is the document file. Allowed combinations are:

- `.pdf` and `application/pdf` with a PDF signature;
- `.docx` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` with a valid DOCX package; or
- `.txt` and `text/plain` using UTF-8.

Maximum size is 10 MB by default. Filenames are metadata only; storage uses generated document/version paths. A successful ingestion returns `201`. Extraction, embedding, Chroma indexing, and manifest activation complete before the response.

Negative cases: invalid metadata/filename `400`; too large `413`; unsupported or mismatched type `415`; no extractable text `422`; provider unavailable/not configured `503`; timeout `504`.

## Create a new version

`POST /api/v1/knowledge/documents/:id/versions?title=<encoded-title>&versionNote=<optional-note>`

Uses the same raw upload contract. The previous active vectors remain available until the new content has been extracted and embedded. On successful indexing, the new version becomes current and old vectors are removed; the earlier version metadata and authorized file remain as audit history.

## Deactivate retrieval

`POST /api/v1/knowledge/documents/:id/deactivate`

Administrator only. This removes the document's chunks from active retrieval and records the logical document as inactive. It deliberately retains version history and stored authorized source files for traceability; it is not a destructive hard-delete endpoint.

## Reliability and privacy

- Core complaint operations do not call this module and remain available if RAG fails.
- Only active indexed chunks can be retrieved.
- Model citations are checked against the exact retrieved chunk identifiers.
- Chat history is kept only in the current React page state and is not written to the complaint databases.
- Document content, questions, credentials, and generated answers are not written to application logs.
- Council procedures, contacts, responsibilities, and policies remain `[NEEDS CONFIRMATION]` until an Administrator supplies and authorizes appropriate source documents.
