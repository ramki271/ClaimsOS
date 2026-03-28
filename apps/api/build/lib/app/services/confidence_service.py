from app.models.claim import AdjudicationDecision, ValidationResult


class ConfidenceService:
    def score(self, validation: ValidationResult, decision: AdjudicationDecision) -> float:
        if not validation.is_valid:
            return 0.24

        if decision.outcome == "approve":
            return 0.91

        if decision.outcome == "review":
            return 0.68

        return 0.5

