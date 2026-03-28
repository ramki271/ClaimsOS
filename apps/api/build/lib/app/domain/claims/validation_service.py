from app.domain.claims.models import ClaimSubmission, ValidationIssue, ValidationResult


class ValidationService:
    allowed_pairs = {
        ("E11.9", "99213"),
        ("I10", "99213"),
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

        if claim.claim_type != "professional_outpatient":
            issues.append(
                ValidationIssue(
                    code="unsupported_claim_type",
                    message="The MVP currently supports only professional outpatient claims.",
                )
            )

        if claim.form_type != "CMS-1500":
            issues.append(
                ValidationIssue(
                    code="unsupported_form_type",
                    message="The MVP currently expects CMS-1500 style professional claims.",
                )
            )

        for procedure in claim.procedure_codes:
            supported = any(
                (diagnosis, procedure) in self.allowed_pairs
                for diagnosis in claim.diagnosis_codes
            )
            if not supported:
                issues.append(
                    ValidationIssue(
                        code="diagnosis_procedure_mismatch",
                        message=f"No supported diagnosis pairing was found for {procedure}.",
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
