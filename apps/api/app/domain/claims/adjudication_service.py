from __future__ import annotations

from app.domain.claims.models import (
    AdjudicationCheck,
    AdjudicationDecision,
    ClaimSubmission,
    PayerVerificationContext,
    PolicyMatch,
    ProviderAdjudicationContext,
    UtilizationContext,
    ValidationResult,
)


class AdjudicationService:
    straight_through_amount_limit = 250.0
    prior_auth_guardrail_codes = {"27447", "29881", "45385", "70553"}

    def adjudicate(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        policies: list[PolicyMatch],
        provider_context: ProviderAdjudicationContext | None = None,
        utilization_context: UtilizationContext | None = None,
        payer_verification_context: PayerVerificationContext | None = None,
    ) -> AdjudicationDecision:
        resolved_utilization = utilization_context or self.build_utilization_context(claim)
        passed_checks, failed_checks, review_checks = self._evaluate_checks(
            claim=claim,
            validation=validation,
            policies=policies,
            provider_context=provider_context,
            utilization_context=resolved_utilization,
            payer_verification_context=payer_verification_context,
        )
        review_triggers = [check.summary for check in review_checks]
        top_policy = policies[0] if policies else None

        if failed_checks:
            failure_summary = "; ".join(check.summary for check in failed_checks[:2])
            rationale = (
                "The claim failed deterministic adjudication checks: "
                f"{failure_summary}."
            )
            if top_policy:
                rationale += f" Top policy evidence came from {top_policy.title}."
            return AdjudicationDecision(
                outcome="deny",
                rationale=rationale,
                cited_rules=[policy.policy_id for policy in policies],
                passed_checks=passed_checks,
                failed_checks=failed_checks,
                review_triggers=review_triggers,
            )

        if review_checks:
            trigger_summary = "; ".join(review_triggers[:2])
            rationale = (
                "The claim passed baseline validation but still needs manual review because "
                f"{trigger_summary}."
            )
            if top_policy:
                rationale += f" The strongest policy evidence came from {top_policy.title}."
            return AdjudicationDecision(
                outcome="review",
                rationale=rationale,
                cited_rules=[policy.policy_id for policy in policies],
                passed_checks=passed_checks,
                failed_checks=[],
                review_triggers=review_triggers,
            )

        rationale = (
            "The claim passed the straight-through adjudication checks for supported diagnosis pairing, "
            "policy relevance, office-visit guardrails, and provider verification."
        )
        if top_policy:
            rationale += f" Primary supporting evidence came from {top_policy.title}."
        return AdjudicationDecision(
            outcome="approve",
            rationale=rationale,
            cited_rules=[policy.policy_id for policy in policies],
            passed_checks=passed_checks,
            failed_checks=[],
            review_triggers=[],
        )

    def explain(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        policies: list[PolicyMatch],
        provider_context: ProviderAdjudicationContext | None = None,
        utilization_context: UtilizationContext | None = None,
        payer_verification_context: PayerVerificationContext | None = None,
        *,
        outcome: str,
        rationale: str,
        cited_rules: list[str],
    ) -> AdjudicationDecision:
        evaluated = self.adjudicate(
            claim,
            validation,
            policies,
            provider_context,
            utilization_context,
            payer_verification_context,
        )
        return AdjudicationDecision(
            outcome=outcome,
            rationale=rationale,
            cited_rules=cited_rules,
            passed_checks=evaluated.passed_checks,
            failed_checks=evaluated.failed_checks,
            review_triggers=evaluated.review_triggers,
        )

    def _evaluate_checks(
        self,
        *,
        claim: ClaimSubmission,
        validation: ValidationResult,
        policies: list[PolicyMatch],
        provider_context: ProviderAdjudicationContext | None,
        utilization_context: UtilizationContext,
        payer_verification_context: PayerVerificationContext | None,
    ) -> tuple[list[AdjudicationCheck], list[AdjudicationCheck], list[AdjudicationCheck]]:
        issue_codes = {issue.code for issue in validation.issues}
        passed: list[AdjudicationCheck] = []
        failed: list[AdjudicationCheck] = []
        review: list[AdjudicationCheck] = []

        supported_profile = (
            claim.claim_type == "professional_outpatient"
            and claim.form_type == "CMS-1500"
        )
        if supported_profile:
            passed.append(
                AdjudicationCheck(
                    code="supported_claim_profile",
                    label="Supported Claim Profile",
                    status="passed",
                    source="validation",
                    summary="Claim type and form are supported for the MVP adjudication lane.",
                )
            )
        else:
            failed.append(
                AdjudicationCheck(
                    code="unsupported_claim_profile",
                    label="Supported Claim Profile",
                    status="failed",
                    source="validation",
                    summary="Claim type or form falls outside the supported professional outpatient profile.",
                )
            )

        if "diagnosis_procedure_mismatch" in issue_codes:
            failed.append(
                AdjudicationCheck(
                    code="diagnosis_procedure_alignment",
                    label="Diagnosis Procedure Alignment",
                    status="failed",
                    source="validation",
                    summary="Diagnosis support does not align with the billed procedure code set.",
                )
            )
        else:
            passed.append(
                AdjudicationCheck(
                    code="diagnosis_procedure_alignment",
                    label="Diagnosis Procedure Alignment",
                    status="passed",
                    source="validation",
                    summary="Diagnosis support aligns with the billed procedure codes.",
                )
            )

        if claim.rendering_provider_id or claim.billing_provider_id:
            passed.append(
                AdjudicationCheck(
                    code="provider_role_capture",
                    label="Provider Role Capture",
                    status="passed",
                    source="provider",
                    summary="Billing and rendering provider context is present for downstream adjudication checks.",
                )
            )

        if "eligibility_mismatch" in issue_codes:
            failed.append(
                AdjudicationCheck(
                    code="provider_identifier_verification",
                    label="Provider Verification",
                    status="failed",
                    source="provider",
                    summary="Provider identifier failed baseline eligibility verification.",
                )
            )
        else:
            passed.append(
                AdjudicationCheck(
                    code="provider_identifier_verification",
                    label="Provider Verification",
                    status="passed",
                    source="provider",
                    summary="Provider identifier cleared baseline verification.",
                )
            )

        if payer_verification_context is not None:
            eligibility = payer_verification_context.eligibility
            if eligibility.status == "eligible":
                passed.append(
                    AdjudicationCheck(
                        code="member_eligibility_status",
                        label="Member Eligibility",
                        status="passed",
                        source="validation",
                        summary="Member eligibility is active for the mocked coverage window.",
                    )
                )
            elif eligibility.status == "manual_review":
                review.append(
                    AdjudicationCheck(
                        code="member_eligibility_status",
                        label="Member Eligibility",
                        status="review",
                        source="validation",
                        summary=eligibility.notes[0]
                        if eligibility.notes
                        else "Eligibility requires manual payer review.",
                    )
                )
            else:
                failed.append(
                    AdjudicationCheck(
                        code="member_eligibility_status",
                        label="Member Eligibility",
                        status="failed",
                        source="validation",
                        summary=eligibility.notes[0]
                        if eligibility.notes
                        else "Member is not eligible for the mocked coverage window.",
                    )
                )

        if provider_context is None:
            review.append(
                AdjudicationCheck(
                    code="provider_contract_context",
                    label="Provider Contract Context",
                    status="review",
                    source="provider",
                    summary="Provider contract context could not be resolved for adjudication.",
                )
            )
        else:
            if provider_context.network_status == "in_network":
                passed.append(
                    AdjudicationCheck(
                        code="provider_network_status",
                        label="Provider Network Status",
                        status="passed",
                        source="provider",
                        summary=(
                            f"Provider is in network"
                            + (
                                f" under contract tier {provider_context.contract_tier}."
                                if provider_context.contract_tier
                                else "."
                            )
                        ),
                    )
                )
            elif provider_context.network_status == "out_of_network":
                review.append(
                    AdjudicationCheck(
                        code="provider_network_status",
                        label="Provider Network Status",
                        status="review",
                        source="provider",
                        summary="Provider is marked out of network and may require alternate reimbursement handling.",
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="provider_network_status",
                        label="Provider Network Status",
                        status="review",
                        source="provider",
                        summary="Provider network status is pending verification.",
                    )
                )

            if provider_context.contract_status == "active":
                passed.append(
                    AdjudicationCheck(
                        code="provider_contract_status",
                        label="Provider Contract Status",
                        status="passed",
                        source="provider",
                        summary="Provider contract is active for adjudication use.",
                    )
                )
            elif provider_context.contract_status == "inactive":
                review.append(
                    AdjudicationCheck(
                        code="provider_contract_status",
                        label="Provider Contract Status",
                        status="review",
                        source="provider",
                        summary="Provider contract is inactive and needs manual reimbursement review.",
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="provider_contract_status",
                        label="Provider Contract Status",
                        status="review",
                        source="provider",
                        summary="Provider contract status is pending confirmation.",
                    )
                )

            if provider_context.credential_status == "credentialed":
                passed.append(
                    AdjudicationCheck(
                        code="provider_credential_status",
                        label="Credential Status",
                        status="passed",
                        source="provider",
                        summary="Provider is credentialed for adjudication use.",
                    )
                )
            elif provider_context.credential_status == "sanctioned":
                failed.append(
                    AdjudicationCheck(
                        code="provider_credential_status",
                        label="Credential Status",
                        status="failed",
                        source="provider",
                        summary="Provider is marked sanctioned and cannot be auto-adjudicated.",
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="provider_credential_status",
                        label="Credential Status",
                        status="review",
                        source="provider",
                        summary=f"Provider credential status is {provider_context.credential_status} and needs manual confirmation.",
                    )
                )

            if provider_context.participates_in_plan:
                passed.append(
                    AdjudicationCheck(
                        code="provider_plan_participation",
                        label="Plan Participation",
                        status="passed",
                        source="provider",
                        summary="Provider participates in the claim plan configuration.",
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="provider_plan_participation",
                        label="Plan Participation",
                        status="review",
                        source="provider",
                        summary="Provider plan participation is not explicitly configured for this plan.",
                    )
                )

            if claim.referring_provider_id:
                if provider_context.accepting_referrals:
                    passed.append(
                        AdjudicationCheck(
                            code="provider_referral_acceptance",
                            label="Referral Acceptance",
                            status="passed",
                            source="provider",
                            summary="Rendering provider is configured to accept referred specialty care.",
                        )
                    )
                else:
                    review.append(
                        AdjudicationCheck(
                            code="provider_referral_acceptance",
                            label="Referral Acceptance",
                            status="review",
                            source="provider",
                            summary="Rendering provider is not configured as accepting referrals for this specialist workflow.",
                        )
                    )

            if claim.facility_name:
                facility_names = {item.lower() for item in provider_context.facility_affiliations}
                if not facility_names:
                    review.append(
                        AdjudicationCheck(
                            code="provider_facility_affiliation",
                            label="Facility Affiliation",
                            status="review",
                            source="provider",
                            summary="Provider facility affiliation is not configured for this claim.",
                        )
                    )
                elif claim.facility_name.lower() in facility_names:
                    passed.append(
                        AdjudicationCheck(
                            code="provider_facility_affiliation",
                            label="Facility Affiliation",
                            status="passed",
                            source="provider",
                            summary=f"Provider is affiliated with {claim.facility_name}.",
                        )
                    )
                else:
                    review.append(
                        AdjudicationCheck(
                            code="provider_facility_affiliation",
                            label="Facility Affiliation",
                            status="review",
                            source="provider",
                            summary=f"Claim facility {claim.facility_name} is not in the configured provider affiliation list.",
                        )
                    )

            if provider_context.specialty_match is True:
                passed.append(
                    AdjudicationCheck(
                        code="provider_specialty_alignment",
                        label="Specialty Alignment",
                        status="passed",
                        source="provider",
                        summary=provider_context.specialty_match_reason
                        or "Provider specialty aligns with the billed service profile.",
                    )
                )
            elif provider_context.specialty_match is False:
                review.append(
                    AdjudicationCheck(
                        code="provider_specialty_alignment",
                        label="Specialty Alignment",
                        status="review",
                        source="provider",
                        summary=provider_context.specialty_match_reason
                        or "Provider specialty does not clearly align with the billed service profile.",
                    )
                )

        top_policy = policies[0] if policies else None
        if top_policy is None:
            review.append(
                AdjudicationCheck(
                    code="policy_evidence_strength",
                    label="Policy Evidence",
                    status="review",
                    source="policy",
                    summary="No indexed policy evidence was retrieved for this claim.",
                )
            )
        elif top_policy.relevance_score >= 0.8:
            passed.append(
                AdjudicationCheck(
                    code="policy_evidence_strength",
                    label="Policy Evidence",
                    status="passed",
                    source="policy",
                    summary=f"Strong policy evidence was retrieved from {top_policy.title}.",
                )
            )
        else:
            review.append(
                AdjudicationCheck(
                    code="policy_evidence_strength",
                    label="Policy Evidence",
                    status="review",
                    source="policy",
                    summary=f"Policy evidence from {top_policy.title} was only moderately aligned.",
                )
            )

        simple_profile = (
            claim.place_of_service == "11"
            and len(claim.service_lines) == 1
            and claim.amount <= self.straight_through_amount_limit
        )
        if simple_profile:
            passed.append(
                AdjudicationCheck(
                    code="straight_through_guardrails",
                    label="Straight Through Guardrails",
                    status="passed",
                    source="integrity",
                    summary="Claim fits the MVP straight-through office-visit guardrails.",
                )
            )
        elif claim.amount > 1000:
            failed.append(
                AdjudicationCheck(
                    code="straight_through_guardrails",
                    label="Straight Through Guardrails",
                    status="failed",
                    source="integrity",
                    summary="Billed amount exceeds the current MVP adjudication guardrail.",
                )
            )
        else:
            review_reasons = []
            if claim.place_of_service != "11":
                review_reasons.append(f"place of service {claim.place_of_service}")
            if len(claim.service_lines) > 1:
                review_reasons.append("multiple service lines")
            if claim.amount > self.straight_through_amount_limit:
                review_reasons.append(f"amount {claim.amount:.2f} exceeds straight-through threshold")
            review.append(
                AdjudicationCheck(
                    code="straight_through_guardrails",
                    label="Straight Through Guardrails",
                    status="review",
                    source="integrity",
                    summary=(
                        "Claim falls outside the narrow straight-through lane because "
                        + ", ".join(review_reasons)
                        + "."
                    ),
                )
            )

        if utilization_context.prior_auth_required:
            if utilization_context.prior_auth_status == "satisfied":
                passed.append(
                    AdjudicationCheck(
                        code="prior_auth_guardrail",
                        label="Prior Authorization Screen",
                        status="passed",
                        source="utilization",
                        summary="Prior authorization identifier is present for the procedures that require it.",
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="prior_auth_guardrail",
                        label="Prior Authorization Screen",
                        status="review",
                        source="utilization",
                        summary=utilization_context.review_reason
                        or (
                            "Procedure codes "
                            + ", ".join(utilization_context.trigger_codes)
                            + " typically require prior authorization verification."
                        ),
                    )
                )
        else:
            passed.append(
                AdjudicationCheck(
                    code="prior_auth_guardrail",
                    label="Prior Authorization Screen",
                    status="passed",
                    source="utilization",
                    summary="No prior-authorization-only procedures were detected in this claim.",
                )
            )

        if payer_verification_context is not None:
            referral = payer_verification_context.referral
            if referral.required and referral.status == "verified":
                passed.append(
                    AdjudicationCheck(
                        code="referral_verification",
                        label="Referral Verification",
                        status="passed",
                        source="utilization",
                        summary=f"Referral {referral.referral_id} satisfies the mocked specialist-access requirement.",
                    )
                )
            elif referral.required and referral.status in {"missing", "manual_review"}:
                review.append(
                    AdjudicationCheck(
                        code="referral_verification",
                        label="Referral Verification",
                        status="review",
                        source="utilization",
                        summary=referral.notes[0]
                        if referral.notes
                        else "Referral verification requires manual review.",
                    )
                )

            pricing = payer_verification_context.pricing
            if pricing.status in {"priced_in_line", "adjusted"}:
                passed.append(
                    AdjudicationCheck(
                        code="pricing_alignment",
                        label="Pricing Alignment",
                        status="passed",
                        source="integrity",
                        summary=(
                            "Mock allowed amount aligns with the billed amount for this claim."
                            if pricing.status == "priced_in_line"
                            else f"Mock pricing projects an allowed amount of {pricing.allowed_amount:.2f} for this claim."
                        ),
                    )
                )
            else:
                review.append(
                    AdjudicationCheck(
                        code="pricing_alignment",
                        label="Pricing Alignment",
                        status="review",
                        source="integrity",
                        summary=pricing.notes[-1]
                        if pricing.notes
                        else "Allowed amount differs from billed amount and should be reviewed.",
                    )
                )

        if utilization_context.utilization_level == "elevated":
            review.append(
                AdjudicationCheck(
                    code="utilization_review_screen",
                    label="Utilization Review",
                    status="review",
                    source="utilization",
                    summary=utilization_context.review_reason
                    or "Claim utilization traits warrant manual utilization review.",
                )
            )
        else:
            passed.append(
                AdjudicationCheck(
                    code="utilization_review_screen",
                    label="Utilization Review",
                    status="passed",
                    source="utilization",
                    summary="No elevated utilization triggers were detected for this claim.",
                )
            )

        for issue in validation.issues:
            if issue.code in {
                "unsupported_claim_type",
                "unsupported_form_type",
                "diagnosis_procedure_mismatch",
                "eligibility_mismatch",
                "high_amount_mvp_guardrail",
            }:
                continue
            target = review if issue.severity != "error" else failed
            target.append(
                AdjudicationCheck(
                    code=issue.code,
                    label="Validation Check",
                    status="review" if issue.severity != "error" else "failed",
                    source="validation",
                    summary=issue.message,
                )
            )

        return passed, failed, review

    def build_utilization_context(self, claim: ClaimSubmission) -> UtilizationContext:
        prior_auth_hits = sorted(
            set(claim.procedure_codes).intersection(self.prior_auth_guardrail_codes)
        )
        if prior_auth_hits:
            return UtilizationContext(
                utilization_level="prior_auth",
                prior_auth_required=True,
                prior_auth_status="satisfied" if claim.prior_authorization_id else "pending_review",
                trigger_codes=prior_auth_hits,
                review_reason=(
                    None
                    if claim.prior_authorization_id
                    else "Procedure codes "
                    + ", ".join(prior_auth_hits)
                    + " typically require prior authorization verification."
                ),
                notes=[
                    (
                        f"Prior authorization {claim.prior_authorization_id} is attached to this claim."
                        if claim.prior_authorization_id
                        else "Manual utilization review is recommended before final adjudication."
                    ),
                    (
                        "Authorization presence is modeled from the claim payload and should be cross-checked with payer records."
                        if claim.prior_authorization_id
                        else "No prior authorization artifact is currently captured in the claim payload."
                    ),
                ],
            )

        elevated_notes: list[str] = []
        if claim.place_of_service != "11":
            elevated_notes.append(
                f"Place of service {claim.place_of_service} falls outside the office-visit fast lane."
            )
        if len(claim.service_lines) > 1:
            elevated_notes.append("Multiple service lines increase utilization review complexity.")
        if claim.amount > self.straight_through_amount_limit:
            elevated_notes.append(
                f"Billed amount {claim.amount:.2f} exceeds the straight-through threshold."
            )

        if elevated_notes:
            return UtilizationContext(
                utilization_level="elevated",
                prior_auth_required=False,
                prior_auth_status="not_required",
                review_reason="Claim utilization traits fall outside the MVP straight-through lane.",
                notes=elevated_notes,
            )

        return UtilizationContext(
            utilization_level="routine",
            prior_auth_required=False,
            prior_auth_status="not_required",
            notes=["Claim fits the routine outpatient utilization profile."],
        )
