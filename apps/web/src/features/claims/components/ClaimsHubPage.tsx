import type { ClaimRecordSummary, ClaimsFilter } from "../../../shared/api/claims";

type ClaimsHubPageProps = {
  claims: ClaimRecordSummary[];
  selectedClaimId: string | null;
  filter: ClaimsFilter;
  onFilterChange: (filter: ClaimsFilter) => void;
  onOpenClaim: (claimId: string) => void;
};

type HubRow = ClaimRecordSummary & {
  serviceType: string;
  claimantInitials: string;
  displayDate: string;
};

function decisionChip(outcome: string) {
  if (outcome === "approve") return "bg-[#eef4ff] text-[#0053dc]";
  if (outcome === "deny") return "bg-[#fdeceb] text-[#c94b41]";
  return "bg-amber-50 text-amber-700";
}

function buildRows(claims: ClaimRecordSummary[]): HubRow[] {
  return claims.map((claim) => {
    const words = claim.member_name.split(" ").filter(Boolean);
    const initials = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "CL";
    const p = claim.provider_name.toLowerCase();
    const serviceType = p.includes("orth")
      ? "Orthopedic Surgery"
      : p.includes("card")
        ? "Cardiac Imaging"
        : p.includes("therapy")
          ? "Physical Therapy"
          : p.includes("gastro")
            ? "Gastroenterology"
            : claim.claim_type === "professional_outpatient"
              ? "Office Visit"
              : "Professional Claim";

    return {
      ...claim,
      serviceType,
      claimantInitials: initials,
      displayDate: new Date(claim.date_of_service).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  });
}

const demoRows: HubRow[] = [
  {
    claim_id: "#CLM-88219-X",
    member_name: "Jonathan Doe",
    provider_name: "Orthopedic Surgery",
    payer_name: "Aetna",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-24",
    amount: 4850,
    outcome: "approve",
    confidence_score: 0.982,
    requires_human_review: false,
    serviceType: "Orthopedic Surgery",
    claimantInitials: "JD",
    displayDate: "Mar 24, 2026",
    created_at: "2026-03-24T12:00:00Z",
  },
  {
    claim_id: "#CLM-77102-Y",
    member_name: "Sarah Kinsley",
    provider_name: "Cardiac Imaging",
    payer_name: "BCBS",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-23",
    amount: 2140,
    outcome: "deny",
    confidence_score: 0.94,
    requires_human_review: false,
    serviceType: "Cardiac Imaging",
    claimantInitials: "SK",
    displayDate: "Mar 23, 2026",
    created_at: "2026-03-23T12:00:00Z",
  },
  {
    claim_id: "#CLM-99211-P",
    member_name: "Marcus Reed",
    provider_name: "Physical Therapy",
    payer_name: "Cigna",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-23",
    amount: 760,
    outcome: "review",
    confidence_score: 0.628,
    requires_human_review: true,
    serviceType: "Physical Therapy",
    claimantInitials: "MR",
    displayDate: "Mar 23, 2026",
    created_at: "2026-03-23T12:00:00Z",
  },
  {
    claim_id: "#CLM-44321-L",
    member_name: "Avery Long",
    provider_name: "Gastroenterology",
    payer_name: "Humana",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-22",
    amount: 1240,
    outcome: "approve",
    confidence_score: 0.914,
    requires_human_review: false,
    serviceType: "Gastroenterology",
    claimantInitials: "AL",
    displayDate: "Mar 22, 2026",
    created_at: "2026-03-22T12:00:00Z",
  },
  {
    claim_id: "#CLM-12093-T",
    member_name: "Tina Bell",
    provider_name: "Neurological Eval",
    payer_name: "Aetna",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-22",
    amount: 920,
    outcome: "approve",
    confidence_score: 0.967,
    requires_human_review: false,
    serviceType: "Neurological Eval",
    claimantInitials: "TB",
    displayDate: "Mar 22, 2026",
    created_at: "2026-03-22T12:00:00Z",
  },
  {
    claim_id: "#CLM-55018-K",
    member_name: "Paul Kersey",
    provider_name: "Dermatology Path",
    payer_name: "BCBS",
    claim_type: "professional_outpatient",
    date_of_service: "2026-03-21",
    amount: 680,
    outcome: "deny",
    confidence_score: 0.891,
    requires_human_review: false,
    serviceType: "Dermatology Path",
    claimantInitials: "PK",
    displayDate: "Mar 21, 2026",
    created_at: "2026-03-21T12:00:00Z",
  },
];

export function ClaimsHubPage({ claims, selectedClaimId, filter, onFilterChange, onOpenClaim }: ClaimsHubPageProps) {
  const rows = claims.length ? buildRows(claims) : demoRows;
  const selectedClaim = rows.find((r) => r.claim_id === selectedClaimId) ?? rows[0] ?? null;

  const PAGE_SIZE = filter.limit ?? 20;
  const currentOffset = filter.offset ?? 0;

  const statusFilters: Array<{ label: string; outcome?: string; requires_review?: boolean }> = [
    { label: "All Statuses" },
    { label: "Approved", outcome: "approve" },
    { label: "Denied", outcome: "deny" },
    { label: "Flagged for Review", requires_review: true },
  ];

  const activeStatus = statusFilters.find(
    (f) =>
      f.outcome === filter.outcome &&
      f.requires_review === filter.requires_review,
  ) ?? statusFilters[0];

  function applyStatusFilter(f: (typeof statusFilters)[number]) {
    onFilterChange({
      ...filter,
      offset: 0,
      outcome: f.outcome,
      requires_review: f.requires_review,
    });
  }

  return (
    <section className="space-y-6">
      {/* Page header */}
      <header>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
          Claims Management
        </p>
        <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#2a3439]">
          Claims Hub
        </h2>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── Claims table ── */}
      <div className="min-w-0 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7f9fb] px-6 py-4 shadow-[inset_0_-1px_0_rgba(169,180,185,0.15)]">
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((f) => {
              const isActive = f.label === activeStatus.label;
              return (
                <button
                  className={`rounded-sm px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-[#0053dc] text-white shadow-[0_2px_8px_rgba(0,83,220,0.2)]"
                      : "bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(169,180,185,0.22)] hover:bg-slate-50"
                  }`}
                  key={f.label}
                  onClick={() => applyStatusFilter(f)}
                  type="button"
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <button
            className="rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-4 py-2 text-[11px] font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
            type="button"
          >
            Export Hub
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1.1fr_1.6fr_1.35fr_1fr_1.1fr_1fr] gap-4 px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          <span>Claim ID</span>
          <span>Claimant</span>
          <span>Service Type</span>
          <span>Date</span>
          <span>AI Decision</span>
          <span>Confidence</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50">
          {rows.map((claim) => {
            const isSelected = selectedClaim?.claim_id === claim.claim_id;
            const isDemo = claim.claim_id.startsWith("#");
            return (
              <button
                className={`grid w-full grid-cols-[1.1fr_1.6fr_1.35fr_1fr_1.1fr_1fr] gap-4 bg-white px-6 py-5 text-left transition-colors ${
                  isSelected
                    ? "shadow-[inset_3px_0_0_0_#0053dc] bg-[#f9fbff]"
                    : isDemo
                      ? "cursor-default opacity-70"
                      : "hover:bg-[#fbfdff]"
                }`}
                key={claim.claim_id}
                onClick={() => !isDemo && onOpenClaim(claim.claim_id)}
                title={isDemo ? "Process a real claim via Policy Manager to interact with this row" : undefined}
                type="button"
              >
                <p className="text-[13px] font-bold text-[#0053dc]">{claim.claim_id}</p>

                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8eef8] text-[10px] font-bold text-slate-600">
                    {claim.claimantInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#2a3439]">
                      {claim.member_name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{claim.provider_name}</p>
                  </div>
                </div>

                <p className="min-w-0 truncate text-[13px] text-slate-600">{claim.serviceType}</p>
                <p className="text-[13px] text-slate-600">{claim.displayDate}</p>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${decisionChip(claim.outcome)}`}
                  >
                    {claim.outcome === "review" ? "Flagged" : claim.outcome}
                  </span>
                  {claim.review_status === "resolved" && (
                    <span className="inline-flex rounded-sm bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                      Resolved
                    </span>
                  )}
                  {claim.review_status === "in_review" && (
                    <span className="inline-flex rounded-sm bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                      In Review
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 rounded-full bg-slate-100">
                    <div
                      className={`h-1 rounded-full ${
                        claim.outcome === "deny" || claim.requires_human_review
                          ? "bg-[#c94b41]"
                          : "bg-[#0053dc]"
                      }`}
                      style={{ width: `${Math.round(claim.confidence_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700">
                    {Math.round(claim.confidence_score * 100)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 text-[12px] text-slate-500">
          <span>
            Showing {currentOffset + 1}–{currentOffset + rows.length} claims
          </span>
          <div className="flex items-center gap-1.5">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-sm bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(169,180,185,0.22)] hover:bg-slate-50 disabled:opacity-40"
              disabled={currentOffset === 0}
              onClick={() => onFilterChange({ ...filter, offset: Math.max(0, currentOffset - PAGE_SIZE) })}
              type="button"
            >
              ‹
            </button>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-sm bg-[#0053dc] px-2 text-xs font-bold text-white">
              {Math.floor(currentOffset / PAGE_SIZE) + 1}
            </span>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-sm bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(169,180,185,0.22)] hover:bg-slate-50 disabled:opacity-40"
              disabled={rows.length < PAGE_SIZE}
              onClick={() => onFilterChange({ ...filter, offset: currentOffset + PAGE_SIZE })}
              type="button"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Decision Summary sidebar ── */}
      <aside className="bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between px-5 py-4 shadow-[inset_0_-1px_0_rgba(169,180,185,0.15)]">
          <h3 className="font-display text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
            Decision Summary
          </h3>
          <span className="text-lg text-slate-300">×</span>
        </div>

        <div className="space-y-6 px-5 py-5">
          {/* Active focus */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0053dc]">
              Active Focus
            </p>
            <div className="mt-3 bg-[#f7f9fb] px-4 py-4">
              <p className="font-display text-xl font-extrabold tracking-tight text-[#2a3439]">
                {selectedClaim?.claim_id ?? "No Claim"}
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                {selectedClaim
                  ? `${selectedClaim.member_name} · ${selectedClaim.serviceType}`
                  : "Select a claim from the hub"}
              </p>
            </div>
          </section>

          {/* AI Reasoning */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#0053dc]" />
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                AI Reasoning
              </p>
            </div>
            <div className="border-l-2 border-[#0053dc] bg-[#f7f9ff] px-4 py-3 text-[13px] leading-6 text-[#0053dc]">
              Procedure coding aligns with documented clinical evidence and the applicable coverage pathway.
              Medical necessity criteria are fully met for this claim profile.
            </div>
          </section>

          {/* Policy References */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
              Policy References
            </p>
            <div className="space-y-3 text-[12px]">
              <div>
                <p className="font-semibold text-[#2a3439]">Standard Adjudication Rule v4.2</p>
                <p className="text-slate-400">Section 4.1.2 · Surgical Necessity</p>
              </div>
              <div>
                <p className="font-semibold text-[#2a3439]">Provider Contract Addendum</p>
                <p className="text-slate-400">Tier-1 Preferred Network Pricing</p>
              </div>
            </div>
          </section>

          {/* Verification Steps */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
              Verification Steps
            </p>
            <div className="space-y-3 text-[13px]">
              {["Identity Verified", "Eligibility Confirmed", "Prior Auth Check"].map((step) => (
                <div className="flex items-center justify-between text-slate-600" key={step}>
                  <span>{step}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0053dc] text-[10px] text-white">
                    ✓
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          {selectedClaim && selectedClaim.claim_id.startsWith("#") ? (
            <p className="rounded-sm bg-slate-50 px-4 py-3 text-center text-[11px] text-slate-400">
              Process a real claim via{" "}
              <span className="font-semibold text-[#0053dc]">Policy Manager</span> to enable actions.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              <button
                className="w-full rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] py-3 text-[12px] font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-50"
                disabled={!selectedClaim}
                onClick={() => selectedClaim && onOpenClaim(selectedClaim.claim_id)}
                type="button"
              >
                Open &amp; Review Claim
              </button>
              <button
                className="w-full rounded-sm border border-slate-200 py-3 text-[12px] font-bold tracking-tight text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={!selectedClaim}
                onClick={() => selectedClaim && onOpenClaim(selectedClaim.claim_id)}
                type="button"
              >
                Manual Override
              </button>
            </div>
          )}
        </div>
      </aside>
      </div>
    </section>
  );
}
