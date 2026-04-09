# Handoff

## Next Focus For Codex — Agent Chat Backend

The frontend chat widget is fully wired and ready. It calls `POST /api/agent/chat`.
Build the backend so it answers natural-language questions about claims, members, providers, and policies.

### Endpoint

```
POST /api/agent/chat
Content-Type: application/json
```

**Request**
```json
{
  "message": "Why was claim CLM-001 flagged for review?",
  "context": {
    "active_view": "detail",
    "claim_id": "CLM-001"
  }
}
```

**Response**
```json
{
  "reply": "Claim CLM-001 was routed to review because..."
}
```

### What the agent must be able to answer

| Question type | Data source |
|---|---|
| Claim status / outcome / rationale | `adjudication_results` + `audit_logs` |
| Member eligibility / demographics | `members` table |
| Provider network status / specialty | `providers` table |
| Policy coverage / prior auth rules | `policy_chunks` (RAG via pgvector) |
| Pending review queue | `human_review_queue` |
| Aggregate stats (approval rate, pending count) | `claims` + `adjudication_results` |

### Implementation notes

- Route: `apps/api/app/api/v1/routes/agent.py`
- Use the `context.claim_id` to pre-load relevant claim data before prompting the LLM.
- Use `context.active_view` to bias what data sources to query first (e.g. `members` view → query members table, `policy` view → hit pgvector first).
- The LLM prompt should receive: user message + retrieved context (claim JSON, member record, policy chunks, etc.) as a structured system prompt.
- Reply must be plain conversational text (no markdown, no JSON) — the widget renders it as-is.
- Keep responses concise (2–4 sentences for simple queries, structured bullets for complex ones).
- Return HTTP 200 with `{ "reply": "..." }` always — never 4xx for question failures, instead reply with a graceful "I don't have enough context to answer that" message.

### Frontend files already in place

- Widget: `apps/web/src/features/agent/components/AgentChatWidget.tsx`
- API stub: `apps/web/src/shared/api/agent.ts` → calls `POST /api/agent/chat`

---

## Latest Focus For Claude

The next UI task is to make AI document intake feel like a true OCR review workspace for the new hero packet:

- scenario brief: [APX-OCR-HERO-ORTHO-3001.md](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.md)
- expected extracted draft: [APX-OCR-HERO-ORTHO-3001.expected-draft.json](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-draft.json)
- expected adjudication path: [APX-OCR-HERO-ORTHO-3001.expected-outcome.md](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-outcome.md)

## Exact UI Goal

Improve the AI intake experience so it clearly supports:

1. document upload
2. extracted draft review
3. claim-to-document comparison
4. missing-field resolution
5. downstream adjudication handoff

The UI should feel like a document-intelligence workstation, not just a stacked upload form.

## Definition Of Done

This work is not done unless all of the following are true:

1. The intake page can visibly present the uploaded OCR document alongside or adjacent to the extracted draft.
2. The extracted draft highlights:
   - missing fields
   - low-confidence fields
   - review notes
3. The scenario `APX-OCR-HERO-ORTHO-3001` can be explained in the UI without outside narration:
   - member, provider, facility, diagnosis, CPT, and billed amount were extracted
   - `prior_authorization_id` is still missing
   - processing the claim routes it to review for an explainable utilization reason
4. The intake surface continues to support the existing richer claim fields already wired into the draft form.
5. The page remains visually aligned with the current design system.

## Strong Product Direction

Please focus on a side-by-side or clearly linked review flow:

- left or top: document preview / packet context
- right or main: extracted claim draft
- explicit callouts for:
  - missing prior auth
  - low-confidence facility / referring-provider fields
  - readiness to process

Do not reduce this to a generic upload widget plus flat form. The page should feel like a reviewer is validating a packet.

## What To Use

- current intake UI: [IntakePolicyPage.tsx](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/web/src/features/intake/components/IntakePolicyPage.tsx)
- current claim API types: [claims.ts](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/apps/web/src/shared/api/claims.ts)
- hero OCR assets:
  - [APX-OCR-HERO-ORTHO-3001.md](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.md)
  - [APX-OCR-HERO-ORTHO-3001.expected-draft.json](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-draft.json)
  - [APX-OCR-HERO-ORTHO-3001.expected-outcome.md](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claim_documents/APX-OCR-HERO-ORTHO-3001.expected-outcome.md)

## Verification

- `cd apps/web && npm run build`
- test the AI intake flow with the new OCR hero packet assets

## Roadmap Reference

Broader future work remains in:
- [detail-claim-plan.md](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/detail-claim-plan.md)
