# Policy Ingestion Commands

Run these from the repo root while the API is running on `localhost:8000`.

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CORE" \
  -F "file=@sample_data/policies/APX-COM-500-EM-99213.md"
```

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CORE" \
  -F "file=@sample_data/policies/APX-POS-11-PROF-2026.md"
```

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=PROVIDER_POLICY" \
  -F "file=@sample_data/policies/APX-NET-TIER1-PROF-2026.md"
```

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=UTILIZATION_RULE" \
  -F "file=@sample_data/policies/APX-PRIORAUTH-ORTHO-2026.md"
```

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=INTEGRITY_RULE" \
  -F "file=@sample_data/policies/APX-DUP-FREQ-2026.md"
```

Optional manifest upload:

```bash
curl -X POST http://localhost:8000/api/policies/upload \
  -F "payer_name=Apex Health Plan" \
  -F "classification=POLICY_CATALOG" \
  -F "file=@sample_data/policies/apex_policy_manifest.json"
```
