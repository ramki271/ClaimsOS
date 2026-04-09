from __future__ import annotations

from app.domain.claims.models import (
    ClaimSubmission,
    EligibilityContext,
    PayerVerificationContext,
    PricingContext,
    PricingLineResult,
    PriorAuthorizationVerification,
    ProviderAdjudicationContext,
    ReferralVerification,
)


class PayerVerificationService:
    prior_auth_required_codes = {"27447", "29881", "45385", "70553"}
    referral_required_codes = {"99244", "99245", "27447", "93000"}

    def build(
        self,
        claim: ClaimSubmission,
        provider_context: ProviderAdjudicationContext | None = None,
    ) -> PayerVerificationContext:
        eligibility = self.build_eligibility(claim)
        prior_auth = self.build_prior_authorization(claim)
        referral = self.build_referral(claim)
        pricing = self.build_pricing(claim, provider_context)
        return PayerVerificationContext(
            eligibility=eligibility,
            prior_authorization=prior_auth,
            referral=referral,
            pricing=pricing,
        )

    def build_eligibility(self, claim: ClaimSubmission) -> EligibilityContext:
        coverage_window = "2026-01-01 to 2026-12-31"
        notes = [f"Coverage checked for date of service {claim.date_of_service.isoformat()}."]
        member_key = claim.member_id.upper()
        if member_key.startswith(("TERM", "INELIG")):
            notes.append("Mock member profile is marked inactive for payer eligibility.")
            return EligibilityContext(
                status="ineligible",
                coverage_window=coverage_window,
                notes=notes,
            )
        if claim.date_of_service.year != 2026:
            notes.append("Date of service falls outside the mocked active benefit year.")
            return EligibilityContext(
                status="manual_review",
                coverage_window=coverage_window,
                notes=notes,
            )
        notes.append(f"Plan {claim.plan_name} is modeled as active for this member.")
        return EligibilityContext(
            status="eligible",
            coverage_window=coverage_window,
            notes=notes,
        )

    def build_prior_authorization(
        self,
        claim: ClaimSubmission,
    ) -> PriorAuthorizationVerification:
        trigger_codes = sorted(
            set(claim.procedure_codes).intersection(self.prior_auth_required_codes)
        )
        if not trigger_codes:
            return PriorAuthorizationVerification(
                required=False,
                status="not_required",
                notes=["No procedures on this claim require prior authorization in the mock payer matrix."],
            )

        if not claim.prior_authorization_id:
            return PriorAuthorizationVerification(
                required=True,
                status="missing",
                notes=[
                    "The billed procedure set falls into the prior-authorization-required category.",
                    "No authorization identifier is attached to the claim payload.",
                ],
            )

        auth_id = claim.prior_authorization_id.strip().upper()
        if auth_id.startswith(("AUTH-", "PA-", "UM-")):
            approved_units = sum(line.units for line in claim.service_lines)
            return PriorAuthorizationVerification(
                required=True,
                status="verified",
                authorization_id=claim.prior_authorization_id,
                approved_units=approved_units,
                notes=[
                    f"Authorization {claim.prior_authorization_id} matches the mock utilization workflow.",
                    f"Approved units modeled for this claim: {approved_units}.",
                ],
            )

        return PriorAuthorizationVerification(
            required=True,
            status="manual_review",
            authorization_id=claim.prior_authorization_id,
            notes=[
                "Authorization identifier format does not match the mock payer verification rules.",
                "Cross-check against the payer utilization system is recommended.",
            ],
        )

    def build_referral(self, claim: ClaimSubmission) -> ReferralVerification:
        referral_required = "hmo" in claim.plan_name.lower() and bool(
            set(claim.procedure_codes).intersection(self.referral_required_codes)
        )
        if not referral_required:
            return ReferralVerification(
                required=False,
                status="not_required",
                notes=["Referral is not required for this plan and procedure combination in the mock rules."],
            )

        if not claim.referral_id:
            return ReferralVerification(
                required=True,
                status="missing",
                notes=[
                    "Plan/product combination is modeled as requiring a PCP referral for this service.",
                    "No referral identifier is attached to the claim payload.",
                ],
            )

        referral_id = claim.referral_id.strip().upper()
        if referral_id.startswith(("REF-", "PCP-", "SPECIALTY-")):
            return ReferralVerification(
                required=True,
                status="verified",
                referral_id=claim.referral_id,
                notes=[
                    f"Referral {claim.referral_id} satisfies the mock specialist access requirement.",
                ],
            )

        return ReferralVerification(
            required=True,
            status="manual_review",
            referral_id=claim.referral_id,
            notes=[
                "Referral identifier format does not match the mock referral system.",
                "Manual review should confirm PCP referral provenance.",
            ],
        )

    def build_pricing(
        self,
        claim: ClaimSubmission,
        provider_context: ProviderAdjudicationContext | None = None,
    ) -> PricingContext:
        if provider_context and provider_context.network_status == "out_of_network":
            multiplier = 0.55
            status = "manual_review"
            notes = ["Out-of-network pricing uses a reduced mock allowed amount and requires reimbursement review."]
        elif claim.place_of_service == "11":
            multiplier = 0.82
            status = "adjusted"
            notes = ["Office-based professional pricing uses the mock in-network allowed amount schedule."]
        else:
            multiplier = 0.76
            status = "adjusted"
            notes = [f"Place of service {claim.place_of_service} uses a non-office allowed amount schedule."]

        line_results = []
        allowed_total = 0.0
        for line in claim.service_lines:
            allowed = round(line.charge_amount * multiplier, 2)
            allowed_total += allowed
            line_results.append(
                PricingLineResult(
                    line_number=line.line_number,
                    procedure_code=line.procedure_code,
                    billed_amount=line.charge_amount,
                    allowed_amount=allowed,
                )
            )

        allowed_total = round(allowed_total, 2)
        billed_total = round(claim.amount, 2)
        adjustment_amount = round(max(billed_total - allowed_total, 0.0), 2)
        if adjustment_amount == 0 and status != "manual_review":
            status = "priced_in_line"
            notes = ["Allowed amount matches the billed amount under the mock payer pricing schedule."]
        else:
            notes.append(
                f"Mock pricing projects {allowed_total:.2f} allowed against {billed_total:.2f} billed."
            )

        return PricingContext(
            status=status,
            billed_amount=billed_total,
            allowed_amount=allowed_total,
            adjustment_amount=adjustment_amount,
            notes=notes,
            line_results=line_results,
        )
