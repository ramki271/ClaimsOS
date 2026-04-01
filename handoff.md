# Backend Handoff

## Latest Focus For Claude

The newest backend slice is now **Members foundation**. Please focus the next UI pass on Members before circling back to older polish tasks.

### Members APIs Ready Now
- `GET /api/members?tenant_key=<tenant_key>`
- `GET /api/members/{member_id}`

Frontend shared types/helpers are ready in [members.ts](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/web/src/shared/api/members.ts).

### What To Build
- Add a `Members` screen backed by the live API.
- Show a list/table with:
  - member name
  - member id
  - subscriber id
  - plan name
  - eligibility status
  - DOB
  - active claim count
  - last claim id
- Add a detail view/panel/page with:
  - demographics
  - payer / plan details
  - PCP details
  - referral-required and prior-auth-required flags
  - risk flags
  - coverage notes
  - recent claim ids

### Important Context
- This first Members slice is intentionally seeded / mock-backed for demo speed.
- There are at least 5 realistic mock members already available from the backend.
- Read-only list + detail is the priority for this pass.
- Keep the page visually aligned with Claims Hub / Providers.

## Completed Backend Changes

### Claims API
- Hardened [claims.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/api/v1/routes/claims.py)
- `GET /api/claims` now supports:
  - `limit`
  - `offset`
  - `outcome`
  - `requires_review`
- Added `POST /api/claims/{claim_id}/review`
- Added `POST /api/claims/upload-x12`
- Claim processing now auto-links claims to a payer tenant and tenant-scoped provider record when possible

### Repository / Persistence
- Expanded [repository.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/claims/repository.py)
- `create_processed_claim(...)` now writes a fuller audit sequence:
  - `claim_received`
  - `validation_completed`
  - `policy_retrieval_completed`
  - `adjudication_completed`
  - `claim_processed`
- `list_claims(...)` now supports filtering and offset pagination
- `get_claim(...)` now returns:
  - latest validation
  - latest adjudication
  - review state if present
  - audit trail
- `submit_review(...)` now:
  - updates claim outcome/review state
  - writes a manual review audit event
  - inserts a new adjudication result row when an override outcome is supplied

### API Models
- Expanded [models.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/claims/models.py)
- Added:
  - `AuditEvent`
  - `HumanReviewState`
  - `ClaimReviewRequest`
- `ClaimProcessingResponse` now includes:
  - `review_state`
  - `audit_trail`
- `ClaimRecordSummary` now includes:
  - `review_status`

### X12 837 Ingestion
- Added [x12_parser.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/claims/x12_parser.py)
- First-pass support is for a simplified professional `837P` transaction
- The parser maps raw X12 into the existing canonical `ClaimSubmission` model:
  - `CLM` -> claim id, billed amount, place of service
  - `NM1*IL` -> member/subscriber
  - `NM1*QC` -> patient id fallback
  - `NM1*82` / `NM1*85` -> provider
  - `NM1*PR` -> payer
  - `SBR` -> plan name
  - `HI` -> diagnosis codes
  - `LX/SV1/DTP` -> service lines and date of service
- Upload path feeds the same downstream processing pipeline as JSON claims:
  - normalize
  - validate
  - retrieve policies
  - adjudicate
  - score confidence
  - persist

### Tenant / Provider Foundation
- MVP direction is now explicitly:
  - payers / TPAs are the tenant boundary
  - providers are tenant-scoped records inside each payer tenant
- Added schema foundation in [002_tenant_provider_foundation.sql](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/infra/supabase/002_tenant_provider_foundation.sql)
- Added provider domain models in [models.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/providers/models.py)
- Added provider repository in [repository.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/providers/repository.py)
- Added provider routes in [providers.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/api/v1/routes/providers.py)
- New schema foundation includes:
  - `tenants`
  - `payer_organizations`
  - `providers`
  - nullable `tenant_id` on `claims`
  - nullable `provider_record_id` on `claims`

