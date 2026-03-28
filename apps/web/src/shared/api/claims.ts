export type ServiceLine = {
  line_number: number;
  procedure_code: string;
  modifiers: string[];
  units: number;
  charge_amount: number;
};

export type ClaimSubmission = {
  claim_id: string;
  claim_type: "professional_outpatient";
  form_type: "CMS-1500";
  payer_name: string;
  plan_name: string;
  member_id: string;
  member_name: string;
  patient_id: string;
  provider_id: string;
  provider_name: string;
  place_of_service: string;
  diagnosis_codes: string[];
  procedure_codes: string[];
  service_lines: ServiceLine[];
  amount: number;
  date_of_service: string;
};

export type AuditEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string | null;
};

export type HumanReviewState = {
  status: string;
  reason: string;
  reviewer_name: string | null;
  reviewer_notes: string | null;
  updated_at: string | null;
};

export type ClaimReviewRequest = {
  reviewer_name?: string;
  reviewer_notes: string;
  review_status: "in_review" | "resolved";
  override_outcome?: "approve" | "deny" | "review";
};

export type ClaimDetailResponse = {
  claim: ClaimSubmission;
  status: string;
  created_at: string | null;
  confidence_score: number;
  requires_human_review: boolean;
  validation: {
    is_valid: boolean;
    issues: Array<{
      code: string;
      message: string;
      severity: string;
    }>;
  };
  decision: {
    outcome: string;
    rationale: string;
    cited_rules: string[];
  };
  matched_policies: Array<{
    policy_id: string;
    title: string;
    summary: string;
    relevance_score: number;
  }>;
  review_state: HumanReviewState | null;
  audit_trail: AuditEvent[];
};

export type ClaimRecordSummary = {
  claim_id: string;
  claim_type: string;
  payer_name: string;
  member_name: string;
  provider_name: string;
  amount: number;
  date_of_service: string;
  outcome: string;
  confidence_score: number;
  requires_human_review: boolean;
  created_at: string;
  review_status: string | null;
};

export type ClaimsFilter = {
  limit?: number;
  offset?: number;
  outcome?: string;
  requires_review?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function fetchDemoClaim(): Promise<ClaimSubmission> {
  const response = await fetch(`${API_BASE_URL}/claims/demo`);
  if (!response.ok) throw new Error("Unable to fetch demo claim.");
  return response.json();
}

export async function fetchClaims(filter: ClaimsFilter = {}): Promise<ClaimRecordSummary[]> {
  const params = new URLSearchParams();
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));
  if (filter.outcome !== undefined) params.set("outcome", filter.outcome);
  if (filter.requires_review !== undefined)
    params.set("requires_review", String(filter.requires_review));

  const qs = params.toString();
  const response = await fetch(`${API_BASE_URL}/claims${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Unable to fetch claims.");
  return response.json();
}

export async function fetchClaimById(claimId: string): Promise<ClaimDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/claims/${claimId}`);
  if (!response.ok) throw new Error("Unable to fetch claim detail.");
  return response.json();
}

export async function processClaim(claim: ClaimSubmission): Promise<ClaimDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/claims/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(claim),
  });
  if (!response.ok) throw new Error("Unable to process claim.");
  return response.json();
}

export async function submitReview(
  claimId: string,
  review: ClaimReviewRequest,
): Promise<ClaimDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/claims/${claimId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
  if (!response.ok) throw new Error("Unable to submit review.");
  return response.json();
}

export async function uploadX12Claim(file: File): Promise<ClaimDetailResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/claims/upload-x12`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}));
    const detail = (data as { detail?: string }).detail;
    throw new Error(detail ?? "Unable to process X12 file.");
  }
  return response.json();
}
