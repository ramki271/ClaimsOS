from __future__ import annotations

import base64
import json
import mimetypes
from pathlib import Path
from typing import Any, Optional

from app.core.config import Settings, get_settings
from app.domain.claims.models import (
    ClaimDocumentDraft,
    ClaimDocumentIntakeResponse,
    ClaimSubmission,
    DraftServiceLine,
    LowConfidenceField,
    ServiceLine,
)
from app.domain.policies.ingestion_service import PolicyIngestionError, PolicyIngestionService
from app.integrations.openai_client import get_openai_client


class ClaimDocumentIntakeError(ValueError):
    """Raised when a claim document cannot be extracted into a draft claim."""


class ClaimDocumentIntakeService:
    def __init__(self) -> None:
        self.policy_ingestion_service = PolicyIngestionService()

    def extract_claim_draft(
        self,
        *,
        filename: str,
        content: bytes,
        content_type: Optional[str] = None,
        payer_name_hint: Optional[str] = None,
    ) -> ClaimDocumentIntakeResponse:
        settings = get_settings()
        if not settings.has_openai:
            raise ClaimDocumentIntakeError("OPENAI_API_KEY is required for AI document intake.")

        source_type = self._detect_source_type(filename=filename, content_type=content_type)
        payload = self._extract_with_openai(
            filename=filename,
            content=content,
            source_type=source_type,
            settings=settings,
            payer_name_hint=payer_name_hint,
        )

        claim_draft = ClaimDocumentDraft.model_validate(payload.get("claim_draft", {}))
        missing_fields = self._missing_fields(claim_draft)

        return ClaimDocumentIntakeResponse(
            status="drafted",
            source_type=source_type,
            extraction_summary=payload.get(
                "extraction_summary",
                "Claim document was extracted into a reviewable draft.",
            ),
            claim_draft=claim_draft,
            ready_for_processing=len(missing_fields) == 0,
            missing_fields=missing_fields,
            review_notes=[
                str(note).strip()
                for note in payload.get("review_notes", [])
                if isinstance(note, str) and note.strip()
            ],
            low_confidence_fields=[
                LowConfidenceField.model_validate(item)
                for item in payload.get("low_confidence_fields", [])
                if isinstance(item, dict)
            ],
        )

    def finalize_claim_submission(self, draft: ClaimDocumentDraft) -> tuple[Optional[ClaimSubmission], list[str]]:
        normalized_lines: list[ServiceLine] = []
        missing_fields = self._missing_fields(draft)
        if missing_fields:
            return None, missing_fields

        for index, line in enumerate(draft.service_lines, start=1):
            normalized_lines.append(
                ServiceLine(
                    line_number=line.line_number or index,
                    procedure_code=line.procedure_code or "",
                    modifiers=line.modifiers or [],
                    diagnosis_pointers=line.diagnosis_pointers or [],
                    units=line.units or 1,
                    charge_amount=line.charge_amount or 0.0,
                )
            )

        procedure_codes = draft.procedure_codes or [
            line.procedure_code or ""
            for line in draft.service_lines
            if line.procedure_code
        ]

        claim = ClaimSubmission(
            claim_id=draft.claim_id or "",
            claim_type=draft.claim_type,
            form_type=draft.form_type,
            payer_name=draft.payer_name or "",
            plan_name=draft.plan_name or "",
            member_id=draft.member_id or "",
            member_name=draft.member_name or "",
            member_date_of_birth=draft.member_date_of_birth,
            member_gender=draft.member_gender,
            subscriber_relationship=draft.subscriber_relationship,
            patient_id=draft.patient_id or draft.member_id or "",
            provider_id=draft.rendering_provider_id or draft.provider_id or draft.billing_provider_id or "",
            provider_name=draft.rendering_provider_name or draft.provider_name or draft.billing_provider_name or "",
            billing_provider_id=draft.billing_provider_id or draft.provider_id or "",
            billing_provider_name=draft.billing_provider_name or draft.provider_name or "",
            rendering_provider_id=draft.rendering_provider_id or draft.provider_id or draft.billing_provider_id or "",
            rendering_provider_name=draft.rendering_provider_name or draft.provider_name or draft.billing_provider_name or "",
            referring_provider_id=draft.referring_provider_id,
            referring_provider_name=draft.referring_provider_name,
            facility_name=draft.facility_name,
            facility_npi=draft.facility_npi,
            prior_authorization_id=draft.prior_authorization_id,
            referral_id=draft.referral_id,
            claim_frequency_code=draft.claim_frequency_code or "1",
            payer_claim_control_number=draft.payer_claim_control_number,
            accident_indicator=draft.accident_indicator,
            employment_related_indicator=draft.employment_related_indicator,
            supporting_document_ids=draft.supporting_document_ids,
            place_of_service=draft.place_of_service or "11",
            diagnosis_codes=draft.diagnosis_codes,
            procedure_codes=procedure_codes,
            service_lines=normalized_lines,
            amount=draft.amount or sum(line.charge_amount for line in normalized_lines),
            date_of_service=draft.date_of_service,
        )
        return claim, []

    def _extract_with_openai(
        self,
        *,
        filename: str,
        content: bytes,
        source_type: str,
        settings: Settings,
        payer_name_hint: Optional[str] = None,
    ) -> dict[str, Any]:
        client = get_openai_client()
        model = settings.openai_claim_intake_model
        prompt = self._build_prompt(filename=filename, payer_name_hint=payer_name_hint)

        if source_type == "image":
            mime_type = mimetypes.guess_type(filename)[0] or "image/png"
            encoded = base64.b64encode(content).decode("utf-8")
            user_content: Any = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}},
            ]
        else:
            try:
                text = self.policy_ingestion_service.extract_text(filename=filename, content=content)
            except PolicyIngestionError as exc:
                raise ClaimDocumentIntakeError(str(exc)) from exc
            user_content = f"{prompt}\n\nDocument text:\n{text[:18000]}"

        response = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an AI intake agent for payer-side claims operations. "
                        "Extract a best-effort structured professional outpatient claim draft from the input. "
                        "Do not invent values when the document does not support them. "
                        "Use null for missing scalar fields and [] for missing lists. "
                        "Return only valid JSON."
                    ),
                },
                {"role": "user", "content": user_content},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ClaimDocumentIntakeError("AI intake returned invalid JSON for the claim draft.") from exc
        if not isinstance(parsed, dict):
            raise ClaimDocumentIntakeError("AI intake returned an unexpected claim draft payload.")
        return parsed

    def _build_prompt(self, *, filename: str, payer_name_hint: Optional[str] = None) -> str:
        hint = f"Payer hint: {payer_name_hint}\n" if payer_name_hint else ""
        return (
            f"{hint}"
            f"Extract a reviewable claim draft from `{filename}`.\n"
            "Return JSON with this shape:\n"
            "{\n"
            '  "extraction_summary": string,\n'
            '  "review_notes": [string],\n'
            '  "low_confidence_fields": [{"field": string, "confidence": "low|medium|high", "reason": string}],\n'
            '  "claim_draft": {\n'
            '    "claim_id": string|null,\n'
            '    "claim_type": "professional_outpatient",\n'
            '    "form_type": "CMS-1500",\n'
            '    "payer_name": string|null,\n'
            '    "plan_name": string|null,\n'
            '    "member_id": string|null,\n'
            '    "member_name": string|null,\n'
            '    "member_date_of_birth": "YYYY-MM-DD"|null,\n'
            '    "member_gender": "female|male|other|unknown"|null,\n'
            '    "subscriber_relationship": "self|spouse|child|other",\n'
            '    "patient_id": string|null,\n'
            '    "provider_id": string|null,\n'
            '    "provider_name": string|null,\n'
            '    "billing_provider_id": string|null,\n'
            '    "billing_provider_name": string|null,\n'
            '    "rendering_provider_id": string|null,\n'
            '    "rendering_provider_name": string|null,\n'
            '    "referring_provider_id": string|null,\n'
            '    "referring_provider_name": string|null,\n'
            '    "facility_name": string|null,\n'
            '    "facility_npi": string|null,\n'
            '    "prior_authorization_id": string|null,\n'
            '    "referral_id": string|null,\n'
            '    "claim_frequency_code": string|null,\n'
            '    "payer_claim_control_number": string|null,\n'
            '    "supporting_document_ids": [string],\n'
            '    "place_of_service": string|null,\n'
            '    "diagnosis_codes": [string],\n'
            '    "procedure_codes": [string],\n'
            '    "service_lines": [{"line_number": number|null, "procedure_code": string|null, "modifiers": [string], "diagnosis_pointers": [number], "units": number|null, "charge_amount": number|null}],\n'
            '    "amount": number|null,\n'
            '    "date_of_service": "YYYY-MM-DD"|null\n'
            "  }\n"
            "}\n"
            "Use the professional outpatient interpretation unless the document clearly indicates otherwise."
        )

    def _detect_source_type(self, *, filename: str, content_type: Optional[str]) -> str:
        suffix = Path(filename or "").suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            return "image"
        if suffix == ".pdf":
            return "pdf"
        if suffix == ".docx":
            return "docx"
        if suffix in {".txt", ".md", ".json", ".xml"} or (content_type or "").startswith("text/") or not suffix:
            return "text"
        raise ClaimDocumentIntakeError(f"Unsupported claim document type for AI intake: {suffix or content_type or 'unknown'}")

    def _missing_fields(self, draft: ClaimDocumentDraft) -> list[str]:
        missing: list[str] = []
        required_scalars = {
            "claim_id": draft.claim_id,
            "payer_name": draft.payer_name,
            "plan_name": draft.plan_name,
            "member_id": draft.member_id,
            "member_name": draft.member_name,
            "billing_provider_id": draft.billing_provider_id,
            "billing_provider_name": draft.billing_provider_name,
            "rendering_provider_id": draft.rendering_provider_id,
            "rendering_provider_name": draft.rendering_provider_name,
            "provider_id": draft.provider_id,
            "provider_name": draft.provider_name,
            "amount": draft.amount,
            "date_of_service": draft.date_of_service,
        }
        for field_name, value in required_scalars.items():
            if value in (None, ""):
                missing.append(field_name)

        if not draft.patient_id and not draft.member_id:
            missing.append("patient_id")
        if not draft.diagnosis_codes:
            missing.append("diagnosis_codes")
        if not draft.service_lines:
            missing.append("service_lines")
            return missing

        for index, line in enumerate(draft.service_lines, start=1):
            if not line.procedure_code:
                missing.append(f"service_lines[{index}].procedure_code")
            if line.charge_amount in (None, 0):
                missing.append(f"service_lines[{index}].charge_amount")

        return missing
