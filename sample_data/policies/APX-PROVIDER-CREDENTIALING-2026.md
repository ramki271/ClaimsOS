# Apex Provider Credentialing Policy 2026

Policy ID: APX-PROVIDER-CREDENTIALING-2026  
Payer: Apex Health Plan  
Effective Date: 2026-01-01  
Review Date: 2026-03-01  
Purpose: Define adjudication handling based on provider credential status.

## Credential Status Tiers

- `credentialed`
  - eligible for normal adjudication
- `provisional`
  - requires manual confirmation for higher-risk or specialty claims
- `pending`
  - route to review until credentialing is confirmed
- `sanctioned`
  - do not auto-adjudicate; deny or route for credentialing intervention per payer operations

## Adjudication Guidance

- Sanctioned providers should not receive straight-through adjudication.
- Provisional providers may be reviewable when other claim traits are complex.
- Credential status should be shown in the provider evidence section of claim adjudication.
