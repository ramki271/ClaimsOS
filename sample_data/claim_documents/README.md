# Claim Document Demo Pack

This folder contains synthetic claim-document inputs for the AI intake demo flow.

Files:
- `clean_claim_form.pdf`
- `clean_claim_form.png`
- `messy_scanned_claim.png`

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

These are synthetic demo artifacts only and do not contain real patient data.
