# ClaimsOS – System Patterns

## Architecture Overview

ClaimsOS is a monorepo with two applications:
- `apps/api/` – FastAPI Python backend
- `apps/web/` – React + Vite + TypeScript frontend

The backend follows a **domain-driven, service-layer architecture** where each domain has its own models, services, and repository. There are no separate microservices — all "agents" are internal backend modules.

## Backend Architecture

### Entry Point
`apps/api/app/main.py` – FastAPI app with CORS middleware, mounts all routers under `/api` prefix.

### Router Layer (`apps/api/app/api/v1/routes/`)
| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| `health.py` | `/api/health` | GET health check |
| `claims.py` | `/api/claims` | GET list, GET by ID, POST process, POST upload-x12, POST upload-x12-batch, POST intake-document, POST {id}/review |
| `policies.py` | `/api/policies` | GET list, POST upload, GET metrics |
| `providers.py` | `/api/providers` | GET list, POST create |
| `members.py` | `/api/members` | GET list, GET by ID |
| `agent.py` | `/api/agent` | POST chat |

### Domain Layer (`apps/api/app/domain/`)

#### Claims Domain
- **`models.py`** – All Pydantic models: `ClaimSubmission`, `ValidationResult`, `AdjudicationDecision`, `ClaimProcessingResponse`, `ClaimDocumentDraft`, `ClaimDocumentIntakeResponse`, etc.
- **`intake_service.py`** – `IntakeService.normalize_claim()` – strips/normalizes all fields, deduplicates procedure codes, resolves provider identity hierarchy
- **`validation_service.py`** – `ValidationService.validate()` – checks: missing claim ID, amount guardrail, claim type/form type, CPT/ICD pairing, provider eligibility (ZZ prefix = fail), prior auth presence, referral presence (HMO plans), frequency code reference, required modifiers
- **`policy_retrieval_service.py`** – Re-exports from `policies/retrieval_service.py`
- **`adjudication_service.py`** – `AdjudicationService.adjudicate()` – runs `_evaluate_checks()` which produces passed/failed/review check lists; determines outcome (approve/deny/review); also `build_utilization_context()` for prior auth and elevated utilization detection
- **`confidence_service.py`** – `ConfidenceService.score()` – penalty-based scoring: approve path starts at 0.9, review path at 0.7, denial path at 0.5 with issue penalties
- **`payer_verification_service.py`** – Builds `PayerVerificationContext` with mocked eligibility, prior auth, referral, and pricing checks
- **`document_intake_service.py`** – `ClaimDocumentIntakeService` – uses OpenAI GPT-4o-mini to extract `ClaimDocumentDraft` from PDF/image/DOCX/text; supports `auto_process` flag to immediately adjudicate
- **`x12_parser.py`** – `X12ProfessionalClaimParser` – parses raw X12 837P EDI text into `ClaimSubmission`; handles multi-claim batches
- **`repository.py`** – `ClaimsRepository` – persists to Supabase; handles upsert, audit trail, review queue, insights computation (policy match, duplication risk, network parity)
- **`demo_data.py`** – Returns a hardcoded demo claim for the `/claims/demo` endpoint

#### Policies Domain
- **`ingestion_service.py`** – Extracts text from PDF/DOCX/text, chunks it, stores in Supabase `policy_documents` + `policy_chunks` tables; optionally uploads to OpenAI vector store
- **`retrieval_service.py`** – `PolicyRetrievalService.retrieve()` – tries OpenAI vector store first (if configured), falls back to keyword-based chunk scoring against pgvector, falls back to hardcoded fallback policies
- **`openai_retrieval_service.py`** – Wraps OpenAI file search API for vector store retrieval
- **`repository.py`** – `PoliciesRepository` – CRUD for policy documents and chunks

#### Providers Domain
- **`models.py`** – `Tenant`, `ProviderRecord`, `ProviderCreateRequest`
- **`repository.py`** – `ProvidersRepository` – `ensure_tenant()` (upsert by payer name), `ensure_provider_for_tenant()` (upsert by provider key), `list_providers()`, `get_provider_by_id()`

#### Members Domain
- **`models.py`** – `MemberRecord`, `MemberListItem`, `MemberDetailResponse`, `ClinicalHotspot`, `ActiveDiagnosis`, `SurgicalHistoryItem`, `PolicyAlignmentItem`
- **`repository.py`** – `MembersRepository` – CRUD for members

#### Agent Domain
- **`service.py`** – `AgentChatService.answer()` – gathers context (claim, member, provider, policy matches, aggregate stats, review queue), calls OpenAI GPT-4o-mini with structured system prompt, falls back to deterministic text replies if OpenAI unavailable
- **`models.py`** – `AgentChatContext`, `AgentChatResponse`, `AgentClaimLink`

### Integration Layer (`apps/api/app/integrations/`)
- **`supabase.py`** – `get_supabase_client()` with retry wrapper `execute_with_retry()`
- **`openai_client.py`** – `get_openai_client()` singleton

