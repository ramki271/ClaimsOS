from typing import Optional

from fastapi.testclient import TestClient

from app.api.v1.routes import claims as claims_routes
from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.models import (
    AdjudicationDecision,
    AuditEvent,
    ClaimDocumentDraft,
    ClaimDocumentIntakeResponse,
    ClaimInsights,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    DraftServiceLine,
    HumanReviewState,
    InsightCard,
    LowConfidenceField,
    ProviderAdjudicationContext,
)
from app.domain.claims.repository import get_claims_repository
from app.main import app


client = TestClient(app)


class FakeClaimsRepository:
    def __init__(self) -> None:
        self.records: dict[str, ClaimProcessingResponse] = {}
        self.adjudication_service = AdjudicationService()
        self.providers_repository = type(
            "FakeProvidersRepo",
            (),
            {
                "ensure_tenant": staticmethod(lambda payer_name: type("TenantObj", (), {"id": payer_name.lower().replace(" ", "-")})()),
                "ensure_provider_for_tenant": staticmethod(
                    lambda tenant_id, provider_id, provider_name, specialty=None: type(
                        "ProviderObj",
                        (),
                        {
                            "provider_key": provider_id,
                            "name": provider_name,
                            "specialty": specialty or "Family Medicine",
                            "network_status": "in_network",
                            "contract_tier": None,
                            "contract_status": "active",
                            "network_effective_date": None,
                            "network_end_date": None,
                            "plan_participation": [],
                        },
                    )()
                ),
            },
        )()

    def create_processed_claim(
        self,
        claim,
        validation,
        decision,
        matched_policies,
        confidence_score,
        requires_human_review,
    ):
        utilization_context = self.adjudication_service.build_utilization_context(claim)
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
            insights=ClaimInsights(
                policy_match=InsightCard(
                    label="Policy Match",
                    value=f"{round(confidence_score * 100)}%",
                    status="strong",
                    score=confidence_score,
                ),
                duplication_risk=InsightCard(
                    label="Duplication Risk",
                    value="Low",
                    status="low",
                    score=0.12,
                ),
                network_parity=InsightCard(
                    label="Network Parity",
                    value="In Network",
                    status="verified",
                    score=0.95,
                ),
            ),
            utilization_context=utilization_context,
        )
        self.records[claim.claim_id] = response
        return response

    def _build_provider_context(self, *, claim, provider):
        return ProviderAdjudicationContext(
            provider_key=provider.provider_key,
            provider_name=provider.name,
            specialty=provider.specialty,
            network_status=provider.network_status,
            contract_tier=provider.contract_tier,
            contract_status=provider.contract_status,
            network_effective_date=provider.network_effective_date,
            network_end_date=provider.network_end_date,
            participates_in_plan=True,
            specialty_match=True,
            specialty_match_reason="Provider specialty aligns with the billed service profile.",
        )

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
    assert body["insights"]["policy_match"]["label"] == "Policy Match"
    assert len(body["decision"]["passed_checks"]) >= 4
    assert body["decision"]["failed_checks"] == []
    assert body["decision"]["review_triggers"] == []
    assert body["utilization_context"]["utilization_level"] == "routine"
    assert body["utilization_context"]["prior_auth_required"] is False


