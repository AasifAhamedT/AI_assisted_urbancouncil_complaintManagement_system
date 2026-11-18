# Frontend Application

The Phase 10 frontend is a responsive React, Vite, and strict TypeScript single-page application. It calls only the Express gateway configured by `VITE_API_BASE_URL`; it never calls MySQL, Gemini, ChromaDB, or the Python services directly.

Local URL: `http://localhost:5173`

## Session behavior

- Login uses `POST /api/v1/auth/login`.
- Access and rotating refresh tokens are kept in browser `sessionStorage`, not permanent `localStorage`.
- A protected request receiving `401` attempts one refresh and retries once.
- Failed refresh clears the session and returns the user to login.
- Logout revokes the refresh token through the API and clears the browser session.
- Navigation is role-aware, but backend authorization remains the security control.

## Shared routes

| Route | Purpose |
|---|---|
| `/login` | Three-role login. |
| `/register` | Citizen-only public registration. |
| `/dashboard` | Role-specific authorized overview. |
| `/complaints` | Backend-scoped complaint register with search, status filtering, and pagination. |
| `/complaints/:id` | Scoped detail, history, evidence, GIS location, and permitted actions. |
| `/map` | Department/Administrator authorized complaint marker map. |
| `/admin/classifications` | Administrator-only AI recommendation review and override queue. |
| `/reassignments` | Department request ledger and Administrator decision queue. |
| `/notifications` | Private notification history, unread actions, and in-app preference for every role. |
| `/knowledge` | Citizen-only grounded public-information chatbot with citations and abstention. |
| `/admin/knowledge` | Administrator-only approved-document ingestion, version history, and deactivation. |
| `/reports` | Department-scoped or Administrator system-wide operational reports with date and data filters. |
| `/future` | Clearly labelled interfaces awaiting later secured phases. |

## Citizen interface

- Registration and login.
- Dashboard and owned complaint list.
- Complaint submission with approved active category choices and optional map selection.
- Edit while `SUBMITTED` using optimistic versioning.
- Complaint details and status history.
- Validated attachment upload/list/download.
- Private complaint notification history with unread badge and read/preference controls.
- Grounded public-information chatbot with authorized-document citations and explicit abstention.

## Department Account interface

- Login and assigned-workload dashboard.
- Department-scoped list and details.
- Central-policy status transitions and reasons.
- Attachment and history viewing.
- Department-scoped complaint marker map and filters.
- Reassignment requests from currently assigned complaint details, plus a department-scoped request ledger.
- Private assignment/reassignment notification history with unread badge and read/preference controls.
- Department-scoped reports with visible period, current workload outcomes, category/status trends, processing duration, and reassignment activity.

## Administrator interface

- System-wide complaint monitoring.
- Department and category creation.
- Category-to-department routing.
- Department Account creation and activation status.
- Internal AI/RAG readiness monitoring.
- Authorized knowledge-document ingestion, version history, activation state, and re-indexing through new versions.
- System-wide authorized complaint marker map and filters.
- Human review of original AI recommendations, documented overrides, and backend-controlled routing.
- Reassignment approval/rejection with active target selection and an immutable decision reason.
- Private reassignment-request notification history with unread badge and read/preference controls.
- System-wide or department-filtered reports with status/category/department distributions, event trends, processing duration, and reassignment activity.

## Accessibility and responsive behavior

- Every form control has a visible or screen-reader label.
- Keyboard focus is visible.
- Semantic headings, navigation, status messages, lists, and buttons are used.
- Desktop sidebar becomes an accessible mobile drawer below 820 px.
- List, metric, form, and detail layouts collapse for small screens.
- English is the current interface language; Sinhala and Tamil remain `[NEEDS CONFIRMATION]`.

## Security notes

- The UI never accepts a client-supplied role or Department identity as authority.
- Future controls are disabled until backend policies exist.
- Uploaded evidence retains the backend scan state.
- The knowledge chatbot sends only the Citizen's bounded public-information question; it has no complaint-record interface.
- The project is labelled as an academic prototype and is not presented as an officially deployed Council service.
