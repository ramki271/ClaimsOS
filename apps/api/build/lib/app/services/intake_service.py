from app.models.claim import ClaimSubmission


class IntakeService:
    def normalize_claim(self, claim: ClaimSubmission) -> ClaimSubmission:
        """Return a canonical claim object for downstream services."""
        return ClaimSubmission(
            claim_id=claim.claim_id.strip(),
            patient_id=claim.patient_id.strip(),
            provider_id=claim.provider_id.strip(),
            diagnosis_codes=[code.strip().upper() for code in claim.diagnosis_codes],
            procedure_codes=[code.strip().upper() for code in claim.procedure_codes],
            amount=round(claim.amount, 2),
            date_of_service=claim.date_of_service,
        )