### Policy Ingestion / Retrieval Foundation
- Added schema foundation in [003_policy_ingestion_foundation.sql](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/infra/supabase/003_policy_ingestion_foundation.sql)
- Added policy domain models in [models.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/policies/models.py)
- Added policy repository in [repository.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/policies/repository.py)
- Added policy ingestion service in [ingestion_service.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/policies/ingestion_service.py)
- Added retrieval service in [retrieval_service.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/policies/retrieval_service.py)
- Replaced the policies route stub in [policies.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/api/v1/routes/policies.py)
- New schema foundation includes:
  - `policy_documents`
  - `policy_chunks`
- New live policy APIs:
  - `GET /api/policies`
  - `GET /api/policies/metrics`
  - `POST /api/policies/upload`
- Policy upload now:
  - resolves payer tenant from `payer_name`
  - stores raw document metadata in `policy_documents`
  - extracts text for supported text-like formats
  - extracts text from `.pdf` uploads
  - extracts text from `.docx` uploads
  - chunks content into retrieval-sized blocks
  - stores chunk tokens and metadata in `policy_chunks`
  - records `ingestion_latency_ms` in document metadata
- Claim adjudication now uses stored policy chunks when available:
  - retrieval is tenant-aware
  - relevance is scored heuristically from claim codes and chunk keywords
  - falls back to static demo policies if no indexed docs exist yet

### OpenAI Hosted RAG Path
- Added OpenAI client integration in [openai_client.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/integrations/openai_client.py)
- Added hosted retrieval helper in [openai_retrieval_service.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/app/domain/policies/openai_retrieval_service.py)
- Added tenant metadata foundation in [004_openai_vector_store_foundation.sql](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/infra/supabase/004_openai_vector_store_foundation.sql)
- Policy upload now supports two retrieval paths:
  - local chunk storage remains the default fallback
  - if `OPENAI_API_KEY` is configured, the backend also:
    - creates or reuses one OpenAI vector store per payer tenant
    - uploads the raw policy document into that tenant vector store
    - stores hosted retrieval metadata in tenant/document metadata
- Claim retrieval now prefers OpenAI vector store search when:
  - `OPENAI_API_KEY` is configured
  - the tenant has an `openai_vector_store_id`
- If hosted retrieval is unavailable or errors, the backend falls back to local chunk retrieval automatically
- Current OpenAI path uses:
  - OpenAI-hosted chunking
  - OpenAI embeddings
  - OpenAI vector store search
  - local deterministic adjudication still remains the decision authority

### Tests
- Updated [test_claims_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_claims_api.py)
- Added [test_x12_claims_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_x12_claims_api.py)
- Added [test_providers_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_providers_api.py)
- Added [test_policies_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_policies_api.py)
- Added [test_members_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_members_api.py)
- Current coverage verifies:
  - healthcheck
  - claim processing
  - claims list
  - review override flow
  - review filter behavior
  - X12 parser mapping
  - X12 multipart upload processing
  - invalid X12 rejection
  - provider creation
  - provider listing/filtering
  - policy upload
  - policy document listing
  - unsupported policy file rejection
  - PDF policy upload and extraction
  - DOCX policy upload and extraction

## Verification
- Backend tests pass:
  - `cd apps/api && ./.venv/bin/python -m pytest -q`
  - Result: `27 passed`
- Supabase migration applied:
  - [004_openai_vector_store_foundation.sql](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/infra/supabase/004_openai_vector_store_foundation.sql)

## Completed / Backend Ready

These backend-backed areas are now available and should be treated as complete from the API side:
- claims list/detail/review flows
- X12 single-claim upload
- provider foundation
- members foundation
- policy upload/list APIs
- OpenAI-hosted semantic retrieval path
- claim detail `review_state`
- claim detail `audit_trail`
- claim detail `matched_policies`

Newly completed in this pass:
- claim detail now includes `insights`
  - `policy_match`
  - `duplication_risk`
  - `network_parity`
- those three cards are now available from backend logic and should no longer be computed in the UI
- policy metrics are now available from backend logic and should no longer be mocked in Policy Manager
  - `GET /api/policies/metrics?tenant_key=<tenant>`
