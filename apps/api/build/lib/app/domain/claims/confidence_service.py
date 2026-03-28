from app.domain.claims.models import AdjudicationDecision, ValidationResult


class ConfidenceService:
    def score(self, validation: ValidationResult, decision: AdjudicationDecision) -> float:
        if not validation.is_valid:
            return 0.24

        if decision.outcome == "approve":
            return 0.92

        if decision.outcome == "review":
            return 0.64

        return 0.5
