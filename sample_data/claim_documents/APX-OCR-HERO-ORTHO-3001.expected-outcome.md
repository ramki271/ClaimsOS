# APX-OCR-HERO-ORTHO-3001 Expected Outcome

## Intake Expectation

The draft should be largely complete and reviewer-friendly, with one meaningful gap:

- extracted successfully:
  - member identifiers and demographics
  - payer and plan
  - billing/rendering provider
  - referring provider
  - facility name and NPI
  - ICD-10 `M17.11`
  - CPT `27447`
  - billed amount `$980.00`
- missing:
  - `prior_authorization_id`

## Adjudication Expectation

Expected result after reviewer processes the draft without supplying an authorization number:

- outcome: `review`
- main trigger: missing prior authorization for orthopedic surgery
- supporting context:
  - in-network provider
  - matched provider specialty and taxonomy
  - affiliated facility
  - otherwise credible orthopedic surgery claim

## Reviewer Story

This scenario is useful because it shows that:

- OCR can recover a rich claim draft from a messy packet
- the user still needs to confirm or supply key utilization data
- the claim does not fail for vague reasons; it routes to review for a specific, explainable utilization gap
