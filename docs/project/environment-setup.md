# Development Environment Setup

## Status

Phase 5 dependencies are installed and the automated type, build, lint, dependency, and health-test checks pass. Live API database readiness still requires a local least-privilege MySQL account and private `.env` configuration.

## Prerequisites

- Node.js 24 and npm 11 (already detected).
- Standard Windows Python 3.12.10 is installed. The existing `py` launcher does not currently discover it, so the project virtual environments are the reliable entry points.
- MySQL Server 8.0 (installed and migrations applied).
- MySQL Workbench (installed).
- Docker Desktop may remain deferred until the infrastructure phase.

## 1. Install standard Python

Python 3.12.10 was installed from python.org using Windows Package Manager. Verify the service environments directly:

```powershell
services\ai-classifier\.venv\Scripts\python.exe --version
services\rag\.venv\Scripts\python.exe --version
```

## 2. Create a least-privilege MySQL application account

`[MANUAL ACTION REQUIRED]`

Do not place the MySQL administrator password in this repository. Create a dedicated development account in Workbench only after reviewing the exact user and grant statements. It needs application privileges on the six development databases but no global administration privileges.

Until this account exists, the API readiness check will report unavailable database connections.

## 3. Configure local environments

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
Copy-Item services\ai-classifier\.env.example services\ai-classifier\.env
Copy-Item services\rag\.env.example services\rag\.env
```

In `apps/api/.env`, replace the MySQL credentials and both JWT placeholders. Use two different random JWT secrets containing at least 32 characters. Never paste those secrets into chat or commit any `.env` file.

Gemini keys and model names intentionally remain unconfigured until the AI phase confirms the provider project and supported models.

## 4. Install and verify TypeScript applications

From the repository root:

```powershell
npm install
npm run typecheck
npm run build
```

Start in separate terminals:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

Verify:

- `http://localhost:4000/health` — API process liveness.
- `http://localhost:4000/ready` — all six database connections.
- `http://localhost:5173` — web shell.

## 5. Install and verify Python services

For each service, use standard Python 3.12 to create its own `.venv`, then follow the commands in that service's README.

Verify:

- `http://localhost:8001/health`
- `http://localhost:8001/ready`
- `http://localhost:8002/health`
- `http://localhost:8002/ready`

The Python readiness endpoints report `configuration_required` until Gemini settings are supplied. That is expected in Phase 5.

## 6. Secret protection

Before committing:

```powershell
git status --short
git check-ignore -v apps/api/.env
git check-ignore -v apps/web/.env
git check-ignore -v services/ai-classifier/.env
git check-ignore -v services/rag/.env
```

Real `.env` files must be ignored. `.env.example` files remain tracked and contain placeholders only.

