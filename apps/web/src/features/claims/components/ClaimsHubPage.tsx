import { useEffect, useState } from "react";
import { fetchClaimById } from "../../../shared/api/claims";
import type { ClaimDetailResponse, ClaimRecordSummary, ClaimsFilter } from "../../../shared/api/claims";

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

export function ClaimsHubPage({ claims, selectedClaimId, filter, onFilterChange, onOpenClaim }: ClaimsHubPageProps) {
  const rows = buildRows(claims);

  // Sidebar state — tracks which row is "focused" for the detail preview
  const [activeRowId, setActiveRowId] = useState<string | null>(selectedClaimId);
  const [sidebarDetail, setSidebarDetail] = useState<ClaimDetailResponse | null>(null);
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  const resolvedActiveRowId = activeRowId ?? selectedClaimId ?? rows[0]?.claim_id ?? null;
  const activeRow = rows.find((r) => r.claim_id === resolvedActiveRowId) ?? rows[0] ?? null;

  useEffect(() => {
    if (!rows.length) {
      setActiveRowId(null);
      setSidebarDetail(null);
      setIsSidebarLoading(false);
      return;
    }

    const activeStillExists = activeRowId
      ? rows.some((row) => row.claim_id === activeRowId)
      : false;
    const nextClaimId = activeStillExists
      ? activeRowId
      : selectedClaimId ?? rows[0]?.claim_id ?? null;

    if (nextClaimId !== activeRowId) {
      setActiveRowId(nextClaimId);
    }

    if (!nextClaimId) {
      setSidebarDetail(null);
      setIsSidebarLoading(false);
      return;
    }

    if (sidebarDetail?.claim.claim_id === nextClaimId) {
      return;
    }

    let isCancelled = false;
    setSidebarDetail(null);
    setIsSidebarLoading(true);

    void fetchClaimById(nextClaimId)
      .then((detail) => {
        if (!isCancelled) {
          setSidebarDetail(detail);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSidebarDetail(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsSidebarLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [rows, selectedClaimId, activeRowId, sidebarDetail?.claim.claim_id]);

  async function handleRowSelect(claim: HubRow) {
    if (claim.claim_id === activeRowId) return;
    setActiveRowId(claim.claim_id);
    setSidebarDetail(null);
    setIsSidebarLoading(true);
    try {
      const detail = await fetchClaimById(claim.claim_id);
      setSidebarDetail(detail);
    } catch {
      // silent — sidebar falls back to summary row data
    } finally {
      setIsSidebarLoading(false);
    }
  }

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
          {rows.length ? rows.map((claim) => {
            const isActive = (activeRowId ?? selectedClaimId) === claim.claim_id;
            return (
              <button
                className={`grid w-full grid-cols-[1.1fr_1.6fr_1.35fr_1fr_1.1fr_1fr] gap-4 bg-white px-6 py-5 text-left transition-colors ${
                  isActive
                    ? "shadow-[inset_3px_0_0_0_#0053dc] bg-[#f9fbff]"
                    : "hover:bg-[#fbfdff]"
                }`}
                key={claim.claim_id}
                onClick={() => void handleRowSelect(claim)}
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
          }) : (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] font-semibold text-[#2a3439]">No claims have been processed yet.</p>
              <p className="mt-2 text-[12px] text-slate-500">
                Upload an X12 file or process a claim through Intake to populate Claims Hub.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 text-[12px] text-slate-500">
          <span>
            {rows.length
              ? `Showing ${currentOffset + 1}–${currentOffset + rows.length} claims`
              : "Showing 0 claims"}
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
          {isSidebarLoading && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0053dc] border-t-transparent" />
          )}
        </div>

        <div className="space-y-6 px-5 py-5">
          {/* Active focus */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0053dc]">
              Active Focus
            </p>
            <div className="mt-3 bg-[#f7f9fb] px-4 py-4">
              <p className="font-display text-xl font-extrabold tracking-tight text-[#2a3439]">
                {activeRow?.claim_id ?? "No Claim"}
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                {activeRow
                  ? `${activeRow.member_name} · ${activeRow.serviceType}`
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
              {sidebarDetail?.decision.rationale
                ? sidebarDetail.decision.rationale
                : isSidebarLoading
                    ? "Loading…"
                    : activeRow
                      ? "Rationale unavailable."
                      : "Select a claim from the hub to load AI reasoning."}
            </div>
          </section>

          {/* Policy References */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
              Policy References
            </p>
            {sidebarDetail?.matched_policies?.length ? (
              <div className="space-y-3 text-[12px]">
                {sidebarDetail.matched_policies.slice(0, 2).map((p) => (
                  <div key={p.policy_id}>
                    <p className="font-semibold text-[#2a3439]">{p.title}</p>
                    <p className="text-slate-400">
                      {Math.round(p.relevance_score * 100)}% relevance
                      {p.summary ? ` · ${p.summary.slice(0, 60)}…` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400">
                {isSidebarLoading
                  ? "—"
                  : activeRow
                    ? "No policy matches found."
                    : "Select a claim from the hub to load policy references."}
              </p>
            )}
          </section>

          {/* Validation */}
          <section>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
              Validation
            </p>
            {sidebarDetail ? (
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span>All fields valid</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${sidebarDetail.validation.is_valid ? "bg-[#0053dc]" : "bg-[#c94b41]"}`}
                  >
                    {sidebarDetail.validation.is_valid ? "✓" : "✗"}
                  </span>
                </div>
                {sidebarDetail.validation.issues.slice(0, 2).map((issue) => (
                  <div className="text-[11px] text-amber-600" key={issue.code}>
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400">
                {activeRow ? "—" : "Select a claim from the hub to load validation details."}
              </p>
            )}
          </section>

          {/* Actions */}
          {!activeRow ? (
            <p className="rounded-sm bg-slate-50 px-4 py-3 text-center text-[11px] text-slate-400">
              Process a real claim via{" "}
              <span className="font-semibold text-[#0053dc]">Intake</span> to enable actions.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              <button
                className="w-full rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] py-3 text-[12px] font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-50"
                disabled={!activeRow}
                onClick={() => activeRow && onOpenClaim(activeRow.claim_id)}
                type="button"
              >
                Open &amp; Review Claim
              </button>
              <button
                className="w-full rounded-sm border border-slate-200 py-3 text-[12px] font-bold tracking-tight text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={!activeRow}
                onClick={() => activeRow && onOpenClaim(activeRow.claim_id)}
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
