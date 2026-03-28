from __future__ import annotations

import re
from pathlib import Path

from app.domain.policies.models import PolicyChunkRecord


class PolicyIngestionError(ValueError):
    """Raised when a policy document cannot be processed."""


class PolicyIngestionService:
    def extract_text(self, *, filename: str, content: bytes) -> str:
        suffix = Path(filename or "").suffix.lower()
        if suffix in {".txt", ".md", ".x12", ".edi", ".json", ".xml"} or not suffix:
            text = content.decode("utf-8", errors="ignore").strip()
            if not text:
                raise PolicyIngestionError("Uploaded policy file is empty.")
            return text
        raise PolicyIngestionError(f"Unsupported policy file type for MVP ingestion: {suffix}")

    def chunk_text(self, *, tenant_id: str, document_id: str, text: str) -> list[PolicyChunkRecord]:
        normalized = re.sub(r"\r\n?", "\n", text).strip()
        if not normalized:
            return []

        blocks = [block.strip() for block in re.split(r"\n\s*\n", normalized) if block.strip()]
        if not blocks:
            blocks = [normalized]

        chunks: list[PolicyChunkRecord] = []
        buffer = ""
        chunk_index = 0

        for block in blocks:
            candidate = f"{buffer}\n\n{block}".strip() if buffer else block
            if len(candidate) > 900 and buffer:
                chunks.append(
                    PolicyChunkRecord(
                        document_id=document_id,
                        tenant_id=tenant_id,
                        chunk_index=chunk_index,
                        content=buffer,
                        keyword_tokens=self._extract_keywords(buffer),
                        metadata={"length": len(buffer)},
                    )
                )
                chunk_index += 1
                buffer = block
            else:
                buffer = candidate

        if buffer:
            chunks.append(
                PolicyChunkRecord(
                    document_id=document_id,
                    tenant_id=tenant_id,
                    chunk_index=chunk_index,
                    content=buffer,
                    keyword_tokens=self._extract_keywords(buffer),
                    metadata={"length": len(buffer)},
                )
            )

        return chunks

    def document_title(self, *, filename: str, text: str) -> str:
        first_line = text.splitlines()[0].strip() if text.splitlines() else ""
        if first_line and len(first_line) <= 90:
            return first_line.lstrip("# ").strip()
        return Path(filename).stem.replace("_", " ").replace("-", " ").title() or "Policy Document"

    def document_key(self, *, filename: str) -> str:
        stem = Path(filename).stem.lower()
        return re.sub(r"[^a-z0-9]+", "-", stem).strip("-") or "policy-document"

    def _extract_keywords(self, text: str) -> list[str]:
        matches = re.findall(r"[A-Za-z0-9][A-Za-z0-9\.-]{2,}", text.upper())
        seen: list[str] = []
        for token in matches:
            if token not in seen:
                seen.append(token)
            if len(seen) >= 40:
                break
        return seen
