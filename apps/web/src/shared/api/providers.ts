const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type Provider = {
  id?: string;
  tenant_key: string;
  provider_key: string;
  name: string;
  npi: string;
  specialty: string;
  network_status: "in_network" | "out_of_network";
};

export type ProviderCreateRequest = Omit<Provider, "id">;

export async function fetchProviders(tenantKey: string): Promise<Provider[]> {
  const response = await fetch(
    `${API_BASE_URL}/providers?tenant_key=${encodeURIComponent(tenantKey)}`,
  );
  if (!response.ok) throw new Error("Unable to fetch providers.");
  return response.json();
}

export async function createProvider(provider: ProviderCreateRequest): Promise<Provider> {
  const response = await fetch(`${API_BASE_URL}/providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider),
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}));
    const detail = (data as { detail?: string }).detail;
    throw new Error(detail ?? "Unable to create provider.");
  }
  return response.json();
}
