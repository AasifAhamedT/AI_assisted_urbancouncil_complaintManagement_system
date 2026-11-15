# Web Application

Responsive React, Vite, and strict TypeScript web client for Citizen, Department Account, and Administrator workflows. It uses the Express gateway only and keeps backend authorization authoritative.

Copy `.env.example` to `.env`, then run from the repository root:

```powershell
npm install
npm run dev:web
```

Open `http://localhost:5173`. Current routes and role capabilities are documented in [`../../docs/api/frontend-application.md`](../../docs/api/frontend-application.md).

Phase 11 adds optional Citizen map selection and Department/Administrator marker maps. OpenStreetMap tiles require an internet connection in the browser; core complaint submission remains durable if the map is unavailable.

