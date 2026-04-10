# ClaimsOS – Tech Context

## Technology Stack

### Backend
| Technology | Version/Notes | Purpose |
|-----------|--------------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | Latest | Web framework, async HTTP |
| Pydantic v2 | pydantic-settings | Schema validation, settings management |
| Supabase Python client | Latest | Database + storage client |
| OpenAI Python SDK | Latest | GPT-4o-mini for intake + agent chat; text-embedding-3-large for embeddings |
| uvicorn | Latest | ASGI server |

### Frontend
| Technology | Version/Notes | Purpose |
|-----------|--------------|---------|
| React 18 | TypeScript | UI framework |
| Vite | Latest | Build tool, dev server |
| TypeScript | Latest | Type safety |
| Tailwind CSS | Latest | Utility-first styling |
| PostCSS | Latest | CSS processing |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Supabase Postgres | Primary database (claims, members, providers, policies, audit logs) |
| Supabase Storage | Policy document file storage |
| pgvector | Vector embeddings for policy RAG (fallback when OpenAI vector store not configured) |
| OpenAI Vector Store | Primary RAG backend (per-tenant vector stores) |

## Development Setup

### Backend
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install .
uvicorn app.main:app --reload
# API runs on http://localhost:8000
```

### Frontend
```bash
cd apps/web
npm install
npm run dev
# App runs on http://localhost:5173
```

### Environment Variables

**Backend** (`apps/api/.env`):
```
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # optional, for backend persistence
OPENAI_API_KEY=<key>
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_CLAIM_INTAKE_MODEL=gpt-4o-mini
OPENAI_VECTOR_STORE_PREFIX=claimsos-policies
HUMAN_REVIEW_THRESHOLD=0.72
```

**Frontend** (`apps/web/.env.local`):
```
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Package Structure

### Backend (`apps/api/pyproject.toml`)
The backend is packaged as `claimsos-backend` with `pip install .`

### Frontend (`apps/web/package.json`)
Standard Vite + React + TypeScript project with Tailwind.

## API Communication
- Frontend talks **only** to FastAPI backend (no direct Supabase calls from frontend for claims processing)
- CORS configured for `localhost:5173`, `localhost:5174`, `localhost:4173`
- All API routes prefixed with `/api`

## AI/ML Configuration

### OpenAI Models Used
- **`gpt-4o-mini`** – Claim document intake (OCR extraction) + Agent chat
- **`text-embedding-3-large`** – Policy document embeddings (when using pgvector path)

### RAG Architecture
Two-tier policy retrieval:
1. **OpenAI Vector Store** (primary) – Per-tenant vector stores created during policy ingestion; searched via OpenAI file search API
2. **pgvector keyword scoring** (fallback) – Keyword token overlap scoring against `policy_chunks` table
3. **Hardcoded fallback policies** (last resort) – 3 generic policies always returned if no indexed policies found

### Vector Store Naming
`{OPENAI_VECTOR_STORE_PREFIX}-{tenant_key}` (e.g., `claimsos-policies-apex-health-plan`)

## Database Migrations
SQL migration files in `infra/supabase/` — applied manually to Supabase project. No Alembic yet (planned for future).

## Testing
Test files in `apps/api/tests/`:
- `test_claims_api.py` – Claims processing tests
- `test_x12_claims_api.py` – X12 parser tests
- `test_agent_api.py` – Agent chat tests
- `test_members_api.py` – Members API tests
- `test_policies_api.py` – Policies API tests
- `test_providers_api.py` – Providers API tests
- `test_sample_scenario_pack.py` – End-to-end scenario tests
- `conftest.py` – Shared fixtures

## Build Verification
```bash
cd apps/web && npm run build  # TypeScript compile + Vite bundle
```

## Technical Constraints

1. **No Redis** – Not used in MVP; all processing is synchronous request-response
2. **No background jobs** – All claim processing happens inline in the HTTP request
3. **No real PHI** – Only synthetic data; no HIPAA compliance implemented yet
4. **Single-region** – No multi-region deployment considerations yet
5. **Supabase anon key** – Frontend currently uses anon key; service-role key recommended for backend persistence
6. **OpenAI dependency** – Document intake and agent chat require `OPENAI_API_KEY`; system degrades gracefully without it

## Sample Data

### Claims
- `sample_data/claims/apex_bulk_realistic_5_claims.x12` – 5-claim X12 batch
- `sample_data/claims/internal_json/advanced/` – 6 advanced JSON claim scenarios

### Policies
- `sample_data/policies/` – 8 Apex Health Plan policy documents (Markdown format)
- `sample_data/policies/format_variants/` – Same policies in DOCX and PDF formats

### Providers
- `sample_data/providers/apex_provider_seed_pack.json` – Provider seed data

### OCR Documents
- `sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.*` – Hero OCR scenario (orthopedic claim)
  - `.md` – Scenario brief
  - `.pdf` / `.png` – Source document
  - `.expected-draft.json` – Expected AI extraction output
  - `.expected-outcome.md` – Expected adjudication path
