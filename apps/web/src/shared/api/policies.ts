const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type PolicyDocumentMetadata = {
  payer_name?: string;
  retrieval_backend?: "openai_vector_store" | "local";
  openai_ingestion_status?: "indexed" | "failed" | "not_configured";
  openai_file_id?: string;
  openai_vector_store_id?: string;
  openai_error?: string;
};

export type PolicyDocumentRecord = {
  id: string | null;
  tenant_id: string;
  document_key: string;
  filename: string;
  title: string;
  classification: string;
  status: string;
  chunk_count: number;
  metadata: PolicyDocumentMetadata;
  created_at: string | null;
};

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
  document: PolicyDocumentRecord;
  chunks_created: number;
  status: string;
};

export type PolicyMetricsSummary = {
  total_documents: number;
  total_chunks: number;
  indexed_documents: number;
  success_rate: number;
  queue_depth: number;
  avg_ingestion_latency_ms: number;
  documents_indexed_24h: number;
};

export type PolicyMetricsPoint = {
  date: string;
  label: string;
  documents_indexed: number;
  chunks_indexed: number;
};

export type PolicyRecentUpload = {
  filename: string;
  title: string;
  status: string;
  chunk_count: number;
  created_at: string | null;
  retrieval_backend: string | null;
  openai_ingestion_status: string | null;
};

export type PolicyMetricsResponse = {
  summary: PolicyMetricsSummary;
  trend: PolicyMetricsPoint[];
  recent_uploads: PolicyRecentUpload[];
};

export async function fetchPolicyMetrics(tenantKey: string): Promise<PolicyMetricsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/policies/metrics?tenant_key=${encodeURIComponent(tenantKey)}`,
  );
  if (!response.ok) throw new Error("Unable to fetch policy metrics.");
  return response.json();
}

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
