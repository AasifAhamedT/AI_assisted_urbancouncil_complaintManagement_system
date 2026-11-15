# AI Classification API

Public Administrator base path: `/api/v1/admin/classifications`

All public endpoints require an active Administrator Bearer token. Citizens and Department Accounts receive `403`. The internal Python endpoint is bound locally and is called only by the Node API.

## Review queue

`GET /?page=1&pageSize=20`

Returns complaints where `classificationReviewRequired` is true and the latest immutable recommendation or failure record. Expected: `200 OK`.

## Review detail

`GET /:complaintId`

Returns the complaint, latest recommendation, and immutable human-review history. Expected: `200 OK`; unknown identifier: `404`.

## Process again

`POST /:complaintId/retry`

Sends only the complaint title, description, and current active categories to the internal AI service. Every attempt creates a separate recommendation record. Expected: `200 OK`, including when the attempt is stored as a safe failure fallback.

## Approve or override

`POST /:complaintId/review`

```json
{
  "categoryId": "active-category-uuid",
  "version": 1,
  "reason": "Required for an override or manual decision"
}
```

Behavior:

- selecting the latest valid recommendation records `APPROVED`;
- selecting another active category records `OVERRIDDEN` and requires a reason;
- deciding after a failed/invalid attempt records `MANUAL` and requires a reason;
- routing uses only the active backend category mapping;
- a missing mapping returns `409 CATEGORY_MAPPING_REQUIRED`;
- stale versions return `409 COMPLAINT_VERSION_CONFLICT`.

Expected successful response: `200 OK` with the updated complaint, preserved recommendation, and review ledger.

## Internal classification endpoint

`POST http://127.0.0.1:8001/v1/classify`

The request contains complaint text plus active category IDs, names, and definitions. Pydantic rejects malformed or duplicate choices. Safe errors include provider-not-configured, timeout, rate limit, provider error, invalid response, and unsupported category.

The API key must never be sent through Postman, the public API, or the frontend.
