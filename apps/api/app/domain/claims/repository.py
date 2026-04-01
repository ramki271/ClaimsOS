from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import Depends

from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.models import (
    AdjudicationDecision,
    AuditEvent,
    ClaimInsights,
    ClaimProcessingResponse,
    ClaimRecordSummary,
    ClaimReviewRequest,
    ClaimSubmission,
    HumanReviewState,
    InsightCard,
    PolicyMatch,
    ProviderAdjudicationContext,
    ValidationResult,
)
from app.domain.claims.validation_service import ValidationIssue
from app.domain.providers.repository import ProvidersRepository
from app.integrations.supabase import execute_with_retry, get_supabase_client


class ClaimsRepository:
    def __init__(self, client: Any) -> None:
        self.client = client
        self.providers_repository = ProvidersRepository(client)
        self.adjudication_service = AdjudicationService()

    def create_processed_claim(
        self,
        claim: ClaimSubmission,
        validation: ValidationResult,
        decision: AdjudicationDecision,
        matched_policies: list[PolicyMatch],
        confidence_score: float,
        requires_human_review: bool,
    ) -> ClaimProcessingResponse:
        tenant = self.providers_repository.ensure_tenant(payer_name=claim.payer_name)
        provider = self.providers_repository.ensure_provider_for_tenant(
            tenant_id=tenant.id or "",
            provider_id=claim.provider_id,
            provider_name=claim.provider_name,
            specialty=None,
        )
        provider_context = self._build_provider_context(claim=claim, provider=provider)
        utilization_context = self.adjudication_service.build_utilization_context(claim)
        claim_payload = {
            "claim_id": claim.claim_id,
            "tenant_id": tenant.id,
            "provider_record_id": provider.id,
            "claim_type": claim.claim_type,
            "form_type": claim.form_type,
            "payer_name": claim.payer_name,
            "plan_name": claim.plan_name,
            "member_id": claim.member_id,
            "member_name": claim.member_name,
            "patient_id": claim.patient_id,
            "provider_id": claim.provider_id,
            "provider_name": claim.provider_name,
            "place_of_service": claim.place_of_service,
            "diagnosis_codes": claim.diagnosis_codes,
            "procedure_codes": claim.procedure_codes,
            "service_lines": [line.model_dump() for line in claim.service_lines],
            "amount": claim.amount,
            "date_of_service": str(claim.date_of_service),
            "processing_status": "processed",
            "outcome": decision.outcome,
            "confidence_score": confidence_score,
            "requires_human_review": requires_human_review,
        }
        claim_row = (
            execute_with_retry(
                self.client.table("claims")
                .upsert(claim_payload, on_conflict="claim_id")
            ).data[0]
        )
        internal_claim_id = claim_row["id"]

        execute_with_retry(
            self.client.table("claim_validation_results").insert(
                {
                    "claim_id": internal_claim_id,
                    "is_valid": validation.is_valid,
                    "issues": [issue.model_dump() for issue in validation.issues],
                }
            )
        )

        execute_with_retry(
            self.client.table("adjudication_results").insert(
                {
                    "claim_id": internal_claim_id,
                    "outcome": decision.outcome,
                    "rationale": decision.rationale,
                    "cited_rules": decision.cited_rules,
                    "confidence_score": confidence_score,
                    "requires_human_review": requires_human_review,
                    "matched_policies": [policy.model_dump() for policy in matched_policies],
                }
            )
        )

        audit_events = [
            (
                "claim_received",
                {
                    "claim_type": claim.claim_type,
                    "payer_name": claim.payer_name,
                    "amount": claim.amount,
                },
            ),
            (
                "validation_completed",
                {
                    "is_valid": validation.is_valid,
                    "issue_count": len(validation.issues),
                },
            ),
            (
                "policy_retrieval_completed",
                {
                    "match_count": len(matched_policies),
                    "top_policy_id": matched_policies[0].policy_id if matched_policies else None,
                },
            ),
            (
                "adjudication_completed",
                {
                    "outcome": decision.outcome,
                    "confidence_score": confidence_score,
                    "requires_human_review": requires_human_review,
                    "passed_check_count": len(decision.passed_checks),
                    "failed_check_count": len(decision.failed_checks),
                    "review_trigger_count": len(decision.review_triggers),
                    "utilization_level": utilization_context.utilization_level,
                    "prior_auth_required": utilization_context.prior_auth_required,
                },
            ),
            (
                "claim_processed",
                {
                    "status": "processed",
                    "outcome": decision.outcome,
                },
            ),
        ]
        execute_with_retry(
            self.client.table("audit_logs").insert(
                [
                    {
                        "claim_id": internal_claim_id,
                        "event_type": event_type,
                        "payload": payload,
                    }
                    for event_type, payload in audit_events
                ]
            )
        )

        review_state = None
        if requires_human_review:
            review_row = (
                execute_with_retry(
                    self.client.table("human_review_queue")
                    .upsert(
                        {
                            "claim_id": internal_claim_id,
                            "status": "pending",
                            "reason": "Low confidence or manual review outcome.",
                        },
                        on_conflict="claim_id",
                    )
                ).data[0]
            )
            review_state = self._map_review_state(review_row)

        return ClaimProcessingResponse(
            claim=claim,
            status="processed",
            validation=validation,
            decision=decision,
            confidence_score=confidence_score,
            requires_human_review=requires_human_review,
            matched_policies=matched_policies,
            created_at=claim_row["created_at"],
            review_state=review_state,
            audit_trail=[
                AuditEvent(event_type=event_type, payload=payload) for event_type, payload in audit_events
            ],
            insights=self._build_insights(
                claim_row=claim_row,
                claim=claim,
                matched_policies=matched_policies,
                validation=validation,
            ),
            provider_context=provider_context,
            utilization_context=utilization_context,
        )

    def list_claims(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        outcome: str | None = None,
        requires_review: bool | None = None,
    ) -> list[ClaimRecordSummary]:
        query = self.client.table("claims").select("*")
        if outcome:
            if outcome == "review":
                query = query.eq("requires_human_review", True)
            else:
                query = query.eq("outcome", outcome)
        if requires_review is not None:
            query = query.eq("requires_human_review", requires_review)

        rows = execute_with_retry(
            query.order("created_at", desc=True).range(offset, offset + limit - 1)
        ).data
        review_rows = self._fetch_review_rows([row["id"] for row in rows])
        review_map = {row["claim_id"]: row for row in review_rows}

        return [
            ClaimRecordSummary(
                claim_id=row["claim_id"],
                claim_type=row["claim_type"],
                payer_name=row["payer_name"],
                member_name=row["member_name"],
                provider_name=row["provider_name"],
                amount=float(row["amount"]),
                date_of_service=row["date_of_service"],
                outcome=row.get("outcome") or "pending",
                confidence_score=float(row.get("confidence_score") or 0),
                requires_human_review=bool(row.get("requires_human_review") or False),
                created_at=row["created_at"],
                review_status=review_map.get(row["id"], {}).get("status"),
            )
            for row in rows
        ]

    def get_claim(self, external_claim_id: str) -> ClaimProcessingResponse | None:
        claim_row = self._fetch_claim_row(external_claim_id)
        if claim_row is None:
            return None
        return self._build_claim_response(claim_row)

    def submit_review(
        self,
        external_claim_id: str,
        review_request: ClaimReviewRequest,
    ) -> ClaimProcessingResponse | None:
        claim_row = self._fetch_claim_row(external_claim_id)
        if claim_row is None:
            return None

        internal_claim_id = claim_row["id"]
        outcome = review_request.override_outcome or claim_row.get("outcome") or "review"
        requires_human_review = (
            review_request.review_status != "resolved" or outcome == "review"
        )

        execute_with_retry(
            self.client.table("claims").update(
                {
                    "outcome": outcome,
                    "requires_human_review": requires_human_review,
                    "processing_status": "processed",
                }
            ).eq("id", internal_claim_id)
        )

        current_detail = self._build_claim_response(claim_row)
        if current_detail is None:
            return None

        updated_reason = (
            review_request.reviewer_notes
            if review_request.review_status == "resolved" or review_request.override_outcome
            else "Claim routed for manual adjudicator review."
        )
        review_row = (
            execute_with_retry(
                self.client.table("human_review_queue")
                .upsert(
                    {
                        "claim_id": internal_claim_id,
                        "status": review_request.review_status,
                        "reason": updated_reason,
                    },
                    on_conflict="claim_id",
                )
            ).data[0]
        )

        if review_request.override_outcome:
            execute_with_retry(
                self.client.table("adjudication_results").insert(
                    {
                        "claim_id": internal_claim_id,
                        "outcome": review_request.override_outcome,
                        "rationale": (
                            f"Manual review override applied by "
                            f"{review_request.reviewer_name or 'Claims reviewer'}: "
                            f"{review_request.reviewer_notes}"
                        ),
                        "cited_rules": current_detail.decision.cited_rules,
                        "confidence_score": current_detail.confidence_score,
                        "requires_human_review": requires_human_review,
                        "matched_policies": [policy.model_dump() for policy in current_detail.matched_policies],
                    }
                )
            )

        execute_with_retry(
            self.client.table("audit_logs").insert(
                {
                    "claim_id": internal_claim_id,
                    "event_type": "human_review_updated",
                    "payload": {
                        "review_status": review_request.review_status,
                        "override_outcome": review_request.override_outcome,
                        "reviewer_name": review_request.reviewer_name,
                        "reviewer_notes": review_request.reviewer_notes,
                    },
                }
            )
        )

        refreshed_claim_row = self._fetch_claim_row(external_claim_id)
        return self._build_claim_response(refreshed_claim_row) if refreshed_claim_row else None

    def cleanup_claim_by_external_id(self, external_claim_id: str) -> None:
        claim_row = self._fetch_claim_row(external_claim_id)
        if claim_row is None:
            return

        internal_claim_id = claim_row["id"]
        for table_name in (
            "audit_logs",
            "human_review_queue",
            "adjudication_results",
            "claim_validation_results",
        ):
            execute_with_retry(
                self.client.table(table_name).delete().eq("claim_id", internal_claim_id)
            )
        execute_with_retry(
            self.client.table("claims").delete().eq("id", internal_claim_id)
        )

    def _fetch_claim_row(self, external_claim_id: str) -> dict[str, Any] | None:
        rows = (
            execute_with_retry(
                self.client.table("claims")
                .select("*")
                .eq("claim_id", external_claim_id)
                .limit(1)
            ).data
        )
        return rows[0] if rows else None

    def _fetch_review_rows(self, internal_claim_ids: list[str]) -> list[dict[str, Any]]:
        if not internal_claim_ids:
            return []
        return (
            execute_with_retry(
                self.client.table("human_review_queue")
                .select("*")
                .in_("claim_id", internal_claim_ids)
            ).data
        )

    def _build_claim_response(self, claim_row: dict[str, Any]) -> ClaimProcessingResponse | None:
        internal_claim_id = claim_row["id"]
        validation_rows = (
            execute_with_retry(
                self.client.table("claim_validation_results")
                .select("*")
                .eq("claim_id", internal_claim_id)
                .order("created_at", desc=True)
                .limit(1)
            ).data
        )
        adjudication_rows = (
            execute_with_retry(
                self.client.table("adjudication_results")
                .select("*")
                .eq("claim_id", internal_claim_id)
                .order("created_at", desc=True)
                .limit(1)
            ).data
        )
        audit_rows = (
            execute_with_retry(
                self.client.table("audit_logs")
                .select("*")
                .eq("claim_id", internal_claim_id)
                .order("created_at", desc=False)
            ).data
        )
        review_rows = (
            execute_with_retry(
                self.client.table("human_review_queue")
                .select("*")
                .eq("claim_id", internal_claim_id)
                .limit(1)
            ).data
        )

        if not validation_rows or not adjudication_rows:
            return None

        validation_row = validation_rows[0]
        adjudication_row = adjudication_rows[0]
        claim = ClaimSubmission(**claim_row)
        validation = ValidationResult(
            is_valid=validation_row["is_valid"],
            issues=[ValidationIssue(**issue) for issue in validation_row.get("issues", [])],
        )
        matched_policies = [
            PolicyMatch(**policy) for policy in adjudication_row["matched_policies"]
        ]
        provider_context = self._resolve_provider_context(claim_row=claim_row, claim=claim)
        utilization_context = self.adjudication_service.build_utilization_context(claim)
        decision = self.adjudication_service.explain(
            claim=claim,
            validation=validation,
            policies=matched_policies,
            provider_context=provider_context,
            utilization_context=utilization_context,
            outcome=adjudication_row["outcome"],
            rationale=adjudication_row["rationale"],
            cited_rules=adjudication_row["cited_rules"],
        )

        return ClaimProcessingResponse(
            claim=claim,
            status=claim_row.get("processing_status") or "processed",
            validation=validation,
            decision=decision,
            confidence_score=float(adjudication_row["confidence_score"]),
            requires_human_review=bool(adjudication_row["requires_human_review"]),
            matched_policies=matched_policies,
            created_at=claim_row["created_at"],
            review_state=self._map_review_state(review_rows[0]) if review_rows else None,
            audit_trail=[
                AuditEvent(
                    event_type=row["event_type"],
                    payload=row.get("payload") or {},
                    created_at=_parse_timestamp(row.get("created_at")),
                )
                for row in audit_rows
            ],
            insights=self._build_insights(
                claim_row=claim_row,
                claim=claim,
                matched_policies=matched_policies,
                validation=validation,
            ),
            provider_context=provider_context,
            utilization_context=utilization_context,
        )

    def _map_review_state(self, review_row: dict[str, Any]) -> HumanReviewState:
        payload = review_row.get("payload") or {}
        return HumanReviewState(
            status=review_row["status"],
            reason=review_row["reason"],
            reviewer_name=payload.get("reviewer_name"),
            reviewer_notes=payload.get("reviewer_notes"),
            updated_at=_parse_timestamp(review_row.get("created_at")),
        )

    def _build_insights(
        self,
        *,
        claim_row: dict[str, Any],
        claim: ClaimSubmission,
        matched_policies: list[PolicyMatch],
        validation: ValidationResult,
    ) -> ClaimInsights:
        top_policy = matched_policies[0] if matched_policies else None
        policy_score = top_policy.relevance_score if top_policy else 0.0
        policy_match = InsightCard(
            label="Policy Match",
            value=f"{round(policy_score * 100)}%",
            status="strong" if policy_score >= 0.85 else "moderate" if policy_score >= 0.65 else "weak",
            score=policy_score,
            detail=top_policy.title if top_policy else "No policy evidence retrieved",
        )

        duplication = self._compute_duplication_risk(claim_row=claim_row, claim=claim)
        network = self._compute_network_parity(claim_row=claim_row)

        return ClaimInsights(
            policy_match=policy_match,
            duplication_risk=duplication,
            network_parity=network,
        )

    def _compute_duplication_risk(self, *, claim_row: dict[str, Any], claim: ClaimSubmission) -> InsightCard:
        query = (
            self.client.table("claims")
            .select("id, claim_id, amount, procedure_codes")
            .neq("id", claim_row["id"])
            .eq("member_id", claim.member_id)
            .eq("provider_id", claim.provider_id)
            .eq("date_of_service", str(claim.date_of_service))
            .limit(10)
        )
        duplicates = query.execute().data

        matching_rows = []
        claim_procedures = set(claim.procedure_codes)
        for row in duplicates:
            other_codes = set(row.get("procedure_codes") or [])
            if claim_procedures.intersection(other_codes):
                matching_rows.append(row)

        if matching_rows:
            score = 0.9 if len(matching_rows) > 1 else 0.72
            return InsightCard(
                label="Duplication Risk",
                value="High" if score >= 0.85 else "Medium",
                status="high" if score >= 0.85 else "moderate",
                score=score,
                detail=f"{len(matching_rows)} similar claim(s) found for member/provider/date of service.",
            )

        if not _is_simple_claim_profile(claim):
            return InsightCard(
                label="Duplication Risk",
                value="Medium",
                status="moderate",
                score=0.45,
                detail="Claim is valid but includes traits that warrant manual integrity review.",
            )

        return InsightCard(
            label="Duplication Risk",
            value="Low",
            status="low",
            score=0.12,
            detail="No similar prior claim found for the same member, provider, and service date.",
        )

    def _compute_network_parity(self, *, claim_row: dict[str, Any]) -> InsightCard:
        provider_record_id = claim_row.get("provider_record_id")
        if not provider_record_id:
            return InsightCard(
                label="Network Parity",
                value="Unknown",
                status="pending",
                score=0.0,
                detail="No provider record linked to this claim.",
            )

        provider = self.providers_repository.get_provider_by_id(provider_record_id)
        if provider is None:
            return InsightCard(
                label="Network Parity",
                value="Unknown",
                status="pending",
                score=0.0,
                detail="Provider record could not be resolved.",
            )

        if provider.network_status == "in_network":
            return InsightCard(
                label="Network Parity",
                value=provider.contract_tier or "In Network",
                status="verified",
                score=0.95,
                detail=(
                    f"Provider is in network under contract tier {provider.contract_tier}."
                    if provider.contract_tier
                    else "Provider is in network. Contract tier is not yet populated."
                ),
            )

        if provider.network_status == "out_of_network":
            return InsightCard(
                label="Network Parity",
                value="Out of Network",
                status="mismatch",
                score=0.25,
                detail="Provider is marked out of network for this tenant and may need alternate reimbursement handling.",
            )

        return InsightCard(
            label="Network Parity",
            value="Pending",
            status="pending",
            score=0.5,
            detail="Provider network status is pending verification.",
        )

    def _resolve_provider_context(
        self,
        *,
        claim_row: dict[str, Any],
        claim: ClaimSubmission,
    ) -> ProviderAdjudicationContext | None:
        provider_record_id = claim_row.get("provider_record_id")
        if not provider_record_id:
            return None
        provider = self.providers_repository.get_provider_by_id(provider_record_id)
        if provider is None:
            return None
        return self._build_provider_context(claim=claim, provider=provider)

    def _build_provider_context(
        self,
        *,
        claim: ClaimSubmission,
        provider,
    ) -> ProviderAdjudicationContext:
        plan_participation = {item.lower() for item in provider.plan_participation}
        participates_in_plan = (
            not plan_participation
            or claim.plan_name.lower() in plan_participation
        )
        specialty_match, specialty_reason = _infer_specialty_match(
            specialty=provider.specialty,
            procedure_codes=claim.procedure_codes,
        )
        return ProviderAdjudicationContext(
            provider_key=provider.provider_key,
            provider_name=provider.name,
            specialty=provider.specialty,
            network_status=provider.network_status,
            contract_tier=provider.contract_tier,
            contract_status=_resolve_contract_status(
                provider_contract_status=provider.contract_status,
                date_of_service=claim.date_of_service,
                effective_date=provider.network_effective_date,
                end_date=provider.network_end_date,
            ),
            network_effective_date=provider.network_effective_date,
            network_end_date=provider.network_end_date,
            participates_in_plan=participates_in_plan,
            specialty_match=specialty_match,
            specialty_match_reason=specialty_reason,
        )


