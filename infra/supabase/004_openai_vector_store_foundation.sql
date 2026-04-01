alter table public.tenants
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.tenants.metadata is 'Tenant-scoped integration metadata such as hosted retrieval provider IDs.';
