# Provider Network and Contract Tier Logic

Policy ID: APX-NET-TIER1-PROF-2026
Payer: Apex Health Plan
Product: Commercial PPO 500
Medical Logic Branch: Network-Par, Contract-Tier
Adjudication Weight: 73.2
Ingestion Status: Ready for Upload
Effective Date: 2026-01-01

## Rule Summary

Professional claims may receive straight-through approval when the servicing or billing provider is in network and mapped to an active contract tier applicable to the member product.

## Network Conditions

For automated adjudication:
- provider must have active in-network status
- provider must not be suspended or terminated on the date of service
- provider must be eligible to furnish the billed service type

## Contract Tier Conditions

Tier 1 outpatient professional providers are eligible for the standard contracted allowables under Commercial PPO 500. Claims meeting all other policy criteria may be paid at contracted rates without manual contract validation.

## Review Triggers

Route to review if:
- provider network status is unknown
- provider is out of network and product-specific reimbursement logic is missing
- the billed service conflicts with the provider specialty or contract tier

## Adjudication Recommendation

If the provider is verified as Tier 1 and in network, provider contract logic supports approval of routine professional office visits that otherwise satisfy clinical and plan rules.
