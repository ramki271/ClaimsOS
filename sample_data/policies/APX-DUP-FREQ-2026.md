# Duplicate Billing and Frequency Guardrails

Policy ID: APX-DUP-FREQ-2026
Payer: Apex Health Plan
Product: Commercial PPO 500
Medical Logic Branch: Dup-Edit, Claims-Integrity
Adjudication Weight: 68.7
Ingestion Status: Ready for Upload
Effective Date: 2026-01-01

## Rule Summary

Claims should be evaluated for duplicate billing, frequency conflicts, and near-duplicate resubmissions prior to final adjudication.

## Duplicate Indicators

Review or flag claims when:
- the same member, provider, procedure code, and date of service appear on another finalized claim
- the billed amount matches a recent finalized claim with no documented correction indicator
- multiple office-visit claims are submitted for the same member and provider on the same date with no modifier or documented distinction

## Straight-Through Logic

Routine office visit claims may proceed when no duplicate indicators are present in recent claim history.

## Adjudication Recommendation

Use this rule as a claims-integrity safeguard. It should not block approval of a clean first-time CPT 99213 professional office visit claim with no prior duplicate history.
