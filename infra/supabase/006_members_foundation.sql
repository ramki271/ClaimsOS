create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id text not null,
  subscriber_id text not null,
  member_name text not null,
  date_of_birth date not null,
  gender text not null default 'unknown',
  relationship_to_subscriber text not null default 'self',
  plan_name text not null,
  plan_product text not null,
  coverage_type text not null default 'commercial',
  eligibility_status text not null default 'active',
  effective_date date not null,
  termination_date date,
  pcp_name text,
  pcp_npi text,
  referral_required boolean not null default false,
  prior_auth_required_for_specialty boolean not null default false,
  address_line_1 text,
  city text,
  state text,
  postal_code text,
  phone text,
  email text,
  risk_flags text[] not null default '{}'::text[],
  active_claim_count integer not null default 0,
  last_claim_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, member_id)
);

create index if not exists idx_members_tenant_id on public.members(tenant_id);

comment on table public.members is 'Tenant-scoped member enrollment and member-intelligence records used in claims review.';
comment on column public.members.metadata is 'Extended member context including coverage notes, diagnoses, surgical history, hotspots, and policy alignment.';

alter table public.members enable row level security;

create policy "members_select_all" on public.members
  for select using (true);

create policy "members_insert_all" on public.members
  for insert with check (true);

create policy "members_update_all" on public.members
  for update using (true) with check (true);
