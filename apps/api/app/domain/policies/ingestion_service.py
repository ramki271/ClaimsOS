from __future__ import annotations

import re
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

from app.domain.policies.models import PolicyChunkRecord

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - dependency installed in app env
    PdfReader = None


class PolicyIngestionError(ValueError):
    """Raised when a policy document cannot be processed."""


class PolicyIngestionService:
    def extract_text(self, *, filename: str, content: bytes) -> str:
        suffix = Path(filename or "").suffix.lower()
        if suffix in {".txt", ".md", ".x12", ".edi", ".json", ".xml"} or not suffix:
            text = content.decode("utf-8", errors="ignore").strip()
            return self._ensure_non_empty(text=text)
        if suffix == ".pdf":
            return self._extract_pdf_text(content=content)
        if suffix == ".docx":
            return self._extract_docx_text(content=content)
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

    def _extract_pdf_text(self, *, content: bytes) -> str:
        if PdfReader is None:
            raise PolicyIngestionError("PDF ingestion is unavailable because the PDF parser dependency is missing.")

        try:
            reader = PdfReader(BytesIO(content))
        except Exception as exc:  # noqa: BLE001
            raise PolicyIngestionError("Unable to read uploaded PDF policy document.") from exc

        pages: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text() or ""
            if extracted.strip():
                pages.append(extracted.strip())

        return self._ensure_non_empty(
            text="\n\n".join(pages),
            message="Uploaded PDF policy did not contain extractable text.",
        )

    def _extract_docx_text(self, *, content: bytes) -> str:
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                document_xml = archive.read("word/document.xml")
        except KeyError as exc:
            raise PolicyIngestionError("Uploaded DOCX policy is missing document content.") from exc
        except zipfile.BadZipFile as exc:
            raise PolicyIngestionError("Unable to read uploaded DOCX policy document.") from exc

        try:
            root = ElementTree.fromstring(document_xml)
        except ElementTree.ParseError as exc:
            raise PolicyIngestionError("Uploaded DOCX policy contains invalid document XML.") from exc

        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs: list[str] = []
        for paragraph in root.findall(".//w:p", namespace):
            texts = [node.text for node in paragraph.findall(".//w:t", namespace) if node.text]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)

        return self._ensure_non_empty(
            text="\n\n".join(paragraphs),
            message="Uploaded DOCX policy did not contain extractable text.",
        )

    def _ensure_non_empty(self, *, text: str, message: str = "Uploaded policy file is empty.") -> str:
        normalized = text.strip()
        if not normalized:
            raise PolicyIngestionError(message)
        return normalized
