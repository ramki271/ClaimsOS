# Apex Specialty and Taxonomy Alignment Policy 2026

Policy ID: APX-SPECIALTY-TAXONOMY-2026  
Payer: Apex Health Plan  
Effective Date: 2026-01-01  
Review Date: 2026-03-01  
Purpose: Align procedure families with provider specialty and taxonomy context.

## Policy Basis

ClaimsOS should compare billed procedure families against rendering provider specialty and taxonomy when available.

## Expected Alignment

- `99213`, `99214`
  - primary care / family medicine / internal medicine
  - taxonomy examples: `207Q00000X`, `207R00000X`, `208D00000X`
- `97110`
  - therapy / rehabilitation
  - taxonomy examples: `225100000X`, `225X00000X`
- `27447`, `29881`
  - orthopedic surgery
  - taxonomy example: `207X00000X`

## Adjudication Guidance

- Clear specialty/taxonomy mismatch should route to review.
- Matching specialty/taxonomy can strengthen provider evidence.
- Orthopedic procedural claims should show orthopedic specialty context in adjudication detail.