- claim detail `decision` now includes structured explainability fields:
  - `passed_checks`
  - `failed_checks`
  - `review_triggers`
- `decision.rationale` is now grounded in deterministic checks plus retrieved policy evidence rather than a single hardcoded outcome sentence
- policy matches now include cleaner documentation metadata:
  - `document_label`
  - `source_reference`
- hosted retrieval now uses a readable policy/document key as the primary `policy_id` instead of exposing raw OpenAI file ids
- provider/contract realism is now available in backend claim detail:
  - `provider_context`
  - `network_status`
  - `contract_status`
  - `contract_tier`
  - `network_effective_date`
  - `network_end_date`
  - `participates_in_plan`
  - `specialty_match`
  - `specialty_match_reason`
- adjudication checks now incorporate provider contract context:
  - provider network status
  - contract status
  - plan participation
  - specialty alignment
- utilization / prior-authorization context is now available in backend claim detail:
  - `utilization_context`
  - `utilization_level`
  - `prior_auth_required`
  - `prior_auth_status`
  - `trigger_codes`
  - `review_reason`
  - `notes`
- adjudication checks now incorporate utilization context:
  - prior authorization screen
  - elevated utilization review screen
- bulk X12 batch processing is now available on the backend:
  - `POST /api/claims/upload-x12-batch`
  - one inbound X12 file can contain multiple `CLM` claim groupings
  - the backend splits those into multiple canonical claims
  - each claim is processed independently through the existing pipeline
  - the batch response returns:
    - `total_claims`
    - `processed_claims`
    - `failed_claims`
    - `results[]`
    - each `results[]` item includes:
      - `claim_id`
      - `status`
      - `result`
      - `error`
- the existing single-claim endpoint remains:
  - `POST /api/claims/upload-x12`
  - it now rejects payloads containing more than one claim
- policy upload now supports richer document formats through the same endpoint:
  - `POST /api/policies/upload`
  - `.txt`
  - `.md`
  - `.pdf`
  - `.docx`
  - existing text-like formats remain supported
- AI claim document intake is now available on the backend:
  - `POST /api/claims/intake-document`
  - accepts:
    - `.pdf`
    - `.docx`
    - `.txt`
    - `.md`
    - `.png`
    - `.jpg`
    - `.jpeg`
    - `.webp`
  - returns:
    - extracted `claim_draft`
    - `ready_for_processing`
    - `missing_fields`
    - `review_notes`
    - `low_confidence_fields`
    - optional `processed_result` when `auto_process=true` and the draft is complete
- the new AI intake path uses OpenAI to:
  - extract claim data from image or document input
  - normalize it into a canonical reviewable draft
  - optionally hand the completed draft into the same adjudication pipeline as JSON/X12 claims
- members foundation is now available on the backend:
  - `GET /api/members`
  - `GET /api/members/{member_id}`
  - seeded realistic member detail data is available for demo use
  - member detail includes:
    - demographics
    - payer / plan context
    - PCP details
    - referral / prior auth flags
    - risk flags
    - recent claim ids
    - coverage notes

## Latest Focus For Claude

Claude should focus on the new AI document-intake UX first. This is now the highest-priority UI task for the hackathon story.

Primary task 1:
- add a new intake path for claim documents that produces a reviewable prefilled draft

New API now available:
- `POST /api/claims/intake-document`
- multipart form fields:
  - `file`
  - `auto_process`
  - optional `payer_name_hint`

Response shape now available:
- `status`
  - `drafted`
  - `processed`
- `source_type`
- `extraction_summary`
- `claim_draft`
- `ready_for_processing`
- `missing_fields`
- `review_notes`
- `low_confidence_fields`
- `processed_result`

Recommended UI mapping:
- in Intake, add a new mode like:
  - `Claim Document`
  - or `AI Intake`
- allow uploading:
  - PDF
  - DOCX
  - image files
- first call the endpoint with `auto_process=false`
- show the extracted `claim_draft` in a reviewable form
- visibly highlight:
  - `missing_fields`
  - `low_confidence_fields`
  - `review_notes`
