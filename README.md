# ClaimsOS

ClaimsOS is an AI-native claims adjudication MVP focused on simple outpatient claims.

This repo is scaffolded as a lightweight monorepo:

- `apps/api/` FastAPI application for claim intake, validation, policy retrieval hooks, adjudication, and confidence scoring
- `apps/web/` React + Vite + TypeScript + Tailwind application for the operator-facing workspace

## Quick Start

### Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install .
uvicorn app.main:app --reload
```

The API starts on `http://localhost:8000`.

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

The app starts on `http://localhost:5173`.

## Supabase

Local Supabase environment files are scaffolded in:

- `apps/api/.env`
- `apps/web/.env.local`

Right now the repo is wired with the project URL and anon key so we can start integration work. For secure backend-side persistence, we should switch the API app to a Supabase service-role key once you share it.

## Initial API Routes

- `GET /api/health`
- `POST /api/claims/process`
- `GET /api/claims/demo`
- `POST /api/policies/upload`

## MVP Notes

- Claim processing is deterministic in the first scaffold and returns explainable outputs.
- Policy retrieval is currently stubbed so we can layer in Supabase Storage and pgvector next.
- The UI is a polished starter shell focused on the three core surfaces: overview, intake, and adjudication detail.
