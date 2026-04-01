from __future__ import annotations

import re

from app.domain.claims.models import ClaimSubmission, PolicyMatch
from app.domain.policies.openai_retrieval_service import OpenAIPolicyRetrievalService
from app.domain.policies.repository import PoliciesRepository
from app.domain.providers.repository import ProvidersRepository
from app.integrations.supabase import get_supabase_client


class PolicyRetrievalService:
    def __init__(self) -> None:
        client = get_supabase_client()
        self.policies_repository = PoliciesRepository(client)
        self.providers_repository = ProvidersRepository(client)
        self.openai_retrieval_service = OpenAIPolicyRetrievalService()

    def retrieve(self, claim: ClaimSubmission) -> list[PolicyMatch]:
        tenant = self.providers_repository.ensure_tenant(payer_name=claim.payer_name)
        if not tenant.id:
            return self._fallback_policies(claim)

        tenant_metadata = getattr(tenant, "metadata", {}) or {}
        vector_store_id = tenant_metadata.get("openai_vector_store_id")
        if self.openai_retrieval_service.is_enabled() and vector_store_id:
            try:
                openai_matches = self._retrieve_from_openai(claim=claim, vector_store_id=vector_store_id)
                if openai_matches:
                    return openai_matches
            except Exception:  # noqa: BLE001
                pass

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
                        document_label=doc.get("filename") or doc.get("title"),
                        source_reference=row["id"],
                    ),
                )
            )

        scored_matches.sort(key=lambda item: item[0], reverse=True)
        if scored_matches:
            return [match for _, match in scored_matches[:5]]

        return self._fallback_policies(claim)

    def _retrieve_from_openai(self, *, claim: ClaimSubmission, vector_store_id: str) -> list[PolicyMatch]:
        query = self._build_retrieval_query(claim)
        rows = self.openai_retrieval_service.search(
            vector_store_id=vector_store_id,
            query=query,
            max_results=5,
        )
        matches: list[PolicyMatch] = []
        for row in rows:
            content = (row.get("content") or "").strip()
            filename = row.get("filename") or "Policy Document"
            file_id = row.get("file_id") or filename
            document_key = _document_key_from_filename(filename)
            score = float(row.get("score") or 0.0)
            matches.append(
                PolicyMatch(
                    policy_id=document_key,
                    title=filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title(),
                    summary=content[:320] if content else f"Retrieved from {filename}",
                    relevance_score=max(min(score, 0.99), 0.01),
                    document_label=filename,
                    source_reference=file_id,
                )
            )
        return matches

    def _build_retrieval_query(self, claim: ClaimSubmission) -> str:
        diagnosis = ", ".join(claim.diagnosis_codes)
        procedures = ", ".join(claim.procedure_codes)
        return (
            f"Payer: {claim.payer_name}\n"
            f"Plan: {claim.plan_name}\n"
            f"Claim type: {claim.claim_type}\n"
            f"Form type: {claim.form_type}\n"
            f"Place of service: {claim.place_of_service}\n"
            f"Diagnosis codes: {diagnosis}\n"
            f"Procedure codes: {procedures}\n"
            f"Provider: {claim.provider_name}\n"
            f"Question: Which policy sections are most relevant to adjudicating this claim?"
        )

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
                document_label="Outpatient Evaluation And Management Coverage",
                source_reference="POL-001",
            )
        ]

        if "97110" in claim.procedure_codes:
            policies.append(
                PolicyMatch(
                    policy_id="POL-017",
                    title="Physical Therapy Visit Guardrails",
                    summary="Therapeutic exercise claims require covered diagnosis support and may trigger review when utilization patterns are incomplete.",
                    relevance_score=0.88,
                    document_label="Physical Therapy Visit Guardrails",
                    source_reference="POL-017",
                )
            )

        if claim.place_of_service == "11":
            policies.append(
                PolicyMatch(
                    policy_id="POL-031",
                    title="Professional Office Visit Place-of-Service Rule",
                    summary="Professional claims billed with place of service 11 are eligible for straight-through review when documentation and covered diagnosis pairings are present.",
                    relevance_score=0.91,
                    document_label="Professional Office Visit Place-of-Service Rule",
                    source_reference="POL-031",
                )
            )

        return policies


def _document_key_from_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0]
    key = re.sub(r"[^A-Za-z0-9]+", "-", base).strip("-")
    return key or "policy-document"
