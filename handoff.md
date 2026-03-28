# Backend Handoff

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
  - `POST /api/policies/upload`
- Policy upload now:
  - resolves payer tenant from `payer_name`
  - stores raw document metadata in `policy_documents`
  - extracts text for supported text-like formats
  - chunks content into retrieval-sized blocks
  - stores chunk tokens and metadata in `policy_chunks`
- Claim adjudication now uses stored policy chunks when available:
  - retrieval is tenant-aware
  - relevance is scored heuristically from claim codes and chunk keywords
  - falls back to static demo policies if no indexed docs exist yet

### Tests
- Updated [test_claims_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_claims_api.py)
- Added [test_x12_claims_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_x12_claims_api.py)
- Added [test_providers_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_providers_api.py)
- Added [test_policies_api.py](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/api/tests/test_policies_api.py)
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

## Verification
- Backend tests pass:
  - `cd apps/api && ./.venv/bin/python -m pytest -q`
  - Result: `14 passed`

## UI Follow-Ups For Claude

### Available Now
- Claims list page can call:
  - `GET /api/claims?limit=20&offset=0`
  - `GET /api/claims?outcome=approve`
  - `GET /api/claims?requires_review=true`
- Claim detail page can use richer payload from:
  - `GET /api/claims/{claim_id}`
- Manual review / override can call:
  - `POST /api/claims/{claim_id}/review`
- X12 claim upload can call:
  - `POST /api/claims/upload-x12`
  - multipart form key: `file`
- Provider / tenant domain shape is now documented and scaffolded for follow-on API work
- Providers API is available now:
  - `GET /api/providers?tenant_key=apex-health-plan`
  - `POST /api/providers`
- Policies API is available now:
  - `GET /api/policies?tenant_key=apex-health-plan`
  - `POST /api/policies/upload`

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
- Add upload error handling for parser failures:
  - backend returns `400` with a human-readable parser message in `detail`
- Wire Intake / Policy Manager to real policy ingestion:
  - upload `.txt`, `.md`, `.x12`, `.edi`, `.json`, `.xml`
  - call `POST /api/policies/upload`
  - send `payer_name`
  - optionally send `classification`
- Replace hardcoded repository rows in the policy screen with:
  - `GET /api/policies?tenant_key=<tenant>`
- Update adjudication detail policy cards to treat backend matches as real retrieval results:
  - title
  - summary
  - relevance score
- Surface that retrieval is currently grounded by indexed chunks, not just demo copy
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
- embeddings / pgvector similarity search
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

## Important Notes
- Reviewer name / notes are currently captured in audit events and response flow, not in dedicated review table columns.
- If Claude wants first-class reviewer metadata in `human_review_queue`, that will need a follow-up SQL migration.
- Current X12 parser is intentionally MVP-scoped:
  - one professional claim at a time
  - common `837P` segments only
  - not a full X12 compliance parser
- `002_tenant_provider_foundation.sql` has been applied to Supabase in this pass.
- `003_policy_ingestion_foundation.sql` has also been applied to Supabase in this pass.
- Existing claim APIs continue to work because the new tenant/provider foreign keys were introduced as nullable foundation columns.
- Current policy ingestion is intentionally MVP-scoped:
  - supports text-like files only
  - does not parse PDFs yet
  - uses heuristic retrieval rather than embeddings
  - does not use an LLM yet
