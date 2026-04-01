import type { ClaimRecordSummary } from "../../../shared/api/claims";

type OverviewPageProps = {
  claims: ClaimRecordSummary[];
  onSelectClaim: (claimId: string) => void;
};

const BAR_DATA = [18, 24, 28, 34, 48, 61, 53, 64, 72, 89];
const BAR_MAX = Math.max(...BAR_DATA);

function outcomeChip(outcome: string) {
  if (outcome === "approve")
    return "bg-[#eef4ff] text-[#0053dc]";
  if (outcome === "deny")
    return "bg-[#fdeceb] text-[#c94b41]";
  return "bg-slate-100 text-slate-600";
}

export function OverviewPage({ claims, onSelectClaim }: OverviewPageProps) {
  const approved = claims.filter((c) => c.outcome === "approve");
  const review = claims.filter((c) => c.requires_human_review);
  const avgConf = claims.length
    ? `${Math.round((claims.reduce((s, c) => s + c.confidence_score, 0) / claims.length) * 100)}%`
    : "--";

  const metrics = [
    {
      label: "STP Rate",
      value: claims.length ? `${Math.round((approved.length / claims.length) * 100)}%` : "--",
      delta: "+1.4%",
      tone: "text-[#0053dc]",
    },
    {
      label: "Avg Confidence",
      value: avgConf,
      delta: "+0.2%",
      tone: "text-slate-900",
    },
    {
      label: "Claims Processed",
      value: String(claims.length || "—"),
      delta: "Stable",
      tone: "text-slate-900",
    },
    {
      label: "Flagged for Review",
      value: String(review.length || "—"),
      delta: review.length ? `${review.length} active` : "None",
      tone: "text-[#c94b41]",
    },
  ];

  return (
    <section className="space-y-8">
      {/* Page header */}
      <header>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
          Performance Overview
        </p>
        <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-slate-900">
          Executive Overview
        </h2>
      </header>

      {/* KPI strip */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <div
            className="bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
            key={m.label}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {m.label}
            </p>
            <p className={`mt-3 font-display text-3xl font-extrabold ${m.tone}`}>{m.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-emerald-500">{m.delta}</p>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Adjudication trends card */}
        <div className="bg-white p-7 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Adjudication Trends</h3>
              <p className="mt-1 text-sm text-slate-500">
                Daily decision distribution over the trailing 10 days.
              </p>
            </div>
          </div>

          <div className="mt-8 grid h-[200px] grid-cols-10 items-end gap-2">
            {BAR_DATA.map((v, i) => {
              const pct = Math.round((v / BAR_MAX) * 100);
              const approvePct = Math.round(pct * 0.72);
              return (
                <div className="flex h-full flex-col justify-end" key={i}>
                  <div
                    className="relative w-full rounded-t-sm bg-slate-100 overflow-hidden"
                    style={{ height: `${pct}%` }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-[#0053dc]"
                      style={{ height: `${approvePct}%` }}
                    />
                  </div>
                  <span className="mt-2 text-center text-[10px] text-slate-400">
                    {i === 9 ? "Today" : `D${i + 1}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-50 pt-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              AI Attribution
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Medical Necessity", 42],
                  ["Policy Eligibility", 28],
                  ["CPT Coding Accuracy", 18],
                  ["Prior Auth Match", 12],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{label}</span>
                    <span className="font-bold text-slate-900">{value}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-slate-100">
                    <div
                      className="h-1 rounded-full bg-[#0053dc]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              System Status
            </p>
            <div className="mt-5 space-y-4 text-sm">
              {(
                [
                  ["AI Engine", "Operational", "text-emerald-500"],
                  ["Review Flags", String(review.length), "text-slate-900"],
                  ["Last Sync", "2m ago", "text-slate-900"],
                ] as [string, string, string][]
              ).map(([label, val, tone]) => (
                <div className="flex items-center justify-between" key={label}>
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-semibold ${tone}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Decision Mix
            </p>
            <div className="mt-5 space-y-3">
              {(
                [
                  ["Approved", approved.length, "#0053dc"],
                  ["Denied", claims.filter((c) => c.outcome === "deny").length, "#c94b41"],
                  ["Flagged", review.length, "#e28a1c"],
                ] as [string, number, string][]
              ).map(([label, count, color]) => (
                <div className="flex items-center justify-between text-sm" key={label}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <span className="text-slate-600">{label}</span>
                  </div>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent AI Actions */}
      <div className="bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between px-7 py-5 shadow-[inset_0_-1px_0_rgba(169,180,185,0.15)]">
          <h3 className="font-display text-sm font-bold text-slate-900">Recent AI Actions</h3>
          <button className="text-[11px] font-bold uppercase tracking-widest text-[#0053dc]" type="button">
            View All
          </button>
        </div>

        <div className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_0.6fr] gap-4 px-7 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Claim ID</span>
          <span>Patient</span>
          <span>Decision</span>
          <span>Confidence</span>
          <span>Action</span>
        </div>

        <div className="divide-y divide-slate-50">
          {claims.length ? (
            claims.slice(0, 5).map((claim) => (
              <button
                className="grid w-full grid-cols-[1.1fr_1.4fr_1fr_1fr_0.6fr] gap-4 px-7 py-4 text-left transition-colors hover:bg-[#fbfdff]"
                key={claim.claim_id}
                onClick={() => onSelectClaim(claim.claim_id)}
                type="button"
              >
                <span className="text-[13px] font-bold text-[#0053dc]">{claim.claim_id}</span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{claim.member_name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{claim.provider_name}</p>
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${outcomeChip(claim.outcome)}`}
                  >
                    {claim.outcome}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 rounded-full bg-slate-100">
                    <div
                      className={`h-1 rounded-full ${claim.requires_human_review ? "bg-[#c94b41]" : "bg-[#0053dc]"}`}
                      style={{ width: `${Math.round(claim.confidence_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700">
                    {Math.round(claim.confidence_score * 100)}%
                  </span>
                </div>
                <span className="text-slate-300">›</span>
              </button>
            ))
          ) : (
            <div className="px-7 py-12 text-center text-sm text-slate-400">
              Process the first claim via <span className="font-semibold text-[#0053dc]">Intake</span> to populate the dashboard.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
