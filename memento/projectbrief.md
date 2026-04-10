# ClaimsOS – Project Brief

## Project Name
ClaimsOS (Autonomous Claims OS)

## Vision
An AI-native, agent-driven SaaS platform that automates healthcare claims processing for payers and TPAs. The system enables high levels of straight-through processing (STP) while maintaining compliance, transparency, and human oversight where required.

## Core Problem Statement
Insurance claims processing is manual, slow, and error-prone. ClaimsOS automates the initial steps: receiving a claim (JSON, X12 EDI, or scanned document), extracting and normalizing data, running policy-aware adjudication, and producing explainable decisions with confidence scoring.

## MVP Objective
Build a functional proof-of-concept demonstrating:
- Automated intake and validation of professional outpatient claims
- AI-assisted adjudication decisions (approve / deny / review)
- Policy-aware reasoning using RAG (Retrieval-Augmented Generation)
- Confidence-based human-in-the-loop (HITL) escalation
- Explainable outputs with full auditability

## MVP Scope
**In Scope:**
- Claim ingestion: JSON (CMS-1500 style), raw X12 837P upload, AI document intake (PDF/image/DOCX/text)
- Validation checks (field presence, CPT/ICD pairing, eligibility, modifiers, referral, prior auth)
- Policy retrieval via RAG (pgvector + OpenAI vector store)
- Decision engine: approve / deny / review
- Confidence scoring (0–1 scale)
- Human review queue with override capability
- Multi-tenant payer foundation
- Tenant-scoped provider records
- Member records with eligibility context
- AI agent chat assistant (natural language Q&A over claims data)

**Out of Scope (MVP):**
- Payments processing
- Appeals automation
- Fraud detection
- Real-time X12 integrations
- Full enterprise tenant administration UI
- Global provider master with cross-payer deduplication

## Tenancy Model
- **Payers** are the primary multi-tenant boundary
- Each tenant owns: claims, policies, plans, members, providers, audit logs
- Providers are tenant-scoped records (not global system tenants)

## Repository Structure
```
ClaimsOS/
├── apps/
│   ├── api/          # FastAPI backend
│   └── web/          # React + Vite + TypeScript frontend
├── infra/
│   └── supabase/     # SQL migration files
├── sample_data/      # Demo claims, policies, provider seed data
└── memento/          # AiDE memory files
