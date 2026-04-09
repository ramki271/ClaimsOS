from app.domain.claims.models import ClaimSubmission, ValidationIssue, ValidationResult


class ValidationService:
    allowed_pairs = {
        ("E11.9", "99213"),
        ("I10", "99213"),
        ("J02.9", "99213"),
        ("M54.5", "97110"),
        ("M17.11", "27447"),
        ("M17.11", "29881"),
        ("R51.9", "99214"),
        ("I25.10", "93000"),
    }
    prior_auth_required_codes = {"27447", "29881", "45385", "70553"}
    referral_required_codes = {"99244", "99245", "27447", "93000"}
    required_modifier_rules = {
        "93000": {"25"},
        "29881": {"59"},
    }

    def validate(self, claim: ClaimSubmission) -> ValidationResult:
        issues: list[ValidationIssue] = []
        normalized_allowed_pairs = {
            (self._normalize_code(diagnosis), procedure.upper())
            for diagnosis, procedure in self.allowed_pairs
        }

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
                (self._normalize_code(diagnosis), procedure.upper()) in normalized_allowed_pairs
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

        if (
            set(claim.procedure_codes).intersection(self.prior_auth_required_codes)
            and not claim.prior_authorization_id
        ):
            issues.append(
                ValidationIssue(
                    code="prior_auth_missing",
                    message="A prior authorization identifier is expected for this procedure set.",
                    severity="warning",
                )
            )

        referral_required = "hmo" in claim.plan_name.lower() and bool(
            set(claim.procedure_codes).intersection(self.referral_required_codes)
        )
        if referral_required and not claim.referral_id:
            issues.append(
                ValidationIssue(
                    code="referral_missing",
                    message="A referral identifier is expected for this HMO specialist claim.",
                    severity="warning",
                )
            )

        if claim.claim_frequency_code in {"7", "8"} and not claim.payer_claim_control_number:
            issues.append(
                ValidationIssue(
                    code="claim_frequency_missing_reference",
                    message="Corrected or replacement claims should include the payer control number they supersede.",
                    severity="warning",
                )
            )

        present_modifiers = {modifier for line in claim.service_lines for modifier in line.modifiers}
        for procedure_code, required_modifiers in self.required_modifier_rules.items():
            if procedure_code in claim.procedure_codes and not present_modifiers.intersection(required_modifiers):
                issues.append(
                    ValidationIssue(
                        code="required_modifier_missing",
                        message=(
                            f"Procedure {procedure_code} is missing one of the expected modifiers: "
                            + ", ".join(sorted(required_modifiers))
                            + "."
                        ),
                        severity="warning",
                    )
                )

        return ValidationResult(
            is_valid=not any(issue.severity == "error" for issue in issues),
            issues=issues,
        )

    def _normalize_code(self, code: str) -> str:
        return code.replace(".", "").upper()
