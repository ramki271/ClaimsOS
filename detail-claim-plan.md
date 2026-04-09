# Detailed Claim Expansion Plan

This document tracks the next expansion of ClaimsOS from an MVP claim shape into a more realistic payer-side adjudication model.

The goal is to make claims, supporting entities, policies, and mock integrations feel much closer to real-world professional claims processing while staying hackathon-manageable.

## North Star

Build toward a claim model that can support:
- richer member context
- richer provider context
- more realistic service lines
- prior auth and referral workflows
- pricing / reimbursement validation
- policy-grounded adjudication
- explainable human review routing

This should make the product feel less like a thin demo claim parser and more like a credible claims intelligence platform.

## Current State

What already exists:
- single-claim JSON processing
- single-claim X12 upload
- batch X12 upload
- policy upload + hosted RAG retrieval
- AI document intake for PDF/image/docx/text
- provider context
- member context
- utilization / prior auth context
- human review flow

Current gap:
- claim payload is still too thin for realistic adjudication complexity
- many real-world payer signals are not yet represented

## Design Principles

Expand in layers instead of all at once:
1. enrich core claim fields
2. enrich member / provider references
3. add mocked external payer signals
4. add policy documents that make the new fields meaningful
5. add sample claims that exercise the new rules

Do not add fields unless at least one of these is true:
- it drives a real adjudication decision
- it supports a real review/routing explanation
- it makes the demo more faithful to actual payer workflows

## Phase 1: Highest-Value Claim Fields

These fields unlock the most realism quickly without overcomplicating the model.

### Claim-Level Fields
- `member_dob`
- `member_gender`
- `subscriber_relationship`
- `billing_provider_id`
- `rendering_provider_id`
- `referring_provider_id`
- `facility_name`
- `facility_npi`
- `prior_authorization_id`
- `referral_id`
- `claim_frequency_code`
- `payer_claim_control_number`
- `accident_indicator`
- `employment_related_indicator`
- `supporting_document_ids`

### Service-Line Fields
- `modifiers`
- `diagnosis_pointers`
- `units`
- `charge_amount`
- `place_of_service` at line level when needed
- `line_status`
- `adjustment_reason`
- `denial_reason_code`

### Why These Matter
- modifiers: required for many professional claims
- diagnosis pointers: tie lines to diagnoses
- rendering vs billing provider: common and important
- referring provider / referral id: needed for HMO / specialist flows
- prior auth id: needed for utilization review realism
- frequency code: supports replacement/corrected claims

## Phase 1: Member Fields That Matter

These should be visible and available for claim processing.

- `member_id`
- `subscriber_id`
- `member_name`
- `date_of_birth`
- `gender`
- `relationship_to_subscriber`
- `payer_name`
- `plan_name`
- `plan_product`
- `coverage_type`
- `eligibility_status`
- `effective_date`
- `termination_date`
- `pcp_name`
- `pcp_npi`
- `referral_required`
- `prior_auth_required_for_specialty`
- `risk_flags`
- `coverage_notes`
- `recent_claim_ids`

### Nice-To-Have Later
- address
- preferred language
- care program enrollment
- case management flag
- benefit accumulators if reimbursement / liability becomes a focus

## Phase 1: Provider Fields That Matter

- `billing_provider_id`
- `rendering_provider_id`
- `referring_provider_id`
- `provider_name`
- `npi`
- `taxonomy_code`
- `specialty`
- `network_status`
- `contract_status`
- `contract_tier`
- `network_effective_date`
- `network_end_date`
- `plan_participation`
- `facility_affiliation`
- `service_location`

### Why These Matter
- specialty validation
- network checks
- plan participation checks
- contract effective-date checks
- rendering vs billing logic

## Phase 2: Mock External Services

To make adjudication feel realistic, add mocked payer-side services.

### 1. Eligibility Service
Purpose:
- verify member coverage on date of service
- verify active plan/product
- return coverage flags

Example outputs:
- active on DOS
- inactive on DOS
- pending reverification
- benefit class / product match

### 2. Provider Directory Service
Purpose:
- verify provider exists
- verify specialty
- verify network status
- verify plan participation

### 3. Prior Authorization Service
Purpose:
- verify auth number exists
- verify auth is active for procedure/date window
- verify units or service family covered

### 4. Referral Service
Purpose:
- verify PCP referral exists for specialist care
- verify referral window / provider match

