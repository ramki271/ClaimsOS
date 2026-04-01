from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PolicyDocumentRecord(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    document_key: str
    filename: str
    title: str
    classification: str = "POLICY_CORE"
    source_type: str = "upload"
    status: str = "indexed"
    raw_text: str
    chunk_count: int = 0
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class PolicyChunkRecord(BaseModel):
    id: Optional[str] = None
    document_id: str
    tenant_id: str
    chunk_index: int
    content: str
    keyword_tokens: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class PolicyUploadResponse(BaseModel):
    document: PolicyDocumentRecord
    chunks_created: int
    status: str


class PolicyListItem(BaseModel):
    id: str
    filename: str
    title: str
    classification: str
    status: str
    chunk_count: int
    created_at: Optional[datetime] = None


class PolicyMetricsSummary(BaseModel):
    total_documents: int
    total_chunks: int
    indexed_documents: int
    success_rate: float
    queue_depth: int
    avg_ingestion_latency_ms: float
    documents_indexed_24h: int


class PolicyMetricsPoint(BaseModel):
    date: str
    label: str
    documents_indexed: int
    chunks_indexed: int


class PolicyRecentUpload(BaseModel):
    filename: str
    title: str
    status: str
    chunk_count: int
    created_at: Optional[datetime] = None
    retrieval_backend: Optional[str] = None
    openai_ingestion_status: Optional[str] = None


class PolicyMetricsResponse(BaseModel):
    summary: PolicyMetricsSummary
    trend: list[PolicyMetricsPoint]
    recent_uploads: list[PolicyRecentUpload]
