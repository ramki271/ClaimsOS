from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.config import Settings, get_settings
from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.confidence_service import ConfidenceService
from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.intake_service import IntakeService
from app.domain.claims.models import (
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimReviewRequest,
    ClaimSubmission,
)
from app.domain.claims.policy_retrieval_service import PolicyRetrievalService
from app.domain.claims.repository import ClaimsRepository, get_claims_repository
from app.domain.claims.validation_service import ValidationService
from app.domain.claims.x12_parser import X12ParseError, X12ProfessionalClaimParser

router = APIRouter(prefix="/claims", tags=["claims"])

intake_service = IntakeService()
validation_service = ValidationService()
policy_service = PolicyRetrievalService()
adjudication_service = AdjudicationService()
confidence_service = ConfidenceService()
x12_parser = X12ProfessionalClaimParser()


def _run_claim_processing(
    claim: ClaimSubmission,
    settings: Settings,
    repository: ClaimsRepository,
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


@router.get("/demo", response_model=ClaimSubmission)
def get_demo_claim() -> ClaimSubmission:
    return get_demo_outpatient_claim()


@router.get("", response_model=list[ClaimRecordSummary])
def list_claims(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    outcome: Optional[str] = Query(default=None),
    requires_review: Optional[bool] = Query(default=None),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> list[ClaimRecordSummary]:
    return repository.list_claims(
        limit=limit,
        offset=offset,
        outcome=outcome,
        requires_review=requires_review,
    )


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
    return _run_claim_processing(claim, settings, repository)


@router.post("/upload-x12", response_model=ClaimProcessingResponse)
async def upload_x12_claim(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> ClaimProcessingResponse:
    payload = (await file.read()).decode("utf-8", errors="ignore")
    try:
        claim = x12_parser.parse(payload)
    except X12ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _run_claim_processing(claim, settings, repository)


@router.post("/{claim_id}/review", response_model=ClaimProcessingResponse)
def submit_claim_review(
    claim_id: str,
    review_request: ClaimReviewRequest,
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> ClaimProcessingResponse:
    claim = repository.submit_review(claim_id, review_request)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return claim
