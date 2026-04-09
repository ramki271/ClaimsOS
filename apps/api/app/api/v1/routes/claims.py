from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.core.config import Settings, get_settings
from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.confidence_service import ConfidenceService
from app.domain.claims.demo_data import get_demo_outpatient_claim
from app.domain.claims.document_intake_service import ClaimDocumentIntakeError, ClaimDocumentIntakeService
from app.domain.claims.intake_service import IntakeService
from app.domain.claims.models import (
    ClaimDocumentIntakeResponse,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimReviewRequest,
    ClaimSubmission,
    X12BatchClaimResult,
    X12BatchUploadResponse,
)
from app.domain.claims.payer_verification_service import PayerVerificationService
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
document_intake_service = ClaimDocumentIntakeService()
payer_verification_service = PayerVerificationService()


def _run_claim_processing(
    claim: ClaimSubmission,
    settings: Settings,
    repository: ClaimsRepository,
) -> ClaimProcessingResponse:
    normalized_claim = intake_service.normalize_claim(claim)
    validation = validation_service.validate(normalized_claim)
    matched_policies = policy_service.retrieve(normalized_claim)
    provider_context = None
    utilization_context = adjudication_service.build_utilization_context(normalized_claim)
    providers_repository = getattr(repository, "providers_repository", None)
    build_provider_context = getattr(repository, "_build_provider_context", None)
    if providers_repository is not None and callable(build_provider_context):
        tenant = providers_repository.ensure_tenant(payer_name=normalized_claim.payer_name)
        provider_key = normalized_claim.rendering_provider_id or normalized_claim.provider_id
        provider_name = normalized_claim.rendering_provider_name or normalized_claim.provider_name
        provider = providers_repository.ensure_provider_for_tenant(
            tenant_id=tenant.id or "",
            provider_id=provider_key,
            provider_name=provider_name,
            specialty=None,
        )
        provider_context = build_provider_context(claim=normalized_claim, provider=provider)
    payer_verification_context = payer_verification_service.build(
        normalized_claim,
        provider_context=provider_context,
    )
    decision = adjudication_service.adjudicate(
        normalized_claim,
        validation,
        matched_policies,
        provider_context=provider_context,
        utilization_context=utilization_context,
        payer_verification_context=payer_verification_context,
    )
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
        payer_verification_context=payer_verification_context,
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


@router.post("/intake-document", response_model=ClaimDocumentIntakeResponse)
async def intake_claim_document(
    file: UploadFile = File(...),
    auto_process: bool = Form(False),
    payer_name_hint: Optional[str] = Form(default=None),
    settings: Settings = Depends(get_settings),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> ClaimDocumentIntakeResponse:
    content = await file.read()
    try:
        intake_result = document_intake_service.extract_claim_draft(
            filename=file.filename or "claim-document",
            content=content,
            content_type=file.content_type,
            payer_name_hint=payer_name_hint,
        )
    except ClaimDocumentIntakeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not auto_process or not intake_result.ready_for_processing:
        return intake_result

    claim, missing_fields = document_intake_service.finalize_claim_submission(intake_result.claim_draft)
    if claim is None:
        return intake_result.model_copy(
            update={
                "ready_for_processing": False,
                "missing_fields": missing_fields,
            }
        )

    processed_result = _run_claim_processing(claim, settings, repository)
    return intake_result.model_copy(
        update={
            "status": "processed",
            "processed_result": processed_result,
            "ready_for_processing": True,
            "missing_fields": [],
        }
    )


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


@router.post("/upload-x12-batch", response_model=X12BatchUploadResponse)
async def upload_x12_batch(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    repository: ClaimsRepository = Depends(get_claims_repository),
) -> X12BatchUploadResponse:
    payload = (await file.read()).decode("utf-8", errors="ignore")
    try:
        claims = x12_parser.parse_many(payload)
    except X12ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    results: list[X12BatchClaimResult] = []
    processed_claims = 0
    failed_claims = 0
    for claim in claims:
        try:
            processed = _run_claim_processing(claim, settings, repository)
        except Exception as exc:  # pragma: no cover - defensive batch isolation
            cleanup = getattr(repository, "cleanup_claim_by_external_id", None)
            if callable(cleanup):
                cleanup(claim.claim_id)
            failed_claims += 1
            results.append(
                X12BatchClaimResult(
                    claim_id=claim.claim_id,
                    status="failed",
                    error=str(exc),
                )
            )
            continue

        processed_claims += 1
        results.append(
            X12BatchClaimResult(
                claim_id=claim.claim_id,
                status="processed",
                result=processed,
            )
        )

    return X12BatchUploadResponse(
        total_claims=len(claims),
        processed_claims=processed_claims,
        failed_claims=failed_claims,
        results=results,
    )


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