def _is_simple_claim_profile(claim: ClaimSubmission) -> bool:
    return claim.amount <= 250 and claim.place_of_service == "11" and len(claim.service_lines) == 1


def _resolve_contract_status(
    *,
    provider_contract_status: str,
    date_of_service: date,
    effective_date: date | None,
    end_date: date | None,
) -> str:
    if provider_contract_status != "active":
        return provider_contract_status
    if effective_date and date_of_service < effective_date:
        return "pending"
    if end_date and date_of_service > end_date:
        return "inactive"
    return "active"


def _infer_specialty_match(
    *,
    specialty: str | None,
    procedure_codes: list[str],
) -> tuple[bool | None, str | None]:
    if not specialty:
        return None, "Provider specialty is not populated yet."

    specialty_lower = specialty.lower()
    procedure_set = set(procedure_codes)
    if procedure_set.intersection({"99213", "99214"}):
        if any(token in specialty_lower for token in {"family", "internal", "primary", "general"}):
            return True, "Provider specialty aligns with outpatient evaluation and management services."
        return False, "Evaluation and management visits are usually billed by primary care or general medicine specialties."

    if "97110" in procedure_set:
        if any(token in specialty_lower for token in {"therapy", "rehab", "physical"}):
            return True, "Provider specialty aligns with therapy services."
        return False, "Therapy procedure codes usually align with rehabilitation or therapy specialties."

    if "27447" in procedure_set:
        if "ortho" in specialty_lower:
            return True, "Provider specialty aligns with orthopedic surgery services."
        return False, "Orthopedic surgery procedure codes usually require an orthopedic specialty."

    return None, "Specialty alignment is not yet modeled for this procedure family."


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    if "." in normalized:
        head, tail = normalized.split(".", 1)
        tz_index = max(tail.find("+"), tail.find("-"))
        if tz_index != -1:
            fractional = tail[:tz_index]
            suffix = tail[tz_index:]
        else:
            fractional = tail
            suffix = ""
        normalized = f"{head}.{fractional[:6].ljust(6, '0')}{suffix}"
    return datetime.fromisoformat(normalized)


def get_claims_repository() -> ClaimsRepository:
    return ClaimsRepository(get_supabase_client())
