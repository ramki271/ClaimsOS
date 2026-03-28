from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.domain.policies.ingestion_service import PolicyIngestionError, PolicyIngestionService
from app.domain.policies.models import PolicyListItem, PolicyUploadResponse
from app.domain.policies.repository import PoliciesRepository, get_policies_repository
from app.domain.providers.repository import ProvidersRepository, get_providers_repository

router = APIRouter(prefix="/policies", tags=["policies"])

ingestion_service = PolicyIngestionService()


@router.get("", response_model=list[PolicyListItem])
def list_policies(
    tenant_key: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    providers_repository: ProvidersRepository = Depends(get_providers_repository),
    repository: PoliciesRepository = Depends(get_policies_repository),
) -> list[PolicyListItem]:
    tenant_id = None
    if tenant_key:
        tenant = providers_repository.get_tenant_by_key(tenant_key)
        if tenant is None:
            return []
        tenant_id = tenant.id
    return repository.list_documents(tenant_id=tenant_id, limit=limit)


@router.post("/upload", response_model=PolicyUploadResponse)
async def upload_policy(
    file: UploadFile = File(...),
    payer_name: str = Form(...),
    classification: str = Form("POLICY_CORE"),
    providers_repository: ProvidersRepository = Depends(get_providers_repository),
    repository: PoliciesRepository = Depends(get_policies_repository),
) -> PolicyUploadResponse:
    content = await file.read()
    try:
        text = ingestion_service.extract_text(filename=file.filename or "policy.txt", content=content)
    except PolicyIngestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    tenant = providers_repository.ensure_tenant(payer_name=payer_name)
    if not tenant.id:
        raise HTTPException(status_code=500, detail="Unable to resolve tenant for policy upload.")

    title = ingestion_service.document_title(filename=file.filename or "policy.txt", text=text)
    document_key = ingestion_service.document_key(filename=file.filename or "policy.txt")
    document = repository.create_document(
        tenant_id=tenant.id,
        document_key=document_key,
        filename=file.filename or "unknown",
        title=title,
        classification=classification,
        raw_text=text,
        metadata={"payer_name": payer_name},
    )
    chunks = ingestion_service.chunk_text(tenant_id=tenant.id, document_id=document.id or "", text=text)
    chunk_count = repository.replace_chunks(
        document_id=document.id or "",
        tenant_id=tenant.id,
        chunks=chunks,
    )
    refreshed_document = repository.create_document(
        tenant_id=tenant.id,
        document_key=document_key,
        filename=file.filename or "unknown",
        title=title,
        classification=classification,
        raw_text=text,
        metadata={"payer_name": payer_name},
    ).model_copy(update={"chunk_count": chunk_count})

    return PolicyUploadResponse(
        document=refreshed_document,
        chunks_created=chunk_count,
        status="indexed",
    )
