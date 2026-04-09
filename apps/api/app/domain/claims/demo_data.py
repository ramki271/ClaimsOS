from app.domain.claims.models import ClaimSubmission, ServiceLine


def get_demo_outpatient_claim() -> ClaimSubmission:
    """First-pass MVP claim type: a simple outpatient professional office visit."""
    return ClaimSubmission(
        claim_id="CLM-20260327-0001",
        claim_type="professional_outpatient",
        form_type="CMS-1500",
        payer_name="Apex Health Plan",
        plan_name="Commercial PPO 500",
        member_id="M-4421907",
        member_name="Elena Martinez",
        member_date_of_birth="1980-01-01",
        member_gender="female",
        subscriber_relationship="self",
        patient_id="PAT-1007",
        provider_id="PRV-4092",
        provider_name="Front Range Family Medicine",
        billing_provider_id="BILL-4092",
        billing_provider_name="Front Range Family Medicine",
        rendering_provider_id="PRV-4092",
        rendering_provider_name="Front Range Family Medicine",
        claim_frequency_code="1",
        place_of_service="11",
        diagnosis_codes=["E11.9", "I10"],
        procedure_codes=["99213"],
        service_lines=[
            ServiceLine(
                line_number=1,
                procedure_code="99213",
                modifiers=[],
                diagnosis_pointers=[1, 2],
                units=1,
                charge_amount=150.00,
            )
        ],
        amount=150.00,
        date_of_service="2026-03-01",
    )
