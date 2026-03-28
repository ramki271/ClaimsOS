const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type PolicyListItem = {
  id: string;
  filename: string;
  title: string;
  classification: string;
  status: string;
  chunk_count: number;
  created_at: string | null;
};

export type PolicyUploadResponse = {
  document: PolicyListItem;
  chunks_created: number;
  status: string;
};

export async function fetchPolicies(tenantKey: string): Promise<PolicyListItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/policies?tenant_key=${encodeURIComponent(tenantKey)}`,
  );
  if (!response.ok) throw new Error("Unable to fetch policies.");
  return response.json();
}

export async function uploadPolicy(
  file: File,
  payerName: string,
  classification = "POLICY_CORE",
): Promise<PolicyUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("payer_name", payerName);
  form.append("classification", classification);

  const response = await fetch(`${API_BASE_URL}/policies/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}));
    const detail = (data as { detail?: string }).detail;
    throw new Error(detail ?? "Unable to upload policy.");
  }
  return response.json();
}
