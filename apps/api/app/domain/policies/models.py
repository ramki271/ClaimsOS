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
