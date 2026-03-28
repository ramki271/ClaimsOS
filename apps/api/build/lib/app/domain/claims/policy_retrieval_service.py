from app.domain.claims.models import ClaimSubmission, PolicyMatch


class PolicyRetrievalService:
    def retrieve(self, claim: ClaimSubmission) -> list[PolicyMatch]:
        policies: list[PolicyMatch] = [
            PolicyMatch(
                policy_id="POL-001",
                title="Outpatient Evaluation And Management Coverage",
                summary=f"Routine outpatient office visits for {claim.plan_name} are covered when diagnosis support is present, place of service is 11, and billed charges remain within plan guardrails.",
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

        if claim.place_of_service == "11":
            policies.append(
                PolicyMatch(
                    policy_id="POL-031",
                    title="Professional Office Visit Place-of-Service Rule",
                    summary="Professional claims billed with place of service 11 are eligible for straight-through review when documentation and covered diagnosis pairings are present.",
                    relevance_score=0.91,
                )
            )

        return policies
