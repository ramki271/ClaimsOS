create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_key text not null,
  filename text not null,
  title text not null,
  classification text not null default 'POLICY_CORE',
  source_type text not null default 'upload',
  status text not null default 'indexed',
  raw_text text not null,
  chunk_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, document_key)
);

create table if not exists public.policy_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.policy_documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  keyword_tokens text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_policy_documents_tenant_id on public.policy_documents(tenant_id);
create index if not exists idx_policy_chunks_tenant_id on public.policy_chunks(tenant_id);
create index if not exists idx_policy_chunks_document_id on public.policy_chunks(document_id);

comment on table public.policy_documents is 'Tenant-scoped policy source documents uploaded for retrieval.';
comment on table public.policy_chunks is 'Chunked policy text used for first-pass retrieval and future embeddings.';
