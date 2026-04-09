# Sample Claim Pack

This folder is now organized around one current demo/testing entrypoint:

- [apex_bulk_realistic_5_claims.x12](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/apex_bulk_realistic_5_claims.x12)

That file is the main claim-ingest artifact to use for realistic demo flows because `837P / X12` is the primary external claim format we want to mimic.

## Current File

- `apex_bulk_realistic_5_claims.x12`
  - Use with: `POST /api/claims/upload-x12-batch`
  - Contains 5 scenarios aligned to the current Apex policy set and seeded provider/member data:
    - `CLM-X12-APPROVE-2001`
      - expected outcome: `approve`
      - clean in-network office visit for Elena Martinez / Front Range Family Medicine
    - `CLM-X12-REFERRAL-2002`
      - expected outcome: `review`
      - Jordan Lee / Commercial HMO Select / cardiology service missing referral
    - `CLM-X12-PRIORAUTH-2003`
      - expected outcome: `review`
      - Harold Bennett / orthopedic procedure missing prior auth
    - `CLM-X12-SANCTION-2004`
      - expected outcome: `deny`
      - sanctioned orthopedic provider
    - `CLM-X12-CORRECTED-2005`
      - expected outcome: `review`
      - corrected claim frequency code `7` without payer control reference

## Recommended Setup

1. Upload the current markdown policy set from [sample_data/policies](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies)
2. Seed providers from [sample_data/providers/apex_provider_seed_pack.json](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/providers/apex_provider_seed_pack.json)
3. Upload [apex_bulk_realistic_5_claims.x12](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/apex_bulk_realistic_5_claims.x12)

## Internal Fixtures

These files are still useful, but they are no longer the primary demo-facing claim assets:

- [internal_json/apex_scenario_manifest.json](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/internal_json/apex_scenario_manifest.json)
- [internal_json/advanced](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/internal_json/advanced)

Use those when you want:
- backend fixture coverage
- canonical JSON payload testing
- scenario-by-scenario debugging outside X12 upload

## Archive

Older MVP X12 files were moved to:

- [archive](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/archive)

They are kept for reference, but the current recommendation is to use the single bulk realistic X12 file above.

## Upload Example

```bash
curl -X POST http://localhost:8000/api/claims/upload-x12-batch \
  -F "file=@sample_data/claims/apex_bulk_realistic_5_claims.x12"
```

## Internal JSON Example

```bash
curl -X POST http://localhost:8000/api/claims/process \
  -H "Content-Type: application/json" \
  -d @sample_data/claims/internal_json/advanced/CLM-SCEN-APPROVE-1001.json
```

## Notes

- The current X12 parser now supports:
  - prior auth via `REF*G1`
  - referral via `REF*9F`
  - corrected claim references via `REF*F8`
  - claim frequency via `CLM05-3`
  - facility name via `NM1*77`
- The internal JSON fixtures remain useful because they can still express some richer canonical detail more directly than X12.
- The current bulk X12 pack uses unique claim IDs and April 2026 service dates to reduce duplicate-noise during demos.
