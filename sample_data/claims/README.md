# Sample Claim Test Pack

This folder contains ready-to-upload professional `837P` test claims aligned to the current ClaimsOS MVP backend behavior.

These claims are designed to work with:
- the current X12 parser
- the current validation rules
- the current adjudication rules
- the Apex Health Plan sample policy pack

Recommended setup:
1. Upload the Apex policy documents from [sample_data/policies](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies)
2. Then upload one of these claim files through the claim upload flow

## Files

- `apex_bulk_mixed_6_claims.x12`
  - Use with: `POST /api/claims/upload-x12-batch`
  - Contains 6 claims with mixed outcomes:
    - `CLM-BULK-APPROVE-0001`
      - Expected path: `approve`
      - Why:
        - `99213`
        - supported diagnoses `E11.9` / `I10`
        - `POS 11`
        - simple office visit amount `150`
    - `CLM-BULK-REVIEW-0002`
      - Expected path: `review`
      - Why:
        - valid `99213`
        - amount `425` exceeds straight-through threshold but not hard deny threshold
    - `CLM-BULK-DENY-0003`
      - Expected path: `deny`
      - Why:
        - amount `1250` exceeds the current MVP hard guardrail
    - `CLM-BULK-THERAPY-0004`
      - Expected path: `review`
      - Why:
        - valid `M54.5` + `97110`
        - `POS 22` pushes it outside the narrow office-visit fast lane
    - `CLM-BULK-PRIORAUTH-0005`
      - Expected path: `review`
      - Why:
        - valid `M17.11` + `27447`
        - procedure triggers prior authorization / utilization review
    - `CLM-BULK-MISMATCH-0006`
      - Expected path: `deny`
      - Why:
        - `I10` does not support `99214` in current validation rules

- `apex_approve_99213.x12`
  - Expected path: `approve`
  - Why:
    - payer is `Apex Health Plan`
    - plan is `Commercial PPO 500`
    - CPT `99213`
    - diagnosis `E11.9` and `I10`
    - place of service `11`
    - amount `150`
    - one service line

- `apex_review_99213_high_amount.x12`
  - Expected path: `deny`
  - Why:
    - amount is above the current MVP validation guardrail of `1000`
    - deterministic validation should fail

- `apex_review_97110_weak_match.x12`
  - Expected path: `review`
  - Why:
    - validation passes because `M54.5` + `97110` is an allowed pair
    - but the claim falls outside the narrow straight-through profile because:
      - CPT is not the office-visit path
      - amount / service shape do not match the simple office-visit auto-approval profile
    - it should also have weaker overlap with the uploaded Apex office-visit policy

## Upload Example

```bash
curl -X POST http://localhost:8000/api/claims/upload-x12 \
  -F "file=@sample_data/claims/apex_approve_99213.x12"
```

## Batch Upload Example

```bash
curl -X POST http://localhost:8000/api/claims/upload-x12-batch \
  -F "file=@sample_data/claims/apex_bulk_mixed_6_claims.x12"
```

## Important

These files are aligned to the backend as of the current MVP:
- `approve` is driven by a narrow deterministic rule
- `deny` happens when validation fails
- `review` happens when the claim is valid but outside the strict first-pass straight-through profile