### Configuration (`apps/api/app/core/config.py`)
- `Settings` (pydantic-settings): `human_review_threshold=0.72`, `openai_claim_intake_model="gpt-4o-mini"`, `openai_embedding_model="text-embedding-3-large"`

## Claim Processing Pipeline (Detailed)

```
POST /api/claims/process
    → _run_claim_processing()
        1. IntakeService.normalize_claim()
        2. ValidationService.validate()
        3. PolicyRetrievalService.retrieve()
        4. ProvidersRepository.ensure_tenant() + ensure_provider_for_tenant()
        5. ClaimsRepository._build_provider_context()
        6. PayerVerificationService.build()
        7. AdjudicationService.adjudicate()
        8. ConfidenceService.score()
        9. requires_human_review = score < 0.72 OR outcome == "review"
        10. ClaimsRepository.create_processed_claim()
            → upsert claims table
            → insert claim_validation_results
            → insert adjudication_results
            → insert audit_logs (5 events)
            → upsert human_review_queue (if review needed)
        → return ClaimProcessingResponse
```

## Adjudication Check Categories

Checks are categorized by `source`:
- `validation` – claim type, form type, diagnosis/procedure alignment, eligibility, member eligibility
- `provider` – network status, contract status, credential status, plan participation, referral acceptance, facility affiliation, specialty alignment
- `policy` – policy evidence strength (relevance score threshold)
- `integrity` – straight-through guardrails (amount ≤ $250, POS=11, single line), pricing alignment
- `utilization` – prior auth screen, utilization review screen, referral verification

## Confidence Scoring Logic

| Path | Base Score | Adjustments |
|------|-----------|-------------|
| Approve (no review triggers) | 0.90 | +0.01 per cited policy (max +0.03), +0.005 per passed check (max +0.04) |
| Approve (with review triggers) | 0.78 | fixed |
| Review | 0.70 | -0.04 per review trigger (max -0.12), -0.03 per failed check (max -0.08) |
| Denial/invalid | 0.50 | penalty per issue code, -0.045 per failed check, -0.02 per review trigger |

Human review threshold: **0.72** (configurable via `HUMAN_REVIEW_THRESHOLD` env var)

## Database Schema (Supabase Postgres)

### Core Tables
| Table | Purpose |
|-------|---------|
| `tenants` | Payer/TPA tenant records |
| `providers` | Tenant-scoped provider records |
| `claims` | Canonical claim records (upserted on `claim_id`) |
| `claim_validation_results` | Validation output per claim |
| `adjudication_results` | Adjudication outcome per claim |
| `audit_logs` | Event trail (5 events per claim processing) |
| `human_review_queue` | Claims flagged for manual review |
| `members` | Member eligibility records |
| `policy_documents` | Uploaded policy document metadata |
| `policy_chunks` | Chunked policy text with keyword tokens |

### Migration Files
- `001_initial_claimsos.sql` – Core claims tables
- `002_tenant_provider_foundation.sql` – Tenants + providers
- `003_policy_ingestion_foundation.sql` – Policy documents + chunks
- `004_openai_vector_store_foundation.sql` – OpenAI vector store metadata
- `005_detailed_claim_phase1.sql` – Extended claim fields (billing/rendering/referring provider, prior auth, referral, modifiers, etc.)
- `006_members_foundation.sql` – Members table

## Frontend Architecture

### State Management
Single `App.tsx` component holds all application state (no Redux/Zustand). State is passed down as props to page components. All API calls are made from `App.tsx` handlers.

### Routing
Client-side view switching via `activeView` state variable (type `ViewId`). No React Router — views are conditionally rendered.

### Feature Structure
```
src/features/
├── adjudication/    # AdjudicationPage – full claim detail
├── agent/           # AgentChatWidget – always-on chat overlay
├── auth/            # LoginPage
├── claims/          # ClaimsHubPage – filterable claims list
├── intake/          # IntakePolicyPage – claim upload/intake
├── knowledge/       # KnowledgeStudioPage – policy RAG explorer
├── members/         # MembersPage
├── overview/        # OverviewPage – dashboard
├── policy/          # PolicyManagerPage
├── providers/       # ProvidersPage
└── reports/         # ReportsPage
```

### API Layer (`src/shared/api/`)
- `claims.ts` – All claims API calls
- `policies.ts` – Policy upload/list/metrics
- `providers.ts` – Provider CRUD
- `members.ts` – Member list/detail
- `agent.ts` – Agent chat

### Layout
`AppShell` component wraps all views with sidebar navigation.

## Key Design Patterns

1. **Upsert on claim_id** – Claims are upserted (not inserted) so re-processing the same claim ID updates the record
2. **Fallback chain for policy retrieval** – OpenAI vector store → pgvector keyword scoring → hardcoded fallback policies
3. **Provider auto-provisioning** – `ensure_tenant()` and `ensure_provider_for_tenant()` create records on first encounter
4. **Deterministic + LLM hybrid** – Adjudication uses deterministic rule checks; LLM is used only for document intake and agent chat
5. **Graceful degradation** – All OpenAI-dependent features check `settings.has_openai` and fall back gracefully
6. **Audit trail always written** – 5 audit events are always written per claim processing regardless of outcome
