from __future__ import annotations

from typing import Any

from fastapi import Depends

from app.domain.policies.models import (
    PolicyChunkRecord,
    PolicyDocumentRecord,
    PolicyListItem,
)
from app.integrations.supabase import get_supabase_client


class PoliciesRepository:
    def __init__(self, client: Any) -> None:
        self.client = client

    def create_document(
        self,
        *,
        tenant_id: str,
        document_key: str,
        filename: str,
        title: str,
        classification: str,
        raw_text: str,
        metadata: dict,
    ) -> PolicyDocumentRecord:
        row = (
            self.client.table("policy_documents")
            .upsert(
                {
                    "tenant_id": tenant_id,
                    "document_key": document_key,
                    "filename": filename,
                    "title": title,
                    "classification": classification,
                    "source_type": "upload",
                    "status": "indexed",
                    "raw_text": raw_text,
                    "metadata": metadata,
                },
                on_conflict="tenant_id,document_key",
            )
            .execute()
            .data[0]
        )
        return PolicyDocumentRecord(**row)

    def replace_chunks(
        self,
        *,
        document_id: str,
        tenant_id: str,
        chunks: list[PolicyChunkRecord],
    ) -> int:
        self.client.table("policy_chunks").delete().eq("document_id", document_id).execute()
        if not chunks:
            self.client.table("policy_documents").update({"chunk_count": 0}).eq("id", document_id).execute()
            return 0

        self.client.table("policy_chunks").insert(
            [
                {
                    "document_id": document_id,
                    "tenant_id": tenant_id,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "keyword_tokens": chunk.keyword_tokens,
                    "metadata": chunk.metadata,
                }
                for chunk in chunks
            ]
        ).execute()
        self.client.table("policy_documents").update({"chunk_count": len(chunks)}).eq("id", document_id).execute()
        return len(chunks)

    def list_documents(self, *, tenant_id: str | None = None, limit: int = 100) -> list[PolicyListItem]:
        query = self.client.table("policy_documents").select("*").order("created_at", desc=True).limit(limit)
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        rows = query.execute().data
        return [
            PolicyListItem(
                id=row["id"],
                filename=row["filename"],
                title=row["title"],
                classification=row["classification"],
                status=row["status"],
                chunk_count=row.get("chunk_count") or 0,
                created_at=row.get("created_at"),
            )
            for row in rows
        ]

    def retrieve_chunks(self, *, tenant_id: str, limit: int = 25) -> list[dict]:
        return (
            self.client.table("policy_chunks")
            .select("*, policy_documents!inner(document_key,title,classification)")
            .eq("tenant_id", tenant_id)
            .limit(limit)
            .execute()
            .data
        )


def get_policies_repository() -> PoliciesRepository:
    return PoliciesRepository(get_supabase_client())
