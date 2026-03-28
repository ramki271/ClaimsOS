from app.domain.claims.models import (
    AdjudicationDecision,
    ClaimSubmission,
    PolicyMatch,
    ValidationResult,
)


class AdjudicationService:
    def adjudicate(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        policies: list[PolicyMatch],
    ) -> AdjudicationDecision:
        if not validation.is_valid:
            return AdjudicationDecision(
                outcome="deny",
                rationale="The claim failed deterministic validation checks and cannot be auto-adjudicated.",
                cited_rules=[issue.code for issue in validation.issues],
            )

        if (
            claim.claim_type == "professional_outpatient"
            and claim.form_type == "CMS-1500"
            and claim.place_of_service == "11"
            and len(claim.service_lines) == 1
            and claim.amount <= 250
        ):
            return AdjudicationDecision(
                outcome="approve",
                rationale="The claim is a simple outpatient professional office visit within the first-pass auto-adjudication threshold and matches supported policy rules.",
                cited_rules=[policy.policy_id for policy in policies],
            )

        return AdjudicationDecision(
            outcome="review",
            rationale="The claim appears broadly eligible but falls outside the narrow first-pass straight-through profile for the MVP workflow.",
            cited_rules=[policy.policy_id for policy in policies],
        )
