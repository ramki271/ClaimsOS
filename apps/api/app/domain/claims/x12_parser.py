from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from app.domain.claims.models import ClaimSubmission, ServiceLine


class X12ParseError(ValueError):
    """Raised when an inbound X12 payload cannot be converted into a claim."""


@dataclass
class _LineDraft:
    line_number: int
    procedure_code: str
    modifiers: list[str] = field(default_factory=list)
    units: int = 1
    charge_amount: float = 0.0
    date_of_service: str | None = None


class X12ProfessionalClaimParser:
    """Parses a first-pass 837P transaction into the canonical claim model."""

    def parse(self, payload: str) -> ClaimSubmission:
        claims = self.parse_many(payload)
        if len(claims) != 1:
            raise X12ParseError(
                f"Expected exactly one claim in the X12 payload, found {len(claims)}."
            )
        return claims[0]

    def parse_many(self, payload: str) -> list[ClaimSubmission]:
        if not payload.strip():
            raise X12ParseError("Uploaded X12 payload is empty.")

        element_sep = payload[3] if len(payload) > 3 else "*"
        segment_term = "~" if "~" in payload else "\n"
        raw_segments = [segment.strip() for segment in payload.split(segment_term) if segment.strip()]
        segments = [segment.split(element_sep) for segment in raw_segments]

        payer_name = ""
        plan_name = "X12 Professional Claim"
        member_id = ""
        member_name = ""
        patient_id = ""
        provider_id = ""
        provider_name = ""
        claims: list[ClaimSubmission] = []
        claim_state: dict[str, object] | None = None
        current_line: _LineDraft | None = None

        def flush_current_line() -> None:
            nonlocal current_line, claim_state
            if current_line is not None and claim_state is not None:
                claim_state["service_lines"].append(current_line)
                current_line = None

        def finalize_claim() -> None:
            nonlocal claim_state, current_line
            if claim_state is None:
                return
            flush_current_line()
            claims.append(
                self._build_claim_submission(
                    claim_id=claim_state["claim_id"],
                    payer_name=payer_name,
                    plan_name=claim_state["plan_name"],
                    member_id=member_id,
                    member_name=member_name,
                    patient_id=patient_id,
                    provider_id=provider_id,
                    provider_name=provider_name,
                    place_of_service=claim_state["place_of_service"],
                    diagnosis_codes=claim_state["diagnosis_codes"],
                    service_lines=claim_state["service_lines"],
                    claim_amount=claim_state["claim_amount"],
                    claim_date_of_service=claim_state["claim_date_of_service"],
                )
            )
            claim_state = None

        for parts in segments:
            tag = parts[0]

            if tag == "CLM":
                finalize_claim()
                claim_id = self._required(parts, 1, "CLM01 claim identifier")
                claim_amount = Decimal(self._required(parts, 2, "CLM02 total charge amount"))
                pos = self._safe(parts, 5)
                place_of_service = "11"
                if pos and ":" in pos:
                    place_of_service = pos.split(":")[0] or place_of_service
                elif pos:
                    place_of_service = pos
                claim_state = {
                    "claim_id": claim_id,
                    "claim_amount": claim_amount,
                    "place_of_service": place_of_service,
                    "diagnosis_codes": [],
                    "service_lines": [],
                    "claim_date_of_service": None,
                    "plan_name": plan_name,
                }

            elif tag == "NM1":
                entity = self._safe(parts, 1)
                if entity == "IL":
                    member_name = self._person_name(parts)
                    member_id = self._safe(parts, 9)
                elif entity == "QC":
                    patient_id = self._safe(parts, 9) or patient_id
                elif entity in {"82", "85"}:
                    provider_name = self._org_or_person_name(parts)
                    provider_id = self._safe(parts, 9) or provider_id
                elif entity == "PR":
                    payer_name = self._org_or_person_name(parts)

            elif tag == "SBR":
                plan_name = self._safe(parts, 3) or plan_name
                if claim_state is not None:
                    claim_state["plan_name"] = plan_name

            elif tag == "HI":
                if claim_state is not None:
                    claim_state["diagnosis_codes"].extend(self._parse_diagnosis_codes(parts[1:]))

            elif tag == "LX":
                flush_current_line()
                current_line = _LineDraft(line_number=int(self._required(parts, 1, "LX01 line number")), procedure_code="")

            elif tag == "SV1":
                if current_line is None:
                    line_number = (
                        len(claim_state["service_lines"]) + 1
                        if claim_state is not None
                        else len(claims) + 1
                    )
                    current_line = _LineDraft(line_number=line_number, procedure_code="")
                procedure_code, modifiers = self._parse_procedure(self._required(parts, 1, "SV101 procedure composite"))
                current_line.procedure_code = procedure_code
                current_line.modifiers = modifiers
                current_line.charge_amount = float(Decimal(self._required(parts, 2, "SV102 line charge amount")))
                units_raw = self._safe(parts, 4)
                if units_raw:
                    current_line.units = int(float(units_raw))

            elif tag == "DTP":
                qualifier = self._safe(parts, 1)
                date_value = self._safe(parts, 3)
                if qualifier == "472" and date_value:
                    normalized_date = self._normalize_date(date_value)
                    if current_line is not None:
                        current_line.date_of_service = normalized_date
                    if claim_state is not None and claim_state["claim_date_of_service"] is None:
                        claim_state["claim_date_of_service"] = normalized_date

        finalize_claim()
        if not claims:
            raise X12ParseError("Could not find CLM segment with a claim identifier.")
        return claims

    def _build_claim_submission(
        self,
        *,
        claim_id: str,
        payer_name: str,
        plan_name: str,
        member_id: str,
        member_name: str,
        patient_id: str,
        provider_id: str,
        provider_name: str,
        place_of_service: str,
        diagnosis_codes: list[str],
        service_lines: list[_LineDraft],
        claim_amount: Decimal,
        claim_date_of_service: str | None,
    ) -> ClaimSubmission:
        if not claim_id:
            raise X12ParseError("Could not find CLM segment with a claim identifier.")
        if not member_name:
            raise X12ParseError("Could not find subscriber/member information in NM1*IL.")
        if not provider_name:
            raise X12ParseError("Could not find provider information in NM1*82 or NM1*85.")
        if not service_lines:
            raise X12ParseError("Could not find any service lines in LX/SV1 segments.")
        if not diagnosis_codes:
            raise X12ParseError("Could not find diagnosis codes in HI segments.")

        normalized_lines = [
            ServiceLine(
                line_number=line.line_number,
                procedure_code=line.procedure_code,
                modifiers=line.modifiers,
                units=line.units,
                charge_amount=line.charge_amount,
            )
            for line in service_lines
        ]
        total_amount = float(claim_amount) if claim_amount else round(
            sum(line.charge_amount for line in normalized_lines), 2
        )

        return ClaimSubmission(
            claim_id=claim_id,
            claim_type="professional_outpatient",
            form_type="CMS-1500",
            payer_name=self._normalize_label(payer_name or "Unknown Payer"),
            plan_name=self._normalize_label(plan_name or "X12 Professional Claim"),
            member_id=member_id or patient_id or claim_id,
            member_name=self._normalize_label(member_name),
            patient_id=patient_id or member_id or claim_id,
            provider_id=provider_id or "UNKNOWN-PROVIDER",
            provider_name=self._normalize_label(provider_name),
            place_of_service=place_of_service,
            diagnosis_codes=diagnosis_codes,
            procedure_codes=[line.procedure_code for line in normalized_lines],
            service_lines=normalized_lines,
            amount=total_amount,
            date_of_service=self._normalize_date(
                claim_date_of_service or self._first_line_date(service_lines)
            ),
        )

    def _required(self, parts: list[str], index: int, label: str) -> str:
        value = self._safe(parts, index)
        if not value:
            raise X12ParseError(f"Missing required X12 field: {label}.")
        return value

    def _safe(self, parts: list[str], index: int) -> str:
        return parts[index].strip() if len(parts) > index and parts[index] else ""

    def _person_name(self, parts: list[str]) -> str:
        last_name = self._safe(parts, 3)
        first_name = self._safe(parts, 4)
        return " ".join(part for part in [first_name, last_name] if part).strip()

    def _org_or_person_name(self, parts: list[str]) -> str:
        entity_type = self._safe(parts, 2)
        if entity_type == "2":
            return self._safe(parts, 3)
        return self._person_name(parts)

    def _parse_diagnosis_codes(self, fields: list[str]) -> list[str]:
        codes: list[str] = []
        for field in fields:
            if not field:
                continue
            chunks = [chunk for chunk in field.split(":") if chunk]
            if len(chunks) >= 2:
                codes.append(chunks[1].replace(".", "").upper())
        return codes

    def _parse_procedure(self, composite: str) -> tuple[str, list[str]]:
        chunks = [chunk for chunk in composite.split(":") if chunk]
        if not chunks:
            raise X12ParseError("SV101 procedure composite is empty.")
        if chunks[0] == "HC":
            if len(chunks) < 2:
                raise X12ParseError("SV101 does not contain a CPT/HCPCS code.")
            return chunks[1].upper(), [chunk.upper() for chunk in chunks[2:]]
        return chunks[0].upper(), [chunk.upper() for chunk in chunks[1:]]

    def _normalize_date(self, raw_date: str) -> str:
        if len(raw_date) == 8 and raw_date.isdigit():
            return datetime.strptime(raw_date, "%Y%m%d").date().isoformat()
        try:
            return datetime.fromisoformat(raw_date).date().isoformat()
        except ValueError as exc:
            raise X12ParseError(f"Unsupported X12 date format: {raw_date}") from exc

    def _first_line_date(self, service_lines: list[_LineDraft]) -> str:
        for line in service_lines:
            if line.date_of_service:
                return line.date_of_service
        raise X12ParseError("Could not determine a date of service from DTP segments.")

    def _normalize_label(self, value: str) -> str:
        value = value.strip()
        if not value:
            return value
        if value.upper() == value:
            return " ".join(word.capitalize() for word in value.split())
        return value
