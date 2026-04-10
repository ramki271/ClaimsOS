# ClaimsOS – Progress

## What Works (Fully Implemented)

### Backend Services
- **Claim Intake & Normalization** – `IntakeService.normalize_claim()` normalizes all fields, resolves provider identity hierarchy, deduplicates procedure codes
- **Validation** – `ValidationService.validate()` checks 8+ rule categories: claim ID, amount guardrail ($1000), claim type/form type, CPT/ICD pairing (8 supported pairs), provider eligibility (ZZ prefix), prior auth presence, referral presence (HMO), frequency code reference, required modifiers
- **Policy Retrieval (RAG)** – `PolicyRetrievalService.retrieve()` with 3-tier fallback: OpenAI vector store → pgvector keyword scoring → hardcoded fallback
- **Provider Context** – Full `ProviderAdjudicationContext` with specialty/taxonomy matching, network status, contract status, credential status, plan participation, facility affiliations, referral acceptance
- **Payer Verification** – `PayerVerificationService` builds mocked eligibility, prior auth, referral, and pricing contexts
- **Adjudication** – `AdjudicationService.adjudicate()` with 15+ deterministic checks across 5 categories (validation, provider, policy, integrity, utilization); produces approve/deny/review outcome
- **Confidence Scoring** – `ConfidenceService.score()` with penalty-based scoring; human review threshold at 0.72
- **X12 837P Parser** – Full single + batch parsing of X12 EDI files
- **AI Document Intake** – OpenAI GPT-4o-mini extracts `ClaimDocumentDraft` from PDF/image/DOCX/text with `auto_process` support
- **Policy Ingestion** – Text extraction, chunking, Supabase storage, optional OpenAI vector store upload
- **Agent Chat** – `AgentChatService` with OpenAI + deterministic fallback; answers questions about claims, members, providers, policies, stats, review queue
- **Human Review Queue** – Claims flagged at confidence < 0.72 or outcome = "review"; supports reviewer override
- **Audit Trail** – 5 events per claim: received, validation completed, policy retrieval completed, adjudication completed, claim processed
- **Insights** – Policy match score, duplication risk (checks same member/provider/DOS), network parity
- **Multi-tenant** – `ensure_tenant()` auto-provisions payer tenants; providers are tenant-scoped

### Frontend Pages
- **Login** – Simple auth gate
- **Dashboard (Overview)** – Aggregate stats + recent claims
- **Claims Hub** – Filterable/paginated claims list with outcome and review status
- **Adjudication Detail** – Full claim processing result: validation issues, policy matches, provider context, utilization context, payer verification, passed/failed/review checks, audit trail, insights cards, human review panel
- **Intake** – JSON editor, X12 single/batch upload, AI document intake with draft review
- **Policy Manager** – Upload policies, view ingestion metrics, open Knowledge Studio
- **Knowledge Studio** – Policy RAG exploration
- **Members** – Member list + detail with clinical enrichment (hotspots, diagnoses, surgical history, policy alignment)
- **Providers** – Provider list + create form
- **Reports** – Claims analytics
- **Agent Chat Widget** – Always-on floating chat overlay, context-aware (passes active view + claim ID)

### Database
- All 6 migrations applied
- Tables: tenants, providers, claims, claim_validation_results, adjudication_results, audit_logs, human_review_queue, members, policy_documents, policy_chunks

### Sample Data
- 8 Apex Health Plan policy documents (Markdown + DOCX + PDF variants)
- 5-claim X12 batch file
- 6 advanced JSON claim scenarios
- Provider seed pack
- OCR hero scenario: `APX-OCR-HERO-ORTHO-3001` (orthopedic claim with missing prior auth)

## What's Left to Build

### High Priority (from handoff.md)
- [ ] **AI Document Intake UI Redesign** – Transform `IntakePolicyPage.tsx` into a document-intelligence workstation:
  - Side-by-side layout: document preview (left) + extracted draft (right)
  - Visual callouts for missing fields, low-confidence fields, review notes
  - Missing prior auth callout for the orthopedic scenario
  - Readiness-to-process indicator
  - Support `APX-OCR-HERO-ORTHO-3001` scenario end-to-end in the UI

### Medium Priority (from detail-claim-plan.md)
- [ ] **Expanded Claim Scenarios** – JSON + X12 scenarios for:
  - Specialist visit missing referral
  - Surgery missing prior auth
  - Modifier required but missing
  - Rendering provider specialty mismatch
  - Billed over allowed amount
  - Corrected/replacement claim
  - Multi-line mixed outcome claim
  - Documentation required
- [ ] **Line-level adjudication outcomes** – Per-service-line approve/deny/review
- [ ] **Expanded policy corpus** – Prior auth, referral, modifier, specialty, site-of-care, frequency, pricing, documentation policies

### Lower Priority / Future
- [ ] Alembic database migrations (currently manual SQL)
- [ ] Redis for background job queues and caching
- [ ] Role-based access control
- [ ] Event-driven architecture (Kafka)
- [ ] Real-time X12 integrations
- [ ] Advanced agents: denial prediction, appeals, fraud detection
- [ ] Global provider master with cross-payer deduplication
- [ ] HIPAA compliance / real PHI handling
- [ ] Multi-region deployment

## Current Status

**Overall: MVP Complete, Enhancement Phase**

The core claims processing pipeline is fully functional end-to-end. The system can:
1. Accept claims via JSON, X12 EDI, or scanned documents
2. Validate, retrieve policies, adjudicate, and score confidence
3. Persist results with full audit trail
4. Flag low-confidence claims for human review
5. Answer natural-language questions via the agent chat

The next development focus is improving the AI document intake UI to feel like a professional OCR review workstation (per `handoff.md`).

## Known Issues

1. **Provider auto-provisioning creates minimal records** – `ensure_provider_for_tenant()` creates providers with only name and key; specialty/taxonomy/network details must be seeded separately
2. **Validation CPT/ICD pairs are hardcoded** – Only 8 pairs supported; real-world would need a full code set
3. **Payer verification is fully mocked** – No real eligibility/prior auth/referral/pricing integrations
4. **Policy retrieval keyword scoring is basic** – Token overlap scoring; no semantic similarity without OpenAI vector store
5. **No pagination on agent context queries** – Agent fetches up to 500 claims and 100 members/providers for context
6. **Frontend has no error boundary** – API errors are console.error'd but not shown to users in most cases
