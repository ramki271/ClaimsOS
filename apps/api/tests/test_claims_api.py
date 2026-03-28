from typing import Optional

from fastapi.testclient import TestClient

from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.models import (
    AdjudicationDecision,
    AuditEvent,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    HumanReviewState,
)
from app.domain.claims.repository import get_claims_repository
from app.main import app


client = TestClient(app)


class FakeClaimsRepository:
    def __init__(self) -> None:
        self.records: dict[str, ClaimProcessingResponse] = {}

    def create_processed_claim(
        self,
        claim,
        validation,
        decision,
        matched_policies,
        confidence_score,
        requires_human_review,
    ):
        response = ClaimProcessingResponse(
            claim=claim,
            status="processed",
            validation=validation,
            decision=decision,
            confidence_score=confidence_score,
            requires_human_review=requires_human_review,
            matched_policies=matched_policies,
            created_at="2026-03-27T00:00:00+00:00",
            review_state=(
                HumanReviewState(
                    status="pending",
                    reason="Low confidence or manual review outcome.",
                )
                if requires_human_review
                else None
            ),
            audit_trail=[
                AuditEvent(
                    event_type="claim_processed",
                    payload={"outcome": decision.outcome},
                )
            ],
        )
        self.records[claim.claim_id] = response
        return response

    def list_claims(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        outcome: Optional[str] = None,
        requires_review: Optional[bool] = None,
    ):
        summaries = []
        for record in self.records.values():
            if outcome:
                if outcome == "review" and not record.requires_human_review:
                    continue
                if outcome != "review" and record.decision.outcome != outcome:
                    continue
            if requires_review is not None and record.requires_human_review != requires_review:
                continue

            summaries.append(
                ClaimRecordSummary(
                    claim_id=record.claim.claim_id,
                    claim_type=record.claim.claim_type,
                    payer_name=record.claim.payer_name,
                    member_name=record.claim.member_name,
                    provider_name=record.claim.provider_name,
                    amount=record.claim.amount,
                    date_of_service=record.claim.date_of_service,
                    outcome=record.decision.outcome,
                    confidence_score=record.confidence_score,
                    requires_human_review=record.requires_human_review,
                    created_at=record.created_at,
                    review_status=record.review_state.status if record.review_state else None,
                )
            )
        return summaries[offset : offset + limit]

    def get_claim(self, external_claim_id: str):
        return self.records.get(external_claim_id)

    def submit_review(self, external_claim_id: str, review_request):
        record = self.records.get(external_claim_id)
        if record is None:
            return None

        outcome = review_request.override_outcome or record.decision.outcome
        record.decision = AdjudicationDecision(
            outcome=outcome,
            rationale=(
                f"Manual review override applied by {review_request.reviewer_name or 'Claims reviewer'}: "
                f"{review_request.reviewer_notes}"
            ),
            cited_rules=record.decision.cited_rules,
        )
        record.requires_human_review = review_request.review_status != "resolved" or outcome == "review"
        record.review_state = HumanReviewState(
            status=review_request.review_status,
            reason=review_request.reviewer_notes,
            reviewer_name=review_request.reviewer_name,
            reviewer_notes=review_request.reviewer_notes,
        )
        record.audit_trail.append(
            AuditEvent(
                event_type="human_review_updated",
                payload={
                    "review_status": review_request.review_status,
                    "override_outcome": review_request.override_outcome,
                },
            )
        )
        return record


fake_repository = FakeClaimsRepository()
app.dependency_overrides[get_claims_repository] = lambda: fake_repository


def test_healthcheck() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_process_claim_approve_path() -> None:
    payload = get_demo_outpatient_claim().model_dump(mode="json")

    response = client.post("/api/claims/process", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["decision"]["outcome"] == "approve"
    assert body["requires_human_review"] is False
    assert body["claim"]["claim_type"] == "professional_outpatient"
    assert body["claim"]["service_lines"][0]["procedure_code"] == "99213"
    assert body["audit_trail"][0]["event_type"] == "claim_processed"


def test_get_claims_returns_processed_claim() -> None:
    response = client.get("/api/claims")
    body = response.json()

    assert response.status_code == 200
    assert len(body) >= 1
    assert body[0]["claim_type"] == "professional_outpatient"


def test_claim_review_override_updates_claim() -> None:
    claim_id = get_demo_outpatient_claim().claim_id

    response = client.post(
        f"/api/claims/{claim_id}/review",
        json={
            "reviewer_name": "Dr. Aris Thorne",
            "reviewer_notes": "Eligibility manually confirmed and override approved.",
            "review_status": "resolved",
            "override_outcome": "approve",
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["decision"]["outcome"] == "approve"
    assert body["review_state"]["status"] == "resolved"
    assert body["audit_trail"][-1]["event_type"] == "human_review_updated"


def test_claim_review_resolution_preserves_confirmation_note() -> None:
    claim_id = get_demo_outpatient_claim().claim_id

    response = client.post(
        f"/api/claims/{claim_id}/review",
        json={
            "reviewer_notes": "AI decision confirmed by reviewer.",
            "review_status": "resolved",
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["review_state"]["status"] == "resolved"
    assert body["review_state"]["reason"] == "AI decision confirmed by reviewer."


def test_claim_filters_support_review_query() -> None:
    review_claim = get_demo_outpatient_claim().model_copy(update={"claim_id": "CLM-REVIEW-1"})
    fake_repository.create_processed_claim(
        claim=review_claim,
        validation=fake_repository.records[get_demo_outpatient_claim().claim_id].validation,
        decision=AdjudicationDecision(
            outcome="review",
            rationale="Manual review required.",
            cited_rules=["RULE-HITL"],
        ),
        matched_policies=[],
        confidence_score=0.42,
        requires_human_review=True,
    )

    response = client.get("/api/claims", params={"requires_review": "true"})
    body = response.json()

    assert response.status_code == 200
    assert any(item["claim_id"] == "CLM-REVIEW-1" for item in body)
    assert all(item["requires_human_review"] is True for item in body)
