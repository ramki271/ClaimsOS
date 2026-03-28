import type { ClaimRecordSummary } from "../../../shared/api/claims";

type ReportsPageProps = {
  claims: ClaimRecordSummary[];
};

const BAR_DATA = [24, 30, 36, 41, 55, 63, 58, 66, 74, 81];
const BAR_MAX = Math.max(...BAR_DATA);

export function ReportsPage({ claims }: ReportsPageProps) {
  const approved = claims.filter((c) => c.outcome === "approve").length;
  const denied = claims.filter((c) => c.outcome === "deny").length;
  const flagged = claims.filter((c) => c.requires_human_review).length;
  const total = claims.length;

  return (
    <section className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
            Reports &amp; Analytics
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#2a3439]">
            Portfolio Reporting
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Adjudication outcome distribution and trend analysis.
          </p>
        </div>
        <button
          className="self-start rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-5 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
          type="button"
        >
          Export Report
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            { label: "Approved", count: approved, textColor: "text-[#0053dc]", barColor: "#0053dc" },
            { label: "Denied", count: denied, textColor: "text-[#c94b41]", barColor: "#c94b41" },
            { label: "Flagged", count: flagged, textColor: "text-amber-700", barColor: "#d97706" },
          ]
        ).map(({ label, count, textColor, barColor }) => (
          <div
            className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
            key={label}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {label}
            </p>
            <p className={`mt-3 font-display text-4xl font-extrabold ${textColor}`}>{count}</p>
            {total > 0 && (
              <div className="mt-4 h-1 rounded-full bg-slate-100">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${Math.round((count / total) * 100)}%`,
                    background: barColor,
                  }}
                />
              </div>
            )}
            {total > 0 && (
              <p className="mt-2 text-[11px] font-semibold text-slate-400">
                {Math.round((count / total) * 100)}% of total
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="bg-white p-7 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-[#2a3439]">
              Operational Snapshot
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Claim volume over the trailing 10-day window.
            </p>
          </div>
          <span className="rounded-sm bg-[#eef4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0053dc]">
            Daily Volume
          </span>
        </div>

        <div className="mt-8 grid h-[180px] grid-cols-10 items-end gap-3">
          {BAR_DATA.map((v, i) => {
            const pct = Math.round((v / BAR_MAX) * 100);
            return (
              <div className="flex h-full flex-col justify-end" key={i}>
                <div
                  className="w-full rounded-t-sm bg-[#0053dc] transition-all hover:bg-[#0049c2]"
                  style={{ height: `${pct}%` }}
                  title={`Day ${i + 1}: ${v}`}
                />
                <span className="mt-2 text-center text-[10px] text-slate-400">
                  {i === 9 ? "Today" : `D${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary table */}
      {claims.length > 0 && (
        <div className="bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="px-7 py-5 shadow-[inset_0_-1px_0_rgba(169,180,185,0.12)]">
            <h3 className="font-display text-sm font-bold text-[#2a3439]">Claim Log</h3>
          </div>
          <div className="grid grid-cols-[1.2fr_1.4fr_1fr_0.8fr_0.9fr] gap-4 px-7 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Claim ID</span>
            <span>Member</span>
            <span>Decision</span>
            <span>Amount</span>
            <span>Confidence</span>
          </div>
          <div className="divide-y divide-slate-50">
            {claims.slice(0, 8).map((claim) => (
              <div
                className="grid grid-cols-[1.2fr_1.4fr_1fr_0.8fr_0.9fr] gap-4 px-7 py-4 text-sm"
                key={claim.claim_id}
              >
                <span className="font-bold text-[#0053dc]">{claim.claim_id}</span>
                <span className="font-semibold text-[#2a3439]">{claim.member_name}</span>
                <span>
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      claim.outcome === "approve"
                        ? "bg-[#eef4ff] text-[#0053dc]"
                        : claim.outcome === "deny"
                          ? "bg-[#fdeceb] text-[#c94b41]"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {claim.outcome}
                  </span>
                </span>
                <span className="font-semibold text-slate-700">
                  ${claim.amount.toFixed(2)}
                </span>
                <span className="font-semibold text-slate-700">
                  {Math.round(claim.confidence_score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
