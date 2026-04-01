from fastapi.testclient import TestClient

from app.domain.members.models import MemberDetailResponse, MemberListItem, MemberRecord
from app.domain.members.repository import get_members_repository
from app.main import app


client = TestClient(app)


class FakeMembersRepository:
    def __init__(self) -> None:
        self.members = [
            MemberDetailResponse(
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
                ),
                recent_claim_ids=["CLM-APX-APPROVE-0001"],
                coverage_notes=["Active plan coverage."],
            ),
            MemberDetailResponse(
                member=MemberRecord(
                    member_id="M-7712044",
                    tenant_key="apex-health-plan",
                    payer_name="Apex Health Plan",
                    subscriber_id="SUB-7712044",
                    member_name="Jordan Lee",
                    date_of_birth="1974-08-19",
                    plan_name="Commercial HMO Select",
                    plan_product="HMO Select",
                    effective_date="2026-01-01",
                ),
                recent_claim_ids=[],
                coverage_notes=[],
            ),
        ]

    def list_members(self, *, tenant_key=None, limit=100):
        members = self.members
        if tenant_key:
            members = [member for member in members if member.member.tenant_key == tenant_key]
        return [
            MemberListItem(
                member_id=item.member.member_id,
                tenant_key=item.member.tenant_key,
                payer_name=item.member.payer_name,
                member_name=item.member.member_name,
                subscriber_id=item.member.subscriber_id,
                plan_name=item.member.plan_name,
                eligibility_status=item.member.eligibility_status,
                date_of_birth=item.member.date_of_birth,
                active_claim_count=item.member.active_claim_count,
                last_claim_id=item.member.last_claim_id,
            )
            for item in members[:limit]
        ]

    def get_member(self, member_id):
        return next((item for item in self.members if item.member.member_id == member_id), None)


fake_members_repository = FakeMembersRepository()
app.dependency_overrides[get_members_repository] = lambda: fake_members_repository


def test_list_members_filters_by_tenant_key() -> None:
    response = client.get("/api/members", params={"tenant_key": "apex-health-plan"})
    body = response.json()

    assert response.status_code == 200
    assert len(body) == 2
    assert all(member["tenant_key"] == "apex-health-plan" for member in body)


def test_get_member_detail() -> None:
    response = client.get("/api/members/M-4421907")
    body = response.json()

    assert response.status_code == 200
    assert body["member"]["member_name"] == "Elena Martinez"
    assert body["recent_claim_ids"] == ["CLM-APX-APPROVE-0001"]


def test_get_member_detail_returns_404_for_missing_member() -> None:
    response = client.get("/api/members/M-UNKNOWN")

    assert response.status_code == 404
    assert response.json()["detail"] == "Member M-UNKNOWN not found."
