from datetime import date

from pydantic import BaseModel, Field


class ClaimSubmission(BaseModel):
    claim_id: str = Field(..., description="Unique claim identifier")
    patient_id: str
    provider_id: str
    diagnosis_codes: list[str] = Field(min_length=1)
    procedure_codes: list[str] = Field(min_length=1)
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
    claim_id: str
    status: str
    validation: ValidationResult
    decision: AdjudicationDecision
    confidence_score: float
    requires_human_review: bool
    matched_policies: list[PolicyMatch]

