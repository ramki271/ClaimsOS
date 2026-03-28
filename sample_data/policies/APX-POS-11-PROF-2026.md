# Professional Office Visit Place-of-Service Rule

Policy ID: APX-POS-11-PROF-2026
Payer: Apex Health Plan
Product: Commercial PPO 500
Medical Logic Branch: Prof-Out, Site-Care
Adjudication Weight: 79.4
Ingestion Status: Ready for Upload
Effective Date: 2026-01-01

## Rule Summary

Professional outpatient claims billed with place of service 11 represent physician office services and may proceed through automated review when documentation context and covered diagnosis pairings are present.

## Required Conditions

For office-visit claims to satisfy place-of-service logic:
- CLM05 must indicate place of service 11
- service line content must reflect a professional office setting
- the claim must not indicate an inpatient, ambulatory surgical center, or emergency department environment

## Straight-Through Processing Logic

Claims with professional office visit codes such as CPT 99213 and place of service 11 are eligible for straight-through review when:
- the provider is credentialed for outpatient professional services
- the member is active for the date of service
- no contradictory site-of-care signals are present

## Review Triggers

Route to review if:
- place of service 11 is billed with procedure patterns suggesting a facility or surgical environment
- service documentation conflicts with office-based care
- the claim presents missing or ambiguous site-of-care indicators

## Adjudication Recommendation

When CPT 99213 is paired with place of service 11, the place-of-service rule is satisfied unless another clinical, contractual, or integrity rule conflicts.
