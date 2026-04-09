import { useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Mock data — shaped around live Apex Health Plan corpus
// ─────────────────────────────────────────────────────────────

type PolicyDoc = {
  id: string;
  title: string;
  payer: string;
  classification: string;
  effective_date: string;
  review_date: string;
  status: "active" | "archived";
  chunk_count: number;
  sections: { heading: string; body: string; highlight?: boolean }[];
};

const POLICIES: PolicyDoc[] = [
  {
    id: "APX-PRIORAUTH-ORTHO-2026",
    title: "Prior Authorization — Orthopedic Surgery",
    payer: "Apex Health Plan",
    classification: "prior_auth",
    effective_date: "2026-01-01",
    review_date: "2026-12-31",
    status: "active",
    chunk_count: 12,
    sections: [
      {
        heading: "Purpose & Scope",
        body: "This policy establishes prior authorization requirements for orthopedic surgical procedures billed under Apex Medicare Advantage Choice and Apex Commercial PPO plans. It applies to all participating providers submitting professional claims for musculoskeletal surgery.",
      },
      {
        heading: "Covered Procedures Requiring Authorization",
        body: "The following CPT codes require prior authorization under all Apex plans:\n\n• 27447 — Total Knee Arthroplasty (TKA)\n• 27130 — Total Hip Arthroplasty (THA)\n• 29827 — Arthroscopic Rotator Cuff Repair\n• 22612 — Lumbar Fusion\n• 27236 — ORIF Femoral Neck Fracture",
        highlight: true,
      },
      {
        heading: "Clinical Authorization Criteria",
        body: "Authorization for total knee arthroplasty (CPT 27447) requires documented evidence of:\n\n1. Radiographic confirmation of advanced osteoarthritis (Kellgren-Lawrence grade III or IV)\n2. Failure of at least 6 months of conservative management including physical therapy, NSAIDs, and/or corticosteroid injections\n3. Functional limitation score documented on a validated instrument (KOOS, Oxford Knee Score)\n4. BMI screening and optimization plan if BMI > 40\n\nRequests without complete clinical documentation will be pended for additional information.",
        highlight: true,
      },
      {
        heading: "Submission Requirements",
        body: "Authorization requests must be submitted via the Apex Provider Portal or by fax to the Utilization Management department at least 72 hours prior to elective procedures. Urgent requests will be processed within 24 hours. The authorization number issued must appear on the claim at box 23 of the CMS-1500 form.",
      },
      {
        heading: "Duration & Validity",
        body: "Approved authorizations are valid for 90 days from the date of issuance. Procedures not performed within this window require re-authorization. Extensions may be requested with documented clinical justification.",
      },
      {
        heading: "Exceptions & Appeals",
        body: "Emergency surgical procedures are exempt from pre-authorization requirements. Retrospective review will apply. Denied authorizations may be appealed within 60 days of the denial notice by submitting additional clinical documentation to the Apex Appeals Unit.",
      },
    ],
  },
  {
    id: "APX-COM-500-EM-99213",
    title: "Evaluation & Management — CPT 99213 Coverage",
    payer: "Apex Health Plan",
    classification: "reimbursement",
    effective_date: "2026-01-01",
    review_date: "2026-06-30",
    status: "active",
    chunk_count: 8,
    sections: [
      {
        heading: "Purpose",
        body: "This policy defines reimbursement parameters for Evaluation & Management services at the office or outpatient setting, specifically CPT code 99213 for established patients.",
      },
      {
        heading: "Coverage Criteria",
        body: "CPT 99213 is covered for established patients requiring a medically appropriate history, examination, and medical decision making of low complexity. The encounter must be documented in accordance with AMA/CPT 2021 E/M guidelines.",
        highlight: true,
      },
      {
        heading: "Allowed Amount",
        body: "The Apex Medicare Advantage allowed amount for CPT 99213 is $112.00 at Place of Service 11 (office). Commercial PPO plans reimburse at 85% of the Medicare Physician Fee Schedule rate. Contracted rates supersede schedule amounts for Tier 1 network providers.",
      },
      {
        heading: "Modifier Rules",
        body: "Modifier 25 may be appended when a significant, separately identifiable E/M service is performed on the same day as a procedure. Modifier 57 applies when the E/M results in the decision to perform major surgery. Both modifiers require supporting documentation.",
      },
    ],
  },
  {
    id: "APX-NET-TIER1-PROF-2026",
    title: "Network Tier 1 — Professional Services",
    payer: "Apex Health Plan",
    classification: "network_policy",
    effective_date: "2026-01-01",
    review_date: "2026-12-31",
    status: "active",
    chunk_count: 15,
    sections: [
      {
        heading: "Network Tier Structure",
        body: "Apex Health Plan maintains a tiered network for professional services. Tier 1 providers have signed a direct participation agreement and are subject to contracted fee schedules. Tier 2 providers are accessible at higher member cost-sharing.",
      },
      {
        heading: "Tier 1 Eligibility Requirements",
        body: "Providers qualify for Tier 1 status by meeting credentialing standards, executing a participation agreement with Apex, maintaining active hospital affiliations, and passing annual re-credentialing. Specialty alignment with the Apex taxonomy is required.",
        highlight: true,
      },
      {
        heading: "Reimbursement Differential",
        body: "Tier 1 professional services are reimbursed at 100% of the contracted fee schedule. Non-participating (out-of-network) services are reimbursed at 60% of the Medicare Physician Fee Schedule, applied to the member's out-of-network benefit.",
      },
    ],
  },
  {
    id: "APX-POS-11-PROF-2026",
    title: "Place of Service 11 — Professional Outpatient",
    payer: "Apex Health Plan",
    classification: "site_of_care",
    effective_date: "2026-01-01",
    review_date: "2026-12-31",
    status: "active",
    chunk_count: 10,
    sections: [
      {
        heading: "Applicable Place of Service",
        body: "This policy governs claims submitted with Place of Service code 11 (Office). Professional services rendered in an office setting are subject to the office-based fee schedule, which differs from facility-based rates.",
        highlight: true,
      },
      {
        heading: "Billing Requirements",
        body: "POS 11 claims must reflect services rendered in a dedicated clinical office space. Rendering provider must be physically present unless telemedicine modifiers (95, GT) are appended per the Apex Telehealth Policy.",
      },
    ],
  },
  {
    id: "APX-REFERRAL-CARDIO-2026",
    title: "Cardiology Referral Requirements",
    payer: "Apex Health Plan",
    classification: "referral",
    effective_date: "2026-01-01",
    review_date: "2026-09-30",
    status: "active",
    chunk_count: 9,
    sections: [
      {
        heading: "Referral Requirement",
        body: "Apex HMO and EPO products require a primary care physician referral for cardiology specialty services. Medicare Advantage Choice plans do not require referral but do require coordination through the Apex care management team for high-cost cardiac procedures.",
        highlight: true,
      },
      {
        heading: "Covered Cardiology Services",
        body: "Referral-eligible cardiology services include diagnostic catheterization, echocardiography, nuclear stress testing, and electrophysiology studies. Routine ECG interpretation does not require referral.",
      },
    ],
  },
  {
    id: "APX-CRED-SPECIALTY-2026",
    title: "Provider Credentialing & Specialty Taxonomy",
    payer: "Apex Health Plan",
    classification: "credentialing",
    effective_date: "2025-07-01",
    review_date: "2026-06-30",
    status: "archived",
    chunk_count: 6,
    sections: [
      {
        heading: "Credentialing Standards",
        body: "This policy establishes minimum credentialing standards for professional providers seeking participation in Apex networks. Standards align with NCQA credentialing requirements.",
      },
    ],
  },
];

type Chunk = {
  chunk_id: string;
  section: string;
  snippet: string;
  relevance: number;
  retrievals_last_30d: number;
};

const CHUNKS: Record<string, Chunk[]> = {
  "APX-PRIORAUTH-ORTHO-2026": [
    { chunk_id: "CHK-001", section: "Covered Procedures Requiring Authorization", snippet: "CPT 27447 — Total Knee Arthroplasty (TKA) requires prior authorization under all Apex plans.", relevance: 0.97, retrievals_last_30d: 14 },
    { chunk_id: "CHK-002", section: "Clinical Authorization Criteria", snippet: "Authorization requires radiographic confirmation of advanced osteoarthritis (Kellgren-Lawrence grade III or IV) and failure of at least 6 months of conservative management.", relevance: 0.94, retrievals_last_30d: 11 },
    { chunk_id: "CHK-003", section: "Submission Requirements", snippet: "Authorization number must appear on the claim at box 23 of the CMS-1500 form.", relevance: 0.88, retrievals_last_30d: 8 },
    { chunk_id: "CHK-004", section: "Exceptions & Appeals", snippet: "Emergency surgical procedures are exempt from pre-authorization requirements. Retrospective review will apply.", relevance: 0.72, retrievals_last_30d: 3 },
  ],
  "APX-COM-500-EM-99213": [
    { chunk_id: "CHK-010", section: "Coverage Criteria", snippet: "CPT 99213 is covered for established patients requiring medical decision making of low complexity per AMA/CPT 2021 E/M guidelines.", relevance: 0.96, retrievals_last_30d: 22 },
    { chunk_id: "CHK-011", section: "Allowed Amount", snippet: "Apex Medicare Advantage allowed amount for CPT 99213 is $112.00 at Place of Service 11.", relevance: 0.89, retrievals_last_30d: 17 },
    { chunk_id: "CHK-012", section: "Modifier Rules", snippet: "Modifier 25 may be appended when a significant, separately identifiable E/M service is performed on the same day as a procedure.", relevance: 0.81, retrievals_last_30d: 9 },
  ],
  "APX-NET-TIER1-PROF-2026": [
    { chunk_id: "CHK-020", section: "Tier 1 Eligibility Requirements", snippet: "Providers qualify for Tier 1 status by executing a participation agreement with Apex and passing annual re-credentialing.", relevance: 0.92, retrievals_last_30d: 18 },
    { chunk_id: "CHK-021", section: "Reimbursement Differential", snippet: "Tier 1 professional services are reimbursed at 100% of the contracted fee schedule.", relevance: 0.85, retrievals_last_30d: 12 },
  ],
  "APX-POS-11-PROF-2026": [
    { chunk_id: "CHK-030", section: "Applicable Place of Service", snippet: "Professional services rendered with POS 11 are subject to the office-based fee schedule.", relevance: 0.91, retrievals_last_30d: 16 },
  ],
  "APX-REFERRAL-CARDIO-2026": [
    { chunk_id: "CHK-040", section: "Referral Requirement", snippet: "Apex HMO and EPO products require a PCP referral for cardiology specialty services.", relevance: 0.93, retrievals_last_30d: 7 },
  ],
  "APX-CRED-SPECIALTY-2026": [
    { chunk_id: "CHK-050", section: "Credentialing Standards", snippet: "Minimum credentialing standards align with NCQA credentialing requirements.", relevance: 0.78, retrievals_last_30d: 2 },
  ],
};

type ClaimMatch = {
  claim_id: string;
  member: string;
  date: string;
  outcome: "approve" | "deny" | "review";
  cpt: string;
  relevance_reason: string;
};

const CLAIM_MATCHES: Record<string, ClaimMatch[]> = {
  "APX-PRIORAUTH-ORTHO-2026": [
    { claim_id: "OCR-CLM-ORTHO-3001", member: "Harold Bennett", date: "2026-04-21", outcome: "review", cpt: "27447", relevance_reason: "Missing prior authorization number — policy matched for utilization review trigger" },
    { claim_id: "CLM-20260315-0042", member: "Robert Simmons", date: "2026-03-15", outcome: "approve", cpt: "27447", relevance_reason: "Prior auth PA-20260315-004 verified — policy matched and satisfied" },
    { claim_id: "CLM-20260208-0019", member: "Patricia Walsh", date: "2026-02-08", outcome: "deny", cpt: "29827", relevance_reason: "Authorization expired — policy matched, auth validity window exceeded" },
  ],
  "APX-COM-500-EM-99213": [
    { claim_id: "CLM-20260327-0001", member: "Elena Martinez", date: "2026-03-27", outcome: "approve", cpt: "99213", relevance_reason: "Office visit E/M — policy matched for coverage and reimbursement rate" },
    { claim_id: "CLM-20260310-0033", member: "James Okafor", date: "2026-03-10", outcome: "approve", cpt: "99213", relevance_reason: "Established patient visit — policy matched, low-complexity MDM confirmed" },
  ],
  "APX-NET-TIER1-PROF-2026": [
    { claim_id: "OCR-CLM-ORTHO-3001", member: "Harold Bennett", date: "2026-04-21", outcome: "review", cpt: "27447", relevance_reason: "Rocky Mountain Orthopedics verified as Tier 1 in-network provider" },
    { claim_id: "CLM-20260327-0001", member: "Elena Martinez", date: "2026-03-27", outcome: "approve", cpt: "99213", relevance_reason: "Front Range Family Medicine confirmed Tier 1 participation" },
  ],
  "APX-POS-11-PROF-2026": [
    { claim_id: "CLM-20260327-0001", member: "Elena Martinez", date: "2026-03-27", outcome: "approve", cpt: "99213", relevance_reason: "POS 11 confirmed — office-based fee schedule applied" },
  ],
  "APX-REFERRAL-CARDIO-2026": [],
  "APX-CRED-SPECIALTY-2026": [],
};

const COVERAGE_DOMAINS = [
  { domain: "Prior Authorization", status: "covered", policy_count: 1, policies: ["APX-PRIORAUTH-ORTHO-2026"] },
  { domain: "Network / Tier", status: "covered", policy_count: 1, policies: ["APX-NET-TIER1-PROF-2026"] },
  { domain: "Site of Care", status: "covered", policy_count: 1, policies: ["APX-POS-11-PROF-2026"] },
  { domain: "Reimbursement", status: "covered", policy_count: 1, policies: ["APX-COM-500-EM-99213"] },
  { domain: "Referral", status: "partial", policy_count: 1, policies: ["APX-REFERRAL-CARDIO-2026"] },
  { domain: "Credentialing", status: "partial", policy_count: 1, policies: ["APX-CRED-SPECIALTY-2026"] },
  { domain: "Corrected Claims", status: "gap", policy_count: 0, policies: [] },
  { domain: "COB / Coordination", status: "gap", policy_count: 0, policies: [] },
];

const MOCK_QUERY_RESULTS: Record<string, { answer: string; chunks: { policy: string; section: string; snippet: string }[] }> = {
  default: {
    answer: "No matching policy found for that query. Try asking about prior authorization, CPT codes, network tier, or site of care requirements.",
    chunks: [],
  },
  "cpt 27447": {
    answer: "CPT 27447 (Total Knee Arthroplasty) requires prior authorization under all Apex Medicare Advantage and Commercial PPO plans. The request must be submitted at least 72 hours before the procedure. Clinical documentation including radiographic evidence of advanced osteoarthritis and failure of conservative management is required.",
    chunks: [
      { policy: "APX-PRIORAUTH-ORTHO-2026", section: "Covered Procedures Requiring Authorization", snippet: "CPT 27447 — Total Knee Arthroplasty (TKA) requires prior authorization under all Apex plans." },
      { policy: "APX-PRIORAUTH-ORTHO-2026", section: "Clinical Authorization Criteria", snippet: "Authorization requires radiographic confirmation of advanced osteoarthritis and failure of at least 6 months of conservative management." },
      { policy: "APX-NET-TIER1-PROF-2026", section: "Tier 1 Eligibility Requirements", snippet: "Orthopedic surgery providers must maintain active Tier 1 participation and hospital surgical privileges." },
    ],
  },
  "prior auth": {
    answer: "Prior authorization is required for orthopedic surgical procedures including CPT 27447, 27130, 29827, and others under Apex Health Plan. Requests must be submitted via the Apex Provider Portal or fax at least 72 hours before elective procedures. Authorization numbers must appear on the CMS-1500 claim form at Box 23.",
    chunks: [
      { policy: "APX-PRIORAUTH-ORTHO-2026", section: "Submission Requirements", snippet: "Authorization requests must be submitted at least 72 hours prior to elective procedures." },
      { policy: "APX-PRIORAUTH-ORTHO-2026", section: "Covered Procedures Requiring Authorization", snippet: "The following CPT codes require prior authorization under all Apex plans." },
    ],
  },
  "corrected claim": {
    answer: "No specific corrected claims policy is currently indexed in the Apex knowledge repository. This is identified as a coverage gap. Claims using frequency code 7 or 8 (corrected/replacement) should reference the payer claim control number and follow standard EDI 837 guidelines pending policy ingestion.",
    chunks: [],
  },
  "cardiology referral": {
    answer: "Apex HMO and EPO products require a primary care physician referral for cardiology specialty services. Medicare Advantage Choice plans do not require a referral but require care management coordination for high-cost cardiac procedures.",
    chunks: [
      { policy: "APX-REFERRAL-CARDIO-2026", section: "Referral Requirement", snippet: "Apex HMO and EPO products require a PCP referral for cardiology specialty services." },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const CLASS_META: Record<string, { label: string; color: string; dot: string }> = {
  prior_auth:    { label: "Prior Auth",    color: "bg-amber-50 text-amber-700",    dot: "bg-amber-400" },
  reimbursement: { label: "Reimbursement", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  network_policy:{ label: "Network",       color: "bg-[#eef4ff] text-[#0053dc]",   dot: "bg-[#0053dc]" },
  site_of_care:  { label: "Site of Care",  color: "bg-purple-50 text-purple-700",  dot: "bg-purple-400" },
  referral:      { label: "Referral",      color: "bg-indigo-50 text-indigo-700",  dot: "bg-indigo-400" },
  credentialing: { label: "Credentialing", color: "bg-slate-100 text-slate-600",   dot: "bg-slate-400" },
};

const OUTCOME_STYLE: Record<string, string> = {
  approve: "bg-emerald-50 text-emerald-700",
  deny:    "bg-[#fdeceb] text-[#c94b41]",
  review:  "bg-amber-50 text-amber-700",
};

function ClassBadge({ cls }: { cls: string }) {
  const meta = CLASS_META[cls] ?? { label: cls, color: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function RelevanceBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#0053dc]" style={{ width: `${score * 100}%` }} />
      </div>
      <span className="text-[9px] font-bold text-slate-400">{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0053dc]">{children}</p>
  );
}

// ─────────────────────────────────────────────────────────────
// KnowledgeStudioPage
// ─────────────────────────────────────────────────────────────
export function KnowledgeStudioPage() {
  const [selectedId, setSelectedId] = useState("APX-PRIORAUTH-ORTHO-2026");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const queryRef = useRef<HTMLInputElement>(null);

  const selectedPolicy = POLICIES.find((p) => p.id === selectedId)!;
  const chunks = CHUNKS[selectedId] ?? [];
  const claimMatches = CLAIM_MATCHES[selectedId] ?? [];

  const filtered = POLICIES.filter((p) => {
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchClass = !classFilter || p.classification === classFilter;
    return matchSearch && matchClass;
  });

  function resolveQueryResult() {
    const q = query.toLowerCase();
    if (q.includes("27447") || q.includes("knee")) return MOCK_QUERY_RESULTS["cpt 27447"];
    if (q.includes("prior auth") || q.includes("authorization")) return MOCK_QUERY_RESULTS["prior auth"];
    if (q.includes("corrected") || q.includes("frequency")) return MOCK_QUERY_RESULTS["corrected claim"];
    if (q.includes("cardiology") || q.includes("referral")) return MOCK_QUERY_RESULTS["cardiology referral"];
    return MOCK_QUERY_RESULTS["default"];
  }

  function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!queryInput.trim()) return;
    setIsQuerying(true);
    setTimeout(() => {
      setQuery(queryInput.trim());
      setIsQuerying(false);
    }, 700);
  }

  const queryResult = query ? resolveQueryResult() : null;

  const totalChunks = POLICIES.reduce((s, p) => s + p.chunk_count, 0);
  const activeCount = POLICIES.filter((p) => p.status === "active").length;
  const classBreakdown = [...new Set(POLICIES.map((p) => p.classification))].length;

  return (
    <div className="space-y-6">

      {/* ══ Repository Overview ══ */}
      <div
        className="overflow-hidden rounded-sm px-8 py-6"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d4a 100%)" }}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#6ea8fe]">
              Open Knowledge Studio
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
              Apex Health Plan — Policy Corpus
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Read-only knowledge inspection and retrieval validation surface
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-sm bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Repository Healthy
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Policy Documents", value: String(POLICIES.length), icon: "description" },
            { label: "Active Policies", value: String(activeCount), icon: "check_circle" },
            { label: "Indexed Chunks", value: String(totalChunks), icon: "segment" },
            { label: "Classifications", value: String(classBreakdown), icon: "category" },
            { label: "Active Payer", value: "Apex Health Plan", icon: "business" },
            { label: "Last Indexed", value: "Apr 7, 2026", icon: "update" },
          ].map((m) => (
            <div key={m.label} className="rounded-sm bg-white/6 px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-slate-400">{m.icon}</span>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
              </div>
              <p className="text-sm font-bold text-white">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Three-panel: Library | Document | Inspector ══ */}
      <div
        className="grid overflow-hidden rounded-sm bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
        style={{ gridTemplateColumns: "260px 1fr 300px", height: "68vh" }}
      >

        {/* ── Left: Knowledge Library ── */}
        <div className="flex min-h-0 flex-col overflow-hidden border-r border-[rgba(169,180,185,0.12)]">
          <div className="shrink-0 border-b border-[rgba(169,180,185,0.1)] px-4 pt-4 pb-3">
            <SectionLabel>Knowledge Library</SectionLabel>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-300">
                search
              </span>
              <input
                className="w-full rounded-sm border border-[rgba(169,180,185,0.2)] bg-[#f7f9fb] py-1.5 pl-7 pr-3 text-[11px] text-[#2a3439] outline-none placeholder:text-slate-300 focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]/20"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search policies…"
                value={search}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[null, "prior_auth", "reimbursement", "network_policy", "site_of_care", "referral"].map((c) => {
                const meta = c ? CLASS_META[c] : null;
                return (
                  <button
                    key={c ?? "all"}
                    className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                      classFilter === c
                        ? "bg-[#0053dc] text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    onClick={() => setClassFilter(c)}
                    type="button"
                  >
                    {c ? (meta?.label ?? c) : "All"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                className={`w-full border-b border-[rgba(169,180,185,0.08)] px-4 py-3 text-left transition-colors ${
                  selectedId === p.id
                    ? "bg-[#eef4ff]"
                    : "hover:bg-[#f7f9fb]"
                }`}
                onClick={() => setSelectedId(p.id)}
                type="button"
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <ClassBadge cls={p.classification} />
                  {p.status === "archived" && (
                    <span className="text-[8px] font-bold uppercase text-slate-300">Archived</span>
                  )}
                </div>
                <p className={`text-[11px] font-semibold leading-4 ${selectedId === p.id ? "text-[#0053dc]" : "text-[#2a3439]"}`}>
                  {p.title}
                </p>
                <p className="mt-1 text-[9px] text-slate-400">
                  {p.chunk_count} chunks · eff. {p.effective_date}
                </p>
              </button>
            ))}
          </div>

          <div className="shrink-0 border-t border-[rgba(169,180,185,0.1)] px-4 py-3">
            <p className="text-[9px] text-slate-300">{filtered.length} of {POLICIES.length} documents</p>
          </div>
        </div>

        {/* ── Center: Document Reading Panel ── */}
        <div className="flex min-h-0 flex-col overflow-hidden border-r border-[rgba(169,180,185,0.12)]">
          {/* Doc header */}
          <div className="shrink-0 border-b border-[rgba(169,180,185,0.1)] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <ClassBadge cls={selectedPolicy.classification} />
                <h3 className="mt-2 text-base font-bold leading-tight text-[#0f172a]">
                  {selectedPolicy.title}
                </h3>
              </div>
              <span className={`mt-1 shrink-0 rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                selectedPolicy.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                {selectedPolicy.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-slate-400">
              {[
                ["Policy ID", selectedPolicy.id],
                ["Payer", selectedPolicy.payer],
                ["Effective", selectedPolicy.effective_date],
                ["Review", selectedPolicy.review_date],
                ["Chunks", String(selectedPolicy.chunk_count)],
              ].map(([k, v]) => (
                <span key={k}>
                  <span className="font-bold uppercase tracking-wider text-slate-300">{k} </span>
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Doc body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {selectedPolicy.sections.map((sec, i) => (
                <div
                  key={i}
                  className={`rounded-sm p-4 ${
                    sec.highlight
                      ? "border-l-2 border-[#0053dc] bg-[#f5f8ff]"
                      : "bg-[#fafbfc]"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {sec.highlight && (
                      <span
                        className="material-symbols-outlined text-[13px] text-[#0053dc]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        stars
                      </span>
                    )}
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#566166]">
                      {sec.heading}
                    </p>
                  </div>
                  <p className="whitespace-pre-line text-[12px] leading-6 text-[#2a3439]">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Retrieval Inspector + Claim Traceability ── */}
        <div className="flex min-h-0 flex-col overflow-y-auto bg-[#f7f9fb]">

          {/* Retrieval Inspector */}
          <div className="shrink-0 border-b border-[rgba(169,180,185,0.12)] px-5 py-4">
            <SectionLabel>Retrieval Inspector</SectionLabel>
            <p className="mb-3 text-[10px] text-slate-400">Top indexed chunks · ranked by relevance</p>
            <div className="space-y-2.5">
              {chunks.length === 0 ? (
                <p className="text-[11px] text-slate-300">No chunks indexed for this document.</p>
              ) : (
                chunks.map((c) => (
                  <div key={c.chunk_id} className="rounded-sm bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#0053dc]">{c.section}</p>
                      <span className="shrink-0 text-[8px] font-bold text-slate-300">{c.chunk_id}</span>
                    </div>
                    <p className="mb-2 text-[11px] leading-4 text-[#2a3439]">"{c.snippet}"</p>
                    <div className="flex items-center justify-between">
                      <RelevanceBar score={c.relevance} />
                      <span className="text-[9px] text-slate-400">{c.retrievals_last_30d}× / 30d</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Claim Traceability */}
          <div className="px-5 py-4">
            <SectionLabel>Claim Traceability</SectionLabel>
            <p className="mb-3 text-[10px] text-slate-400">Claims matched to this policy</p>
            {claimMatches.length === 0 ? (
              <p className="text-[11px] text-slate-300">No claim matches recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {claimMatches.map((cm) => (
                  <div key={cm.claim_id} className="rounded-sm bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-[#2a3439]">{cm.claim_id}</p>
                      <span className={`rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${OUTCOME_STYLE[cm.outcome]}`}>
                        {cm.outcome}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{cm.member} · CPT {cm.cpt} · {cm.date}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">{cm.relevance_reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Knowledge Query Playground ══ */}
      <div className="overflow-hidden rounded-sm bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[rgba(169,180,185,0.1)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-[#0053dc]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              manage_search
            </span>
            <div>
              <p className="text-sm font-bold text-[#2a3439]">Knowledge Query</p>
              <p className="text-[10px] text-slate-400">Ask the policy corpus a natural-language question</p>
            </div>
            <span className="ml-auto rounded-sm bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">
              Simulated RAG
            </span>
          </div>
        </div>

        <div className="p-6">
          <form className="flex gap-3" onSubmit={handleQuery}>
            <input
              ref={queryRef}
              className="flex-1 rounded-sm border border-[rgba(169,180,185,0.3)] bg-[#f7f9fb] px-4 py-2.5 text-sm text-[#2a3439] outline-none placeholder:text-slate-300 focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]/20"
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="e.g. Does CPT 27447 require prior auth? What governs corrected claims?"
              value={queryInput}
            />
            <button
              className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#003fa8] px-5 py-2.5 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,83,220,0.2)] disabled:opacity-50"
              disabled={!queryInput.trim() || isQuerying}
              type="submit"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isQuerying ? "pending" : "travel_explore"}
              </span>
              {isQuerying ? "Searching…" : "Query"}
            </button>
          </form>

          {/* Suggested queries */}
          {!query && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Does CPT 27447 require prior auth?",
                "What policy governs corrected claims?",
                "What applies to cardiology referral requirements?",
              ].map((s) => (
                <button
                  key={s}
                  className="rounded-full border border-[#0053dc]/15 bg-[#eef4ff] px-3 py-1 text-[10px] font-semibold text-[#0053dc] transition-colors hover:bg-[#0053dc] hover:text-white"
                  onClick={() => { setQueryInput(s); setTimeout(() => queryRef.current?.focus(), 50); }}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Query result */}
          {queryResult && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
              {/* Synthesized answer */}
              <div className="rounded-sm border border-[#0053dc]/10 bg-[#f5f8ff] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[15px] text-[#0053dc]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#0053dc]">
                    Synthesized Answer
                  </p>
                </div>
                <p className="text-[12px] leading-6 text-[#2a3439]">
                  {queryResult.answer}
                </p>
                <p className="mt-3 text-[9px] text-slate-400">
                  Query: "{query}"
                </p>
              </div>

              {/* Matched chunks */}
              <div>
                <p className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                  Matched Policy Sections
                </p>
                {queryResult.chunks.length === 0 ? (
                  <p className="text-[11px] text-slate-300">No matching chunks found.</p>
                ) : (
                  <div className="space-y-2">
                    {queryResult.chunks.map((c, i) => (
                      <div key={i} className="rounded-sm border border-[rgba(169,180,185,0.15)] bg-white p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#0053dc]">{c.section}</p>
                        <p className="mt-0.5 text-[9px] text-slate-400">{c.policy}</p>
                        <p className="mt-1.5 text-[11px] leading-4 text-[#2a3439]">"{c.snippet}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Coverage / Domain Map ══ */}
      <div className="rounded-sm bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[rgba(169,180,185,0.1)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-[#0053dc]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              grid_view
            </span>
            <div>
              <p className="text-sm font-bold text-[#2a3439]">Coverage Map</p>
              <p className="text-[10px] text-slate-400">Policy domain coverage across the Apex corpus</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[rgba(169,180,185,0.1)] sm:grid-cols-4 lg:grid-cols-8">
          {COVERAGE_DOMAINS.map((d) => (
            <div
              key={d.domain}
              className={`flex flex-col gap-2 bg-white px-4 py-4 ${
                d.status === "covered" ? "" : d.status === "partial" ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    d.status === "covered"
                      ? "text-emerald-500"
                      : d.status === "partial"
                      ? "text-amber-500"
                      : "text-slate-300"
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {d.status === "covered" ? "check_circle" : d.status === "partial" ? "pending" : "radio_button_unchecked"}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                  d.status === "covered" ? "text-emerald-600" : d.status === "partial" ? "text-amber-600" : "text-slate-300"
                }`}>
                  {d.status === "covered" ? "Covered" : d.status === "partial" ? "Partial" : "Gap"}
                </span>
              </div>
              <p className="text-[11px] font-bold leading-4 text-[#2a3439]">{d.domain}</p>
              <p className="text-[9px] text-slate-400">
                {d.policy_count > 0 ? `${d.policy_count} polic${d.policy_count !== 1 ? "ies" : "y"}` : "Not indexed"}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