def test_intake_document_returns_reviewable_claim_draft(monkeypatch) -> None:
    monkeypatch.setattr(
        claims_routes.document_intake_service,
        "extract_claim_draft",
        lambda **kwargs: ClaimDocumentIntakeResponse(
            status="drafted",
            source_type="image",
            extraction_summary="Claim image was converted into a draft.",
            claim_draft=ClaimDocumentDraft(
                claim_id="OCR-CLM-0001",
                payer_name="Apex Health Plan",
                member_name="Elena Martinez",
                diagnosis_codes=["E11.9"],
                service_lines=[DraftServiceLine(line_number=1, procedure_code="99213", charge_amount=150.0)],
            ),
            ready_for_processing=False,
            missing_fields=["plan_name", "member_id", "provider_id", "provider_name", "amount", "date_of_service"],
            review_notes=["Review highlighted fields before submitting the claim."],
            low_confidence_fields=[
                LowConfidenceField(
                    field="member_id",
                    confidence="low",
                    reason="Subscriber identifier was partially obscured in the image.",
                )
            ],
        ),
    )

    response = client.post(
        "/api/claims/intake-document",
        data={"auto_process": "false"},
        files={"file": ("claim-photo.png", b"fake image bytes", "image/png")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "drafted"
    assert body["ready_for_processing"] is False
    assert body["processed_result"] is None
    assert body["low_confidence_fields"][0]["field"] == "member_id"


def test_intake_document_can_auto_process_complete_draft(monkeypatch) -> None:
    demo_claim = get_demo_outpatient_claim()
    monkeypatch.setattr(
        claims_routes.document_intake_service,
        "extract_claim_draft",
        lambda **kwargs: ClaimDocumentIntakeResponse(
            status="drafted",
            source_type="pdf",
            extraction_summary="Claim PDF was converted into a complete draft.",
            claim_draft=ClaimDocumentDraft.model_validate(demo_claim.model_dump(mode="json")),
            ready_for_processing=True,
            missing_fields=[],
            review_notes=[],
            low_confidence_fields=[],
        ),
    )

    response = client.post(
        "/api/claims/intake-document",
        data={"auto_process": "true"},
        files={"file": ("claim-form.pdf", b"%PDF-1.7 fake pdf", "application/pdf")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "processed"
    assert body["ready_for_processing"] is True
    assert body["processed_result"]["claim"]["claim_id"] == demo_claim.claim_id
    assert body["processed_result"]["decision"]["outcome"] == "approve"


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


def test_process_claim_review_path_surfaces_review_triggers() -> None:
    review_claim = get_demo_outpatient_claim().model_copy(
        update={
            "claim_id": "CLM-REVIEW-TRIGGERS",
        }
    )
    review_claim.service_lines[0] = review_claim.service_lines[0].model_copy(
        update={"charge_amount": 425.0}
    )
    payload = review_claim.model_dump(mode="json")

    response = client.post("/api/claims/process", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["decision"]["outcome"] == "review"
    assert body["decision"]["review_triggers"]
    assert any("straight-through" in trigger.lower() for trigger in body["decision"]["review_triggers"])
    assert body["utilization_context"]["utilization_level"] == "elevated"
    assert body["utilization_context"]["prior_auth_required"] is False


def test_process_claim_prior_auth_path_surfaces_utilization_context() -> None:
    prior_auth_claim = get_demo_outpatient_claim().model_copy(
        update={
            "claim_id": "CLM-PRIOR-AUTH-1",
            "diagnosis_codes": ["M17.11"],
            "procedure_codes": ["27447"],
            "amount": 225.0,
        }
    )
    prior_auth_claim.service_lines[0] = prior_auth_claim.service_lines[0].model_copy(
        update={
            "procedure_code": "27447",
            "charge_amount": 225.0,
        }
    )
    payload = prior_auth_claim.model_dump(mode="json")

    response = client.post("/api/claims/process", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["decision"]["outcome"] == "review"
    assert body["utilization_context"]["utilization_level"] == "prior_auth"
    assert body["utilization_context"]["prior_auth_required"] is True
    assert body["utilization_context"]["prior_auth_status"] == "pending_review"
    assert body["utilization_context"]["trigger_codes"] == ["27447"]
    assert any("prior authorization" in trigger.lower() for trigger in body["decision"]["review_triggers"])


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


def test_confidence_scoring_varies_across_deny_scenarios() -> None:
    diagnosis_mismatch_response = client.post(
        "/api/claims/process",
        json=get_demo_outpatient_claim()
        .model_copy(
            update={
                "claim_id": "CLM-CONFIDENCE-MISMATCH",
                "procedure_codes": ["99214"],
                "service_lines": [
                    get_demo_outpatient_claim().service_lines[0].model_copy(
                        update={"procedure_code": "99214", "charge_amount": 200.0}
                    )
                ],
                "amount": 200.0,
                "diagnosis_codes": ["I10"],
            }
        )
        .model_dump(mode="json"),
    )
    high_amount_response = client.post(
        "/api/claims/process",
        json=get_demo_outpatient_claim()
        .model_copy(
            update={
                "claim_id": "CLM-CONFIDENCE-HIGH-AMOUNT",
                "amount": 1250.0,
                "service_lines": [
                    get_demo_outpatient_claim().service_lines[0].model_copy(
                        update={"charge_amount": 1250.0}
                    )
                ],
            }
        )
        .model_dump(mode="json"),
    )

    mismatch_body = diagnosis_mismatch_response.json()
    high_amount_body = high_amount_response.json()

    assert diagnosis_mismatch_response.status_code == 200
    assert high_amount_response.status_code == 200
    assert mismatch_body["decision"]["outcome"] == "deny"
    assert high_amount_body["decision"]["outcome"] == "deny"
    assert mismatch_body["confidence_score"] != high_amount_body["confidence_score"]
    assert mismatch_body["confidence_score"] > high_amount_body["confidence_score"]