### 5. Pricing / Fee Schedule Service
Purpose:
- return allowed amount
- compare billed vs allowed
- support pricing validation / reimbursement logic

This does not need to be a real integration; mocked deterministic services are enough for demo realism.

## Phase 3: Policy Corpus To Add

The richer claim model only matters if policies exist that use those fields.

### Must-Have Policy Types
- prior authorization policy
- referral policy
- modifier usage policy
- specialty / provider participation policy
- site-of-care policy
- frequency / repeat-service policy
- duplicate billing / integrity policy

### Next-Level Policy Types
- pricing / reimbursement policy
- demographic restriction policy
- documentation-required policy
- plan exclusion policy

## Sample Policy Documents To Create

Suggested examples:
- `APX-PRIORAUTH-KNEE-ARTHRO-2026.md`
- `APX-REFERRAL-SPECIALIST-HMO-2026.md`
- `APX-MODIFIER-25-59-PROF-2026.md`
- `APX-SPECIALTY-CARDIOLOGY-PROF-2026.md`
- `APX-SITE-OF-CARE-OUTPATIENT-2026.md`
- `APX-FREQ-PHYSICAL-THERAPY-2026.md`
- `APX-PRICE-PROF-99214-2026.md`
- `APX-DOC-REQUIRED-SURGERY-2026.md`

## Phase 4: Realistic Claim Scenarios To Add

These scenarios should be implemented as structured JSON, X12 where practical, and optionally OCR docs.

### Scenario 1: Specialist Visit Missing Referral
- HMO member
- specialist rendering provider
- referral required
- no referral id
- expected outcome: review or deny

### Scenario 2: Surgery Missing Prior Auth
- orthopedic or ambulatory surgery CPT
- prior auth required by policy
- missing or invalid auth id
- expected outcome: review

### Scenario 3: Modifier Required But Missing
- CPT requiring modifier under policy
- no modifier present
- expected outcome: deny or review

### Scenario 4: Rendering Provider Specialty Mismatch
- procedure billed by provider with incompatible specialty
- expected outcome: review

### Scenario 5: Billed Over Allowed
- pricing service returns allowed amount below billed amount
- expected outcome: approve with adjustment or pricing validation flag

### Scenario 6: Corrected / Frequency Claim
- replacement or corrected claim frequency code
- expected duplicate/frequency logic path

### Scenario 7: Multi-Line Mixed Outcome Claim
- one line covered
- one line denied
- one line review
- strongest demo scenario for realistic adjudication

### Scenario 8: Documentation Required
- procedure requires supporting document
- document missing
- expected outcome: request more info / review

## Recommended Implementation Order

### Phase A: Data Model Expansion
1. add core claim fields
2. add service-line modifiers + diagnosis pointers
3. add billing/rendering/referring provider references
4. add prior auth / referral ids

### Phase B: Processing Expansion
1. validate new fields
2. enrich adjudication checks using member/provider context
3. add mocked eligibility/prior-auth/referral/pricing lookups
4. add line-level adjudication outcomes where possible

### Phase C: Policy Expansion
1. create/upload prior auth policies
2. create/upload referral policies
3. create/upload modifier policies
4. create/upload specialty / site-of-care policies

### Phase D: Sample Data Expansion
1. add JSON claims
2. add X12 claims
3. add OCR documents
4. add attachment examples

## UI Implications

### Claim Intake / Draft Review
Needs room for:
- prior auth id
- referral id
- billing/rendering/referring provider
- modifiers
- diagnosis pointers
- supporting document references

### Member Detail
Should emphasize:
- eligibility
- plan/product
- referral requirements
- prior auth expectations
- diagnoses / surgical history
- recent claims

### Provider Detail
Should emphasize:
- billing/rendering role
- specialty / taxonomy
- network / contract details
- participating plans
- facility affiliation

### Adjudication Detail
Should eventually show:
- line-level reasoning
- pricing validation
- referral / auth verification
- provider specialty checks
- cited policy basis per decision

## Suggested Backend Milestone After Members

Best next technical slice:
1. add claim fields:
   - `rendering_provider_id`
   - `billing_provider_id`
   - `referring_provider_id`
   - `prior_authorization_id`
   - `referral_id`
   - `service_lines[].modifiers`
   - `service_lines[].diagnosis_pointers`
