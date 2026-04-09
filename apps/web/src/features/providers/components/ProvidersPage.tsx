import { useState } from "react";
import type { Provider, ProviderCreateRequest } from "../../../shared/api/providers";

type ProvidersPageProps = {
  providers: Provider[];
  isLoading: boolean;
  onCreateProvider: (provider: ProviderCreateRequest) => Promise<void>;
};

const TENANT_KEY = "apex-health-plan";

// ─────────────────────────────────────────────────────────────
// Form state — flat strings for list fields; converted on submit
// ─────────────────────────────────────────────────────────────
type ProviderFormState = {
  tenant_key: string;
  provider_key: string;
  name: string;
  npi: string;
  tin: string;
  taxonomy_code: string;
  specialty: string;
  subspecialty: string;
  network_status: "in_network" | "out_of_network" | "pending";
  contract_tier: string;
  contract_status: "active" | "inactive" | "pending";
  credential_status: "credentialed" | "provisional" | "sanctioned" | "pending";
  plan_participation_raw: string;
  facility_affiliations_raw: string;
  service_locations_raw: string;
  accepting_referrals: boolean;
  surgical_privileges: boolean;
};

const EMPTY_FORM: ProviderFormState = {
  tenant_key: TENANT_KEY,
  provider_key: "",
  name: "",
  npi: "",
  tin: "",
  taxonomy_code: "",
  specialty: "",
  subspecialty: "",
  network_status: "in_network",
  contract_tier: "",
  contract_status: "active",
  credential_status: "credentialed",
  plan_participation_raw: "",
  facility_affiliations_raw: "",
  service_locations_raw: "",
  accepting_referrals: true,
  surgical_privileges: false,
};

