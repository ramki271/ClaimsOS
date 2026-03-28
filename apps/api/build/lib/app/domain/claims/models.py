from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ServiceLine(BaseModel):
    line_number: int = Field(ge=1)
    procedure_code: str
    modifiers: list[str] = []
    units: int = Field(default=1, ge=1)
    charge_amount: float = Field(gt=0)


class ClaimSubmission(BaseModel):
    claim_id: str = Field(..., description="Unique claim identifier")
    claim_type: Literal["professional_outpatient"] = "professional_outpatient"
    form_type: Literal["CMS-1500"] = "CMS-1500"
    payer_name: str
    plan_name: str
    member_id: str
    member_name: str
    patient_id: str
    provider_id: str
    provider_name: str
    place_of_service: str = "11"
    diagnosis_codes: list[str] = Field(min_length=1)
    procedure_codes: list[str] = Field(default_factory=list)
    service_lines: list[ServiceLine] = Field(min_length=1)
    amount: float = Field(gt=0)
    date_of_service: date


class ValidationIssue(BaseModel):
    code: str
    message: str
    severity: str = "error"


class ValidationResult(BaseModel):
    is_valid: bool
    issues: list[ValidationIssue]


class PolicyMatch(BaseModel):
    policy_id: str
    title: str
    summary: str
    relevance_score: float


class AdjudicationDecision(BaseModel):
    outcome: str
    rationale: str
    cited_rules: list[str]


class ClaimProcessingResponse(BaseModel):
    claim: ClaimSubmission
    status: str
    validation: ValidationResult
    decision: AdjudicationDecision
    confidence_score: float
    requires_human_review: bool
    matched_policies: list[PolicyMatch]
    created_at: Optional[datetime] = None


class ClaimRecordSummary(BaseModel):
    claim_id: str
    claim_type: str
    payer_name: str
    member_name: str
    provider_name: str
    amount: float
    date_of_service: date
    outcome: str
    confidence_score: float
    requires_human_review: bool
    created_at: datetime
