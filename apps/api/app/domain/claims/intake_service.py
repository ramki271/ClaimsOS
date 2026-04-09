from app.domain.claims.models import ClaimSubmission


class IntakeService:
    def normalize_claim(self, claim: ClaimSubmission) -> ClaimSubmission:
        """Return a canonical claim object for downstream services."""
        normalized_lines = [
            line.model_copy(
                update={
                    "procedure_code": line.procedure_code.strip().upper(),
                    "modifiers": [modifier.strip().upper() for modifier in line.modifiers],
                    "diagnosis_pointers": sorted({int(pointer) for pointer in line.diagnosis_pointers if int(pointer) > 0}),
                    "charge_amount": round(line.charge_amount, 2),
                }
            )
            for line in claim.service_lines
        ]
        procedure_codes = [line.procedure_code for line in normalized_lines]
        primary_provider_id = (
            (claim.rendering_provider_id or "").strip()
            or claim.provider_id.strip()
            or (claim.billing_provider_id or "").strip()
        )
        primary_provider_name = (
            (claim.rendering_provider_name or "").strip()
            or claim.provider_name.strip()
            or (claim.billing_provider_name or "").strip()
        )
        return ClaimSubmission(
            claim_id=claim.claim_id.strip(),
            claim_type=claim.claim_type,
            form_type=claim.form_type,
            payer_name=claim.payer_name.strip(),
            plan_name=claim.plan_name.strip(),
            member_id=claim.member_id.strip(),
            member_name=claim.member_name.strip(),
            member_date_of_birth=claim.member_date_of_birth,
            member_gender=claim.member_gender,
            subscriber_relationship=claim.subscriber_relationship,
            patient_id=claim.patient_id.strip(),
            provider_id=primary_provider_id,
            provider_name=primary_provider_name,
            billing_provider_id=(claim.billing_provider_id or claim.provider_id).strip() or None,
            billing_provider_name=(claim.billing_provider_name or claim.provider_name).strip() or None,
            rendering_provider_id=primary_provider_id,
            rendering_provider_name=primary_provider_name,
            referring_provider_id=(claim.referring_provider_id or "").strip() or None,
            referring_provider_name=(claim.referring_provider_name or "").strip() or None,
            facility_name=(claim.facility_name or "").strip() or None,
            facility_npi=(claim.facility_npi or "").strip() or None,
            prior_authorization_id=(claim.prior_authorization_id or "").strip() or None,
            referral_id=(claim.referral_id or "").strip() or None,
            claim_frequency_code=(claim.claim_frequency_code or "1").strip() or "1",
            payer_claim_control_number=(claim.payer_claim_control_number or "").strip() or None,
            accident_indicator=claim.accident_indicator,
            employment_related_indicator=claim.employment_related_indicator,
            supporting_document_ids=[doc_id.strip() for doc_id in claim.supporting_document_ids if doc_id.strip()],
            place_of_service=claim.place_of_service.strip(),
            diagnosis_codes=[code.strip().upper() for code in claim.diagnosis_codes],
            procedure_codes=list(dict.fromkeys(procedure_codes or claim.procedure_codes)),
            service_lines=normalized_lines,
            amount=round(sum(line.charge_amount for line in normalized_lines), 2),
            date_of_service=claim.date_of_service,
        )
