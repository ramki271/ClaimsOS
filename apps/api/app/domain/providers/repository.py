from __future__ import annotations

import re
from typing import Any

from fastapi import Depends

from app.domain.providers.models import ProviderCreateRequest, ProviderRecord, Tenant
from app.integrations.supabase import get_supabase_client


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


class ProvidersRepository:
    def __init__(self, client: Any) -> None:
        self.client = client

    def get_tenant_by_key(self, tenant_key: str) -> Tenant | None:
        rows = (
            self.client.table("tenants")
            .select("*")
            .eq("tenant_key", tenant_key)
            .limit(1)
            .execute()
            .data
        )
        return Tenant(**rows[0]) if rows else None

    def ensure_tenant(self, *, payer_name: str) -> Tenant:
        tenant_key = _slugify(payer_name)
        tenant = self.get_tenant_by_key(tenant_key)
        if tenant is not None:
            tenant_row = tenant.model_dump(mode="json")
        else:
            tenant_row = (
            self.client.table("tenants")
            .upsert(
                {
                    "tenant_key": tenant_key,
                    "tenant_type": "payer",
                    "name": payer_name,
                },
                on_conflict="tenant_key",
            )
            .execute()
            .data[0]
            )
        self.client.table("payer_organizations").upsert(
            {
                "tenant_id": tenant_row["id"],
                "payer_code": tenant_key,
                "display_name": payer_name,
            },
            on_conflict="tenant_id,payer_code",
        ).execute()
        return Tenant(**tenant_row)

    def ensure_provider_for_tenant(
        self,
        *,
        tenant_id: str,
        provider_id: str,
        provider_name: str,
        npi: str | None = None,
        specialty: str | None = None,
    ) -> ProviderRecord:
        provider_key = provider_id or _slugify(provider_name)
        row = (
            self.client.table("providers")
            .upsert(
                {
                    "tenant_id": tenant_id,
                    "provider_key": provider_key,
                    "npi": npi,
                    "name": provider_name,
                    "specialty": specialty,
                    "network_status": "in_network",
                    "active": True,
                },
                on_conflict="tenant_id,provider_key",
            )
            .execute()
            .data[0]
        )
        return ProviderRecord(**row)

    def list_providers(self, *, tenant_key: str | None = None, limit: int = 100) -> list[ProviderRecord]:
        query = self.client.table("providers").select("*, tenants!inner(tenant_key)").order("created_at", desc=True).limit(limit)
        if tenant_key:
            query = query.eq("tenants.tenant_key", tenant_key)
        rows = query.execute().data
        return [ProviderRecord(**{k: v for k, v in row.items() if k != "tenants"}) for row in rows]

    def create_provider(self, request: ProviderCreateRequest) -> ProviderRecord:
        tenant_rows = (
            self.client.table("tenants")
            .select("*")
            .eq("tenant_key", request.tenant_key)
            .limit(1)
            .execute()
            .data
        )
        if not tenant_rows:
            tenant = self.ensure_tenant(payer_name=request.tenant_key.replace("-", " ").title())
            tenant_id = tenant.id
        else:
            tenant_id = tenant_rows[0]["id"]

        row = (
            self.client.table("providers")
            .upsert(
                {
                    "tenant_id": tenant_id,
                    "provider_key": request.provider_key,
                    "npi": request.npi,
                    "tin": request.tin,
                    "name": request.name,
                    "specialty": request.specialty,
                    "network_status": request.network_status,
                    "contract_tier": request.contract_tier,
                    "active": request.active,
                    "metadata": request.metadata,
                },
                on_conflict="tenant_id,provider_key",
            )
            .execute()
            .data[0]
        )
        return ProviderRecord(**row)


def get_providers_repository() -> ProvidersRepository:
    return ProvidersRepository(get_supabase_client())
