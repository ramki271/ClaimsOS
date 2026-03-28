from app.domain.claims.models import ClaimSubmission


class IntakeService:
    def normalize_claim(self, claim: ClaimSubmission) -> ClaimSubmission:
        """Return a canonical claim object for downstream services."""
        normalized_lines = [
            line.model_copy(
                update={
                    "procedure_code": line.procedure_code.strip().upper(),
                    "modifiers": [modifier.strip().upper() for modifier in line.modifiers],
                    "charge_amount": round(line.charge_amount, 2),
                }
            )
            for line in claim.service_lines
        ]
        procedure_codes = [line.procedure_code for line in normalized_lines]
        return ClaimSubmission(
            claim_id=claim.claim_id.strip(),
            claim_type=claim.claim_type,
            form_type=claim.form_type,
            payer_name=claim.payer_name.strip(),
            plan_name=claim.plan_name.strip(),
            member_id=claim.member_id.strip(),
            member_name=claim.member_name.strip(),
            patient_id=claim.patient_id.strip(),
            provider_id=claim.provider_id.strip(),
            provider_name=claim.provider_name.strip(),
            place_of_service=claim.place_of_service.strip(),
            diagnosis_codes=[code.strip().upper() for code in claim.diagnosis_codes],
            procedure_codes=list(dict.fromkeys(procedure_codes or claim.procedure_codes)),
            service_lines=normalized_lines,
            amount=round(sum(line.charge_amount for line in normalized_lines), 2),
            date_of_service=claim.date_of_service,
        )
