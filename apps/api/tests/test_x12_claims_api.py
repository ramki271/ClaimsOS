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
CLM*CLM-20260327-0001*150***11:B:1*Y*A*Y*Y~
HI*ABK:E119*ABF:I10~
LX*1~
SV1*HC:99213*150*UN*1***1~
DTP*472*D8*20260301~
SE*22*0001~
GE*1*1~
IEA*1*000000905~"""


def test_x12_parser_maps_claim_into_canonical_model() -> None:
    parser = X12ProfessionalClaimParser()

    claim = parser.parse(SAMPLE_837P)

    assert claim.claim_id == "CLM-20260327-0001"
    assert claim.member_name == "Elena Martinez"
    assert claim.provider_name == "Front Range Family Medicine"
    assert claim.payer_name == "Apex Health Plan"
    assert claim.procedure_codes == ["99213"]
    assert claim.amount == 150.0
    assert str(claim.date_of_service) == "2026-03-01"


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
