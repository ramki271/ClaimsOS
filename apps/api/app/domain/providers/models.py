from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Tenant(BaseModel):
    id: Optional[str] = None
    tenant_key: str
    tenant_type: Literal["payer", "tpa"] = "payer"
    name: str
    created_at: Optional[datetime] = None


class ProviderRecord(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    provider_key: str
    npi: Optional[str] = None
    tin: Optional[str] = None
    name: str
    specialty: Optional[str] = None
    network_status: Literal["in_network", "out_of_network", "pending"] = "in_network"
    contract_tier: Optional[str] = None
    active: bool = True
    metadata: dict = {}
    created_at: Optional[datetime] = None


class ProviderCreateRequest(BaseModel):
    tenant_key: str
    provider_key: str
    name: str
    npi: Optional[str] = None
    tin: Optional[str] = None
    specialty: Optional[str] = None
    network_status: Literal["in_network", "out_of_network", "pending"] = "in_network"
    contract_tier: Optional[str] = None
    active: bool = True
    metadata: dict = Field(default_factory=dict)
