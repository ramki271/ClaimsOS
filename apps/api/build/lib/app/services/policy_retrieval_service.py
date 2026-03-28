from app.models.claim import ClaimSubmission, PolicyMatch


class PolicyRetrievalService:
    def retrieve(self, claim: ClaimSubmission) -> list[PolicyMatch]:
        policies: list[PolicyMatch] = [
            PolicyMatch(
                policy_id="POL-001",
                title="Outpatient Evaluation And Management Coverage",
                summary="Routine outpatient office visits are covered when the diagnosis and procedure pairing is supported and the billed amount is within plan limits.",
                relevance_score=0.94,
            )
        ]

        if "97110" in claim.procedure_codes:
            policies.append(
                PolicyMatch(
                    policy_id="POL-017",
                    title="Physical Therapy Visit Guardrails",
                    summary="Therapeutic exercise claims require covered diagnosis support and may trigger review when utilization patterns are incomplete.",
                    relevance_score=0.88,
                )
            )

        return policies