- if the draft is complete, show a CTA to continue into adjudication
- when the user confirms, call the same endpoint with `auto_process=true` or submit the reviewed draft through the existing claim flow
- if the backend returns `processed_result`, navigate into the normal claim detail/adjudication view

Primary task 2:
- make the draft-review UX feel human-in-the-loop rather than black-box OCR

Recommended UI mapping:
- show the source document name and source type
- present extracted fields in a form-like layout
- mark low-confidence fields inline
- show extraction summary at the top
- if fields are missing, keep the CTA as:
  - `Review & Complete Draft`
  - not `Process Claim`

Primary task 3:
- keep the Policy Manager PDF/DOCX upload polish work as secondary follow-up

Recommended UI mapping:
- update upload helper copy / dropzone text so users can see `.pdf` and `.docx` are supported
- refresh ledger/metrics/recent uploads after success
- show friendly extraction failures for unreadable docs

Primary task 4:
- surface backend `utilization_context` in the adjudication/detail UI

New fields now available:
- `result.utilization_context.utilization_level`
- `result.utilization_context.prior_auth_required`
- `result.utilization_context.prior_auth_status`
- `result.utilization_context.trigger_codes`
- `result.utilization_context.review_reason`
- `result.utilization_context.notes`

Recommended UI mapping:
- add a compact utilization / prior-auth block in adjudication detail
- show:
  - utilization level
  - prior auth required yes/no
  - prior auth status
  - trigger codes when present
  - 1-2 supporting notes
- if `prior_auth_required` is true, surface that prominently near the decision summary / review explanation
- use `review_reason` as the lead sentence instead of inventing frontend copy

Primary task 3:
- surface backend `provider_context` in the adjudication/detail UI and, where useful, in the Providers screen

New fields now available:
- `result.provider_context.network_status`
- `result.provider_context.contract_status`
- `result.provider_context.contract_tier`
- `result.provider_context.network_effective_date`
- `result.provider_context.network_end_date`
- `result.provider_context.participates_in_plan`
- `result.provider_context.specialty_match`
- `result.provider_context.specialty_match_reason`

Recommended UI mapping:
- add a compact provider contract/context block in adjudication detail
- show:
  - network status
  - contract tier
  - contract status
  - plan participation
  - specialty alignment
- if `network_end_date` or `network_effective_date` exist, show them as coverage window / effective period
- use `specialty_match_reason` as the supporting sentence rather than inventing frontend copy

Primary task 4:
- use the richer backend `decision` payload from `GET /api/claims/{claim_id}` instead of fallback UI copy

New fields now available:
- `result.decision.passed_checks`
- `result.decision.failed_checks`
- `result.decision.review_triggers`

Recommended UI mapping:
- `AI Reasoning`
  - render `result.decision.rationale`
  - optionally surface 2-4 bullets from `passed_checks` / `failed_checks`
- `Validation`
  - show real validation issues plus failed decision checks instead of a generic summary row
- `Manual review / review-required explanation`
  - bind to `result.decision.review_triggers`
- `Documentation`
  - prefer `matched_policies[].document_label` or `matched_policies[].title`
  - only fall back to `source_reference` when there is no friendly label

Primary task 5:
- keep the three adjudication summary cards bound to backend `insights`

Map the cards as:
- `Policy Match` -> `result.insights.policy_match`
- `Duplication Risk` -> `result.insights.duplication_risk`
- `Network Parity` -> `result.insights.network_parity`

Do not invent frontend-only logic for these anymore.

Primary task 6:
- replace the Policy Manager ingestion metrics placeholders with the backend metrics payload from `GET /api/policies/metrics?tenant_key=<tenant>`

Suggested mapping:
- `Total Throughput` -> `summary.documents_indexed_24h`
- `Latency (Avg)` -> `summary.avg_ingestion_latency_ms`
- `Success Rate` -> `summary.success_rate`
- `Queue Depth` -> `summary.queue_depth`
- bar chart -> `trend`
- repository health counts -> `summary.total_documents`, `summary.total_chunks`
- recent upload activity -> `recent_uploads`