function formToRequest(f: ProviderFormState): ProviderCreateRequest {
  return {
    tenant_key: f.tenant_key,
    provider_key: f.provider_key,
    name: f.name,
    npi: f.npi || null,
    tin: f.tin || null,
    taxonomy_code: f.taxonomy_code || null,
    specialty: f.specialty || null,
    subspecialty: f.subspecialty || null,
    network_status: f.network_status,
    contract_tier: f.contract_tier || null,
    contract_status: f.contract_status,
    credential_status: f.credential_status,
    plan_participation: f.plan_participation_raw.split(",").map((s) => s.trim()).filter(Boolean),
    facility_affiliations: f.facility_affiliations_raw.split(",").map((s) => s.trim()).filter(Boolean),
    service_locations: f.service_locations_raw.split(",").map((s) => s.trim()).filter(Boolean),
    accepting_referrals: f.accepting_referrals,
    surgical_privileges: f.surgical_privileges,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function networkChip(status: string) {
  if (status === "in_network") return "bg-emerald-50 text-emerald-700";
  if (status === "out_of_network") return "bg-[#fdeceb] text-[#c94b41]";
  return "bg-amber-50 text-amber-700";
}
function networkLabel(status: string) {
  if (status === "in_network") return "In Network";
  if (status === "out_of_network") return "Out of Network";
  return "Pending";
}

function credentialChip(status: string | null | undefined) {
  if (status === "credentialed") return "bg-emerald-50 text-emerald-700";
  if (status === "provisional") return "bg-amber-50 text-amber-700";
  if (status === "sanctioned") return "bg-[#fdeceb] text-[#c94b41]";
  return "bg-slate-100 text-slate-500";
}
function credentialLabel(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function contractChip(status: string | null | undefined) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "inactive") return "bg-[#fdeceb] text-[#c94b41]";
  return "bg-amber-50 text-amber-700";
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-[#566166]">{label}</p>
      <p className="text-[11px] font-medium text-[#2a3439]">{value}</p>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-[#566166]">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            className="rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-[#2a3439]"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ToggleFlag({ label, value, icon }: { label: string; value: boolean; icon: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-sm px-2 py-1 ${value ? "bg-emerald-50" : "bg-slate-50"}`}>
      <span
        className={`material-symbols-outlined text-[12px] ${value ? "text-emerald-600" : "text-slate-400"}`}
        style={{ fontVariationSettings: `'FILL' 1` }}
      >
        {icon}
      </span>
      <span className={`text-[10px] font-bold uppercase tracking-wide ${value ? "text-emerald-700" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ProviderDetail — expanded panel for a selected provider
// ─────────────────────────────────────────────────────────────
function ProviderDetail({ provider }: { provider: Provider }) {
  return (
    <div className="border-t border-[rgba(169,180,185,0.12)] bg-[#f8fafc] px-6 py-5">
      <div className="grid grid-cols-3 gap-6">
        {/* Column 1: Identity */}
        <div className="space-y-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0053dc]">Identity</p>
          <InfoRow label="NPI" value={provider.npi} />
          <InfoRow label="TIN" value={provider.tin} />
          <InfoRow label="Taxonomy Code" value={provider.taxonomy_code} />
          <InfoRow label="Specialty" value={provider.specialty} />
          <InfoRow label="Subspecialty" value={provider.subspecialty} />
          <InfoRow label="Provider Key" value={provider.provider_key} />
        </div>

        {/* Column 2: Network & Contract */}
        <div className="space-y-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0053dc]">Network & Contract</p>
          <div>
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-[#566166]">Network Status</p>
            <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${networkChip(provider.network_status)}`}>
              {networkLabel(provider.network_status)}
            </span>
          </div>
          {provider.contract_status && (
            <div>
              <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-[#566166]">Contract Status</p>
              <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${contractChip(provider.contract_status)}`}>
                {provider.contract_status}
              </span>
            </div>
          )}
          {provider.contract_tier && <InfoRow label="Contract Tier" value={provider.contract_tier} />}
          {provider.credential_status && (
            <div>
              <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-[#566166]">Credential Status</p>
              <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${credentialChip(provider.credential_status)}`}>
                {credentialLabel(provider.credential_status)}
              </span>
            </div>
          )}
          {(provider.network_effective_date || provider.network_end_date) && (
            <InfoRow
              label="Coverage Window"
              value={`${provider.network_effective_date ?? "—"} → ${provider.network_end_date ?? "Open"}`}
            />
          )}
          <TagList label="Plan Participation" items={provider.plan_participation} />
        </div>

        {/* Column 3: Clinical */}
        <div className="space-y-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0053dc]">Clinical</p>
          <div className="flex flex-wrap gap-2">
            <ToggleFlag label="Accepting Referrals" value={provider.accepting_referrals ?? true} icon="person_add" />
            <ToggleFlag label="Surgical Privileges" value={provider.surgical_privileges ?? false} icon="surgical" />
          </div>
          <TagList label="Facility Affiliations" items={provider.facility_affiliations} />
          <TagList label="Service Locations" items={provider.service_locations} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FormSection
// ─────────────────────────────────────────────────────────────
function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0053dc]">{label}</p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ProvidersPage
// ─────────────────────────────────────────────────────────────
export function ProvidersPage({ providers, isLoading, onCreateProvider }: ProvidersPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProviderFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function setField<K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.provider_key.trim()) {
      setFormError("Provider Name and Provider Key are required.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onCreateProvider(formToRequest(form));
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create provider.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]";
  const selectCls = inputCls;

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
            Tenant-scoped provider registry with taxonomy, credentials, and clinical context.
          </p>
        </div>
        <button
          className="flex shrink-0 items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-5 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
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

          <div className="space-y-6">
            {/* Identity */}
            <FormSection label="Identity">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  { key: "name" as const, label: "Provider Name *", placeholder: "Front Range Family Medicine" },
                  { key: "provider_key" as const, label: "Provider Key *", placeholder: "prv-4092" },
                  { key: "npi" as const, label: "NPI", placeholder: "1299304491" },
                  { key: "tin" as const, label: "TIN", placeholder: "84-1234567" },
                  { key: "taxonomy_code" as const, label: "Taxonomy Code", placeholder: "207Q00000X" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">{label}</label>
                    <input
                      className={inputCls}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={placeholder}
                      type="text"
                      value={form[key]}
                    />
                  </div>
                ))}
              </div>
            </FormSection>

            {/* Specialty */}
            <FormSection label="Specialty">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Specialty</label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("specialty", e.target.value)}
                    placeholder="Family Medicine"
                    type="text"
                    value={form.specialty}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Subspecialty</label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("subspecialty", e.target.value)}
                    placeholder="Sports Medicine"
                    type="text"
                    value={form.subspecialty}
                  />
                </div>
              </div>
            </FormSection>

            {/* Network & Contract */}
            <FormSection label="Network & Contract">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Network Status */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Network Status</label>
                  <div className="flex gap-2">
                    {(["in_network", "out_of_network"] as const).map((s) => (
                      <button
                        className={`flex-1 rounded-sm py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                          form.network_status === s
                            ? s === "in_network" ? "bg-emerald-500 text-white" : "bg-[#9f403d] text-white"
                            : "border border-[rgba(169,180,185,0.3)] bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                        key={s}
                        onClick={() => setField("network_status", s)}
                        type="button"
                      >
                        {s === "in_network" ? "In Net" : "Out"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contract Status */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Contract Status</label>
                  <select
                    className={selectCls}
                    onChange={(e) => setField("contract_status", e.target.value as ProviderFormState["contract_status"])}
                    value={form.contract_status}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {/* Credential Status */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Credential Status</label>
                  <select
                    className={selectCls}
                    onChange={(e) => setField("credential_status", e.target.value as ProviderFormState["credential_status"])}
                    value={form.credential_status}
                  >
                    <option value="credentialed">Credentialed</option>
                    <option value="provisional">Provisional</option>
                    <option value="sanctioned">Sanctioned</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {/* Contract Tier */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Contract Tier</label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("contract_tier", e.target.value)}
                    placeholder="Tier 1"
                    type="text"
                    value={form.contract_tier}
                  />
                </div>
              </div>
            </FormSection>

            {/* Clinical */}
            <FormSection label="Clinical">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Plan Participation <span className="normal-case text-slate-300">(comma-separated)</span></label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("plan_participation_raw", e.target.value)}
                    placeholder="Commercial PPO 500, HMO Gold"
                    type="text"
                    value={form.plan_participation_raw}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Facility Affiliations <span className="normal-case text-slate-300">(comma-separated)</span></label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("facility_affiliations_raw", e.target.value)}
                    placeholder="Memorial Hospital, Sunrise Clinic"
                    type="text"
                    value={form.facility_affiliations_raw}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-[#566166]">Service Locations <span className="normal-case text-slate-300">(comma-separated)</span></label>
                  <input
                    className={inputCls}
                    onChange={(e) => setField("service_locations_raw", e.target.value)}
                    placeholder="Denver CO, Boulder CO"
                    type="text"
                    value={form.service_locations_raw}
                  />
                </div>
                <div className="flex gap-3">
                  {/* Accepting Referrals toggle */}
                  <button
                    className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-bold transition-colors ${
                      form.accepting_referrals
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-[rgba(169,180,185,0.3)] bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                    onClick={() => setField("accepting_referrals", !form.accepting_referrals)}
                    type="button"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: `'FILL' ${form.accepting_referrals ? 1 : 0}` }}
                    >
                      person_add
                    </span>
                    Accepting Referrals
                  </button>
                  {/* Surgical Privileges toggle */}
                  <button
                    className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-bold transition-colors ${
                      form.surgical_privileges
                        ? "border-[#0053dc] bg-[#eef4ff] text-[#0053dc]"
                        : "border-[rgba(169,180,185,0.3)] bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                    onClick={() => setField("surgical_privileges", !form.surgical_privileges)}
                    type="button"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: `'FILL' ${form.surgical_privileges ? 1 : 0}` }}
                    >
                      surgical
                    </span>
                    Surgical Privileges
                  </button>
                </div>
              </div>
            </FormSection>
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

      {/* ── Provider Registry ── */}
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
          <div className="divide-y divide-slate-50">
            {providers.map((p) => {
              const isExpanded = expandedKey === p.provider_key;
              return (
                <div key={p.provider_key}>
                  {/* Collapsed row */}
                  <button
                    className="w-full cursor-pointer px-6 py-4 text-left transition-colors hover:bg-slate-50/60"
                    onClick={() => setExpandedKey(isExpanded ? null : p.provider_key)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      {/* Name + taxonomy */}
                      <div className="min-w-[180px] flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#2a3439]">{p.name}</p>
                          {p.taxonomy_code && (
                            <span className="rounded-sm bg-[#eef4ff] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#0053dc]">
                              {p.taxonomy_code}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#566166]">
                          {[p.specialty, p.subspecialty].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>

                      {/* Status chips */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${networkChip(p.network_status)}`}>
                          {networkLabel(p.network_status)}
                        </span>
                        {p.credential_status && (
                          <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${credentialChip(p.credential_status)}`}>
                            {credentialLabel(p.credential_status)}
                          </span>
                        )}
                        {p.contract_status && p.contract_status !== "active" && (
                          <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${contractChip(p.contract_status)}`}>
                            Contract: {p.contract_status}
                          </span>
                        )}
                        {p.accepting_referrals === false && (
                          <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                            Not Accepting Referrals
                          </span>
                        )}
                        {p.surgical_privileges && (
                          <span className="rounded-sm bg-[#eef4ff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0053dc]">
                            Surgical
                          </span>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <span
                        className={`material-symbols-outlined ml-auto shrink-0 text-sm text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        expand_more
                      </span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && <ProviderDetail provider={p} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
