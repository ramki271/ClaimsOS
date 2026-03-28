from app.models.claim import AdjudicationDecision, ClaimSubmission, PolicyMatch, ValidationResult


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

        if claim.amount <= 250:
            return AdjudicationDecision(
                outcome="approve",
                rationale="The claim is within the MVP outpatient threshold and matches the currently supported diagnosis and procedure policy rules.",
                cited_rules=[policy.policy_id for policy in policies],
            )

        return AdjudicationDecision(
            outcome="review",
            rationale="The claim appears eligible but exceeds the low-risk auto-adjudication amount threshold for the MVP workflow.",
            cited_rules=[policy.policy_id for policy in policies],
        )

