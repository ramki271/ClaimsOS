const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type MemberListItem = {
  member_id: string;
  tenant_key: string;
  payer_name: string;
  member_name: string;
  subscriber_id: string;
  plan_name: string;
  eligibility_status: "active" | "inactive" | "pending_review";
  date_of_birth: string;
  active_claim_count: number;
  last_claim_id?: string | null;
};

export type MemberRecord = {
  member_id: string;
  tenant_key: string;
  payer_name: string;
  subscriber_id: string;
  member_name: string;
  date_of_birth: string;
  gender: "female" | "male" | "other" | "unknown";
  relationship_to_subscriber: "self" | "spouse" | "child" | "other";
  plan_name: string;
  plan_product: string;
  coverage_type: "commercial" | "medicare_advantage" | "medicaid_managed_care";
  eligibility_status: "active" | "inactive" | "pending_review";
  effective_date: string;
  termination_date?: string | null;
  pcp_name?: string | null;
  pcp_npi?: string | null;
  referral_required: boolean;
  prior_auth_required_for_specialty: boolean;
  address_line_1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  risk_flags: string[];
  active_claim_count: number;
  last_claim_id?: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
};

export type ClinicalHotspot = {
  id: string;
  body_location: string;
  description: string;
  icd_code: string;
  risk_level: "high_risk" | "active_claim" | "monitor";
  position_x: number;
  position_y: number;
};

export type ActiveDiagnosis = {
  icd_code: string;
  description: string;
  onset: string;
};

export type SurgicalHistoryItem = {
  date: string;
  procedure: string;
  facility?: string | null;
  notes: string;
  is_primary: boolean;
};

export type PolicyAlignmentItem = {
  status: "approved" | "active" | "review_required";
  text: string;
};

export type MemberDetailResponse = {
  member: MemberRecord;
  recent_claim_ids: string[];
  coverage_notes: string[];
  plan_tier: string;
  deductible_met: string;
  deductible_max: string;
  diagnostic_confidence: number;
  clinical_hotspots: ClinicalHotspot[];
  active_diagnoses: ActiveDiagnosis[];
  surgical_history: SurgicalHistoryItem[];
  policy_alignment: PolicyAlignmentItem[];
};

export async function fetchMembers(tenantKey?: string): Promise<MemberListItem[]> {
  const query = tenantKey ? `?tenant_key=${encodeURIComponent(tenantKey)}` : "";
  const response = await fetch(`${API_BASE_URL}/members${query}`);
  if (!response.ok) throw new Error("Unable to fetch members.");
  return response.json();
}

export async function fetchMemberById(memberId: string): Promise<MemberDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/members/${encodeURIComponent(memberId)}`);
  if (!response.ok) throw new Error("Unable to fetch member detail.");
  return response.json();
}
