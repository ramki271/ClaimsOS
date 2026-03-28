# Prior Authorization Rule for Orthopedic Surgical Services

Policy ID: APX-PRIORAUTH-ORTHO-2026
Payer: Apex Health Plan
Product: Commercial PPO 500
Medical Logic Branch: Prior-Auth, Ortho-Surg
Adjudication Weight: 91.8
Ingestion Status: Ready for Upload
Effective Date: 2026-01-01

## Rule Summary

Selected orthopedic surgical procedures require prior authorization before reimbursement. This rule is included in the test pack so ClaimsOS can distinguish routine office visits from higher-scrutiny surgical services.

## Procedures Commonly Requiring Prior Authorization

Examples include:
- CPT 27447
- CPT 29881
- CPT 29888
- CPT 23472

## Review Logic

Claims billed with the above orthopedic surgical procedures should route to review when no valid prior authorization record is present for the service date and servicing provider.

Routine office evaluation and management claims such as CPT 99213 do not require prior authorization under this rule unless bundled with a separately reviewable service.

## Adjudication Recommendation

Do not use this rule to deny routine outpatient office visits. Use it to identify orthopedic surgical claims that require prior authorization verification.
