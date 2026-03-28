from __future__ import annotations

import re

from app.domain.claims.models import ClaimSubmission, PolicyMatch
from app.domain.policies.repository import PoliciesRepository
from app.domain.providers.repository import ProvidersRepository
from app.integrations.supabase import get_supabase_client


class PolicyRetrievalService:
    def __init__(self) -> None:
        client = get_supabase_client()
        self.policies_repository = PoliciesRepository(client)
        self.providers_repository = ProvidersRepository(client)

    def retrieve(self, claim: ClaimSubmission) -> list[PolicyMatch]:
        tenant = self.providers_repository.ensure_tenant(payer_name=claim.payer_name)
        if not tenant.id:
            return self._fallback_policies(claim)

        chunk_rows = self.policies_repository.retrieve_chunks(tenant_id=tenant.id, limit=250)
        scored_matches = []
        claim_tokens = self._claim_tokens(claim)

        for row in chunk_rows:
            score = self._score_chunk(claim_tokens, row.get("keyword_tokens") or [], row.get("content") or "")
            if score <= 0:
                continue
            doc = row.get("policy_documents") or {}
            scored_matches.append(
                (
                    score,
                    PolicyMatch(
                        policy_id=doc.get("document_key") or row["id"],
                        title=doc.get("title") or "Policy Match",
                        summary=(row.get("content") or "")[:320],
                        relevance_score=min(round(score, 3), 0.99),
                    ),
                )
            )

        scored_matches.sort(key=lambda item: item[0], reverse=True)
        if scored_matches:
            return [match for _, match in scored_matches[:5]]

        return self._fallback_policies(claim)

    def _claim_tokens(self, claim: ClaimSubmission) -> set[str]:
        tokens = set()
        for code in claim.diagnosis_codes + claim.procedure_codes:
            tokens.add(code.upper())
        tokens.add(claim.place_of_service.upper())
        tokens.update(re.findall(r"[A-Za-z0-9][A-Za-z0-9\.-]{2,}", claim.plan_name.upper()))
        tokens.update(re.findall(r"[A-Za-z0-9][A-Za-z0-9\.-]{2,}", claim.provider_name.upper()))
        return tokens

    def _score_chunk(self, claim_tokens: set[str], keyword_tokens: list[str], content: str) -> float:
        keyword_set = set(token.upper() for token in keyword_tokens)
        overlap = len(claim_tokens.intersection(keyword_set))
        if overlap:
            return 0.55 + min(overlap * 0.08, 0.35)

        content_upper = content.upper()
        partial = 0
        for token in claim_tokens:
            if token and token in content_upper:
                partial += 1
        if partial:
            return 0.4 + min(partial * 0.06, 0.25)
        return 0.0

    def _fallback_policies(self, claim: ClaimSubmission) -> list[PolicyMatch]:
        policies: list[PolicyMatch] = [
            PolicyMatch(
                policy_id="POL-001",
                title="Outpatient Evaluation And Management Coverage",
                summary=f"Routine outpatient office visits for {claim.plan_name} are covered when diagnosis support is present, place of service is 11, and billed charges remain within plan guardrails.",
                relevance_score=0.94,
            )
        ]

        if "97110" in claim.procedure_codes:
            policies.append(
                PolicyMatch(
                    policy_id="POL-017",
                    title="Physical Therapy Visit Guardrails",
                    summary="Therapeutic exercise claims require covered diagnosis support and may trigger review when utilization patterns are incomplete.",
                    relevance_score=0.88,
                )
            )

        if claim.place_of_service == "11":
            policies.append(
                PolicyMatch(
                    policy_id="POL-031",
                    title="Professional Office Visit Place-of-Service Rule",
                    summary="Professional claims billed with place of service 11 are eligible for straight-through review when documentation and covered diagnosis pairings are present.",
                    relevance_score=0.91,
                )
            )

        return policies
