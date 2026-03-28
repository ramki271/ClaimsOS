from app.models.claim import ClaimSubmission, ValidationIssue, ValidationResult


class ValidationService:
    allowed_pairs = {
        ("E11.9", "99213"),
        ("J02.9", "99213"),
        ("M54.5", "97110"),
        ("R51.9", "99214"),
    }

    def validate(self, claim: ClaimSubmission) -> ValidationResult:
        issues: list[ValidationIssue] = []

        if not claim.claim_id:
            issues.append(
                ValidationIssue(code="missing_claim_id", message="Claim ID is required.")
            )

        if claim.amount > 1000:
            issues.append(
                ValidationIssue(
                    code="high_amount_mvp_guardrail",
                    message="Claim amount exceeds the MVP auto-adjudication range.",
                )
            )

        for diagnosis in claim.diagnosis_codes:
            for procedure in claim.procedure_codes:
                if (diagnosis, procedure) not in self.allowed_pairs:
                    issues.append(
                        ValidationIssue(
                            code="diagnosis_procedure_mismatch",
                            message=f"{diagnosis} is not currently configured for {procedure}.",
                        )
                    )

        if claim.provider_id.startswith("ZZ"):
            issues.append(
                ValidationIssue(
                    code="eligibility_mismatch",
                    message="Provider failed mocked eligibility verification.",
                )
            )

        return ValidationResult(is_valid=len(issues) == 0, issues=issues)

