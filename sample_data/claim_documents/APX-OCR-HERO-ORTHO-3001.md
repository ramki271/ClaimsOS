# APX-OCR-HERO-ORTHO-3001

This is the recommended OCR hero scenario for ClaimsOS.

## Scenario

- packet type: faxed orthopedic professional claim packet
- expected intake mode: AI document intake
- expected source type: `pdf` or `image`
- expected downstream outcome: `review`

## Why This Scenario

It uses the richer claim fields now supported end to end:

- member demographics
- billing and rendering provider roles
- facility name and NPI
- line-level CPT and charge amount
- claim-frequency context
- supporting-document references
- prior authorization review

It is also aligned to live seeded data:

- payer: `Apex Health Plan`
- member: `M-9011182` Harold Bennett
- provider: `PRV-ORTHO-100` Rocky Mountain Orthopedics
- facility: `St. Anthony Hospital, Lakewood`

## Packet Story

The packet represents a scheduled total knee arthroplasty submission from Rocky Mountain Orthopedics.

Page 1:
- fax cover sheet to Apex utilization management
- patient and provider references
- scheduled procedure and DOS
- handwritten note indicating prior authorization is still pending

Page 2:
- CMS-1500-style professional claim summary
- member identifiers
- provider identifiers
- facility information
- ICD-10 `M17.11`
- CPT `27447`
- billed amount `$980.00`

## Intended Review Trigger

The packet does **not** include a valid prior authorization number.

That means the OCR draft should still be rich and mostly complete, but the reviewer should see:

- missing field: `prior_authorization_id`
- review note that orthopedic surgery requires prior authorization

## Recommended Demo Flow

1. Upload the PDF or PNG version of this packet in AI intake.
2. Show the extracted draft.
3. Point out that the member, provider, facility, diagnosis, CPT, and amount were extracted.
4. Highlight that prior authorization was not found and needs reviewer attention.
5. Process the reviewed draft and show the adjudication path landing in `review`.
