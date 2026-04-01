# X12 837P Payload Guide

This guide explains what the current ClaimsOS backend accepts for `POST /api/claims/upload-x12`.

Important:
- This is **not** a full X12 compliance guide
- This is a guide for the **current MVP parser**
- The current parser supports a **first-pass subset of professional 837P**

## Current Support

The backend currently supports:
- single-claim professional `837P` uploads
- one claim per file
- common delimiter format using `*` as element separator and `~` as segment terminator
- common claim/service line segments needed for the MVP demo flow
- bulk `837P` batch uploads through a separate endpoint when one file contains multiple `CLM` claim groupings

The backend currently does **not** fully support:
- multiple claims in one file
- full loop-aware 837 parsing across all variants
- all payer-specific 837P variations
- full subscriber/patient relationship handling
- secondary coverage / COB complexity
- all date and composite permutations

## Endpoint

Upload endpoint:

```http
POST /api/claims/upload-x12
```

Bulk upload endpoint:

```http
POST /api/claims/upload-x12-batch
```

Multipart form field:

```text
file
```

Example:

```bash
curl -X POST http://localhost:8000/api/claims/upload-x12 \
  -F "file=@sample-837p.txt"
```

## Required Segments

For the current parser to work reliably, your payload should contain these segments:

- `CLM`
- `NM1*IL`
- `NM1*PR`
- `NM1*82` or `NM1*85`
- `SBR`
- `HI`
- `LX`
- `SV1`
- `DTP*472`

## How Fields Are Mapped

The parser currently maps the following segments into the canonical claim object:

- `CLM`
  - `CLM01` -> `claim_id`
  - `CLM02` -> `amount`
  - `CLM05` -> `place_of_service`

- `NM1*IL`
  - member/subscriber name
  - member id

- `NM1*QC`
  - patient id fallback

- `NM1*82` or `NM1*85`
  - provider name
  - provider identifier

- `NM1*PR`
  - payer name

- `SBR`
  - plan name

- `HI`
  - diagnosis codes

- `LX`
  - service line number

- `SV1`
  - procedure code
  - modifiers
  - line charge amount
  - units

- `DTP*472`
  - date of service

## Payload Rules

To work with the current parser, follow these rules:

1. Use one claim per file.
2. Include at least one `LX` + `SV1` service line pair.
3. Include at least one `HI` diagnosis segment.
4. Include a `DTP*472` date for the service line.
5. Use a valid `CLM` segment with claim id and total charge amount.
6. Include member info in `NM1*IL`.
7. Include provider info in `NM1*82` or `NM1*85`.
8. Include payer info in `NM1*PR`.

## Example Working Payload

```x12
ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260327*1200*^*00501*000000905*1*T*:~
GS*HC*SENDER*RECEIVER*20260327*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*0123*20260327*1200*CH~
NM1*41*2*CLAIMSOS SUBMITTER*****46*12345~
NM1*40*2*ACME CLEARINGHOUSE*****46*99999~
HL*1**20*1~
NM1*85*2*FRONT RANGE FAMILY MEDICINE*****XX*1299304491~
N3*123 MAIN ST~
N4*DENVER*CO*80202~
REF*EI*123456789~
HL*2*1*22*0~
SBR*P*18*COMMERCIAL PPO 500*****CI~
NM1*IL*1*MARTINEZ*ELENA****MI*M-4421907~
N3*123 OAK ST~
N4*DENVER*CO*80203~
DMG*D8*19800101*F~
NM1*PR*2*APEX HEALTH PLAN*****PI*842610001~
CLM*CLM-20260327-0001*150***11:B:1*Y*A*Y*Y~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213*150*UN*1***1~
DTP*472*D8*20260301~
SE*22*0001~
GE*1*1~
IEA*1*000000905~
```

## What Canonical Claim This Produces

Roughly:

```json
{
  "claim_id": "CLM-20260327-0001",
  "claim_type": "professional_outpatient",
  "form_type": "CMS-1500",
  "payer_name": "Apex Health Plan",
  "plan_name": "Commercial Ppo 500",
  "member_id": "M-4421907",
  "member_name": "Elena Martinez",
  "patient_id": "M-4421907",
  "provider_id": "1299304491",
  "provider_name": "Front Range Family Medicine",
  "place_of_service": "11",
  "diagnosis_codes": ["E119", "I10"],
  "procedure_codes": ["99213"],
  "service_lines": [
    {
      "line_number": 1,
      "procedure_code": "99213",
      "modifiers": [],
      "units": 1,
      "charge_amount": 150.0
    }
  ],
  "amount": 150.0,
  "date_of_service": "2026-03-01"
}
```

## Error Cases You May See

The parser will reject uploads with `400` if it cannot find core fields. Common errors include:

- `Could not find CLM segment with a claim identifier.`
- `Could not find subscriber/member information in NM1*IL.`
- `Could not find provider information in NM1*82 or NM1*85.`
- `Could not find any service lines in LX/SV1 segments.`
- `Could not find diagnosis codes in HI segments.`
- `Could not determine a date of service from DTP segments.`

## Bulk Uploads With Multiple Claims

Short answer: **yes, now through the batch endpoint**.

Current behavior:
- `POST /api/claims/upload-x12`
  - expects exactly one claim in the file
  - returns one canonical claim output
  - returns one adjudication result
- `POST /api/claims/upload-x12-batch`
  - accepts multiple `CLM` groupings in one file
  - splits them into separate canonical claims
  - processes each claim independently
  - returns batch results with per-claim success/failure

If you send multiple claims to the single-claim endpoint:
- the upload will now be rejected because that endpoint expects exactly one claim
- use the batch endpoint instead

So for now:
- `single claim file`: supported
- `bulk file with multiple claims`: supported through `POST /api/claims/upload-x12-batch`

## Recommended Current Usage

For the current MVP:

- upload one professional claim per file
- keep the payload simple
- use common 837P segment patterns
- test with office visit / simple outpatient claims first

## Remaining Bulk Limitations

The first-pass batch parser now supports multiple `CLM` groupings, but it still has MVP limitations:

1. it assumes a simplified professional `837P` layout
2. subscriber/provider/payer context is reused across claims unless reset by later segments
3. line-level parse errors are still coarse
4. payer-specific loop variations are not fully modeled
5. partial parse failure reporting is not yet segment-precise
