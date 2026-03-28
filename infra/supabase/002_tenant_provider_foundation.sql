create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  tenant_type text not null default 'payer',
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payer_organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payer_code text not null,
  display_name text not null,
  region text,
  created_at timestamptz not null default now(),
  unique (tenant_id, payer_code)
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_key text not null,
  npi text,
  tin text,
  name text not null,
  specialty text,
  network_status text not null default 'in_network',
  contract_tier text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_key)
);

alter table public.claims
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

alter table public.claims
  add column if not exists provider_record_id uuid references public.providers(id) on delete set null;

create index if not exists idx_claims_tenant_id on public.claims(tenant_id);
create index if not exists idx_claims_provider_record_id on public.claims(provider_record_id);
create index if not exists idx_providers_tenant_id on public.providers(tenant_id);

comment on table public.tenants is 'Primary SaaS tenant boundary. MVP assumes payer/TPA tenants.';
comment on table public.providers is 'Tenant-scoped provider records used during adjudication and network checks.';
