from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import Settings, get_settings
from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.confidence_service import ConfidenceService
from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.intake_service import IntakeService
from app.domain.claims.models import (
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimSubmission,
)
from app.domain.claims.policy_retrieval_service import PolicyRetrievalService
from app.domain.claims.repository import ClaimsRepository, get_claims_repository
from app.domain.claims.validation_service import ValidationService

router = APIRouter(prefix="/claims", tags=["claims"])

intake_service = IntakeService()
validation_service = ValidationService()
policy_service = PolicyRetrievalService()
adjudication_service = AdjudicationService()
confidence_service = ConfidenceService()


@router.get("/demo", response_model=ClaimSubmission)
def get_demo_claim() -> ClaimSubmission:
    return get_demo_outpatient_claim()


@router.get("", response_model=list[ClaimRecordSummary])
def list_claims(
    limit: int = Query(default=20, ge=1, le=100),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> list[ClaimRecordSummary]:
    return repository.list_claims(limit=limit)


@router.get("/{claim_id}", response_model=ClaimProcessingResponse)
def get_claim(
    claim_id: str,
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> ClaimProcessingResponse:
    claim = repository.get_claim(claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim


@router.post("/process", response_model=ClaimProcessingResponse)
def process_claim(
    claim: ClaimSubmission,
    settings: Settings = Depends(get_settings),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> ClaimProcessingResponse:
    normalized_claim = intake_service.normalize_claim(claim)
    validation = validation_service.validate(normalized_claim)
    matched_policies = policy_service.retrieve(normalized_claim)
    decision = adjudication_service.adjudicate(normalized_claim, validation, matched_policies)
    confidence_score = confidence_service.score(validation, decision)
    requires_human_review = (
        confidence_score < settings.human_review_threshold or decision.outcome == "review"
    )

    return repository.create_processed_claim(
        claim=normalized_claim,
        validation=validation,
        decision=decision,
        confidence_score=confidence_score,
        requires_human_review=requires_human_review,
        matched_policies=matched_policies,
    )
