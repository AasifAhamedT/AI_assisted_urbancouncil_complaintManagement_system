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
| `/future` | Clearly labelled interfaces awaiting later secured phases. |

## Citizen interface

- Registration and login.
- Dashboard and owned complaint list.
- Complaint submission with approved active category choices and optional map selection.
- Edit while `SUBMITTED` using optimistic versioning.
- Complaint details and status history.
- Validated attachment upload/list/download.
- Future placeholders: notifications (Phase 15) and RAG chatbot (Phase 16).

## Department Account interface

- Login and assigned-workload dashboard.
- Department-scoped list and details.
- Central-policy status transitions and reasons.
- Attachment and history viewing.
- Department-scoped complaint marker map and filters.
- Future placeholders: internal actions, information requests and reassignment (Phase 14), notifications (Phase 15), and reports (Phase 17).

## Administrator interface

- System-wide complaint monitoring.
- Department and category creation.
- Category-to-department routing.
- Department Account creation and activation status.
- Internal AI/RAG readiness monitoring.
- System-wide authorized complaint marker map and filters.
- Human review of original AI recommendations, documented overrides, and backend-controlled routing.
- Future placeholders: reassignment (Phase 14), notifications (Phase 15), RAG documents (Phase 16), and analytics (Phase 17).

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
- The project is labelled as an academic prototype and is not presented as an officially deployed Council service.
