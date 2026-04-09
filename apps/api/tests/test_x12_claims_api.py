from fastapi.testclient import TestClient

from app.domain.claims.x12_parser import X12ProfessionalClaimParser
from app.main import app


client = TestClient(app)

SAMPLE_837P = """ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260327*1200*^*00501*000000905*1*T*:~
GS*HC*SENDER*RECEIVER*20260327*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*0123*20260327*1200*CH~
NM1*41*2*CLAIMSOS SUBMITTER*****46*12345~
NM1*40*2*ACME CLEARINGHOUSE*****46*99999~
HL*1**20*1~
NM1*85*2*FRONT RANGE FAMILY MEDICINE*****XX*1299304491~
N3*123 MAIN ST~
N4*DENVER*CO*80202~
REF*EI*123456789~
HL*2*1*22*0~
SBR*P*18*COMMERCIAL PPO 500*****CI~
NM1*IL*1*MARTINEZ*ELENA****MI*M-4421907~
N3*123 OAK ST~
N4*DENVER*CO*80203~
DMG*D8*19800101*F~
NM1*PR*2*APEX HEALTH PLAN*****PI*842610001~
NM1*DN*1*HOUSE*GREGORY****XX*1881777111~
NM1*77*2*FRONT RANGE FAMILY MEDICINE*****XX*1299304491~
CLM*CLM-20260327-0001*150***11:B:1*Y*A*Y*Y~
REF*G1*AUTH-4421~
REF*9F*REF-2049~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213:25*150*UN*1***1~
DTP*472*D8*20260301~
SE*22*0001~
GE*1*1~
IEA*1*000000905~"""

BATCH_837P = """ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260327*1200*^*00501*000000906*1*T*:~
GS*HC*SENDER*RECEIVER*20260327*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*0124*20260327*1200*CH~
NM1*41*2*CLAIMSOS SUBMITTER*****46*12345~
NM1*40*2*ACME CLEARINGHOUSE*****46*99999~
HL*1**20*1~
NM1*85*2*FRONT RANGE FAMILY MEDICINE*****XX*1299304491~
N3*123 MAIN ST~
N4*DENVER*CO*80202~
REF*EI*123456789~
HL*2*1*22*0~
SBR*P*18*COMMERCIAL PPO 500*****CI~
NM1*IL*1*MARTINEZ*ELENA****MI*M-4421907~
N3*123 OAK ST~
N4*DENVER*CO*80203~
DMG*D8*19800101*F~
NM1*PR*2*APEX HEALTH PLAN*****PI*842610001~
CLM*CLM-BATCH-0001*150***11:B:1*Y*A*Y*Y~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213*150*UN*1***1~
DTP*472*D8*20260301~
CLM*CLM-BATCH-0002*175***11:B:1*Y*A*Y*Y~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213*175*UN*1***1~
DTP*472*D8*20260302~
SE*27*0001~
GE*1*1~
IEA*1*000000906~"""


def test_x12_parser_maps_claim_into_canonical_model() -> None:
    parser = X12ProfessionalClaimParser()

    claim = parser.parse(SAMPLE_837P)

    assert claim.claim_id == "CLM-20260327-0001"
    assert claim.member_name == "Elena Martinez"
    assert claim.provider_name == "Front Range Family Medicine"
    assert claim.billing_provider_id == "1299304491"
    assert claim.billing_provider_name == "Front Range Family Medicine"
    assert claim.rendering_provider_id == "1299304491"
    assert claim.rendering_provider_name == "Front Range Family Medicine"
    assert claim.referring_provider_id == "1881777111"
    assert claim.referring_provider_name == "Gregory House"
    assert claim.facility_name == "Front Range Family Medicine"
    assert claim.facility_npi == "1299304491"
    assert claim.payer_name == "Apex Health Plan"
    assert claim.prior_authorization_id == "AUTH-4421"
    assert claim.referral_id == "REF-2049"
    assert claim.claim_frequency_code == "1"
    assert claim.procedure_codes == ["99213"]
    assert claim.service_lines[0].modifiers == ["25"]
    assert claim.amount == 150.0
    assert str(claim.date_of_service) == "2026-03-01"


def test_x12_parser_maps_corrected_claim_reference_and_frequency() -> None:
    parser = X12ProfessionalClaimParser()
    payload = """ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260402*0900*^*00501*000000910*1*T*:~
GS*HC*SENDER*RECEIVER*20260402*0900*1*X*005010X222A1~
ST*837*0010*005010X222A1~
BHT*0019*00*0456*20260402*0900*CH~
NM1*41*2*CLAIMSOS SUBMITTER*****46*12345~
NM1*40*2*ACME CLEARINGHOUSE*****46*99999~
HL*1**20*1~
NM1*85*2*FRONT RANGE FAMILY MEDICINE*****XX*PRV-4092~
HL*2*1*22*0~
SBR*P*18*COMMERCIAL PPO 500*****CI~
NM1*IL*1*MARTINEZ*ELENA****MI*M-4421907~
DMG*D8*19800101*F~
NM1*PR*2*APEX HEALTH PLAN*****PI*842610001~
CLM*CLM-CORRECTED-TEST*150***11:B:7*Y*A*Y*Y~
REF*F8*ORIG-CTRL-991~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213*150*UN*1***1~
DTP*472*D8*20260429~
SE*17*0010~
GE*1*1~
IEA*1*000000910~"""

    claim = parser.parse(payload)

    assert claim.claim_frequency_code == "7"
    assert claim.payer_claim_control_number == "ORIG-CTRL-991"


def test_x12_parser_maps_multiple_claims_into_canonical_models() -> None:
    parser = X12ProfessionalClaimParser()

    claims = parser.parse_many(BATCH_837P)

    assert len(claims) == 2
    assert claims[0].claim_id == "CLM-BATCH-0001"
    assert claims[0].amount == 150.0
    assert str(claims[0].date_of_service) == "2026-03-01"
    assert claims[1].claim_id == "CLM-BATCH-0002"
    assert claims[1].amount == 175.0
    assert str(claims[1].date_of_service) == "2026-03-02"


def test_upload_x12_claim_processes_transaction() -> None:
    response = client.post(
        "/api/claims/upload-x12",
        files={
            "file": ("sample-837p.txt", SAMPLE_837P, "text/plain"),
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["claim"]["claim_id"] == "CLM-20260327-0001"
    assert body["claim"]["procedure_codes"] == ["99213"]
    assert body["claim"]["member_name"] == "Elena Martinez"
    assert body["decision"]["outcome"] in {"approve", "review", "deny"}


def test_upload_x12_claim_rejects_invalid_payload() -> None:
    response = client.post(
        "/api/claims/upload-x12",
        files={"file": ("broken-837.txt", "not a valid x12 payload", "text/plain")},
    )

    assert response.status_code == 400
    assert "claim" in response.json()["detail"].lower() or "x12" in response.json()["detail"].lower()


def test_upload_x12_batch_processes_multiple_transactions() -> None:
    response = client.post(
        "/api/claims/upload-x12-batch",
        files={
            "file": ("sample-837p-batch.txt", BATCH_837P, "text/plain"),
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["total_claims"] == 2
    assert body["processed_claims"] == 2
    assert body["failed_claims"] == 0
    assert [item["claim_id"] for item in body["results"]] == ["CLM-BATCH-0001", "CLM-BATCH-0002"]
    assert all(item["status"] == "processed" for item in body["results"])
