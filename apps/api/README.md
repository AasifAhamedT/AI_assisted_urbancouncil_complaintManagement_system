# Public API

Node.js, Express, and TypeScript public API with authentication, department configuration, and complaint-management modules.

Copy `.env.example` to `.env`, replace every `change-me` value, and run from the repository root:

```powershell
npm install
npm run dev:api
```

Health check: `GET http://localhost:4000/health`.

Phase 6 authentication endpoints are documented in [`../../docs/api/authentication-api.md`](../../docs/api/authentication-api.md). Public registration creates Citizens only; Department Accounts and Administrators are never created by the registration endpoint.

Department administration is documented in [`../../docs/api/department-management-api.md`](../../docs/api/department-management-api.md). Complaint submission, scoped processing, search, status history, and attachment contracts are documented in [`../../docs/api/complaint-management-api.md`](../../docs/api/complaint-management-api.md).

The versioned gateway boundary, structured error contract, request correlation, and internal service readiness checks are documented in [`../../docs/api/api-gateway-integration.md`](../../docs/api/api-gateway-integration.md).

GIS location storage, authorized markers, bounding boxes, and nearby search are documented in [`../../docs/api/gis-api.md`](../../docs/api/gis-api.md).

AI recommendation storage and Administrator review are documented in [`../../docs/api/ai-classification-api.md`](../../docs/api/ai-classification-api.md).

Department reassignment requests, Administrator decisions, isolation rules, and transaction behavior are documented in [`../../docs/api/reassignment-api.md`](../../docs/api/reassignment-api.md).

Recipient-scoped in-app notifications, unread actions, preferences, event integration, and duplicate/failure handling are documented in [`../../docs/api/notification-api.md`](../../docs/api/notification-api.md).

Administrator-only knowledge ingestion/version management and Citizen grounded queries are documented in [`../../docs/api/knowledge-rag-api.md`](../../docs/api/knowledge-rag-api.md).

