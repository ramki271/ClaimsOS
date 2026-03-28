# Sample Policy Pack

This folder contains synthetic payer-side policy artifacts for ClaimsOS MVP testing.

These documents are:
- realistic in structure
- safe to ingest into the current Policy Manager flow
- not copied from any real payer policy

Recommended upload tenant:
- `Apex Health Plan`

Recommended upload order:
1. `APX-COM-500-EM-99213.md`
2. `APX-POS-11-PROF-2026.md`
3. `APX-NET-TIER1-PROF-2026.md`
4. `APX-PRIORAUTH-ORTHO-2026.md`
5. `APX-DUP-FREQ-2026.md`
6. `apex_policy_manifest.json`

Suggested test sequence:
1. Upload the markdown policies in Policy Manager for payer `Apex Health Plan`
2. Verify they appear in the policy repository list
3. Upload the sample single-claim `837P`
4. Confirm the adjudication page shows policy matches grounded in the uploaded content

If you want to test from the terminal instead of the UI:

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CORE" \
  -F "file=@sample_data/policies/APX-COM-500-EM-99213.md"
```

Repeat for each file.
