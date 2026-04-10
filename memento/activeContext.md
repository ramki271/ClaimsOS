# ClaimsOS – Active Context

## Current Work Focus

The application is a fully functional MVP. The core claims processing pipeline is complete and working. The most recent development work (per `handoff.md`) focused on two areas:

### 1. Agent Chat Backend (COMPLETED)
The `AgentChatService` in `apps/api/app/domain/agent/service.py` is fully implemented. It:
- Gathers context from claims, members, providers, policies, aggregate stats, and review queue
- Calls OpenAI GPT-4o-mini with structured system prompt
- Falls back to deterministic text replies when OpenAI is unavailable
- Returns clean plain-text replies (no markdown)
- Supports claim links for review queue queries

### 2. AI Document Intake UI (LAST ACTIVE TASK per handoff.md)
The `handoff.md` describes the next UI task as improving the AI document intake experience to feel like a true OCR review workspace. The hero scenario is `APX-OCR-HERO-ORTHO-3001` (orthopedic claim).

**Definition of Done (from handoff.md):**
1. Intake page can visibly present the uploaded OCR document alongside the extracted draft
2. Extracted draft highlights missing fields, low-confidence fields, and review notes
3. The `APX-OCR-HERO-ORTHO-3001` scenario can be explained in the UI without outside narration
4. Intake surface continues to support existing richer claim fields
5. Page remains visually aligned with the current design system

**Key files for this task:**
- `apps/web/src/features/intake/components/IntakePolicyPage.tsx` – Current intake UI
- `apps/web/src/shared/api/claims.ts` – API types
- `sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.md` – Scenario brief
- `sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-draft.json` – Expected extraction
- `sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-outcome.md` – Expected adjudication

## Recent Changes (What Was Built)

Based on code analysis, the following are fully implemented:

### Backend (Complete)
- ✅ Full claims processing pipeline (intake → validation → policy retrieval → adjudication → confidence → persist)
- ✅ X12 837P parser (single + batch)
- ✅ AI document intake via OpenAI GPT-4o-mini
- ✅ Policy ingestion + RAG retrieval (OpenAI vector store + pgvector fallback)
- ✅ Provider context with specialty/taxonomy matching
- ✅ Payer verification (mocked eligibility, prior auth, referral, pricing)
- ✅ Confidence scoring with human review threshold (0.72)
- ✅ Human review queue with override capability
- ✅ Agent chat service with OpenAI + deterministic fallback
- ✅ Multi-tenant foundation (tenants + tenant-scoped providers)
- ✅ Member records with clinical enrichment fields
- ✅ Full audit trail (5 events per claim)
- ✅ Insights computation (policy match, duplication risk, network parity)

### Frontend (Complete)
- ✅ Authentication (login page)
- ✅ Dashboard / Overview page
- ✅ Claims Hub (filterable list)
- ✅ Adjudication Detail page
- ✅ Intake page (JSON editor, X12 upload, document intake)
- ✅ Policy Manager page
- ✅ Knowledge Studio page
- ✅ Members page
- ✅ Providers page
- ✅ Reports page
- ✅ Agent Chat Widget (always-on overlay)
- ✅ AppShell with sidebar navigation

### Database (Complete)
- ✅ 6 migration files applied
- ✅ All core tables: claims, validation results, adjudication results, audit logs, human review queue, tenants, providers, members, policy documents, policy chunks

## Active Decisions and Considerations

### Design System
- Follow "Surgical Ledger" design: `surface` (#F7F9FB) base, `secondary` (#0053DC) primary actions
- No 1px borders — use tonal surface shifts
- Manrope for headlines, Inter for data
- 4px button radius
- High-density data presentation

### Coding Conventions
- Backend: domain-driven, service-layer pattern; all services are plain Python classes (no DI framework)
- Frontend: all state in `App.tsx`, passed as props; no Redux/Zustand; no React Router
- API responses always return HTTP 200 for agent chat (graceful "I don't have enough context" on failure)
- Claims are upserted (not inserted) — re-processing same claim_id updates the record

### Known Constraints
- OpenAI API key required for document intake and agent chat
- No real PHI — synthetic data only
- No Redis — synchronous processing only
- Human review threshold is 0.72 (configurable)

## Next Steps (Pending Tasks)

### Immediate (from handoff.md)
1. **Improve AI Document Intake UI** – Transform `IntakePolicyPage.tsx` into a document-intelligence workstation:
   - Side-by-side layout: document preview (left) + extracted draft (right)
   - Highlight missing fields, low-confidence fields, review notes
   - Support the `APX-OCR-HERO-ORTHO-3001` orthopedic scenario
   - Show missing prior auth callout
   - Show readiness-to-process indicator

### Roadmap (from detail-claim-plan.md)
- Phase 2: Mock external services (eligibility, provider directory, prior auth, referral, pricing) — partially done via `PayerVerificationService`
- Phase 3: Expand policy corpus
- Phase 4: Realistic claim scenarios (specialist missing referral, surgery missing prior auth, modifier required, specialty mismatch, corrected claim, multi-line mixed outcome)
- Phase 5: Line-level adjudication outcomes
- Phase 6: SaaS evolution (role-based access, event-driven architecture, advanced agents)