2. add mocked services:
   - eligibility
   - prior auth
   - referral
3. add matching policies:
   - prior auth
   - referral
   - modifier
   - specialty

## Phase 1 Execution Checklist

This is the concrete next build sequence for the first realistic-claim expansion pass.

### Backend Slice 1: Claim Schema
- add claim-level support for:
  - `billing_provider_id`
  - `rendering_provider_id`
  - `referring_provider_id`
  - `prior_authorization_id`
  - `referral_id`
  - `claim_frequency_code`
  - `payer_claim_control_number`
- add service-line support for:
  - `modifiers`
  - `diagnosis_pointers`
  - explicit `units`

### Backend Slice 2: Rules
- validate missing referral when referral is required
- validate missing prior auth when prior auth is required
- validate provider specialty mismatch
- validate modifier-required scenarios
- validate corrected/replacement claim frequency handling

### Backend Slice 3: Mock Services
- add mock eligibility verification
- add mock referral verification
- add mock prior auth verification
- defer pricing mock unless time allows in the same slice

### Backend Slice 4: Policy Set
- add one prior auth policy
- add one referral policy
- add one modifier policy
- add one specialty/provider participation policy

### Backend Slice 5: Sample Claims
- specialist claim missing referral
- surgery claim missing prior auth
- modifier-required claim missing modifier
- specialty mismatch claim
- corrected/replacement claim

## Phase 1 UI Impact

Once the backend slice above lands, the first UI pass should expose the new fields in the most decision-relevant places.

### Intake / Draft Review
- rendering provider
- billing provider
- referring provider
- prior auth id
- referral id
- modifiers
- diagnosis pointers

### Adjudication Detail
- referral verification result
- prior auth verification result
- provider specialty check
- modifier / diagnosis-pointer check
- claim frequency handling result

### Member Intelligence
- keep this page focused on context:
  - eligibility
  - referral requirement
  - prior auth expectation
  - recent claims
  - diagnoses / surgical history
- do not make Member Intelligence the primary place where claim-rule outcomes are explained

## Definition Of Done For Phase 1

Phase 1 is complete when:
- a claim can carry provider role distinctions
- a claim can carry referral and prior auth identifiers
- service lines can carry modifiers and diagnosis pointers
- at least four realistic rule scenarios adjudicate visibly
- the UI can show why a claim was approved, denied, or reviewed using those fields

## Demo Readiness Checklist

- member context is visible
- provider context is visible
- claim contains realistic payer-side fields
- adjudication explains why referral/auth/specialty/modifiers matter
- at least one claim routes to manual review because of missing auth/referral
- at least one claim adjusts/flags because billed exceeds allowed
- at least one claim shows mixed line-level logic

## Provider Depth Slice

This slice brings ClaimsOS closer to a realistic payer/provider configuration model without requiring another schema migration yet.

### Added Provider Fields
- `taxonomy_code`
- `subspecialty`
- `credential_status`
- `facility_affiliations`
- `service_locations`
- `accepting_referrals`
- `surgical_privileges`

These are metadata-backed for now and stored through the provider repository layer.

### Added Claim-Side Provider Context

`ProviderAdjudicationContext` now carries:
- taxonomy code
- subspecialty
- credential status
- plan participation list
- facility affiliations
- service locations
- referral acceptance
- surgical privileges

### New Adjudication Uses
- specialty and taxonomy-aware procedure matching
- credential-status checks
- facility affiliation review checks
- referral-acceptance checks when a referring provider is present
- stronger plan participation context

### Next UI Impact
- Provider detail should show:
  - taxonomy
  - specialty / subspecialty
  - credential status
  - plan participation
  - facility affiliations
  - service locations
  - referral acceptance
  - surgical privileges
- Adjudication detail should show richer provider context, not just network status

### Recommended Next Scenario Pack
- orthopedic surgery claim with ortho taxonomy and verified privileges
- specialty mismatch claim with family medicine taxonomy on orthopedic CPT
- specialist referral claim where provider does not accept referrals
- facility mismatch claim where provider is not affiliated to billed facility
- sanctioned / provisional provider review scenario

## Notes

- Keep the demo honest: use terms like `Clinical Match` or `Procedure Alignment`, not speculative diagnostic AI language.
- Prefer explainable payer operations logic over flashy but weakly grounded clinical graphics.
- Every added field should either affect adjudication, review routing, or explanation quality.
