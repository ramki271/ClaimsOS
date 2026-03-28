# Tech Stack

## Chosen MVP Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- Pydantic

### Database and Storage
- Supabase Postgres
- Supabase Storage
- pgvector for embeddings and policy retrieval

### Tenancy and Core Domain Shape
- Payers are the primary tenant boundary
- Each tenant owns its own:
  - claims
  - policies
  - plans
  - members
  - providers
  - audit logs
- Providers are tenant-scoped records for MVP, not global system tenants

### AI and Retrieval
- OpenAI or Anthropic API through the FastAPI backend
- RAG using policy documents stored in Supabase Storage and embeddings stored in Postgres via pgvector

### Processing Model
- Modular backend services for:
  - claim intake and normalization
  - validation
  - policy retrieval
  - adjudication
  - confidence scoring
  - provider lookup and network validation

### Logging and Auditability
- Structured application logs
- Audit log tables in Supabase

## Redis Decision

Redis is not required for the first MVP version.

We should start without Redis because:
- claim volume will be low
- the initial workflow can be handled in a request-response model
- keeping the architecture simple will help us move faster

We should add Redis later if we need:
- background job queues
- retries for long-running tasks
- caching for policy retrieval
- rate limiting
- real-time status updates

## Recommended MVP Architecture

Keep the "agent" concept as internal backend modules or services inside FastAPI rather than separate microservices.

Suggested backend service boundaries:
- `intake_service`
- `validation_service`
- `policy_retrieval_service`
- `adjudication_service`
- `confidence_service`

This preserves the modular agent-driven design from the MVP doc without adding operational complexity too early.

## Suggested Supporting Pieces

- Database migrations: Alembic
- Environment management: `.env` files for local development
- API communication: frontend talks only to FastAPI
- File uploads: policy PDFs and text documents stored in Supabase Storage

## Initial Database Entities

- `tenants`
- `payer_organizations`
- `providers`
- `claims`
- `claim_validation_results`
- `policy_documents`
- `policy_chunks`
- `adjudication_results`
- `audit_logs`
- `human_review_queue`

## Final Recommendation

For the first build, use:
- React + Vite + TypeScript for the UI
- FastAPI + Pydantic for the backend
- Supabase Postgres + Storage for persistence
- pgvector for RAG
- No Redis in phase 1
- Tenant-scoped provider modeling for MVP

Add Redis only when asynchronous processing, caching, or queueing becomes necessary.