Do not preserve the old fake ingestion metrics once this is wired.

## UI Follow-Ups For Claude

### Available Now
- Claims list page can call:
  - `GET /api/claims?limit=20&offset=0`
  - `GET /api/claims?outcome=approve`
  - `GET /api/claims?requires_review=true`
- Claim detail page can use richer payload from:
  - `GET /api/claims/{claim_id}`
  - includes `insights`
- Manual review / override can call:
  - `POST /api/claims/{claim_id}/review`
- X12 claim upload can call:
  - `POST /api/claims/upload-x12`
  - multipart form key: `file`
- AI claim document intake can call:
  - `POST /api/claims/intake-document`
  - multipart form keys:
    - `file`
    - `auto_process`
    - optional `payer_name_hint`
- Provider / tenant domain shape is now documented and scaffolded for follow-on API work
- Providers API is available now:
  - `GET /api/providers?tenant_key=apex-health-plan`
  - `POST /api/providers`
- Policies API is available now:
  - `GET /api/policies?tenant_key=apex-health-plan`
  - `GET /api/policies/metrics?tenant_key=apex-health-plan`
  - `POST /api/policies/upload`
- Policy upload responses now include richer document metadata that may contain:
  - `retrieval_backend`
  - `openai_ingestion_status`
  - `openai_file_id`
  - tenant-level hosted vector store state is stored server-side

Example request body:
```json
{
  "reviewer_name": "Dr. Aris Thorne",
  "reviewer_notes": "Eligibility manually confirmed and override approved.",
  "review_status": "resolved",
  "override_outcome": "approve"
}
```

Example upload request:
```bash
curl -X POST http://localhost:8000/api/claims/upload-x12 \
  -F "file=@sample-837p.txt"
```

Example AI intake request:
```bash
curl -X POST http://localhost:8000/api/claims/intake-document \
  -F "file=@claim-photo.png" \
  -F "auto_process=false" \
  -F "payer_name_hint=Apex Health Plan"
```

Example provider create request:
```json
{
  "tenant_key": "apex-health-plan",
  "provider_key": "prv-4092",
  "name": "Front Range Family Medicine",
  "npi": "1299304491",
  "specialty": "Family Medicine",
  "network_status": "in_network"
}
```

Example policy upload request:
```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CORE" \
  -F "file=@office-visit-policy.txt"
```

### UI Should Accommodate
- Update frontend claim detail types to read:
  - `review_state`
  - `audit_trail`
  - `insights`
  - `provider_context`
  - `decision.passed_checks`
  - `decision.failed_checks`
  - `decision.review_triggers`
  - `matched_policies[].document_label`
  - `matched_policies[].source_reference`
- Add Claims Hub filters using:
  - `outcome`
  - `requires_review`
  - `limit`
  - `offset`
- Add manual review actions on adjudication detail:
  - resolve review
  - override approve
  - override deny
- Surface audit trail from backend instead of hardcoded timeline data
- Add an X12 upload entry point in the intake screen:
  - file picker / drag-drop for `.txt`, `.x12`, `.edi`
  - multipart upload to `POST /api/claims/upload-x12`
  - reuse the existing transition to adjudication detail after success
- Add an AI claim document intake entry point in the intake screen:
  - file picker / drag-drop for `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.webp`
  - multipart upload to `POST /api/claims/intake-document`
  - first show the extracted draft
  - then let the user continue into adjudication when ready
- Update frontend shared claim API types to read:
  - `ClaimDocumentDraft`
  - `LowConfidenceField`
  - `ClaimDocumentIntakeResponse`
- Add upload error handling for parser failures:
  - backend returns `400` with a human-readable parser message in `detail`
- Wire Intake / Policy Manager to real policy ingestion:
  - upload `.txt`, `.md`, `.x12`, `.edi`, `.json`, `.xml`
  - call `POST /api/policies/upload`
  - send `payer_name`
  - optionally send `classification`
- Replace hardcoded repository rows in the policy screen with:
  - `GET /api/policies?tenant_key=<tenant>`
