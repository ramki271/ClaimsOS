alter table public.claims
  add column if not exists member_date_of_birth date,
  add column if not exists member_gender text,
  add column if not exists subscriber_relationship text,
  add column if not exists billing_provider_id text,
  add column if not exists billing_provider_name text,
  add column if not exists rendering_provider_id text,
  add column if not exists rendering_provider_name text,
  add column if not exists referring_provider_id text,
  add column if not exists referring_provider_name text,
  add column if not exists facility_name text,
  add column if not exists facility_npi text,
  add column if not exists prior_authorization_id text,
  add column if not exists referral_id text,
  add column if not exists claim_frequency_code text not null default '1',
  add column if not exists payer_claim_control_number text,
  add column if not exists accident_indicator boolean not null default false,
  add column if not exists employment_related_indicator boolean not null default false,
  add column if not exists supporting_document_ids text[] not null default '{}'::text[];

comment on column public.claims.member_date_of_birth is 'Optional member date of birth captured from richer professional claim inputs.';
comment on column public.claims.member_gender is 'Optional member gender used for adjudication and policy checks.';
comment on column public.claims.subscriber_relationship is 'Relationship of the patient to the subscriber when supplied by the claim.';
comment on column public.claims.billing_provider_id is 'Billing provider identifier from the submitted claim.';
comment on column public.claims.billing_provider_name is 'Billing provider name from the submitted claim.';
comment on column public.claims.rendering_provider_id is 'Rendering provider identifier from the submitted claim.';
comment on column public.claims.rendering_provider_name is 'Rendering provider name from the submitted claim.';
comment on column public.claims.referring_provider_id is 'Referring provider identifier for specialist or referred services.';
comment on column public.claims.referring_provider_name is 'Referring provider name for specialist or referred services.';
comment on column public.claims.facility_name is 'Facility or service location name when present on the claim.';
comment on column public.claims.facility_npi is 'Facility NPI when present on the claim.';
comment on column public.claims.prior_authorization_id is 'Prior authorization identifier supplied on the claim.';
comment on column public.claims.referral_id is 'Referral identifier supplied on the claim.';
comment on column public.claims.claim_frequency_code is 'Original/corrected/replacement claim frequency code.';
comment on column public.claims.payer_claim_control_number is 'Payer control number referenced by corrected or replacement claims.';
comment on column public.claims.accident_indicator is 'Whether the claim is marked as accident-related.';
comment on column public.claims.employment_related_indicator is 'Whether the claim is marked as employment-related.';
comment on column public.claims.supporting_document_ids is 'Document identifiers attached to the claim for payer-side review.';
