from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.models.claim import ClaimProcessingResponse, ClaimSubmission
from app.services.adjudication_service import AdjudicationService
from app.services.confidence_service import ConfidenceService
from app.services.intake_service import IntakeService
from app.services.policy_retrieval_service import PolicyRetrievalService
from app.services.validation_service import ValidationService

router = APIRouter(prefix="/claims", tags=["claims"])

intake_service = IntakeService()
validation_service = ValidationService()
policy_service = PolicyRetrievalService()
adjudication_service = AdjudicationService()
confidence_service = ConfidenceService()


@router.get("/demo", response_model=ClaimSubmission)
def get_demo_claim() -> ClaimSubmission:
    return ClaimSubmission(
        claim_id="CLM-240031",
        patient_id="PAT-1007",
        provider_id="PRV-4092",
        diagnosis_codes=["E11.9"],
        procedure_codes=["99213"],
        amount=150,
        date_of_service="2026-03-01",
    )


@router.post("/process", response_model=ClaimProcessingResponse)
def process_claim(
    claim: ClaimSubmission,
    settings: Settings = Depends(get_settings),
) -> ClaimProcessingResponse:
    normalized_claim = intake_service.normalize_claim(claim)
    validation = validation_service.validate(normalized_claim)
    matched_policies = policy_service.retrieve(normalized_claim)
    decision = adjudication_service.adjudicate(normalized_claim, validation, matched_policies)
    confidence_score = confidence_service.score(validation, decision)

    return ClaimProcessingResponse(
        claim_id=normalized_claim.claim_id,
        status="processed",
        validation=validation,
        decision=decision,
        confidence_score=confidence_score,
        requires_human_review=confidence_score < settings.human_review_threshold
        or decision.outcome == "review",
        matched_policies=matched_policies,
    )

