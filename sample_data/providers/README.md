# Sample Provider Seed Pack

This folder contains provider seed payloads aligned to the richer provider model in ClaimsOS.

These providers are synthetic and intended for demo/testing use with:
- the seeded Apex Health Plan member set
- the richer provider adjudication checks
- the current bulk X12 pack in [sample_data/claims/apex_bulk_realistic_5_claims.x12](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/apex_bulk_realistic_5_claims.x12)
- the internal canonical scenarios in [sample_data/claims/internal_json/advanced](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/internal_json/advanced)

## Recommended Seed Order

Use the single batch payload:
- [apex_provider_seed_pack.json](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/providers/apex_provider_seed_pack.json)

## What This Pack Covers

- primary care / family medicine
- orthopedic surgery
- provisional orthopedic provider
- cardiology
- sanctioned procedural provider

These providers are configured to exercise:
- taxonomy / specialty alignment
- credential status
- plan participation
- facility affiliation
- referral acceptance
- surgical privileges

## Suggested Seed Method

Submit each item in the `providers` array to:
- `POST /api/providers`

Example:

```bash
jq -c '.providers[]' sample_data/providers/apex_provider_seed_pack.json | while read -r row; do
  curl -X POST http://localhost:8000/api/providers \
    -H "Content-Type: application/json" \
    -d "$row"
done
```

## Important

This pack is aligned to the advanced claim scenarios and intentionally includes:
- one provider who does **not** accept referrals
- one provider with **provisional** credential status
- one provider with **sanctioned** credential status
- one orthopedic provider whose affiliated facilities intentionally do not match one scenario
