# Claim Document Demo Pack

This folder contains synthetic claim-document inputs for the AI intake demo flow.

Files:
- `clean_claim_form.pdf`
- `clean_claim_form.png`
- `messy_scanned_claim.png`
- `APX-OCR-HERO-ORTHO-3001.pdf`
- `APX-OCR-HERO-ORTHO-3001.png`
- `APX-OCR-HERO-ORTHO-3001.md`
- `APX-OCR-HERO-ORTHO-3001.expected-draft.json`
- `APX-OCR-HERO-ORTHO-3001.expected-outcome.md`

Recommended usage:
- `clean_claim_form.pdf`
  - best for showing a clean document-to-draft extraction flow
- `clean_claim_form.png`
  - best for showing image upload with a likely high-confidence draft
- `messy_scanned_claim.png`
  - best for showing low-confidence extraction and human review of missing fields

Suggested demo flow:
1. Upload `clean_claim_form.png` or `clean_claim_form.pdf` in AI Intake
2. Show the extracted draft and agent workflow
3. Process the reviewed draft into adjudication
4. Upload `messy_scanned_claim.png`
5. Show low-confidence fields / missing-field review

Recommended hero flow for the richer claim model:
1. Upload `APX-OCR-HERO-ORTHO-3001.pdf` or `APX-OCR-HERO-ORTHO-3001.png`
2. Show that AI intake extracts member, provider, facility, diagnosis, CPT, and billed amount
3. Highlight the missing `prior_authorization_id`
4. Compare the extracted draft against `APX-OCR-HERO-ORTHO-3001.expected-draft.json`
5. Process the draft and land in the expected `review` path described in `APX-OCR-HERO-ORTHO-3001.expected-outcome.md`

These are synthetic demo artifacts only and do not contain real patient data.
