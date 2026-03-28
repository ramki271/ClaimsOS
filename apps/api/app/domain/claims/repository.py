from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Depends

from app.domain.claims.models import (
    AdjudicationDecision,
    AuditEvent,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimReviewRequest,
    ClaimSubmission,
    HumanReviewState,
    PolicyMatch,
    ValidationResult,
)
from app.domain.claims.validation_service import ValidationIssue
from app.domain.providers.repository import ProvidersRepository
from app.integrations.supabase import get_supabase_client


class ClaimsRepository:
    def __init__(self, client: Any) -> None:
        self.client = client
        self.providers_repository = ProvidersRepository(client)

    def create_processed_claim(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        decision: AdjudicationDecision,
        matched_policies: list[PolicyMatch],
        confidence_score: float,
        requires_human_review: bool,
    ) -> ClaimProcessingResponse:
        tenant = self.providers_repository.ensure_tenant(payer_name=claim.payer_name)
        provider = self.providers_repository.ensure_provider_for_tenant(
            tenant_id=tenant.id or "",
            provider_id=claim.provider_id,
            provider_name=claim.provider_name,
            specialty=None,
        )
        claim_payload = {
            "claim_id": claim.claim_id,
            "tenant_id": tenant.id,
            "provider_record_id": provider.id,
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

        self.client.table("claim_validation_results").insert(
            {
                "claim_id": internal_claim_id,
                "is_valid": validation.is_valid,
                "issues": [issue.model_dump() for issue in validation.issues],
            }
        ).execute()

        self.client.table("adjudication_results").insert(
            {
                "claim_id": internal_claim_id,
                "outcome": decision.outcome,
                "rationale": decision.rationale,
                "cited_rules": decision.cited_rules,
                "confidence_score": confidence_score,
                "requires_human_review": requires_human_review,
                "matched_policies": [policy.model_dump() for policy in matched_policies],
            }
        ).execute()

        audit_events = [
            (
                "claim_received",
                {
                    "claim_type": claim.claim_type,
                    "payer_name": claim.payer_name,
                    "amount": claim.amount,
                },
            ),
            (
                "validation_completed",
                {
                    "is_valid": validation.is_valid,
                    "issue_count": len(validation.issues),
                },
            ),
            (
                "policy_retrieval_completed",
                {
                    "match_count": len(matched_policies),
                    "top_policy_id": matched_policies[0].policy_id if matched_policies else None,
                },
            ),
            (
                "adjudication_completed",
                {
                    "outcome": decision.outcome,
                    "confidence_score": confidence_score,
                    "requires_human_review": requires_human_review,
                },
            ),
            (
                "claim_processed",
                {
                    "status": "processed",
                    "outcome": decision.outcome,
                },
            ),
        ]
        self.client.table("audit_logs").insert(
            [
                {
                    "claim_id": internal_claim_id,
                    "event_type": event_type,
                    "payload": payload,
                }
                for event_type, payload in audit_events
            ]
        ).execute()

        review_state = None
        if requires_human_review:
            review_row = (
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
                .data[0]
            )
            review_state = self._map_review_state(review_row)

        return ClaimProcessingResponse(
            claim=claim,
            status="processed",
            validation=validation,
            decision=decision,
            confidence_score=confidence_score,
            requires_human_review=requires_human_review,
            matched_policies=matched_policies,
            created_at=claim_row["created_at"],
            review_state=review_state,
            audit_trail=[
                AuditEvent(event_type=event_type, payload=payload) for event_type, payload in audit_events
            ],
        )

    def list_claims(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        outcome: str | None = None,
        requires_review: bool | None = None,
    ) -> list[ClaimRecordSummary]:
        query = self.client.table("claims").select("*")
        if outcome:
            if outcome == "review":
                query = query.eq("requires_human_review", True)
            else:
                query = query.eq("outcome", outcome)
        if requires_review is not None:
            query = query.eq("requires_human_review", requires_review)

        rows = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data
        review_rows = self._fetch_review_rows([row["id"] for row in rows])
        review_map = {row["claim_id"]: row for row in review_rows}

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
                review_status=review_map.get(row["id"], {}).get("status"),
            )
            for row in rows
        ]

    def get_claim(self, external_claim_id: str) -> ClaimProcessingResponse | None:
        claim_row = self._fetch_claim_row(external_claim_id)
        if claim_row is None:
            return None
        return self._build_claim_response(claim_row)

    def submit_review(
        self,
        external_claim_id: str,
        review_request: ClaimReviewRequest,
    ) -> ClaimProcessingResponse | None:
        claim_row = self._fetch_claim_row(external_claim_id)
        if claim_row is None:
            return None

        internal_claim_id = claim_row["id"]
        outcome = review_request.override_outcome or claim_row.get("outcome") or "review"
        requires_human_review = (
            review_request.review_status != "resolved" or outcome == "review"
        )

        self.client.table("claims").update(
            {
                "outcome": outcome,
                "requires_human_review": requires_human_review,
                "processing_status": "processed",
            }
        ).eq("id", internal_claim_id).execute()

        current_detail = self._build_claim_response(claim_row)
        if current_detail is None:
            return None

        updated_reason = (
            review_request.reviewer_notes
            if review_request.review_status == "resolved" or review_request.override_outcome
            else "Claim routed for manual adjudicator review."
        )
        review_row = (
            self.client.table("human_review_queue")
            .upsert(
                {
                    "claim_id": internal_claim_id,
                    "status": review_request.review_status,
                    "reason": updated_reason,
                },
                on_conflict="claim_id",
            )
            .execute()
            .data[0]
        )

        if review_request.override_outcome:
            self.client.table("adjudication_results").insert(
                {
                    "claim_id": internal_claim_id,
                    "outcome": review_request.override_outcome,
                    "rationale": (
                        f"Manual review override applied by "
                        f"{review_request.reviewer_name or 'Claims reviewer'}: "
                        f"{review_request.reviewer_notes}"
                    ),
                    "cited_rules": current_detail.decision.cited_rules,
                    "confidence_score": current_detail.confidence_score,
                    "requires_human_review": requires_human_review,
                    "matched_policies": [policy.model_dump() for policy in current_detail.matched_policies],
                }
            ).execute()

        self.client.table("audit_logs").insert(
            {
                "claim_id": internal_claim_id,
                "event_type": "human_review_updated",
                "payload": {
                    "review_status": review_request.review_status,
                    "override_outcome": review_request.override_outcome,
                    "reviewer_name": review_request.reviewer_name,
                    "reviewer_notes": review_request.reviewer_notes,
                },
            }
        ).execute()

        refreshed_claim_row = self._fetch_claim_row(external_claim_id)
        return self._build_claim_response(refreshed_claim_row) if refreshed_claim_row else None

    def _fetch_claim_row(self, external_claim_id: str) -> dict[str, Any] | None:
        rows = (
            self.client.table("claims")
            .select("*")
            .eq("claim_id", external_claim_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def _fetch_review_rows(self, internal_claim_ids: list[str]) -> list[dict[str, Any]]:
        if not internal_claim_ids:
            return []
        return (
            self.client.table("human_review_queue")
            .select("*")
            .in_("claim_id", internal_claim_ids)
            .execute()
            .data
        )

    def _build_claim_response(self, claim_row: dict[str, Any]) -> ClaimProcessingResponse | None:
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
        audit_rows = (
            self.client.table("audit_logs")
            .select("*")
            .eq("claim_id", internal_claim_id)
            .order("created_at", desc=False)
            .execute()
            .data
        )
        review_rows = (
            self.client.table("human_review_queue")
            .select("*")
            .eq("claim_id", internal_claim_id)
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
            validation=ValidationResult(
                is_valid=validation_row["is_valid"],
                issues=[ValidationIssue(**issue) for issue in validation_row.get("issues", [])],
            ),
            decision=AdjudicationDecision(
                outcome=adjudication_row["outcome"],
                rationale=adjudication_row["rationale"],
                cited_rules=adjudication_row["cited_rules"],
            ),
            confidence_score=float(adjudication_row["confidence_score"]),
            requires_human_review=bool(adjudication_row["requires_human_review"]),
            matched_policies=[
                PolicyMatch(**policy) for policy in adjudication_row["matched_policies"]
            ],
            created_at=claim_row["created_at"],
            review_state=self._map_review_state(review_rows[0]) if review_rows else None,
            audit_trail=[
                AuditEvent(
                    event_type=row["event_type"],
                    payload=row.get("payload") or {},
                    created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                    if row.get("created_at")
                    else None,
                )
                for row in audit_rows
            ],
        )

    def _map_review_state(self, review_row: dict[str, Any]) -> HumanReviewState:
        payload = review_row.get("payload") or {}
        return HumanReviewState(
            status=review_row["status"],
            reason=review_row["reason"],
            reviewer_name=payload.get("reviewer_name"),
            reviewer_notes=payload.get("reviewer_notes"),
            updated_at=datetime.fromisoformat(review_row["created_at"].replace("Z", "+00:00"))
            if review_row.get("created_at")
            else None,
        )


def get_claims_repository() -> ClaimsRepository:
    return ClaimsRepository(get_supabase_client())
