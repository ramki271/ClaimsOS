# Sample Policy Pack

This folder contains synthetic payer-side policy artifacts for ClaimsOS MVP testing.

These documents are:
- realistic in structure
- safe to ingest into the current Policy Manager flow
- not copied from any real payer policy

The root of this folder now keeps only the current markdown policy set.

Format variants were moved to:
- [format_variants/pdf](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies/format_variants/pdf)
- [format_variants/docx](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies/format_variants/docx)

Older markdown policies that are no longer part of the current recommendation were moved to:
- [archive](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies/archive)

Recommended upload tenant:
- `Apex Health Plan`

Recommended upload order:
1. `APX-COM-500-EM-99213.md`
2. `APX-PRIORAUTH-ORTHO-2026.md`
3. `APX-DUP-FREQ-2026.md`
4. `APX-REFERRAL-HMO-SPECIALIST-2026.md`
5. `APX-PROVIDER-CREDENTIALING-2026.md`
6. `APX-SPECIALTY-TAXONOMY-2026.md`
7. `APX-FACILITY-SITE-OF-CARE-2026.md`
8. `APX-PROF-ALLOWABLES-2026.md`
9. `apex_policy_manifest.json`

Suggested test sequence:
1. Upload the markdown policies in Policy Manager for payer `Apex Health Plan`
2. Verify they appear in the policy repository list
3. Seed providers from [sample_data/providers](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/providers)
4. Upload [sample_data/claims/apex_bulk_realistic_5_claims.x12](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/claims/apex_bulk_realistic_5_claims.x12)
5. Confirm the adjudication page shows policy matches grounded in the uploaded content

Format testing sequence:
1. Upload one of the files from [format_variants/pdf](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies/format_variants/pdf) to confirm PDF text extraction
2. Upload one of the files from [format_variants/docx](/Users/ramakrishnan.sridar/ClaimsOS1/ClaimsOS/sample_data/policies/format_variants/docx) to confirm DOCX text extraction
3. Verify chunk counts and repository rows update in Policy Manager

If you want to test from the terminal instead of the UI:

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CORE" \
  -F "file=@sample_data/policies/APX-COM-500-EM-99213.md"
```

Repeat for each file.
