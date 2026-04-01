from app.domain.claims.models import AdjudicationDecision, ValidationResult


class ConfidenceService:
    issue_penalties = {
        "high_amount_mvp_guardrail": 0.16,
        "diagnosis_procedure_mismatch": 0.12,
        "eligibility_mismatch": 0.1,
        "unsupported_claim_type": 0.14,
        "unsupported_form_type": 0.14,
        "missing_claim_id": 0.2,
    }

    def score(self, validation: ValidationResult, decision: AdjudicationDecision) -> float:
        if not validation.is_valid or decision.failed_checks:
            return self._score_denial_like_path(validation, decision)

        if decision.outcome == "approve":
            if decision.review_triggers:
                return 0.78
            policy_bonus = min(len(decision.cited_rules) * 0.01, 0.03)
            passed_bonus = min(len(decision.passed_checks) * 0.005, 0.04)
            return min(0.98, round(0.9 + policy_bonus + passed_bonus, 3))

        if decision.outcome == "review":
            review_penalty = min(len(decision.review_triggers) * 0.04, 0.12)
            failed_penalty = min(len(decision.failed_checks) * 0.03, 0.08)
            return max(0.46, round(0.7 - review_penalty - failed_penalty, 3))

        return 0.5

    def _score_denial_like_path(
        self,
        validation: ValidationResult,
        decision: AdjudicationDecision,
    ) -> float:
        severity_penalty = sum(
            self.issue_penalties.get(issue.code, 0.07)
            for issue in validation.issues
        )
        failed_penalty = len(decision.failed_checks) * 0.045
        review_penalty = len(decision.review_triggers) * 0.02
        evidence_bonus = min(len(decision.cited_rules) * 0.008, 0.024)
        score = 0.5 - severity_penalty - failed_penalty - review_penalty + evidence_bonus
        return round(min(0.46, max(0.14, score)), 3)
