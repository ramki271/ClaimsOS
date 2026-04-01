from __future__ import annotations

import io
from typing import Any

from app.core.config import get_settings
from app.integrations.openai_client import get_openai_client


class OpenAIPolicyRetrievalService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def is_enabled(self) -> bool:
        return self.settings.has_openai

    def ensure_vector_store(self, *, tenant_key: str, existing_vector_store_id: str | None = None) -> str:
        if existing_vector_store_id:
            return existing_vector_store_id

        client = get_openai_client()
        vector_store = client.vector_stores.create(
            name=f"{self.settings.openai_vector_store_prefix}-{tenant_key}",
        )
        return vector_store.id

    def upload_policy_document(
        self,
        *,
        vector_store_id: str,
        filename: str,
        content: bytes,
    ) -> dict[str, str]:
        client = get_openai_client()
        file_obj = io.BytesIO(content)
        file_obj.name = filename

        uploaded = client.vector_stores.files.upload_and_poll(
            vector_store_id=vector_store_id,
            file=file_obj,
        )
        file_id = getattr(uploaded, "id", None)
        return {
            "vector_store_id": vector_store_id,
            "openai_file_id": file_id or "",
        }

    def search(
        self,
        *,
        vector_store_id: str,
        query: str,
        max_results: int = 5,
    ) -> list[dict]:
        client = get_openai_client()
        response = client.vector_stores.search(
            vector_store_id=vector_store_id,
            query=query,
            max_num_results=max_results,
        )
        rows = getattr(response, "data", None)
        if rows is None and isinstance(response, dict):
            rows = response.get("data", [])
        if rows is None:
            return []

        return [self._normalize_search_result(row) for row in rows]

    def _normalize_search_result(self, row: Any) -> dict:
        if hasattr(row, "model_dump"):
            row = row.model_dump()

        content_items = row.get("content") or []
        snippets: list[str] = []
        for item in content_items:
            if hasattr(item, "model_dump"):
                item = item.model_dump()
            text = item.get("text") or item.get("content") or ""
            if text:
                snippets.append(text)

        attributes = row.get("attributes") or {}
        return {
            "file_id": row.get("file_id") or row.get("id"),
            "filename": row.get("filename") or attributes.get("filename") or "Policy Document",
            "score": float(row.get("score") or 0.0),
            "content": "\n".join(snippets).strip(),
        }
