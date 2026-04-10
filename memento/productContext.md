# ClaimsOS – Product Context

## Why This Project Exists

Healthcare claims adjudication is a high-volume, high-stakes process that is largely manual at most payers and TPAs. Adjudicators must cross-reference claim data against member eligibility, provider contracts, policy rules, prior authorizations, and referral requirements — all before making a pay/deny decision. This is slow, expensive, and error-prone.

ClaimsOS exists to prove that AI agents can reliably assist (and eventually automate) adjudication decisions, starting with the simplest and highest-volume claim type: professional outpatient claims (CMS-1500 / 837P).

## Problems It Solves

1. **Manual intake bottleneck** – Claims arrive as paper, scanned PDFs, X12 EDI files, or structured JSON. ClaimsOS normalizes all of these into a canonical claim object automatically.
2. **Policy lookup friction** – Adjudicators must manually look up coverage rules. ClaimsOS uses RAG to retrieve the most relevant policy sections for each claim.
3. **Inconsistent decisions** – Human adjudicators apply rules inconsistently. ClaimsOS applies deterministic checks + LLM reasoning with full explainability.
4. **Lack of auditability** – ClaimsOS records every processing step in an audit trail.
5. **Slow human review routing** – Low-confidence or complex claims are automatically flagged for human review with a clear reason.

## How It Should Work

### Claim Lifecycle
```
Claim Input (JSON / X12 / Document)
    ↓
Intake & Normalization (IntakeService)
    ↓
Validation (ValidationService)
    ↓
Policy Retrieval (PolicyRetrievalService via RAG)
    ↓
Provider Context Lookup (ProvidersRepository)
    ↓
Payer Verification (PayerVerificationService)
    ↓
Adjudication (AdjudicationService)
    ↓
Confidence Scoring (ConfidenceService)
    ↓
Decision: approve / deny / review
    ↓
Persist to Supabase + Audit Trail
    ↓
Human Review Queue (if confidence < 0.72 or outcome = "review")
```

### Three Input Channels
1. **JSON API** – `POST /api/claims/process` with a `ClaimSubmission` JSON body
2. **X12 837P upload** – `POST /api/claims/upload-x12` (single) or `POST /api/claims/upload-x12-batch` (multi-claim)
3. **AI Document Intake** – `POST /api/claims/intake-document` with a PDF/image/DOCX/text file; OpenAI extracts a `ClaimDocumentDraft` which can be reviewed and then submitted

## User Experience Goals

### Primary Users: Claims Operators / Adjudicators
- See a dashboard of all claims with outcomes and confidence scores
- Drill into any claim to see the full adjudication detail: validation results, policy matches, provider context, utilization context, payer verification, passed/failed checks, audit trail
- Review and override flagged claims from the human review queue
- Upload new claims (JSON editor, X12 file, or scanned document)
- Upload policy documents to the knowledge base

### Secondary Users: Claims Managers
- View aggregate stats: approval rate, pending review count, outcome distribution
- Use the AI chat assistant to ask natural-language questions about claims, members, providers, and policies

## Key UI Surfaces

| View | Purpose |
|------|---------|
| Dashboard (Overview) | Aggregate stats, recent claims list |
| Claims Hub | Filterable claims list with outcome/review status |
| Intake | Upload claims (JSON, X12, document), review AI-extracted drafts |
| Adjudication Detail | Full claim processing result with all checks and audit trail |
| Policy Manager | Upload and manage policy documents, view ingestion metrics |
| Knowledge Studio | Policy RAG exploration |
| Members | Member eligibility and clinical context |
| Providers | Provider network and contract management |
| Reports | Claims analytics |
| Agent Chat | AI assistant widget (always-on, context-aware) |

## Design Philosophy
The UI follows a "Surgical Ledger" design system:
- High-density data presentation (healthcare professionals prefer more data, less scrolling)
- Monochromatic base palette with "Procedure Blue" (#0053DC) for primary actions
- No 1px dividers — boundaries defined by tonal surface shifts
- Manrope for display/headlines, Inter for data/UI
- Glassmorphism for floating elements
- 4px button radius (architectural, not consumer-grade)
