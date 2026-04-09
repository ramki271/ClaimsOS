from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Tenant(BaseModel):
    id: Optional[str] = None
    tenant_key: str
    tenant_type: Literal["payer", "tpa"] = "payer"
    name: str
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class ProviderRecord(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    provider_key: str
    npi: Optional[str] = None
    tin: Optional[str] = None
    name: str
    taxonomy_code: Optional[str] = None
    specialty: Optional[str] = None
    subspecialty: Optional[str] = None
    network_status: Literal["in_network", "out_of_network", "pending"] = "in_network"
    contract_tier: Optional[str] = None
    contract_status: Literal["active", "inactive", "pending"] = "active"
    credential_status: Literal["credentialed", "provisional", "sanctioned", "pending"] = "credentialed"
    network_effective_date: Optional[date] = None
    network_end_date: Optional[date] = None
    plan_participation: list[str] = Field(default_factory=list)
    facility_affiliations: list[str] = Field(default_factory=list)
    service_locations: list[str] = Field(default_factory=list)
    accepting_referrals: bool = True
    surgical_privileges: bool = False
    active: bool = True
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class ProviderCreateRequest(BaseModel):
    tenant_key: str
    provider_key: str
    name: str
    npi: Optional[str] = None
    tin: Optional[str] = None
    taxonomy_code: Optional[str] = None
    specialty: Optional[str] = None
    subspecialty: Optional[str] = None
    network_status: Literal["in_network", "out_of_network", "pending"] = "in_network"
    contract_tier: Optional[str] = None
    contract_status: Literal["active", "inactive", "pending"] = "active"
    credential_status: Literal["credentialed", "provisional", "sanctioned", "pending"] = "credentialed"
    network_effective_date: Optional[date] = None
    network_end_date: Optional[date] = None
    plan_participation: list[str] = Field(default_factory=list)
    facility_affiliations: list[str] = Field(default_factory=list)
    service_locations: list[str] = Field(default_factory=list)
    accepting_referrals: bool = True
    surgical_privileges: bool = False
    active: bool = True
    metadata: dict = Field(default_factory=dict)
