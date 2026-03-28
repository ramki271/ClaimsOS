# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaimsOS is an AI-powered SaaS platform for autonomous healthcare claims processing. It uses a modular, agent-driven architecture where AI agents handle intake, validation, policy retrieval (RAG), adjudication, and confidence scoring. The project is in early development — currently only planning documentation exists.

## Planned Architecture

### Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Pydantic (Python)
- **Database**: Supabase Postgres + pgvector (embeddings for RAG)
- **Storage**: Supabase Storage (policy PDFs/documents)
- **AI**: OpenAI or Anthropic API via FastAPI backend
- **Migrations**: Alembic
- **No Redis in Phase 1** — synchronous request-response model until async/queueing is needed

### Backend Service Boundaries

Agents are implemented as internal FastAPI service modules (not separate microservices):

| Service | Responsibility |
|---|---|
| `intake_service` | Parse claim JSON (simulated 837 format) → canonical Claim Object |
| `validation_service` | Check missing fields, invalid CPT/ICD combos, eligibility |
| `policy_retrieval_service` | RAG: embed claim details, retrieve matching policy chunks from pgvector |
| `adjudication_service` | Hybrid rules + LLM reasoning → approve / deny / partial + explanation |
| `confidence_service` | Score confidence (0–1); flag low-confidence claims for human review (HITL) |

### Core API Endpoints (MVP)

```
POST /claims/process     # Submit a claim for processing
GET  /claims/{claim_id}  # Retrieve adjudication result
POST /policies/upload    # Upload policy documents
```

### Database Entities

`claims`, `claim_validation_results`, `policy_documents`, `policy_chunks`, `adjudication_results`, `audit_logs`, `human_review_queue`

### Canonical Claim Object (MVP)

```json
{
  "claim_id": "123",
  "patient_id": "P001",
  "provider_id": "PR001",
  "diagnosis_codes": ["E11.9"],
  "procedure_codes": ["99213"],
  "amount": 150,
  "date_of_service": "2026-03-01"
}
```

## MVP Scope

**In scope**: Claim ingestion (JSON 837 simulation), validation, policy RAG, adjudication (approve/deny), confidence scoring, basic UI.

**Out of scope**: Payments, appeals automation, fraud detection, real-time X12 integration, multi-payer configuration.

## Development Setup (to be created)

Once implementation begins, the expected commands will be:

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Tests
pytest tests/
pytest tests/services/test_adjudication_service.py  # single test file
npm test  # frontend tests
```

Environment variables should be configured in a `.env` file (see `.env.example` when created).

## Key Architectural Decisions

- **Agents as services, not microservices**: All agents run inside FastAPI to minimize operational complexity in Phase 1.
- **pgvector for RAG**: Policy documents are chunked, embedded, and stored in Supabase Postgres via pgvector — no separate vector DB needed in Phase 1.
- **Synthetic data only**: No real PHI; use synthetic claims data during development for compliance.
- **Confidence-gated HITL**: Low-confidence adjudications are automatically queued for human review rather than auto-decided.
- **Audit logging**: All adjudication decisions must be persisted to `audit_logs` for explainability and compliance.
