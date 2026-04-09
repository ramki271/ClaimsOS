from fastapi.testclient import TestClient

from app.domain.providers.models import ProviderRecord
from app.domain.providers.repository import get_providers_repository
from app.main import app


client = TestClient(app)


class FakeProvidersRepository:
    def __init__(self) -> None:
        self.providers: list[ProviderRecord] = []
        self.tenants = {}

    def ensure_tenant(self, *, payer_name):
        tenant_key = payer_name.lower().replace(" ", "-")
        tenant = self.tenants.get(tenant_key)
        if tenant is None:
            tenant = type("TenantObj", (), {"id": tenant_key, "tenant_key": tenant_key, "name": payer_name})()
            self.tenants[tenant_key] = tenant
        return tenant

    def get_tenant_by_key(self, tenant_key):
        return self.tenants.get(tenant_key)

    def list_providers(self, *, tenant_key=None, limit=100):
        providers = self.providers
        if tenant_key:
            providers = [provider for provider in providers if provider.metadata.get("tenant_key") == tenant_key]
        return providers[:limit]

    def create_provider(self, request):
        self.ensure_tenant(payer_name=request.tenant_key.replace("-", " ").title())
        provider = ProviderRecord(
            id=f"provider-{len(self.providers) + 1}",
            tenant_id=request.tenant_key,
            provider_key=request.provider_key,
            npi=request.npi,
            tin=request.tin,
            name=request.name,
            taxonomy_code=request.taxonomy_code,
            specialty=request.specialty,
            subspecialty=request.subspecialty,
            network_status=request.network_status,
            contract_tier=request.contract_tier,
            contract_status=request.contract_status,
            credential_status=request.credential_status,
            network_effective_date=request.network_effective_date,
            network_end_date=request.network_end_date,
            plan_participation=request.plan_participation,
            facility_affiliations=request.facility_affiliations,
            service_locations=request.service_locations,
            accepting_referrals=request.accepting_referrals,
            surgical_privileges=request.surgical_privileges,
            active=request.active,
            metadata={**request.metadata, "tenant_key": request.tenant_key},
        )
        self.providers.append(provider)
        return provider


fake_providers_repository = FakeProvidersRepository()
app.dependency_overrides[get_providers_repository] = lambda: fake_providers_repository


def test_create_provider() -> None:
    response = client.post(
        "/api/providers",
        json={
            "tenant_key": "apex-health-plan",
            "provider_key": "prv-4092",
            "name": "Front Range Family Medicine",
            "npi": "1299304491",
            "taxonomy_code": "207Q00000X",
            "specialty": "Family Medicine",
            "credential_status": "credentialed",
            "plan_participation": ["Apex PPO Gold"],
            "facility_affiliations": ["Front Range Family Medicine"],
            "network_status": "in_network",
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["provider_key"] == "prv-4092"
    assert body["name"] == "Front Range Family Medicine"
    assert body["taxonomy_code"] == "207Q00000X"
    assert body["credential_status"] == "credentialed"


def test_list_providers_filters_by_tenant_key() -> None:
    client.post(
        "/api/providers",
        json={
            "tenant_key": "blue-cross",
            "provider_key": "prv-777",
            "name": "Blue Cross Ortho Group",
            "network_status": "in_network",
        },
    )

    response = client.get("/api/providers", params={"tenant_key": "apex-health-plan"})
    body = response.json()

    assert response.status_code == 200
    assert any(provider["provider_key"] == "prv-4092" for provider in body)
    assert all(provider["metadata"]["tenant_key"] == "apex-health-plan" for provider in body)
