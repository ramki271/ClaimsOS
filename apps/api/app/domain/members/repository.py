from __future__ import annotations

from datetime import date, datetime

from app.domain.members.models import (
    ActiveDiagnosis,
    ClinicalHotspot,
    MemberDetailResponse,
    MemberListItem,
    MemberRecord,
    PolicyAlignmentItem,
    SurgicalHistoryItem,
)


# ─────────────────────────────────────────────────────────────────────────────
# ANATOMICAL LANDMARK REFERENCE — position_x / position_y are % of image dims
# (calibrated against frontal muscular anatomy image; figure starts ~y=6%)
#
#  BODY PART                X (viewer)   Y (image %)
#  Top of head              50           6
#  Throat / airway          50           18
#  Left shoulder (pt)       32           22   ← confirmed anchor
#  Right shoulder (pt)      68           22
#  Left chest / heart       45           30
#  Center sternum           50           33
#  Navel / mid-abdomen      50           45
#  Lower abdomen            50           50
#  Left hip (pt)            38           54
#  Right hip (pt)           62           54
#  Left knee (pt)           42           67
#  Right knee (pt)          58           67
#  Left ankle (pt)          44           80
#  Right ankle (pt)         56           80
# ─────────────────────────────────────────────────────────────────────────────
def _seeded_members() -> list[MemberDetailResponse]:
    members = [
        MemberDetailResponse(
            member=MemberRecord(
                member_id="M-4421907",
                tenant_key="apex-health-plan",
                payer_name="Apex Health Plan",
                subscriber_id="SUB-4421907",
                member_name="Elena Martinez",
                date_of_birth=date(1980, 1, 1),
                gender="female",
                relationship_to_subscriber="self",
                plan_name="Commercial PPO 500",
                plan_product="PPO 500",
                coverage_type="commercial",
                eligibility_status="active",
                effective_date=date(2026, 1, 1),
                pcp_name="Dr. Maya Chen",
                pcp_npi="1299304491",
                referral_required=False,
                prior_auth_required_for_specialty=True,
                address_line_1="123 Oak St",
                city="Denver",
                state="CO",
                postal_code="80203",
                phone="303-555-0183",
                email="elena.martinez@example.com",
                risk_flags=["diabetes_management", "hypertension_followup"],
                active_claim_count=4,
                last_claim_id="OCR-CLM-APR-0001",
                metadata={"line_of_business": "commercial", "preferred_language": "en"},
                created_at=datetime(2026, 1, 2, 9, 30, 0),
            ),
            recent_claim_ids=[
                "OCR-CLM-APR-0001",
                "CLM-BULK-APPROVE-0001",
                "CLM-APX-APPROVE-0001",
            ],
            coverage_notes=[
                "Active commercial PPO enrollment verified through 2026-12-31.",
                "Office visits do not require referral when rendered in-network.",
                "Specialty procedures may require prior authorization.",
            ],
            plan_tier="Commercial PPO Member",
            deductible_met="$850",
            deductible_max="$2,500",
            diagnostic_confidence=94.2,
            clinical_hotspots=[
                ClinicalHotspot(
                    id="HS-01",
                    body_location="Left Shoulder",
                    description="Prior Surgical Site (Arthroscopy 2021)",
                    icd_code="M25.512",
                    risk_level="high_risk",
                    position_x=32.0,
                    position_y=22.0,
                ),
                ClinicalHotspot(
                    id="HS-02",
                    body_location="Right Knee Joint",
                    description="Pathological Focus — Chronic Synovitis",
                    icd_code="M17.11",
                    risk_level="active_claim",
                    position_x=58.0,
                    position_y=67.0,
                ),
            ],
            active_diagnoses=[
                ActiveDiagnosis(
                    icd_code="M17.11",
                    description="Unilateral primary osteoarthritis, right knee",
                    onset="Jan 2024",
                ),
                ActiveDiagnosis(
                    icd_code="M25.512",
                    description="Pain in left shoulder",
                    onset="Sept 2021",
                ),
                ActiveDiagnosis(
                    icd_code="I10",
                    description="Essential (primary) hypertension",
                    onset="May 2018",
                ),
            ],
            surgical_history=[
                SurgicalHistoryItem(
                    date="OCT 2021",
                    procedure="Left Shoulder Arthroscopy",
                    facility="Mercy General Hospital",
                    notes="Labral repair with 2 anchors. Recovery noted as standard with follow-up physical therapy.",
                    is_primary=True,
                ),
                SurgicalHistoryItem(
                    date="FEB 2015",
                    procedure="Appendectomy",
                    notes="Laparoscopic procedure. No complications reported in historical records.",
                    is_primary=False,
                ),
            ],
            policy_alignment=[
                PolicyAlignmentItem(
                    status="approved",
                    text="Experimental exclusion criteria not met (Approved).",
                ),
                PolicyAlignmentItem(
                    status="active",
                    text="Pre-authorization window active (Auth #44012).",
                ),
                PolicyAlignmentItem(
                    status="review_required",
                    text="Requires secondary clinical review due to prior surgical history.",
                ),
            ],
        ),
        MemberDetailResponse(
            member=MemberRecord(
                member_id="M-7712044",
                tenant_key="apex-health-plan",
                payer_name="Apex Health Plan",
                subscriber_id="SUB-7712044",
                member_name="Jordan Lee",
                date_of_birth=date(1974, 8, 19),
                gender="male",
                relationship_to_subscriber="self",
                plan_name="Commercial HMO Select",
                plan_product="HMO Select",
                coverage_type="commercial",
                eligibility_status="active",
                effective_date=date(2026, 1, 1),
                pcp_name="Dr. Aria Singh",
                pcp_npi="1558473920",
                referral_required=True,
                prior_auth_required_for_specialty=True,
                address_line_1="88 Clarkson Ave",
                city="Aurora",
                state="CO",
                postal_code="80012",
                phone="720-555-0191",
                email="jordan.lee@example.com",
                risk_flags=["referral_required", "cardiology_followup"],
                active_claim_count=2,
                last_claim_id="CLM-HMO-REF-0007",
                metadata={"line_of_business": "commercial", "care_program": "cardiac"},
                created_at=datetime(2026, 1, 5, 10, 15, 0),
            ),
            recent_claim_ids=["CLM-HMO-REF-0007", "CLM-HMO-REV-0003"],
            coverage_notes=[
                "PCP referral is required for specialist visits under HMO Select.",
                "Cardiology specialty services require active referral on file.",
            ],
            plan_tier="Commercial HMO Member",
            deductible_met="$400",
            deductible_max="$1,500",
            diagnostic_confidence=88.7,
            clinical_hotspots=[
                ClinicalHotspot(
                    id="HS-01",
                    body_location="Chest / Cardiac Region",
                    description="Chronic Coronary Artery Disease — Active Monitoring",
                    icd_code="I25.10",
                    risk_level="high_risk",
                    position_x=45.0,
                    position_y=30.0,
                ),
                ClinicalHotspot(
                    id="HS-02",
                    body_location="Lumbar Spine",
                    description="Recurrent Lower Back Pain — L4-L5 Disc Compression",
                    icd_code="M54.5",
                    risk_level="monitor",
                    position_x=50.0,
                    position_y=50.0,
                ),
            ],
            active_diagnoses=[
                ActiveDiagnosis(
                    icd_code="I25.10",
                    description="Atherosclerotic heart disease of native coronary artery",
                    onset="Jun 2020",
                ),
                ActiveDiagnosis(
                    icd_code="I10",
                    description="Essential (primary) hypertension",
                    onset="Mar 2016",
                ),
                ActiveDiagnosis(
                    icd_code="M54.5",
                    description="Low back pain",
                    onset="Nov 2022",
                ),
            ],
            surgical_history=[
                SurgicalHistoryItem(
                    date="AUG 2022",
                    procedure="Coronary Angioplasty with Stent",
                    facility="Aurora Cardiac Center",
                    notes="Single-vessel intervention. Drug-eluting stent placed in LAD. Post-procedure recovery unremarkable. Cardiology follow-up every 6 months.",
                    is_primary=True,
                ),
                SurgicalHistoryItem(
                    date="MAR 2018",
                    procedure="Knee Arthroscopy — Medial Meniscus Repair",
                    notes="Partial meniscectomy performed. Physical therapy completed. No residual functional limitation noted.",
                    is_primary=False,
                ),
            ],
            policy_alignment=[
                PolicyAlignmentItem(
                    status="approved",
                    text="Cardiac care program enrollment verified (Auth #38201).",
                ),
                PolicyAlignmentItem(
                    status="review_required",
                    text="Specialist referral required before cardiology claim adjudication.",
                ),
                PolicyAlignmentItem(
                    status="active",
                    text="HMO network restriction applies to all non-emergency services.",
                ),
            ],
        ),
        MemberDetailResponse(
            member=MemberRecord(
                member_id="M-6638821",
                tenant_key="apex-health-plan",
                payer_name="Apex Health Plan",
                subscriber_id="SUB-6638821",
                member_name="Priya Natarajan",
                date_of_birth=date(2012, 4, 11),
                gender="female",
                relationship_to_subscriber="child",
                plan_name="Family Plus PPO",
                plan_product="Family Plus",
                coverage_type="commercial",
                eligibility_status="active",
                effective_date=date(2026, 1, 1),
                pcp_name="Dr. Holly Rivera",
                pcp_npi="1882034490",
                referral_required=False,
                prior_auth_required_for_specialty=False,
                address_line_1="519 W 8th Ave",
                city="Broomfield",
                state="CO",
                postal_code="80020",
                phone="303-555-0144",
                risk_flags=["pediatric_member"],
                active_claim_count=1,
                last_claim_id="CLM-PEDS-0012",
                metadata={"line_of_business": "commercial", "subscriber_name": "Kavya Natarajan"},
                created_at=datetime(2026, 1, 12, 14, 45, 0),
            ),
            recent_claim_ids=["CLM-PEDS-0012"],
            coverage_notes=[
                "Dependent coverage active under family subscriber policy.",
                "Pediatric preventive services covered in-network without referral.",
            ],
            plan_tier="Family PPO Dependent",
            deductible_met="$120",
            deductible_max="$750",
            diagnostic_confidence=97.1,
            clinical_hotspots=[
                ClinicalHotspot(
                    id="HS-01",
                    body_location="Airway / Respiratory",
                    description="Mild Persistent Asthma — Seasonal Exacerbation Pattern",
                    icd_code="J45.30",
                    risk_level="monitor",
                    position_x=50.0,
                    position_y=25.0,
                ),
            ],
            active_diagnoses=[
                ActiveDiagnosis(
                    icd_code="J45.30",
                    description="Mild persistent asthma, uncomplicated",
                    onset="Sep 2020",
                ),
                ActiveDiagnosis(
                    icd_code="Z23",
                    description="Encounter for immunization",
                    onset="Jan 2026",
                ),
            ],
            surgical_history=[
                SurgicalHistoryItem(
                    date="JUN 2019",
                    procedure="Tonsillectomy & Adenoidectomy",
                    facility="Children's Hospital Colorado",
                    notes="Procedure performed due to recurrent strep pharyngitis. Uncomplicated recovery. No follow-up surgical intervention anticipated.",
                    is_primary=True,
                ),
            ],
            policy_alignment=[
                PolicyAlignmentItem(
                    status="approved",
                    text="Pediatric preventive services fully covered in-network.",
                ),
                PolicyAlignmentItem(
                    status="active",
                    text="Dependent coverage valid under subscriber Kavya Natarajan through 2026-12-31.",
                ),
                PolicyAlignmentItem(
                    status="approved",
                    text="Asthma management program enrollment confirmed.",
                ),
            ],
        ),
        MemberDetailResponse(
            member=MemberRecord(
                member_id="M-9011182",
                tenant_key="apex-health-plan",
                payer_name="Apex Health Plan",
                subscriber_id="SUB-9011182",
                member_name="Harold Bennett",
                date_of_birth=date(1953, 11, 2),
                gender="male",
                relationship_to_subscriber="self",
                plan_name="Apex Medicare Advantage Choice",
                plan_product="MA Choice",
                coverage_type="medicare_advantage",
                eligibility_status="pending_review",
                effective_date=date(2026, 1, 1),
                termination_date=date(2026, 12, 31),
                pcp_name="Dr. Lena Ortiz",
                pcp_npi="1447002194",
                referral_required=False,
                prior_auth_required_for_specialty=True,
                address_line_1="761 Spruce Ct",
                city="Lakewood",
                state="CO",
                postal_code="80226",
                phone="303-555-0108",
                risk_flags=["eligibility_reverification", "specialty_auth_watch"],
                active_claim_count=0,
                metadata={"line_of_business": "medicare_advantage", "risk_score_band": "moderate"},
                created_at=datetime(2026, 1, 20, 8, 0, 0),
            ),
            recent_claim_ids=[],
            coverage_notes=[
                "Eligibility needs reverification before specialty adjudication proceeds.",
                "Prior authorization is expected for advanced outpatient procedures.",
            ],
            plan_tier="Medicare Advantage Member",
            deductible_met="$0",
            deductible_max="$3,400",
            diagnostic_confidence=79.3,
            clinical_hotspots=[
                ClinicalHotspot(
                    id="HS-01",
                    body_location="Right Hip Joint",
                    description="Post-Surgical Monitoring — Total Hip Replacement 2023",
                    icd_code="M16.11",
                    risk_level="active_claim",
                    position_x=62.0,
                    position_y=54.0,
                ),
                ClinicalHotspot(
                    id="HS-02",
                    body_location="Lumbar Spine L3-L5",
                    description="Degenerative Disc Disease — Chronic Pain Management",
                    icd_code="M51.16",
                    risk_level="high_risk",
                    position_x=50.0,
                    position_y=50.0,
                ),
            ],
            active_diagnoses=[
                ActiveDiagnosis(
                    icd_code="M16.11",
                    description="Primary osteoarthritis, right hip",
                    onset="Feb 2022",
                ),
                ActiveDiagnosis(
                    icd_code="M51.16",
                    description="Intervertebral disc degeneration, lumbar region",
                    onset="Aug 2019",
                ),
                ActiveDiagnosis(
                    icd_code="E11.9",
                    description="Type 2 diabetes mellitus without complications",
                    onset="Jan 2010",
                ),
                ActiveDiagnosis(
                    icd_code="I10",
                    description="Essential (primary) hypertension",
                    onset="May 2008",
                ),
            ],
            surgical_history=[
                SurgicalHistoryItem(
                    date="NOV 2023",
                    procedure="Total Right Hip Arthroplasty",
                    facility="St. Anthony Hospital, Lakewood",
                    notes="Cemented total hip replacement. Post-op PT completed 8 weeks. Ambulation restored. Ongoing monitoring for implant integrity.",
                    is_primary=True,
                ),
                SurgicalHistoryItem(
                    date="SEP 2020",
                    procedure="Bilateral Cataract Extraction",
                    facility="Colorado Eye Center",
                    notes="Phacoemulsification with IOL implant, both eyes. Vision restored to corrected 20/25. No complications.",
                    is_primary=False,
                ),
            ],
            policy_alignment=[
                PolicyAlignmentItem(
                    status="review_required",
                    text="Eligibility reverification required prior to any specialty claim processing.",
                ),
                PolicyAlignmentItem(
                    status="review_required",
                    text="Prior authorization mandatory for advanced outpatient orthopedic procedures.",
                ),
                PolicyAlignmentItem(
                    status="active",
                    text="Medicare Advantage annual benefit period active through 2026-12-31.",
                ),
            ],
        ),
        MemberDetailResponse(
            member=MemberRecord(
                member_id="M-5543209",
                tenant_key="apex-health-plan",
                payer_name="Apex Health Plan",
                subscriber_id="SUB-5543209",
                member_name="Sofia Ramirez",
                date_of_birth=date(1991, 6, 24),
                gender="female",
                relationship_to_subscriber="self",
                plan_name="Community Managed Care",
                plan_product="CMC Gold",
                coverage_type="medicaid_managed_care",
                eligibility_status="inactive",
                effective_date=date(2025, 1, 1),
                termination_date=date(2026, 2, 28),
                pcp_name="Dr. Nate Walker",
                pcp_npi="1776029014",
                referral_required=True,
                prior_auth_required_for_specialty=False,
                address_line_1="42 Pearl St",
                city="Pueblo",
                state="CO",
                postal_code="81003",
                phone="719-555-0177",
                risk_flags=["coverage_terminated", "timely_filing_watch"],
                active_claim_count=0,
                metadata={"line_of_business": "medicaid_managed_care", "case_management": True},
                created_at=datetime(2025, 12, 15, 11, 0, 0),
            ),
            recent_claim_ids=["CLM-MMC-TERM-0041"],
            coverage_notes=[
                "Coverage terminated on 2026-02-29; claims after that date require eligibility review.",
                "Managed care referral rules apply while coverage is active.",
            ],
            plan_tier="Medicaid Managed Care Member",
            deductible_met="$0",
            deductible_max="$0",
            diagnostic_confidence=82.4,
            clinical_hotspots=[
                ClinicalHotspot(
                    id="HS-01",
                    body_location="Lower Abdomen",
                    description="Post-Surgical Healing — Cesarean Section Mar 2023",
                    icd_code="O82",
                    risk_level="monitor",
                    position_x=50.0,
                    position_y=50.0,
                ),
            ],
            active_diagnoses=[
                ActiveDiagnosis(
                    icd_code="J45.40",
                    description="Moderate persistent asthma, uncomplicated",
                    onset="Apr 2015",
                ),
                ActiveDiagnosis(
                    icd_code="F32.9",
                    description="Major depressive episode, unspecified",
                    onset="Oct 2023",
                ),
            ],
            surgical_history=[
                SurgicalHistoryItem(
                    date="MAR 2023",
                    procedure="Cesarean Section",
                    facility="Parkview Medical Center, Pueblo",
                    notes="Lower segment C-section. Uncomplicated delivery. Incision healed without infection. Follow-up OB visit completed.",
                    is_primary=True,
                ),
            ],
            policy_alignment=[
                PolicyAlignmentItem(
                    status="review_required",
                    text="Coverage terminated 2026-02-28; all new claims require eligibility review.",
                ),
                PolicyAlignmentItem(
                    status="review_required",
                    text="Timely filing deadline watch — outstanding claim CLM-MMC-TERM-0041.",
                ),
                PolicyAlignmentItem(
                    status="approved",
                    text="Mental health parity coverage was active during enrolled period.",
                ),
            ],
        ),
    ]
    return members


class MembersRepository:
    def __init__(self) -> None:
        self._members = _seeded_members()

    def list_members(self, *, tenant_key: str | None = None, limit: int = 100) -> list[MemberListItem]:
        members = self._members
        if tenant_key:
            members = [member for member in members if member.member.tenant_key == tenant_key]
        return [
            MemberListItem(
                member_id=item.member.member_id,
                tenant_key=item.member.tenant_key,
                payer_name=item.member.payer_name,
                member_name=item.member.member_name,
                subscriber_id=item.member.subscriber_id,
                plan_name=item.member.plan_name,
                eligibility_status=item.member.eligibility_status,
                date_of_birth=item.member.date_of_birth,
                active_claim_count=item.member.active_claim_count,
                last_claim_id=item.member.last_claim_id,
            )
            for item in members[:limit]
        ]

    def get_member(self, member_id: str) -> MemberDetailResponse | None:
        return next((item for item in self._members if item.member.member_id == member_id), None)


def get_members_repository() -> MembersRepository:
    return MembersRepository()
