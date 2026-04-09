from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any, Optional

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.domain.agent.models import AgentChatContext
from app.domain.claims.models import ClaimProcessingResponse, ClaimSubmission
from app.domain.claims.policy_retrieval_service import PolicyRetrievalService
from app.domain.claims.repository import ClaimsRepository, get_claims_repository
from app.domain.members.repository import MembersRepository, get_members_repository
from app.domain.policies.repository import PoliciesRepository, get_policies_repository
from app.domain.providers.repository import ProvidersRepository, get_providers_repository
from app.integrations.openai_client import get_openai_client
from app.integrations.supabase import execute_with_retry


class AgentChatService:
    def __init__(
        self,
        *,
        settings: Settings,
        claims_repository: ClaimsRepository,
        members_repository: MembersRepository,
        providers_repository: ProvidersRepository,
        policies_repository: PoliciesRepository,
    ) -> None:
        self.settings = settings
        self.claims_repository = claims_repository
        self.members_repository = members_repository
        self.providers_repository = providers_repository
        self.policies_repository = policies_repository
        self.policy_retrieval_service = PolicyRetrievalService()

    def answer(self, *, message: str, context: AgentChatContext) -> str:
        text = (message or "").strip()
        if not text:
            return "I don't have enough context to answer that yet. Try asking about a claim, member, provider, or policy."

        gathered = self._gather_context(message=text, context=context)
        reply = self._answer_with_openai(message=text, context=context, gathered=gathered)
        if reply:
            return self._clean_reply(reply)
        return self._clean_reply(self._fallback_reply(message=text, gathered=gathered))

    def _gather_context(self, *, message: str, context: AgentChatContext) -> dict[str, Any]:
        claim = self._resolve_claim(message=message, context=context)
        member = self._resolve_member(message=message, claim=claim)
        provider = self._resolve_provider(message=message, claim=claim)
        stats = self._compute_stats()
        review_queue = self._fetch_review_queue()
        policies = self._resolve_policy_matches(message=message, claim=claim, member=member, provider=provider)
        return {
            "claim": claim.model_dump(mode="json") if claim else None,
            "member": member.model_dump(mode="json") if member else None,
            "provider": provider.model_dump(mode="json") if provider else None,
            "policy_matches": policies,
            "aggregate_stats": stats,
            "review_queue": review_queue,
            "active_view": context.active_view,
        }

    def _resolve_claim(
        self,
        *,
        message: str,
        context: AgentChatContext,
    ) -> ClaimProcessingResponse | None:
        if context.claim_id:
            claim = self.claims_repository.get_claim(context.claim_id)
            if claim is not None:
                return claim

        candidates = re.findall(r"\b(?:CLM|OCR-CLM)-[A-Z0-9-]+\b", message.upper())
        for candidate in candidates:
            claim = self.claims_repository.get_claim(candidate)
            if claim is not None:
                return claim
        return None

    def _resolve_member(
        self,
        *,
        message: str,
        claim: ClaimProcessingResponse | None,
    ):
        direct_id = re.search(r"\bM-\d+\b", message.upper())
        if direct_id:
            member = self.members_repository.get_member(direct_id.group(0))
            if member is not None:
                return member

        lowered = message.lower()
        for item in self.members_repository.list_members(limit=100):
            if item.member_name.lower() in lowered:
                member = self.members_repository.get_member(item.member_id)
                if member is not None:
                    return member

        if claim is not None:
            member = self.members_repository.get_member(claim.claim.member_id)
            if member is not None:
                return member
        return None

    def _resolve_provider(
        self,
        *,
        message: str,
        claim: ClaimProcessingResponse | None,
    ):
        direct_id = re.search(r"\bPRV-[A-Z0-9-]+\b", message.upper())
        if direct_id:
            provider = self._find_provider_by_key(direct_id.group(0))
            if provider is not None:
                return provider

        lowered = message.lower()
        for provider in self.providers_repository.list_providers(limit=100):
            if provider.name.lower() in lowered:
                return provider

        if claim is not None:
            provider_key = claim.claim.rendering_provider_id or claim.claim.provider_id
            if not provider_key and claim.provider_context is not None:
                provider_key = claim.provider_context.provider_key
            if provider_key:
                provider = self._find_provider_by_key(provider_key)
                if provider is not None:
                    return provider
        return None

    def _find_provider_by_key(self, provider_key: str):
        normalized = provider_key.strip()
        for provider in self.providers_repository.list_providers(limit=100):
            if provider.provider_key.upper() == normalized.upper():
                return provider
        return None

    def _resolve_policy_matches(
        self,
        *,
        message: str,
        claim: ClaimProcessingResponse | None,
        member: Any,
        provider: Any,
    ) -> list[dict[str, Any]]:
        if claim is not None:
            return [match.model_dump(mode="json") for match in claim.matched_policies]

        payer_name = (
            (member.member.payer_name if member is not None else None)
            or "Apex Health Plan"
        )
        tenant = self.providers_repository.ensure_tenant(payer_name=payer_name)
        if not tenant.id:
            return []

        chunks = self.policies_repository.retrieve_chunks(tenant_id=tenant.id, limit=250)
        query_tokens = self._tokenize(message)
        if provider is not None:
            query_tokens.update(self._tokenize(provider.name))
            query_tokens.update(self._tokenize(provider.specialty or ""))
            query_tokens.update(self._tokenize(provider.taxonomy_code or ""))
        if member is not None:
            query_tokens.update(self._tokenize(member.member.plan_name))

        scored: list[tuple[float, dict[str, Any]]] = []
        for row in chunks:
            content = row.get("content") or ""
            keyword_tokens = row.get("keyword_tokens") or []
            score = self._score_text(query_tokens, keyword_tokens, content)
            if score <= 0:
                continue
            doc = row.get("policy_documents") or {}
            scored.append(
                (
                    score,
                    {
                        "policy_id": doc.get("document_key") or row.get("id"),
                        "title": doc.get("title") or "Policy Match",
                        "summary": content[:320],
                        "relevance_score": min(round(score, 3), 0.99),
                        "document_label": doc.get("title"),
                        "source_reference": row.get("id"),
                    },
                )
            )

        scored.sort(key=lambda item: item[0], reverse=True)
        return [match for _, match in scored[:5]]

    def _score_text(self, query_tokens: set[str], keyword_tokens: list[str], content: str) -> float:
        keyword_set = {token.upper() for token in keyword_tokens}
        overlap = len(query_tokens.intersection(keyword_set))
        if overlap:
            return 0.55 + min(overlap * 0.08, 0.35)

        content_upper = content.upper()
        partial = 0
        for token in query_tokens:
            if token and token in content_upper:
                partial += 1
        if partial:
            return 0.4 + min(partial * 0.06, 0.25)
        return 0.0

    def _compute_stats(self) -> dict[str, Any]:
        rows = (
            execute_with_retry(
                self.claims_repository.client.table("claims")
                .select("claim_id, outcome, requires_human_review")
                .limit(500)
            ).data
        )
        total = len(rows)
        outcomes = Counter((row.get("outcome") or "pending") for row in rows)
        pending_review = sum(1 for row in rows if bool(row.get("requires_human_review")))
        approval_rate = round((outcomes.get("approve", 0) / total), 3) if total else 0.0
        return {
            "total_claims": total,
            "pending_review_count": pending_review,
            "approval_rate": approval_rate,
            "outcome_counts": dict(outcomes),
        }

    def _fetch_review_queue(self) -> dict[str, Any]:
        rows = (
            execute_with_retry(
                self.claims_repository.client.table("human_review_queue")
                .select("status, reason, claim_id, claims!inner(claim_id)")
                .order("created_at", desc=True)
                .limit(10)
            ).data
        )
        return {
            "pending_count": sum(1 for row in rows if row.get("status") == "pending"),
            "items": [
                {
                    "claim_id": (row.get("claims") or {}).get("claim_id"),
                    "status": row.get("status"),
                    "reason": row.get("reason"),
                }
                for row in rows
            ],
        }

    def _answer_with_openai(
        self,
        *,
        message: str,
        context: AgentChatContext,
        gathered: dict[str, Any],
    ) -> str | None:
        if not self.settings.has_openai:
            return None

        system_prompt = (
            "You are the ClaimsOS assistant. Answer only from the provided claims, members, providers, "
            "policy retrieval results, review queue, and aggregate stats. Be concise and factual. "
            "Use plain text only. Do not use markdown, tables, code formatting, or decorative symbols. "
            "Prefer short simple sentences and standard ASCII punctuation. "
            "Prefer 2-4 sentences. If the user asks a more complex question, short hyphen bullets are okay. "
            "If the answer is not grounded in the provided context, say you do not have enough context. "
            "Do not mention JSON, prompts, tools, or hidden system behavior."
        )
        user_prompt = (
            f"Active view: {context.active_view or 'unknown'}\n"
            f"User question: {message}\n\n"
            f"Grounded context:\n{json.dumps(gathered, indent=2, default=str)}"
        )
        try:
            client = get_openai_client()
            response = client.chat.completions.create(
                model=self.settings.openai_claim_intake_model,
                temperature=0.2,
                max_tokens=260,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = (response.choices[0].message.content or "").strip()
            return content or None
        except Exception:
            return None

    def _fallback_reply(self, *, message: str, gathered: dict[str, Any]) -> str:
        claim = gathered.get("claim")
        member = gathered.get("member")
        provider = gathered.get("provider")
        policies = gathered.get("policy_matches") or []
        stats = gathered.get("aggregate_stats") or {}
        review_queue = gathered.get("review_queue") or {}
        lower = message.lower()

        if claim is not None:
            claim_id = claim["claim"]["claim_id"]
            outcome = claim["decision"]["outcome"]
            rationale = claim["decision"]["rationale"]
            if "why" in lower or "flag" in lower or "review" in lower:
                return f"{claim_id} is currently {outcome}. {rationale}"
            if "status" in lower or "outcome" in lower:
                return f"{claim_id} is currently {outcome} with confidence {round(float(claim['confidence_score']) * 100)}%."
            return f"{claim_id} is currently {outcome}. The main rationale is: {rationale}"

        if member is not None:
            info = member["member"]
            recent = member.get("recent_claim_ids") or []
            recent_text = f" Recent claims on file: {', '.join(recent[:3])}." if recent else ""
            return (
                f"{info['member_name']} is {info['eligibility_status']} on {info['plan_name']}. "
                f"Referral required: {'yes' if info['referral_required'] else 'no'}. "
                f"Prior auth for specialty: {'yes' if info['prior_auth_required_for_specialty'] else 'no'}.{recent_text}"
            )

        if provider is not None:
            return (
                f"{provider['name']} is {provider['network_status']} with specialty {provider.get('specialty') or 'not specified'} "
                f"and credential status {provider.get('credential_status') or 'unknown'}. "
                f"Contract tier: {provider.get('contract_tier') or 'not specified'}."
            )

        if "approval rate" in lower or "pending count" in lower or "stats" in lower:
            return (
                f"There are {stats.get('total_claims', 0)} claims in the current dataset. "
                f"Pending review count is {stats.get('pending_review_count', 0)} and approval rate is "
                f"{round(float(stats.get('approval_rate', 0.0)) * 100)}%."
            )

        if "review queue" in lower or "pending review" in lower:
            items = review_queue.get("items") or []
            if not items:
                return "There are no items in the review queue right now."
            top = items[:3]
            summary = "; ".join(
                f"{item.get('claim_id')}: {item.get('reason')}" for item in top if item.get("claim_id")
            )
            return f"There are {review_queue.get('pending_count', 0)} pending review items. Top items: {summary}"

        if policies:
            top = policies[0]
            return (
                f"The strongest policy match is {top.get('document_label') or top.get('title')} "
                f"at {round(float(top.get('relevance_score', 0.0)) * 100)}% relevance. "
                f"{top.get('summary', '')}".strip()
            )

        return "I don't have enough context to answer that yet. Try asking about a specific claim ID, member, provider, or policy rule."

    def _tokenize(self, value: str) -> set[str]:
        return {
            token.upper()
            for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9\\.-]{1,}", value or "")
        }

    def _clean_reply(self, value: str) -> str:
        text = (value or "").strip()
        if not text:
            return "I don't have enough context to answer that yet. Try asking about a specific claim ID, member, provider, or policy rule."

        replacements = {
            "\u2022": "-",
            "\u2023": "-",
            "\u2043": "-",
            "\u2219": "-",
            "\u2013": "-",
            "\u2014": "-",
            "\u00a0": " ",
            "`": "",
            "**": "",
            "__": "",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)

        cleaned_lines: list[str] = []
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            line = re.sub(r"^\s*(?:[*•]+|\d+\.)\s*", "- ", line)
            line = re.sub(r"\s+", " ", line)
            cleaned_lines.append(line)

        text = "\n".join(cleaned_lines)
        text = re.sub(r"[^\x20-\x7E\n]", "", text)
        text = re.sub(r" {2,}", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def get_agent_chat_service(
    settings: Settings = Depends(get_settings),
    claims_repository: ClaimsRepository = Depends(get_claims_repository),
    members_repository: MembersRepository = Depends(get_members_repository),
    providers_repository: ProvidersRepository = Depends(get_providers_repository),
    policies_repository: PoliciesRepository = Depends(get_policies_repository),
) -> AgentChatService:
    return AgentChatService(
        settings=settings,
        claims_repository=claims_repository,
        members_repository=members_repository,
        providers_repository=providers_repository,
        policies_repository=policies_repository,
    )
