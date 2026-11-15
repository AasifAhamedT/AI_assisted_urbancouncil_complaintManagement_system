# API Gateway and Service Integration

## Public boundary

The React application calls only the versioned Express API at `/api/v1`. MySQL, Gemini, ChromaDB, the AI Classification Service, and the RAG Service are never called directly by the browser.

`GET /api/v1` returns the gateway identity and active API version. `GET /health` reports process liveness. `GET /ready` reports only the six required MySQL connections; optional AI or RAG unavailability does not make core complaint management unready.

## Request pipeline

Public requests pass through this sequence:

1. Security and CORS headers.
2. JSON or route-specific binary body limits.
3. A validated or generated `X-Request-ID`.
4. Route-specific schema validation.
5. Access-token authentication.
6. Role authorization.
7. Resource-level Citizen ownership or Department scoping.
8. Thin controller and domain service.
9. Consistent response or structured error handling.

## Error contract

Errors returned by the gateway use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe client-facing message.",
    "requestId": "correlation-id",
    "details": []
  }
}
```

`details` appears only for safe validation information. Database credentials, provider keys, stack traces, internal URLs, tokens, and private service errors are not returned.

Common status meanings:

- `400` invalid request or schema.
- `401` missing, invalid, expired, or revoked authentication.
- `403` authenticated actor lacks the required role.
- `404` route or scoped resource unavailable; this avoids cross-owner disclosure.
- `409` duplicate, stale version, or invalid state transition.
- `413` configured body-size limit exceeded.
- `415` attachment media mismatch.
- `500` unexpected gateway failure with a safe message.

## Internal service health contract

The gateway calls each Python service's `GET /ready` endpoint with `Accept: application/json` and the gateway `X-Request-ID`. The response contract is:

```json
{
  "status": "ready | configuration_required",
  "service": "ai-classifier | rag",
  "provider_configured": false
}
```

The gateway validates the status and exact service identity. Calls use `INTEGRATION_TIMEOUT_MS` (default 2000 ms). Timeouts, connection failures, invalid JSON/contracts, and non-success HTTP responses are converted to bounded status objects without leaking raw errors.

## Administrator integration status

`GET /api/v1/system/integrations`

Header:

```text
Authorization: Bearer <administrator-access-token>
```

Expected: `200 OK` with one item per internal Python service. Overall states:

- `ready`: all providers configured and services ready.
- `configuration_required`: both services are reachable but at least one provider is not configured.
- `degraded`: at least one service is unreachable or returns an invalid contract.

Citizen and Department Account tokens receive `403`; unauthenticated requests receive `401`. This status route does not expose internal base URLs or provider credentials.

## Phase boundaries

Phase 9 establishes the communication and security boundary only. Gemini classification behavior remains Phase 12, while document ingestion and chatbot behavior remain Phase 16. The frontend must not call future Python feature endpoints directly.
