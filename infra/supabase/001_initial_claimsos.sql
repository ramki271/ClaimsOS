create extension if not exists "pgcrypto";

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_id text not null unique,
  claim_type text not null,
  form_type text not null,
  payer_name text not null,
  plan_name text not null,
  member_id text not null,
  member_name text not null,
  patient_id text not null,
  provider_id text not null,
  provider_name text not null,
  place_of_service text not null,
  diagnosis_codes text[] not null,
  procedure_codes text[] not null,
  service_lines jsonb not null default '[]'::jsonb,
  amount numeric(12, 2) not null,
  date_of_service date not null,
  processing_status text not null default 'processed',
  outcome text,
  confidence_score numeric(4, 3),
  requires_human_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_validation_results (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  is_valid boolean not null,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.adjudication_results (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  outcome text not null,
  rationale text not null,
  cited_rules jsonb not null default '[]'::jsonb,
  confidence_score numeric(4, 3) not null,
  requires_human_review boolean not null default false,
  matched_policies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.claims(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.human_review_queue (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  status text not null default 'pending',
  reason text not null,
  created_at timestamptz not null default now(),
  unique (claim_id)
);
