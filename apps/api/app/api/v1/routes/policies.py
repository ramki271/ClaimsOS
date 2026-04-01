from collections import defaultdict
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.domain.policies.ingestion_service import PolicyIngestionError, PolicyIngestionService
from app.domain.policies.models import (
    PolicyListItem,
    PolicyMetricsPoint,
    PolicyMetricsResponse,
    PolicyMetricsSummary,
    PolicyRecentUpload,
    PolicyUploadResponse,
)
from app.domain.policies.openai_retrieval_service import OpenAIPolicyRetrievalService
from app.domain.policies.repository import PoliciesRepository, get_policies_repository
from app.domain.providers.repository import ProvidersRepository, get_providers_repository

router = APIRouter(prefix="/policies", tags=["policies"])

ingestion_service = PolicyIngestionService()
openai_retrieval_service = OpenAIPolicyRetrievalService()


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


@router.get("/metrics", response_model=PolicyMetricsResponse)
def get_policy_metrics(
    tenant_key: Optional[str] = Query(default=None),
    providers_repository: ProvidersRepository = Depends(get_providers_repository),
    repository: PoliciesRepository = Depends(get_policies_repository),
) -> PolicyMetricsResponse:
    tenant_id = None
    if tenant_key:
        tenant = providers_repository.get_tenant_by_key(tenant_key)
        if tenant is None:
            return PolicyMetricsResponse(
                summary=PolicyMetricsSummary(
                    total_documents=0,
                    total_chunks=0,
                    indexed_documents=0,
                    success_rate=0.0,
                    queue_depth=0,
                    avg_ingestion_latency_ms=0.0,
                    documents_indexed_24h=0,
                ),
                trend=[],
                recent_uploads=[],
            )
        tenant_id = tenant.id

    docs = repository.list_document_records(tenant_id=tenant_id, limit=500)
    total_chunks = repository.count_chunks(tenant_id=tenant_id)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)

    indexed_documents = sum(1 for doc in docs if doc.status == "indexed")
    queue_depth = sum(1 for doc in docs if doc.status in {"uploaded", "processing", "indexing"})
    latency_values = [
        float(doc.metadata.get("ingestion_latency_ms"))
        for doc in docs
        if isinstance(doc.metadata.get("ingestion_latency_ms"), (int, float))
    ]
    avg_ingestion_latency_ms = round(sum(latency_values) / len(latency_values), 1) if latency_values else 0.0
    documents_indexed_24h = sum(
        1 for doc in docs if doc.created_at and doc.created_at >= cutoff and doc.status == "indexed"
    )
    success_rate = round(indexed_documents / len(docs), 4) if docs else 0.0

    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"documents_indexed": 0, "chunks_indexed": 0})
    for day_offset in range(13, -1, -1):
        day = (now - timedelta(days=day_offset)).date()
        buckets[day.isoformat()]

    for doc in docs:
        if not doc.created_at:
            continue
        key = doc.created_at.date().isoformat()
        if key not in buckets:
            continue
        buckets[key]["documents_indexed"] += 1 if doc.status == "indexed" else 0
        buckets[key]["chunks_indexed"] += doc.chunk_count

    trend = [
        PolicyMetricsPoint(
            date=date_key,
            label=datetime.fromisoformat(date_key).strftime("%d %b"),
            documents_indexed=counts["documents_indexed"],
            chunks_indexed=counts["chunks_indexed"],
        )
        for date_key, counts in buckets.items()
    ]

    recent_uploads = [
        PolicyRecentUpload(
            filename=doc.filename,
            title=doc.title,
            status=doc.status,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at,
            retrieval_backend=(doc.metadata or {}).get("retrieval_backend"),
            openai_ingestion_status=(doc.metadata or {}).get("openai_ingestion_status"),
        )
        for doc in docs[:5]
    ]

    return PolicyMetricsResponse(
        summary=PolicyMetricsSummary(
            total_documents=len(docs),
            total_chunks=total_chunks,
            indexed_documents=indexed_documents,
            success_rate=success_rate,
            queue_depth=queue_depth,
            avg_ingestion_latency_ms=avg_ingestion_latency_ms,
            documents_indexed_24h=documents_indexed_24h,
        ),
        trend=trend,
        recent_uploads=recent_uploads,
    )


@router.post("/upload", response_model=PolicyUploadResponse)
async def upload_policy(
    file: UploadFile = File(...),
    payer_name: str = Form(...),
    classification: str = Form("POLICY_CORE"),
    providers_repository: ProvidersRepository = Depends(get_providers_repository),
    repository: PoliciesRepository = Depends(get_policies_repository),
) -> PolicyUploadResponse:
    started_at = perf_counter()
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
        metadata={"payer_name": payer_name, "retrieval_backend": "local"},
    )
    chunks = ingestion_service.chunk_text(tenant_id=tenant.id, document_id=document.id or "", text=text)
    chunk_count = repository.replace_chunks(
        document_id=document.id or "",
        tenant_id=tenant.id,
        chunks=chunks,
    )
    refreshed_document = repository.update_document(
        document_id=document.id or "",
        chunk_count=chunk_count,
    )

    metadata = dict(refreshed_document.metadata or {})
    metadata.setdefault("payer_name", payer_name)

    if openai_retrieval_service.is_enabled():
        try:
            tenant_metadata = getattr(tenant, "metadata", {}) or {}
            existing_vector_store_id = tenant_metadata.get("openai_vector_store_id")
            vector_store_id = openai_retrieval_service.ensure_vector_store(
                tenant_key=tenant.tenant_key,
                existing_vector_store_id=existing_vector_store_id,
            )
            if vector_store_id != existing_vector_store_id:
                tenant = providers_repository.set_tenant_vector_store_id(
                    tenant_id=tenant.id or "",
                    vector_store_id=vector_store_id,
                )
            openai_metadata = openai_retrieval_service.upload_policy_document(
                vector_store_id=vector_store_id,
                filename=file.filename or "unknown",
                content=content,
            )
            metadata.update(
                {
                    **openai_metadata,
                    "retrieval_backend": "openai_vector_store",
                    "openai_ingestion_status": "indexed",
                }
            )
        except Exception as exc:  # noqa: BLE001
            metadata.update(
                {
                    "retrieval_backend": "local",
                    "openai_ingestion_status": "failed",
                    "openai_error": str(exc),
                }
            )
    else:
        metadata["openai_ingestion_status"] = "not_configured"

    metadata["ingestion_latency_ms"] = round((perf_counter() - started_at) * 1000, 1)

    refreshed_document = repository.update_document(
        document_id=document.id or "",
        metadata=metadata,
        chunk_count=chunk_count,
    )

    return PolicyUploadResponse(
        document=refreshed_document,
        chunks_created=chunk_count,
        status="indexed",
    )
