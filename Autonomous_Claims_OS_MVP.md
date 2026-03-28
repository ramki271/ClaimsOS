# 🧠 Autonomous Claims OS – MVP Plan

## 📌 Vision

Autonomous Claims OS is an AI-powered SaaS platform designed to automate healthcare claims processing using a modular, agent-driven architecture.

The system enables payers and TPAs to achieve high levels of straight-through processing (STP) while maintaining compliance, transparency, and human oversight where required.

Providers are modeled as adjudication participants inside each payer tenant's operating context, not as the SaaS tenant boundary itself.

---

## 🎯 MVP Objective

Build a functional proof-of-concept that demonstrates:

- Automated intake and validation of claims
- AI-assisted adjudication decisions
- Policy-aware reasoning using RAG
- Confidence-based human-in-the-loop escalation
- Explainable outputs with auditability

---

## 🧪 MVP Scope (Strict)

### Use Case
> Auto-adjudicate simple outpatient claims

### In Scope
- Claim ingestion (JSON-based 837 simulation)
- Raw X12 837P upload and parsing into canonical claim JSON
- Validation checks
- Policy retrieval (RAG)
- Decision engine (approve/deny)
- Confidence scoring
- Basic UI for results
- Multi-tenant payer foundation
- Tenant-scoped provider records used for claim context and network checks

### Out of Scope (for MVP)
- Payments processing
- Appeals automation
- Fraud detection
- Real-time X12 integrations
- Full enterprise tenant administration UI
- Global provider master with cross-payer deduplication

---

## 🏗️ High-Level Architecture

[ Client UI / API ]
        ↓
[ FastAPI Backend ]
        ↓
[ Agent Orchestrator ]
        ↓
-----------------------------------
| Validation Agent               |
| Policy Agent (RAG)            |
| Adjudication Agent            |
-----------------------------------
        ↓
[ Decision Engine + Confidence ]
        ↓
[ Response + Audit Logs ]

---

## 🤖 Core AI Agents (MVP)

### 1. Intake & Normalization Agent
- Input: Claim JSON (simulated 837)
- Output: Canonical Claim Object
- Type: Deterministic + Light AI validation

### 2. Validation Agent
- Checks:
  - Missing fields
  - Invalid CPT/ICD combinations
  - Eligibility mismatch (mocked)
- Output:
  - Validation status
  - Errors list

### 3. Policy Agent (RAG-based)
- Input:
  - Claim details
  - Policy documents (PDF/text)
- Output:
  - Relevant policy rules
- Tech:
  - Embeddings + vector DB
  - LLM reasoning

### 4. Adjudication Agent
- Input:
  - Validated claim
  - Policy rules
- Output:
  - Decision (approve / deny / partial)
  - Explanation
- Approach:
  - Hybrid (rules + LLM reasoning)

### 5. Confidence & HITL Agent
- Calculates:
  - Confidence score (0–1)
- Logic:
  - If confidence < threshold → flag for human review

---

## ⚙️ Tech Stack

### Backend
- FastAPI (Python)
- Pydantic (schema validation)
- Supabase Postgres as the source of truth for tenant, provider, claim, and audit entities

### AI Layer
- LLM: Claude / GPT
- Prompt templates for each agent

### Vector DB
- Pinecone / Weaviate / FAISS (local for MVP)

### Storage
- PostgreSQL (claims + logs)
- S3 (policy documents)

### Tenancy Model
- Payers are the primary multi-tenant boundary
- Providers are tenant-scoped records under each payer tenant
- Claims belong to a payer tenant and reference a provider within that tenant context

---

## 📊 Data Model (Simplified)

### Claim Object (Canonical)

{
  "claim_id": "123",
  "tenant_id": "TENANT_001",
  "patient_id": "P001",
  "provider_id": "PR001",
  "diagnosis_codes": ["E11.9"],
  "procedure_codes": ["99213"],
  "amount": 150,
  "date_of_service": "2026-03-01"
}

### Tenant Object (MVP Foundation)

{
  "tenant_id": "TENANT_001",
  "tenant_type": "payer",
  "name": "Apex Health Plan"
}

### Provider Object (Tenant-Scoped)

{
  "provider_id": "PR001",
  "tenant_id": "TENANT_001",
  "npi": "1299304491",
  "name": "Front Range Family Medicine",
  "specialty": "Family Medicine",
  "network_status": "in_network"
}

---

## 🔄 Workflow (MVP)

1. User uploads claim JSON
   - or uploads a first-pass X12 837P file
2. System runs:
   - Validation Agent
   - Policy Agent (RAG)
   - Adjudication Agent
   - provider context and network lookup within the active payer tenant
3. System computes:
   - Decision
   - Confidence score
4. Output:
   - Decision + reasoning
   - Validation results
   - HITL flag (if needed)

---

## 🧩 APIs (MVP)

### Submit Claim
POST /claims/process

### Upload X12 Claim
POST /claims/upload-x12

### Get Result
GET /claims/{claim_id}

### Upload Policy Docs
POST /policies/upload

### Providers
GET /providers
POST /providers

---

## 🖥️ UI (Simple MVP)

### Screens
1. Upload Claim
2. View Result:
   - Decision (Approve/Deny)
   - Reasoning
   - Confidence Score
   - Validation Errors
3. Provider context visible on adjudication detail

---

## 📈 Success Metrics

- % of claims auto-adjudicated
- Confidence score distribution
- Validation accuracy
- Decision explainability
- Latency per claim

---

## 🔐 Compliance (MVP Level)

- No real PHI (use synthetic data)
- Basic encryption
- Logging enabled

---

## 🧱 Phase Plan

### Phase 1 (Week 1–2)
- Claim API
- Validation Agent
- Basic rule engine
- First-pass payer-tenant foundation
- Provider records scaffold

### Phase 2 (Week 3–4)
- Policy Agent (RAG)
- LLM integration
- Adjudication logic
- Provider-aware network and contract checks

### Phase 3 (Week 5–6)
- Confidence scoring
- HITL flagging
- UI dashboard
- X12 upload flow in UI

---

## 🚀 SaaS Evolution Path

### Phase 4
- Mature multi-tenant architecture
- Role-based access

### Phase 5
- Event-driven architecture (Kafka)
- Real-time ingestion

### Phase 6
- Advanced agents (denial prediction, appeals, fraud)

### Phase 7
- Agent marketplace

---

## ⚠️ Risks & Mitigation

- Incorrect AI decisions → Confidence scoring + HITL
- Policy complexity → RAG + structured rules
- Lack of trust → Explainability + audit logs
- Data availability → Synthetic datasets
- Cross-payer provider complexity → tenant-scoped provider modeling first, global provider master later

---

## 💡 Positioning

This is an AI-native Claims Operating System.

Differentiators:
- Agent-based architecture
- Policy intelligence (RAG)
- Explainable AI decisions
- Modular and extensible
- Built as a neutral claims operating system for payer tenants rather than a single-payer internal tool

---

## 🔥 Final Note

Goal is not full automation initially.

Goal:
Prove AI agents can reliably assist adjudication decisions.
