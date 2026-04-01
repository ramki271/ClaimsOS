from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class MemberRecord(BaseModel):
    member_id: str
    tenant_key: str
    payer_name: str
    subscriber_id: str
    member_name: str
    date_of_birth: date
    gender: Literal["female", "male", "other", "unknown"] = "unknown"
    relationship_to_subscriber: Literal["self", "spouse", "child", "other"] = "self"
    plan_name: str
    plan_product: str
    coverage_type: Literal["commercial", "medicare_advantage", "medicaid_managed_care"] = "commercial"
    eligibility_status: Literal["active", "inactive", "pending_review"] = "active"
    effective_date: date
    termination_date: Optional[date] = None
    pcp_name: Optional[str] = None
    pcp_npi: Optional[str] = None
    referral_required: bool = False
    prior_auth_required_for_specialty: bool = False
    address_line_1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    risk_flags: list[str] = Field(default_factory=list)
    active_claim_count: int = 0
    last_claim_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class ClinicalHotspot(BaseModel):
    id: str
    body_location: str
    description: str
    icd_code: str
    risk_level: Literal["high_risk", "active_claim", "monitor"] = "monitor"
    position_x: float = 50.0  # % from left of body container
    position_y: float = 50.0  # % from top of body container


class ActiveDiagnosis(BaseModel):
    icd_code: str
    description: str
    onset: str


class SurgicalHistoryItem(BaseModel):
    date: str
    procedure: str
    facility: Optional[str] = None
    notes: str
    is_primary: bool = False


class PolicyAlignmentItem(BaseModel):
    status: Literal["approved", "active", "review_required"] = "approved"
    text: str


class MemberListItem(BaseModel):
    member_id: str
    tenant_key: str
    payer_name: str
    member_name: str
    subscriber_id: str
    plan_name: str
    eligibility_status: str
    date_of_birth: date
    active_claim_count: int = 0
    last_claim_id: Optional[str] = None


class MemberDetailResponse(BaseModel):
    member: MemberRecord
    recent_claim_ids: list[str] = Field(default_factory=list)
    coverage_notes: list[str] = Field(default_factory=list)
    # Clinical enrichment fields
    plan_tier: str = ""
    deductible_met: str = ""
    deductible_max: str = ""
    diagnostic_confidence: float = 0.0
    clinical_hotspots: list[ClinicalHotspot] = Field(default_factory=list)
    active_diagnoses: list[ActiveDiagnosis] = Field(default_factory=list)
    surgical_history: list[SurgicalHistoryItem] = Field(default_factory=list)
    policy_alignment: list[PolicyAlignmentItem] = Field(default_factory=list)