- Replace Policy Manager metric cards / chart / recent uploads with:
  - `GET /api/policies/metrics?tenant_key=<tenant>`
- Policy Manager UI is still demo-only today:
  - `Ingest New Policy` currently has no live upload wiring
  - the policy ledger is still hardcoded
  - Claude should wire file upload + ledger refresh + metrics next
- Update adjudication detail policy cards to treat backend matches as real retrieval results:
  - title
  - summary
  - relevance score
  - document label
  - source reference when needed
- Replace the current mock/simplified summary-card logic with backend `insights`
- Replace fallback adjudication explanation copy with backend `decision` explainability fields
- Add a provider contract/context section to adjudication detail using backend `provider_context`
- Expand the Providers screen later to show:
  - contract tier
  - contract status
  - effective dates
  - plan participation
- Surface retrieval source when useful:
  - local fallback vs OpenAI-hosted retrieval
- Surface upload/indexing state when useful:
  - local indexed
  - OpenAI indexed
  - OpenAI failed / not configured
- Update product assumptions in UI copy:
  - ClaimsOS should be framed as a platform used by payer tenants
  - providers should be treated as contextual entities under each payer tenant
- Future provider surfaces should assume tenant-scoped provider lists, not provider-as-tenant
- Claude can add a lightweight Provider Manager UI next without waiting on more backend work
- Claims submitted through JSON or X12 will now create/link tenant/provider records automatically behind the scenes

### Still Not Built Yet
- dashboard aggregate endpoints
- reports aggregate endpoints
- policy ingestion job orchestration / async queue
- structured ingestion status / progress events in the UI
- local pgvector / self-hosted semantic search path
- PDF policy extraction
- LLM-based policy synthesis or explanation layer
- reviewer identity persistence beyond audit note text
- multi-claim batching from a single X12 file
- raw `835`, `277`, or other EDI transaction support
- robust loop coverage for every 837 variant beyond first-pass professional claims
- actual provider CRUD endpoints
- tenant-aware claim scoping in live queries
- provider network and contract validation logic tied into adjudication
- provider detail/update endpoints

### Yet To Start For Claude
- wiring `provider_context` into adjudication detail
- expanding `ProvidersPage` to show the richer provider contract fields now available from backend
- wiring adjudication detail `decision.passed_checks` / `failed_checks` / `review_triggers` into the live layout
- wiring `PolicyManagerPage` upload and ledger refresh fully to live backend
- wiring `PolicyManagerPage` live metrics/trend/recent uploads to the new backend metrics endpoint
- audit trail timestamp rendering cleanup if any `—` placeholders remain after frontend mapping fixes
- optional richer presentation for document labels / citations now that friendly backend metadata is available

## Important Notes
- Reviewer name / notes are currently captured in audit events and response flow, not in dedicated review table columns.
- If Claude wants first-class reviewer metadata in `human_review_queue`, that will need a follow-up SQL migration.
- Current X12 parser is intentionally MVP-scoped:
  - one professional claim at a time
  - common `837P` segments only
  - not a full X12 compliance parser
- `002_tenant_provider_foundation.sql` has been applied to Supabase in this pass.
- `003_policy_ingestion_foundation.sql` has also been applied to Supabase in this pass.
- `004_openai_vector_store_foundation.sql` has also been applied to Supabase in this pass.
- Existing claim APIs continue to work because the new tenant/provider foreign keys were introduced as nullable foundation columns.
- Current policy ingestion is intentionally MVP-scoped:
  - supports text-like files only
  - does not parse PDFs yet
  - uses OpenAI hosted semantic retrieval only when `OPENAI_API_KEY` is configured
  - otherwise falls back to local heuristic retrieval
  - does not use an LLM for adjudication synthesis yet
- Backend env now supports:
  - `OPENAI_API_KEY`
  - `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-large`)
  - `OPENAI_VECTOR_STORE_PREFIX`
- The adjudication UI currently still contains old frontend-derived card logic.
  Claude should replace that with the backend `insights` payload rather than layering on more local heuristics.
