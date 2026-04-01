import { useState } from "react";
import type { Provider, ProviderCreateRequest } from "../../../shared/api/providers";

type ProvidersPageProps = {
  providers: Provider[];
  isLoading: boolean;
  onCreateProvider: (provider: ProviderCreateRequest) => Promise<void>;
};

const TENANT_KEY = "apex-health-plan";

const NETWORK_LABELS: Record<string, string> = {
  in_network: "In Network",
  out_of_network: "Out of Network",
};

function networkChip(status: string) {
  return status === "in_network"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-[#fdeceb] text-[#c94b41]";
}

const EMPTY_FORM: ProviderCreateRequest = {
  tenant_key: TENANT_KEY,
  provider_key: "",
  name: "",
  npi: "",
  specialty: "",
  network_status: "in_network",
};

export function ProvidersPage({ providers, isLoading, onCreateProvider }: ProvidersPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProviderCreateRequest>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function setField<K extends keyof ProviderCreateRequest>(key: K, value: ProviderCreateRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !(form.npi ?? "").trim() || !form.provider_key.trim()) {
      setFormError("Name, NPI, and Provider Key are required.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onCreateProvider(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create provider.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
            Tenant: Apex Health Plan
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2a3439]">Providers</h2>
          <p className="mt-1 text-sm font-medium text-[#566166]">
            Tenant-scoped provider registry. Providers are linked automatically when claims are processed.
          </p>
        </div>
        <button
          className="flex shrink-0 items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-5 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
          onClick={() => setShowForm((v) => !v)}
          type="button"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Provider
        </button>
      </div>

      {/* ── Add Provider Form ── */}
      {showForm && (
        <div className="rounded-sm border border-[#0053dc]/20 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#2a3439]">New Provider</h3>
            <button
              className="text-[10px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc]"
              onClick={() => { setShowForm(false); setFormError(null); }}
              type="button"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "name" as const, label: "Provider Name", placeholder: "Front Range Family Medicine" },
              { key: "npi" as const, label: "NPI", placeholder: "1299304491" },
              { key: "provider_key" as const, label: "Provider Key", placeholder: "prv-4092" },
              { key: "specialty" as const, label: "Specialty", placeholder: "Family Medicine" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
                  {label}
                </label>
                <input
                  className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  type="text"
                  value={form[key] ?? ""}
                />
              </div>
            ))}

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
                Network Status
              </label>
              <div className="flex gap-2">
                {(["in_network", "out_of_network"] as const).map((s) => (
                  <button
                    className={`flex-1 rounded-sm py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      form.network_status === s
                        ? s === "in_network"
                          ? "bg-emerald-500 text-white"
                          : "bg-[#9f403d] text-white"
                        : "border border-[rgba(169,180,185,0.3)] bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    key={s}
                    onClick={() => setField("network_status", s)}
                    type="button"
                  >
                    {s === "in_network" ? "In Network" : "Out of Network"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {formError && (
            <p className="mt-4 rounded-sm bg-[#fdeceb] px-3 py-2 text-xs font-semibold text-[#752121]">
              {formError}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              className="rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
              type="button"
            >
              {isSubmitting ? "Creating..." : "Create Provider"}
            </button>
          </div>
        </div>
      )}

      {/* ── Providers Table ── */}
      <div className="overflow-hidden rounded-sm border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between border-b border-[rgba(169,180,185,0.1)] bg-slate-50 px-6 py-4">
          <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
            Provider Registry
          </h3>
          <span className="text-[10px] font-bold uppercase text-[#566166]">
            {providers.length} {providers.length === 1 ? "provider" : "providers"}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading providers...
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#f0f4f7]">
              <span className="material-symbols-outlined text-2xl text-[#566166]">groups</span>
            </div>
            <p className="text-sm font-semibold text-[#2a3439]">No providers registered</p>
            <p className="text-[11px] text-slate-400">
              Add a provider above, or process a claim — providers are auto-linked on ingestion.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[rgba(169,180,185,0.1)] bg-slate-50/50">
                {["Provider", "NPI", "Specialty", "Network Status", "Provider Key"].map((h) => (
                  <th
                    className="px-6 py-3 text-[9px] font-extrabold uppercase tracking-widest text-[#566166]"
                    key={h}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {providers.map((p) => (
                <tr className="transition-colors hover:bg-slate-50/50" key={p.provider_key}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-[#2a3439]">{p.name}</p>
                    <p className="text-[10px] text-[#566166]">{p.tenant_key}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs text-[#2a3439]">{p.npi}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-[#566166]">{p.specialty}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-sm px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${networkChip(p.network_status)}`}
                    >
                      {NETWORK_LABELS[p.network_status] ?? p.network_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-[11px] text-slate-400">{p.provider_key}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
