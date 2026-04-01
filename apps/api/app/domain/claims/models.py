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
    document_label: Optional[str] = None
    source_reference: Optional[str] = None


class AdjudicationCheck(BaseModel):
    code: str
    label: str
    status: Literal["passed", "failed", "review"]
    source: Literal["validation", "policy", "integrity", "provider", "utilization"]
    summary: str


class AdjudicationDecision(BaseModel):
    outcome: str
    rationale: str
    cited_rules: list[str]
    passed_checks: list[AdjudicationCheck] = Field(default_factory=list)
    failed_checks: list[AdjudicationCheck] = Field(default_factory=list)
    review_triggers: list[str] = Field(default_factory=list)


class AuditEvent(BaseModel):
    event_type: str
    payload: dict
    created_at: Optional[datetime] = None


class HumanReviewState(BaseModel):
    status: str
    reason: str
    reviewer_name: Optional[str] = None
    reviewer_notes: Optional[str] = None
    updated_at: Optional[datetime] = None


class InsightCard(BaseModel):
    label: str
    value: str
    status: str
    score: float
    detail: Optional[str] = None


class ClaimInsights(BaseModel):
    policy_match: InsightCard
    duplication_risk: InsightCard
    network_parity: InsightCard


class ProviderAdjudicationContext(BaseModel):
    provider_key: str
    provider_name: str
    specialty: Optional[str] = None
    network_status: str
    contract_tier: Optional[str] = None
    contract_status: str
    network_effective_date: Optional[date] = None
    network_end_date: Optional[date] = None
    participates_in_plan: bool
    specialty_match: Optional[bool] = None
    specialty_match_reason: Optional[str] = None


class UtilizationContext(BaseModel):
    utilization_level: Literal["routine", "elevated", "prior_auth"]
    prior_auth_required: bool
    prior_auth_status: Literal["not_required", "pending_review", "satisfied"]
    trigger_codes: list[str] = Field(default_factory=list)
    review_reason: Optional[str] = None
    notes: list[str] = Field(default_factory=list)


class ClaimReviewRequest(BaseModel):
    reviewer_name: Optional[str] = None
    reviewer_notes: str = Field(min_length=1)
    review_status: Literal["in_review", "resolved"] = "resolved"
    override_outcome: Optional[Literal["approve", "deny", "review"]] = None


class ClaimProcessingResponse(BaseModel):
    claim: ClaimSubmission
    status: str
    validation: ValidationResult
    decision: AdjudicationDecision
    confidence_score: float
    requires_human_review: bool
    matched_policies: list[PolicyMatch]
    created_at: Optional[datetime] = None
    review_state: Optional[HumanReviewState] = None
    audit_trail: list[AuditEvent] = Field(default_factory=list)
    insights: ClaimInsights
    provider_context: Optional[ProviderAdjudicationContext] = None
    utilization_context: Optional[UtilizationContext] = None


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
    review_status: Optional[str] = None


class X12BatchClaimResult(BaseModel):
    claim_id: Optional[str] = None
    status: Literal["processed", "failed"]
    result: Optional[ClaimProcessingResponse] = None
    error: Optional[str] = None


class X12BatchUploadResponse(BaseModel):
    total_claims: int
    processed_claims: int
    failed_claims: int
    results: list[X12BatchClaimResult] = Field(default_factory=list)


class DraftServiceLine(BaseModel):
    line_number: Optional[int] = Field(default=None, ge=1)
    procedure_code: Optional[str] = None
    modifiers: list[str] = Field(default_factory=list)
    units: Optional[int] = Field(default=None, ge=1)
    charge_amount: Optional[float] = Field(default=None, gt=0)


class ClaimDocumentDraft(BaseModel):
    claim_id: Optional[str] = None
    claim_type: Literal["professional_outpatient"] = "professional_outpatient"
    form_type: Literal["CMS-1500"] = "CMS-1500"
    payer_name: Optional[str] = None
    plan_name: Optional[str] = None
    member_id: Optional[str] = None
    member_name: Optional[str] = None
    patient_id: Optional[str] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    place_of_service: Optional[str] = "11"
    diagnosis_codes: list[str] = Field(default_factory=list)
    procedure_codes: list[str] = Field(default_factory=list)
    service_lines: list[DraftServiceLine] = Field(default_factory=list)
    amount: Optional[float] = Field(default=None, gt=0)
    date_of_service: Optional[date] = None


class LowConfidenceField(BaseModel):
    field: str
    confidence: Literal["low", "medium", "high"] = "medium"
    reason: str


class ClaimDocumentIntakeResponse(BaseModel):
    status: Literal["drafted", "processed"]
    source_type: Literal["text", "pdf", "docx", "image"]
    extraction_summary: str
    claim_draft: ClaimDocumentDraft
    ready_for_processing: bool
    missing_fields: list[str] = Field(default_factory=list)
    review_notes: list[str] = Field(default_factory=list)
    low_confidence_fields: list[LowConfidenceField] = Field(default_factory=list)
    processed_result: Optional[ClaimProcessingResponse] = None
