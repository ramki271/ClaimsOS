from __future__ import annotations

from datetime import date
import re
from typing import Any

from fastapi import Depends

from app.domain.providers.models import ProviderCreateRequest, ProviderRecord, Tenant
from app.integrations.supabase import execute_with_retry, get_supabase_client


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


class ProvidersRepository:
    def __init__(self, client: Any) -> None:
        self.client = client

    def get_tenant_by_key(self, tenant_key: str) -> Tenant | None:
        rows = (
            execute_with_retry(
                self.client.table("tenants")
                .select("*")
                .eq("tenant_key", tenant_key)
                .limit(1)
            ).data
        )
        return Tenant(**rows[0]) if rows else None

    def get_provider_by_id(self, provider_id: str) -> ProviderRecord | None:
        rows = (
            execute_with_retry(
                self.client.table("providers")
                .select("*")
                .eq("id", provider_id)
                .limit(1)
            ).data
        )
        return self._map_provider_row(rows[0]) if rows else None

    def ensure_tenant(self, *, payer_name: str) -> Tenant:
        tenant_key = _slugify(payer_name)
        tenant = self.get_tenant_by_key(tenant_key)
        if tenant is not None:
            tenant_row = tenant.model_dump(mode="json")
        else:
            tenant_row = (
                execute_with_retry(
                    self.client.table("tenants")
                    .upsert(
                        {
                            "tenant_key": tenant_key,
                            "tenant_type": "payer",
                            "name": payer_name,
                            "metadata": {},
                        },
                        on_conflict="tenant_key",
                    )
                ).data[0]
            )
        execute_with_retry(
            self.client.table("payer_organizations").upsert(
                {
                    "tenant_id": tenant_row["id"],
                    "payer_code": tenant_key,
                    "display_name": payer_name,
                },
                on_conflict="tenant_id,payer_code",
            )
        )
        return Tenant(**tenant_row)

    def set_tenant_vector_store_id(self, *, tenant_id: str, vector_store_id: str) -> Tenant:
        rows = (
            execute_with_retry(
                self.client.table("tenants")
                .select("*")
                .eq("id", tenant_id)
                .limit(1)
            ).data
        )
        if not rows:
            raise ValueError(f"Tenant {tenant_id} not found.")

        row = rows[0]
        metadata = row.get("metadata") or {}
        metadata["openai_vector_store_id"] = vector_store_id
        updated = (
            execute_with_retry(
                self.client.table("tenants")
                .update({"metadata": metadata})
                .eq("id", tenant_id)
            ).data[0]
        )
        return Tenant(**updated)

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
        existing_rows = (
            execute_with_retry(
                self.client.table("providers")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("provider_key", provider_key)
                .limit(1)
            ).data
        )
        if existing_rows:
            existing = existing_rows[0]
            metadata = existing.get("metadata") or {}
            update_payload: dict[str, Any] = {}
            if provider_name and existing.get("name") != provider_name:
                update_payload["name"] = provider_name
            if npi and existing.get("npi") != npi:
                update_payload["npi"] = npi
            if specialty and not existing.get("specialty"):
                update_payload["specialty"] = specialty
            if update_payload:
                existing = (
                    execute_with_retry(
                        self.client.table("providers")
                        .update(update_payload)
                        .eq("id", existing["id"])
                    ).data[0]
                )
            else:
                existing["metadata"] = metadata
            return self._map_provider_row(existing)
        row = (
            execute_with_retry(
                self.client.table("providers")
                .upsert(
                    {
                        "tenant_id": tenant_id,
                        "provider_key": provider_key,
                        "npi": npi,
                        "name": provider_name,
                        "taxonomy_code": None,
                        "specialty": specialty,
                        "network_status": "in_network",
                        "contract_tier": None,
                        "active": True,
                        "metadata": {
                            "contract_status": "active",
                            "credential_status": "credentialed",
                            "plan_participation": [],
                            "facility_affiliations": [],
                            "service_locations": [],
                            "accepting_referrals": True,
                            "surgical_privileges": False,
                        },
                    },
                    on_conflict="tenant_id,provider_key",
                )
            ).data[0]
        )
        return self._map_provider_row(row)

    def list_providers(self, *, tenant_key: str | None = None, limit: int = 100) -> list[ProviderRecord]:
        query = self.client.table("providers").select("*, tenants!inner(tenant_key)").order("created_at", desc=True).limit(limit)
        if tenant_key:
            query = query.eq("tenants.tenant_key", tenant_key)
        rows = execute_with_retry(query).data
        return [self._map_provider_row({k: v for k, v in row.items() if k != "tenants"}) for row in rows]

    def create_provider(self, request: ProviderCreateRequest) -> ProviderRecord:
        tenant_rows = (
            execute_with_retry(
                self.client.table("tenants")
                .select("*")
                .eq("tenant_key", request.tenant_key)
                .limit(1)
            ).data
        )
        if not tenant_rows:
            tenant = self.ensure_tenant(payer_name=request.tenant_key.replace("-", " ").title())
            tenant_id = tenant.id
        else:
            tenant_id = tenant_rows[0]["id"]

        row = (
            execute_with_retry(
                self.client.table("providers")
                .upsert(
                    {
                        "tenant_id": tenant_id,
                        "provider_key": request.provider_key,
                        "npi": request.npi,
                        "tin": request.tin,
                        "name": request.name,
                        "taxonomy_code": request.taxonomy_code,
                        "specialty": request.specialty,
                        "network_status": request.network_status,
                        "contract_tier": request.contract_tier,
                        "active": request.active,
                        "metadata": {
                            **request.metadata,
                            "subspecialty": request.subspecialty,
                            "contract_status": request.contract_status,
                            "credential_status": request.credential_status,
                            "network_effective_date": (
                                request.network_effective_date.isoformat()
                                if request.network_effective_date
                                else None
                            ),
                            "network_end_date": (
                                request.network_end_date.isoformat()
                                if request.network_end_date
                                else None
                            ),
                            "plan_participation": request.plan_participation,
                            "facility_affiliations": request.facility_affiliations,
                            "service_locations": request.service_locations,
                            "accepting_referrals": request.accepting_referrals,
                            "surgical_privileges": request.surgical_privileges,
                        },
                    },
                    on_conflict="tenant_id,provider_key",
                )
            ).data[0]
        )
        return self._map_provider_row(row)

    def _map_provider_row(self, row: dict[str, Any]) -> ProviderRecord:
        metadata = row.get("metadata") or {}
        base_row = {k: v for k, v in row.items() if k != "metadata"}
        return ProviderRecord(
            **base_row,
            contract_status=metadata.get("contract_status", "active"),
            subspecialty=metadata.get("subspecialty"),
            credential_status=metadata.get("credential_status", "credentialed"),
            network_effective_date=_parse_optional_date(metadata.get("network_effective_date")),
            network_end_date=_parse_optional_date(metadata.get("network_end_date")),
            plan_participation=list(metadata.get("plan_participation") or []),
            facility_affiliations=list(metadata.get("facility_affiliations") or []),
            service_locations=list(metadata.get("service_locations") or []),
            accepting_referrals=bool(metadata.get("accepting_referrals", True)),
            surgical_privileges=bool(metadata.get("surgical_privileges", False)),
            metadata=metadata,
        )


def get_providers_repository() -> ProvidersRepository:
    return ProvidersRepository(get_supabase_client())


def _parse_optional_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))
