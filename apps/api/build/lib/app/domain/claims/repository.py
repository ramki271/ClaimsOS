from __future__ import annotations

from typing import Any

from fastapi import Depends

from app.domain.claims.models import (
    AdjudicationDecision,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimSubmission,
    PolicyMatch,
    ValidationResult,
)
from app.integrations.supabase import get_supabase_client


class ClaimsRepository:
    def __init__(self, client: Any) -> None:
        self.client = client

    def create_processed_claim(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        decision: AdjudicationDecision,
        matched_policies: list[PolicyMatch],
        confidence_score: float,
        requires_human_review: bool,
    ) -> ClaimProcessingResponse:
        claim_payload = {
            "claim_id": claim.claim_id,
            "claim_type": claim.claim_type,
            "form_type": claim.form_type,
            "payer_name": claim.payer_name,
            "plan_name": claim.plan_name,
            "member_id": claim.member_id,
            "member_name": claim.member_name,
            "patient_id": claim.patient_id,
            "provider_id": claim.provider_id,
            "provider_name": claim.provider_name,
            "place_of_service": claim.place_of_service,
            "diagnosis_codes": claim.diagnosis_codes,
            "procedure_codes": claim.procedure_codes,
            "service_lines": [line.model_dump() for line in claim.service_lines],
            "amount": claim.amount,
            "date_of_service": str(claim.date_of_service),
            "processing_status": "processed",
            "outcome": decision.outcome,
            "confidence_score": confidence_score,
            "requires_human_review": requires_human_review,
        }
        claim_row = (
            self.client.table("claims")
            .upsert(claim_payload, on_conflict="claim_id")
            .execute()
            .data[0]
        )
        internal_claim_id = claim_row["id"]

        (
            self.client.table("claim_validation_results")
            .insert(
                {
                    "claim_id": internal_claim_id,
                    "is_valid": validation.is_valid,
                    "issues": [issue.model_dump() for issue in validation.issues],
                }
            )
            .execute()
        )

        (
            self.client.table("adjudication_results")
            .insert(
                {
                    "claim_id": internal_claim_id,
                    "outcome": decision.outcome,
                    "rationale": decision.rationale,
                    "cited_rules": decision.cited_rules,
                    "confidence_score": confidence_score,
                    "requires_human_review": requires_human_review,
                    "matched_policies": [policy.model_dump() for policy in matched_policies],
                }
            )
            .execute()
        )

        (
            self.client.table("audit_logs")
            .insert(
                {
                    "claim_id": internal_claim_id,
                    "event_type": "claim_processed",
                    "payload": {
                        "outcome": decision.outcome,
                        "confidence_score": confidence_score,
                    },
                }
            )
            .execute()
        )

        if requires_human_review:
            (
                self.client.table("human_review_queue")
                .upsert(
                    {
                        "claim_id": internal_claim_id,
                        "status": "pending",
                        "reason": "Low confidence or manual review outcome.",
                    },
                    on_conflict="claim_id",
                )
                .execute()
            )

        return ClaimProcessingResponse(
            claim=claim,
            status="processed",
            validation=validation,
            decision=decision,
            confidence_score=confidence_score,
            requires_human_review=requires_human_review,
            matched_policies=matched_policies,
            created_at=claim_row["created_at"],
        )

    def list_claims(self, limit: int = 20) -> list[ClaimRecordSummary]:
        rows = (
            self.client.table("claims")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data
        )
        return [
            ClaimRecordSummary(
                claim_id=row["claim_id"],
                claim_type=row["claim_type"],
                payer_name=row["payer_name"],
                member_name=row["member_name"],
                provider_name=row["provider_name"],
                amount=float(row["amount"]),
                date_of_service=row["date_of_service"],
                outcome=row.get("outcome") or "pending",
                confidence_score=float(row.get("confidence_score") or 0),
                requires_human_review=bool(row.get("requires_human_review") or False),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def get_claim(self, external_claim_id: str) -> ClaimProcessingResponse | None:
        rows = (
            self.client.table("claims")
            .select("*")
            .eq("claim_id", external_claim_id)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None

        claim_row = rows[0]
        internal_claim_id = claim_row["id"]

        validation_rows = (
            self.client.table("claim_validation_results")
            .select("*")
            .eq("claim_id", internal_claim_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        adjudication_rows = (
            self.client.table("adjudication_results")
            .select("*")
            .eq("claim_id", internal_claim_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )

        if not validation_rows or not adjudication_rows:
            return None

        validation_row = validation_rows[0]
        adjudication_row = adjudication_rows[0]

        return ClaimProcessingResponse(
            claim=ClaimSubmission(**claim_row),
            status=claim_row.get("processing_status") or "processed",
            validation=ValidationResult(**validation_row),
            decision=AdjudicationDecision(
                outcome=adjudication_row["outcome"],
                rationale=adjudication_row["rationale"],
                cited_rules=adjudication_row["cited_rules"],
            ),
            confidence_score=float(adjudication_row["confidence_score"]),
            requires_human_review=bool(adjudication_row["requires_human_review"]),
            matched_policies=[PolicyMatch(**policy) for policy in adjudication_row["matched_policies"]],
            created_at=claim_row["created_at"],
        )


def get_claims_repository() -> ClaimsRepository:
    return ClaimsRepository(get_supabase_client())
