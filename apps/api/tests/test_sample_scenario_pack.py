import json
from pathlib import Path

from app.domain.claims.adjudication_service import AdjudicationService
from app.domain.claims.models import ClaimSubmission, PolicyMatch, ProviderAdjudicationContext
from app.domain.claims.payer_verification_service import PayerVerificationService
from app.domain.claims.validation_service import ValidationService


ROOT = Path(__file__).resolve().parents[3]
SCENARIO_MANIFEST = ROOT / "sample_data" / "claims" / "internal_json" / "apex_scenario_manifest.json"
PROVIDER_SEED_PACK = ROOT / "sample_data" / "providers" / "apex_provider_seed_pack.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def _provider_contexts() -> dict[str, ProviderAdjudicationContext]:
    payload = _load_json(PROVIDER_SEED_PACK)
    contexts: dict[str, ProviderAdjudicationContext] = {}
    for provider in payload["providers"]:
        contexts[provider["provider_key"]] = ProviderAdjudicationContext(
            provider_key=provider["provider_key"],
            provider_name=provider["name"],
            taxonomy_code=provider.get("taxonomy_code"),
            specialty=provider.get("specialty"),
            subspecialty=provider.get("subspecialty"),
            network_status=provider["network_status"],
            contract_tier=provider.get("contract_tier"),
            contract_status=provider.get("contract_status", "active"),
            credential_status=provider.get("credential_status", "credentialed"),
            participates_in_plan=False,
            plan_participation=list(provider.get("plan_participation") or []),
            facility_affiliations=list(provider.get("facility_affiliations") or []),
            service_locations=list(provider.get("service_locations") or []),
            accepting_referrals=bool(provider.get("accepting_referrals", True)),
            surgical_privileges=bool(provider.get("surgical_privileges", False)),
        )
    return contexts


def test_advanced_scenario_pack_matches_expected_outcomes() -> None:
    provider_contexts = _provider_contexts()
    manifest = _load_json(SCENARIO_MANIFEST)
    validation_service = ValidationService()
    payer_verification_service = PayerVerificationService()
    adjudication_service = AdjudicationService()

    for scenario in manifest["scenarios"]:
        scenario_path = ROOT / scenario["file"]
        claim = ClaimSubmission.model_validate(_load_json(scenario_path))
        provider_context = provider_contexts[scenario["provider_key"]].model_copy(
            update={
                "participates_in_plan": claim.plan_name
                in provider_contexts[scenario["provider_key"]].plan_participation
            }
        )
        validation = validation_service.validate(claim)
        payer_verification = payer_verification_service.build(
            claim,
            provider_context=provider_context,
        )
        policy_matches = [
            PolicyMatch(
                policy_id="SCENARIO-PACK",
                title="Scenario Pack Baseline Policy Context",
                summary="Synthetic policy context supplied for scenario-pack verification.",
                relevance_score=0.9,
            )
        ]
        decision = adjudication_service.adjudicate(
            claim=claim,
            validation=validation,
            policies=policy_matches,
            provider_context=provider_context,
            utilization_context=None,
            payer_verification_context=payer_verification,
        )

        assert decision.outcome == scenario["expected_outcome"], (
            f"{scenario['claim_id']} expected {scenario['expected_outcome']} "
            f"but got {decision.outcome} with issues {[issue.code for issue in validation.issues]}"
        )
