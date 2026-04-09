from fastapi.testclient import TestClient

from app.domain.agent.service import get_agent_chat_service
from app.domain.agent.service import AgentChatService
from app.domain.agent.models import AgentChatContext
from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.models import (
    AdjudicationDecision,
    AuditEvent,
    ClaimInsights,
    ClaimProcessingResponse,
    HumanReviewState,
    InsightCard,
)
from app.domain.claims.repository import get_claims_repository
from app.domain.members.models import MemberDetailResponse, MemberRecord
from app.domain.members.repository import get_members_repository
from app.domain.policies.repository import get_policies_repository
from app.domain.providers.models import ProviderRecord
from app.domain.providers.repository import get_providers_repository
from app.core.config import get_settings
from app.main import app


client = TestClient(app)


class FakeAgentChatService:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    def answer(self, *, message: str, context) -> str:
        from app.domain.agent.models import AgentChatResponse

        if self.should_fail:
            raise RuntimeError("boom")
        claim_id = context.claim_id or "unknown"
        return AgentChatResponse(
            reply=f"Claim {claim_id} is in review because prior authorization is missing."
        )


def test_agent_chat_returns_reply() -> None:
    app.dependency_overrides[get_agent_chat_service] = lambda: FakeAgentChatService()
    response = client.post(
        "/api/agent/chat",
        json={
            "message": "Why was claim CLM-001 flagged for review?",
            "context": {"active_view": "detail", "claim_id": "CLM-001"},
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert "reply" in body
    assert "CLM-001" in body["reply"]
    assert body["claim_links"] == []

    app.dependency_overrides.pop(get_agent_chat_service, None)


def test_agent_chat_returns_graceful_reply_on_failure() -> None:
    app.dependency_overrides[get_agent_chat_service] = lambda: FakeAgentChatService(should_fail=True)
    response = client.post(
        "/api/agent/chat",
        json={
            "message": "What is the status?",
            "context": {"active_view": "claims"},
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert "reply" in body
    assert "don't have enough context" in body["reply"].lower()
    assert body["claim_links"] == []

    app.dependency_overrides.pop(get_agent_chat_service, None)


class FakeClaimsRepository:
    def __init__(self) -> None:
        claim = get_demo_outpatient_claim().model_copy(
            update={
                "claim_id": "OCR-CLM-ORTHO-3001",
                "member_id": "M-9011182",
                "member_name": "Harold Bennett",
            }
        )
        self.record = ClaimProcessingResponse(
            claim=claim,
            status="processed",
            validation={"is_valid": True, "issues": []},
            decision=AdjudicationDecision(
                outcome="review",
                rationale="Missing prior authorization.",
                cited_rules=[],
            ),
            confidence_score=0.61,
            requires_human_review=True,
            matched_policies=[],
            audit_trail=[AuditEvent(event_type="claim_processed", payload={"outcome": "review"})],
            review_state=HumanReviewState(status="pending", reason="manual review"),
            insights=ClaimInsights(
                policy_match=InsightCard(label="Policy Match", value="95%", status="strong", score=0.95),
                duplication_risk=InsightCard(label="Duplication Risk", value="Low", status="low", score=0.1),
                network_parity=InsightCard(label="Network Parity", value="Tier 1", status="verified", score=0.9),
            ),
        )
        self.client = _FakeSupabaseClient(
            {
                "claims": [],
                "human_review_queue": [
                    {"status": "pending", "reason": "Missing prior authorization.", "claims": {"claim_id": "CLM-X12-PRIORAUTH-2003"}},
                    {"status": "pending", "reason": "Referral is missing.", "claims": {"claim_id": "CLM-X12-REFERRAL-2002"}},
                ],
            }
        )

    def get_claim(self, claim_id: str):
        return self.record if claim_id == self.record.claim.claim_id else None


class FakeMembersRepository:
    def __init__(self) -> None:
        self.members = {
            "M-9011182": MemberDetailResponse(
                member=MemberRecord(
                    member_id="M-9011182",
                    tenant_key="apex-health-plan",
                    payer_name="Apex Health Plan",
                    subscriber_id="SUB-9011182",
                    member_name="Harold Bennett",
                    date_of_birth="1953-11-02",
                    plan_name="Apex Medicare Advantage Choice",
                    plan_product="MA Choice",
                    effective_date="2026-01-01",
                )
            ),
            "M-4421907": MemberDetailResponse(
                member=MemberRecord(
                    member_id="M-4421907",
                    tenant_key="apex-health-plan",
                    payer_name="Apex Health Plan",
                    subscriber_id="SUB-4421907",
                    member_name="Elena Martinez",
                    date_of_birth="1980-01-01",
                    plan_name="Commercial PPO 500",
                    plan_product="PPO 500",
                    effective_date="2026-01-01",
                )
            ),
        }

    def get_member(self, member_id: str):
        return self.members.get(member_id)

    def list_members(self, *, tenant_key=None, limit=100):
        items = list(self.members.values())[:limit]
        return [
            type(
                "MemberListItemObj",
                (),
                {"member_id": item.member.member_id, "member_name": item.member.member_name},
            )()
            for item in items
        ]


class FakeProvidersRepository:
    def ensure_tenant(self, *, payer_name):
        return type("TenantObj", (), {"id": "tenant-1"})()

    def list_providers(self, *, tenant_key=None, limit=100):
        return [
            ProviderRecord(
                tenant_id="tenant-1",
                provider_key="PRV-4092",
                name="Front Range Family Medicine",
            )
        ]


class FakePoliciesRepository:
    def retrieve_chunks(self, *, tenant_id, limit=250):
        return []


class _FakeExecResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, data):
        self._data = data

    def select(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def execute(self):
        return _FakeExecResult(self._data)


class _FakeSupabaseClient:
    def __init__(self, tables=None):
        self._tables = tables or {}

    def table(self, name: str):
        return _FakeQuery(self._tables.get(name, []))


def test_agent_service_prefers_explicit_member_over_active_claim_context() -> None:
    service = AgentChatService(
        settings=get_settings(),
        claims_repository=FakeClaimsRepository(),
        members_repository=FakeMembersRepository(),
        providers_repository=FakeProvidersRepository(),
        policies_repository=FakePoliciesRepository(),
    )

    gathered = service._gather_context(
        message="Is Elena Martinez eligible right now?",
        context=AgentChatContext(active_view="detail", claim_id="OCR-CLM-ORTHO-3001"),
    )

    assert gathered["claim"]["claim"]["member_name"] == "Harold Bennett"
    assert gathered["member"]["member"]["member_name"] == "Elena Martinez"


def test_agent_service_cleans_reply_formatting() -> None:
    service = AgentChatService(
        settings=get_settings(),
        claims_repository=FakeClaimsRepository(),
        members_repository=FakeMembersRepository(),
        providers_repository=FakeProvidersRepository(),
        policies_repository=FakePoliciesRepository(),
    )

    cleaned = service._clean_reply("**Coverage**\n• Prior auth missing\n2. Review claim - now")

    assert "**" not in cleaned
    assert "•" not in cleaned
    assert "Coverage" in cleaned
    assert "- Prior auth missing" in cleaned
    assert "- Review claim - now" in cleaned


def test_agent_service_returns_claim_links_for_review_queue_questions() -> None:
    service = AgentChatService(
        settings=get_settings(),
        claims_repository=FakeClaimsRepository(),
        members_repository=FakeMembersRepository(),
        providers_repository=FakeProvidersRepository(),
        policies_repository=FakePoliciesRepository(),
    )

    result = service.answer(
        message="How many claims are pending review?",
        context=AgentChatContext(active_view="claims"),
    )

    assert [item.claim_id for item in result.claim_links] == [
        "CLM-X12-PRIORAUTH-2003",
        "CLM-X12-REFERRAL-2002",
    ]
