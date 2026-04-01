import { useState } from "react";
import type {
  ClinicalHotspot,
  MemberDetailResponse,
  MemberListItem,
  PolicyAlignmentItem,
} from "../../../shared/api/members";

type MembersPageProps = {
  members: MemberListItem[];
  isLoading: boolean;
  selectedMember: MemberDetailResponse | null;
  onSelectMember: (memberId: string) => Promise<void>;
  onOpenClaim: (claimId: string) => void;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function eligibilityStyle(status: string) {
  if (status === "active") return { bg: "bg-emerald-50 text-emerald-700", label: "Active" };
  if (status === "inactive") return { bg: "bg-[#fdeceb] text-[#c94b41]", label: "Inactive" };
  return { bg: "bg-amber-50 text-amber-700", label: "Pending Review" };
}

function coverageTypeLabel(ct: string) {
  return ct.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age;
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// ① MEMBERS LIST VIEW
// ─────────────────────────────────────────────────────────────
function MembersListView({
  members,
  isLoading,
  loadingId,
  onSelect,
}: {
  members: MemberListItem[];
  isLoading: boolean;
  loadingId: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.member_name.toLowerCase().includes(q) ||
      m.member_id.toLowerCase().includes(q) ||
      m.plan_name.toLowerCase().includes(q) ||
      m.subscriber_id.toLowerCase().includes(q)
    );
  });

  const activeCount = members.filter((m) => m.eligibility_status === "active").length;
  const pendingCount = members.filter((m) => m.eligibility_status === "pending_review").length;
  const inactiveCount = members.filter((m) => m.eligibility_status === "inactive").length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
            Plan Administration
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2a3439]">Members</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Enrolled plan members — click any row to view clinical details.
          </p>
        </div>
        {/* Search */}
        <div className="relative w-72 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            search
          </span>
          <input
            className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white py-2.5 pl-9 pr-4 text-sm text-[#2a3439] outline-none placeholder:text-slate-400 focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            type="text"
            value={search}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3">
        <Chip className="bg-[#f0f4f7] text-[#566166]">{members.length} total</Chip>
        <Chip className="bg-emerald-50 text-emerald-700">{activeCount} active</Chip>
        {pendingCount > 0 && (
          <Chip className="bg-amber-50 text-amber-700">{pendingCount} pending review</Chip>
        )}
        {inactiveCount > 0 && (
          <Chip className="bg-[#fdeceb] text-[#c94b41]">{inactiveCount} inactive</Chip>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse border-b border-[#f0f4f7] bg-slate-50"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-200">person_search</span>
            <p className="mt-3 text-sm text-slate-400">
              {search ? "No members match your search." : "No members found."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f0f4f7]/60 border-b border-[#e8eff3]">
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Member
                </th>
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Plan
                </th>
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Date of Birth
                </th>
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Active Claims
                </th>
                <th className="px-6 py-3.5 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">
                  Last Claim
                </th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f4f7]">
              {filtered.map((m) => {
                const { bg, label } = eligibilityStyle(m.eligibility_status);
                const isRowLoading = loadingId === m.member_id;
                return (
                  <tr
                    key={m.member_id}
                    className={`group cursor-pointer transition-colors hover:bg-[#f7f9fb] ${isRowLoading ? "opacity-60 pointer-events-none" : ""}`}
                    onClick={() => onSelect(m.member_id)}
                  >
                    {/* Member name + ID */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-[#2a3439]">{m.member_name}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-[#566166]">{m.member_id}</p>
                    </td>
                    {/* Plan */}
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-[#2a3439]">{m.plan_name}</p>
                      <p className="mt-0.5 text-[10px] text-[#566166]">{m.payer_name}</p>
                    </td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <Chip className={bg}>{label}</Chip>
                    </td>
                    {/* DOB */}
                    <td className="px-6 py-4">
                      <p className="text-xs text-[#2a3439]">{m.date_of_birth}</p>
                      <p className="mt-0.5 text-[10px] text-[#566166]">Age {calculateAge(m.date_of_birth)}</p>
                    </td>
                    {/* Active claims */}
                    <td className="px-6 py-4">
                      {m.active_claim_count > 0 ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#0053dc]">
                          <span
                            className="material-symbols-outlined text-sm leading-none"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            receipt_long
                          </span>
                          {m.active_claim_count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    {/* Last claim */}
                    <td className="px-6 py-4">
                      {m.last_claim_id ? (
                        <span className="font-mono text-[10px] text-[#566166]">{m.last_claim_id}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      {isRowLoading ? (
                        <span className="text-[10px] text-[#566166]">Loading…</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc] opacity-0 group-hover:opacity-100 transition-opacity">
                          View →
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ② MEMBER DETAIL VIEW — sub-components
// ─────────────────────────────────────────────────────────────

function BodySilhouette() {
  return (
    <img
      alt="3D anatomical human body silhouette"
      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWoDgS9Ov5gic_YsX9I72-Lu1U96-M3usWCO7E5INeSirOBggd6CW03-Caqk7IV1yoy0M_J91sthjfjvuoBbIRKhTio4jCYomqzo4vCG1HoANtEZlCjciLTnFDk1ysXxUCMyJDCzWv9S525I2-0w9JK_Y02Rin4shnp9-cd_Cf55q-oN-TjusCR07V5ixTFRnagsa1-2PuGHzFUPhAgdbA2Z1veVQCo_F5l_NbO_Y_UeCXQKqn1QLIKcgkT8f7YIIb8zBfRvXIudUx"
      className="h-full w-auto max-h-[420px] opacity-90"
    />
  );
}

function HotspotPin({ hotspot }: { hotspot: ClinicalHotspot }) {
  return (
    <div
      className="absolute z-10"
      style={{ left: `${hotspot.position_x}%`, top: `${hotspot.position_y}%`, transform: "translate(-50%, -50%)" }}
    >
      <div className="hotspot-pulse w-5 h-5 bg-red-500 rounded-full cursor-pointer flex items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(239,68,68,0.5)]">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
      <div className="absolute top-0 left-6 bg-[rgba(15,23,42,0.85)] backdrop-blur-sm px-2 py-1 rounded-sm shadow-xl border border-red-500/30 whitespace-nowrap">
        <p className="text-[10px] font-bold uppercase tracking-tighter text-white">{hotspot.id}</p>
      </div>
    </div>
  );
}

function AlignmentIcon({ item }: { item: PolicyAlignmentItem }) {
  return item.status === "review_required" ? (
    <span className="material-symbols-outlined text-sm text-[#566166] shrink-0 mt-0.5">info</span>
  ) : (
    <span className="material-symbols-outlined text-sm text-[#0053dc] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
      check_circle
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// ② MEMBER DETAIL VIEW — full page
// ─────────────────────────────────────────────────────────────
function MemberDetailView({
  data,
  onBack,
  onOpenClaim,
}: {
  data: MemberDetailResponse;
  onBack: () => void;
  onOpenClaim: (claimId: string) => void;
}) {
  const [activeView, setActiveView] = useState("frontal");

  const {
    member,
    plan_tier,
    deductible_met,
    deductible_max,
    diagnostic_confidence,
    clinical_hotspots,
    active_diagnoses,
    surgical_history,
    policy_alignment,
    recent_claim_ids,
  } = data;

  const eligBg =
    member.eligibility_status === "active" ? "text-emerald-600"
    : member.eligibility_status === "inactive" ? "text-[#c94b41]"
    : "text-amber-600";

  const eligLabel =
    member.eligibility_status === "active" ? "Active"
    : member.eligibility_status === "inactive" ? "Inactive"
    : "Pending Review";

  return (
    <div className="min-h-[700px]">
      {/* Main content */}
      <div className="min-w-0">
        {/* Header */}
        <div className="flex items-end justify-between px-6 pt-6 pb-5">
          <div>
            {/* Back breadcrumb */}
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc] transition-colors mb-2"
            >
              <span className="material-symbols-outlined text-[12px] leading-none">arrow_back</span>
              Members
              <span className="material-symbols-outlined text-[12px] leading-none mx-0.5">chevron_right</span>
              <span className="text-[#0053dc]">{member.member_id}</span>
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2a3439]">
              Member Intelligence
            </h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="px-3 py-2 bg-[#e8eff3] text-[#2a3439] text-[10px] font-bold rounded-sm flex items-center gap-1.5 border border-[rgba(169,180,185,0.2)] hover:bg-[#d9e4ea] transition-colors">
              <span className="material-symbols-outlined text-sm leading-none">print</span>Print Record
            </button>
            <button type="button" className="px-3 py-2 bg-[#0053dc] text-white text-[10px] font-bold rounded-sm flex items-center gap-1.5 hover:bg-[#0049c2] transition-colors shadow-sm">
              <span className="material-symbols-outlined text-sm leading-none">verified</span>Final Adjudication
            </button>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {/* Row 1: Member context (3 columns) */}
          <div className="grid grid-cols-12 gap-5">
            {/* Member profile + plan summary */}
            <aside className="col-span-12 xl:col-span-5 space-y-4">
              {/* Member profile + plan summary */}
              <div className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 shrink-0 rounded-sm bg-[#e8eff3] flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-[#a9b4b9]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[#2a3439] truncate">{member.member_name}</h3>
                    <p className="text-[11px] text-[#566166]">DOB: {member.date_of_birth} (Age {calculateAge(member.date_of_birth)})</p>
                    {plan_tier && <p className="text-[11px] font-bold text-[#0053dc] mt-0.5">{plan_tier}</p>}
                  </div>
                </div>

                {/* Eligibility + deductible */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#f0f4f7]">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold mb-0.5">Eligibility</p>
                    <span className={`text-xs font-bold ${eligBg}`}>{eligLabel}</span>
                  </div>
                  {deductible_met && (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold mb-0.5">Deductible</p>
                      <span className="text-xs font-bold text-[#2a3439]">{deductible_met} / {deductible_max}</span>
                    </div>
                  )}
                </div>

                {/* Coverage window */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#f0f4f7]">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold mb-0.5">Effective</p>
                    <span className="text-xs font-bold text-[#2a3439]">{member.effective_date}</span>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold mb-0.5">Terminates</p>
                    <span className="text-xs font-bold text-[#2a3439]">{member.termination_date ?? "—"}</span>
                  </div>
                </div>

                {/* Plan + payer context */}
                <div className="mt-3 pt-3 border-t border-[#f0f4f7] space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Payer</p>
                    <p className="text-[10px] font-bold text-[#2a3439] text-right max-w-[60%] truncate">{member.payer_name}</p>
                  </div>
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Plan</p>
                    <p className="text-[10px] font-bold text-[#2a3439] text-right max-w-[60%] truncate">{member.plan_name}</p>
                  </div>
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Coverage</p>
                    <p className="text-[10px] font-bold text-[#2a3439] text-right">{coverageTypeLabel(member.coverage_type)}</p>
                  </div>
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Subscriber Role</p>
                    <p className="text-[10px] font-bold text-[#2a3439] text-right capitalize">{member.relationship_to_subscriber}</p>
                  </div>
                </div>

                {/* Auth requirements */}
                <div className="mt-3 pt-3 border-t border-[#f0f4f7] space-y-2">
                  {member.pcp_name && (
                    <div className="flex justify-between items-start">
                      <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">PCP</p>
                      <p className="text-[10px] font-bold text-[#2a3439] text-right max-w-[60%] truncate">{member.pcp_name}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Referral Required</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${member.referral_required ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                      {member.referral_required ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold">Prior Auth — Specialty</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${member.prior_auth_required_for_specialty ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                      {member.prior_auth_required_for_specialty ? "Required" : "Not Required"}
                    </span>
                  </div>
                </div>

                {/* Risk flags */}
                {member.risk_flags.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#f0f4f7]">
                    <p className="text-[9px] uppercase tracking-wider text-[#566166] font-bold mb-2">Risk Flags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.risk_flags.map((flag) => (
                        <span key={flag} className="text-[9px] font-bold px-2 py-0.5 bg-[#fdeceb] text-[#c94b41] border border-red-200 rounded-sm uppercase tracking-wider">
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Coverage notes */}
              {data.coverage_notes.length > 0 && (
                <div className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#566166] text-base leading-none">info</span>
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">Coverage Notes</h3>
                  </div>
                  <ul className="space-y-2">
                    {data.coverage_notes.map((note, i) => (
                      <li key={i} className="text-[11px] text-[#566166] leading-snug pl-3 border-l-2 border-[#e8eff3]">{note}</li>
                    ))}
                  </ul>
                </div>
              )}

            </aside>

            {/* Col 2: Coverage notes + Policy alignment */}
            <aside className="col-span-12 xl:col-span-4 space-y-4">
              {data.coverage_notes.length > 0 && (
                <div className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#566166] text-base leading-none">info</span>
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">Coverage Notes</h3>
                  </div>
                  <ul className="space-y-2">
                    {data.coverage_notes.map((note, i) => (
                      <li key={i} className="text-[11px] text-[#566166] leading-snug pl-3 border-l-2 border-[#e8eff3]">{note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {policy_alignment.length > 0 && (
                <div className="bg-[#eef4ff] rounded-sm border border-[#dbe1ff] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#0053dc] text-base leading-none">policy</span>
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">Policy Alignment</h3>
                  </div>
                  <ul className="space-y-3">
                    {policy_alignment.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlignmentIcon item={item} />
                        <p className="text-xs text-[#2a3439] leading-snug">{item.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>

            {/* Col 3: Recent claims + quick actions */}
            <aside className="col-span-12 xl:col-span-3 space-y-4">
              {recent_claim_ids.length > 0 && (
                <div className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#0053dc] text-base leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">Recent Claims</h3>
                  </div>
                  <div className="space-y-1.5">
                    {recent_claim_ids.slice(0, 3).map((claimId) => (
                      <div key={claimId} className="flex items-center justify-between rounded-sm bg-[#f7f9fb] px-3 py-2">
                        <span className="font-mono text-[10px] font-bold text-[#2a3439] truncate mr-2">{claimId}</span>
                        <button type="button" onClick={() => onOpenClaim(claimId)} className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc] hover:underline shrink-0">
                          Open →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <button type="button" className="w-full py-3 bg-white border border-[rgba(169,180,185,0.3)] text-[#2a3439] text-[10px] font-bold uppercase tracking-widest hover:bg-[#f0f4f7] transition-colors text-center rounded-sm">
                  Request Records
                </button>
                <button type="button" className="w-full py-3 bg-white border border-[rgba(169,180,185,0.3)] text-[#2a3439] text-[10px] font-bold uppercase tracking-widest hover:bg-[#f0f4f7] transition-colors text-center rounded-sm">
                  Flag for Peer Review
                </button>
              </div>
            </aside>
          </div>

          {/* Row 2: Active Diagnoses + Surgical History */}
          <div className="grid grid-cols-12 gap-5">
            {/* Active Diagnoses */}
            <section className="col-span-12 xl:col-span-6 bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f4f7] flex items-center justify-between bg-[#f7f9fb]/60">
                <h3 className="text-sm font-bold text-[#2a3439] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0053dc] text-base leading-none">clinical_notes</span>
                  Active Diagnoses
                </h3>
                <button type="button" className="text-[#0053dc] text-[10px] font-bold uppercase tracking-widest hover:underline">View All</button>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f0f4f7]/40">
                    <th className="px-5 py-3 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">ICD-10 Code</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">Description</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold text-[#566166] uppercase tracking-widest">Onset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f4f7]">
                  {active_diagnoses.map((dx, i) => (
                    <tr key={i} className="hover:bg-[#f7f9fb] transition-colors">
                      <td className="px-5 py-4 text-xs font-bold text-[#2a3439]">{dx.icd_code}</td>
                      <td className="px-5 py-4 text-xs text-[#566166]">{dx.description}</td>
                      <td className="px-5 py-4 text-xs text-[#566166] whitespace-nowrap">{dx.onset}</td>
                    </tr>
                  ))}
                  {active_diagnoses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">No active diagnoses on file.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Surgical History */}
            <section className="col-span-12 xl:col-span-6 bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0f4f7] flex items-center justify-between bg-[#f7f9fb]/60">
                <h3 className="text-sm font-bold text-[#2a3439] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0053dc] text-base leading-none">history_edu</span>
                  Surgical History
                </h3>
                <button type="button" className="text-[#0053dc] text-[10px] font-bold uppercase tracking-widest hover:underline">Full Chart</button>
              </div>
              <div className="p-6">
                {surgical_history.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-[#e8eff3] space-y-7">
                    {surgical_history.map((item, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-4 border-white ${item.is_primary ? "bg-[#0053dc]" : "bg-[#e1e9ee]"}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${item.is_primary ? "text-[#0053dc]" : "text-[#566166]"}`}>
                          {item.date}
                        </span>
                        <h4 className="text-xs font-bold text-[#2a3439] mt-1">{item.procedure}</h4>
                        {item.facility && (
                          <p className="text-[10px] text-[#0053dc] font-medium mt-0.5">{item.facility}</p>
                        )}
                        <p className="text-[11px] text-[#566166] mt-1 leading-relaxed">{item.notes}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No surgical history on file.</p>
                )}
              </div>
            </section>
          </div>

          {/* Row 3: Clinical History Map — secondary, bottom of page */}
          <section className="bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f4f7] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#2a3439]">Clinical History Map</h2>
                <p className="text-[11px] text-[#566166]">Documented procedures and diagnoses relevant to claim adjudication</p>
              </div>
              <div className="flex items-center gap-3">
                {diagnostic_confidence > 0 && (
                  <div className="flex items-center gap-2 pr-3 border-r border-[#f0f4f7]">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#566166]">Clinical Match</span>
                    <span className="text-sm font-extrabold text-[#0053dc]">{diagnostic_confidence.toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex bg-[#f0f4f7] p-1 rounded-sm gap-0.5">
                  {["Frontal", "Posterior", "Lateral"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setActiveView(v.toLowerCase())}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                        activeView === v.toLowerCase() ? "bg-white text-[#0053dc] shadow-sm" : "text-[#566166] hover:text-[#2a3439]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 h-[340px]">
              {/* Dark silhouette — fixed height, no longer dominates page */}
              <div className="col-span-3 bg-[#0F172A] overflow-hidden flex items-center justify-center py-6">
                <div className="relative h-full">
                  <BodySilhouette />
                  {clinical_hotspots.map((h) => <HotspotPin key={h.id} hotspot={h} />)}
                  {clinical_hotspots.length === 0 && (
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">No hotspots recorded</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Legend */}
              <div className="col-span-2 p-5 overflow-y-auto bg-[#f7f9fb] flex flex-col">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439] mb-3">Documented Findings</h3>
                <div className="space-y-2.5 flex-1">
                  {clinical_hotspots.map((h, i) => (
                    <div key={h.id} className="flex items-start gap-3 p-3 rounded-sm bg-white border-l-4 border-[#c94b41] shadow-sm">
                      <div className="mt-0.5 w-5 h-5 shrink-0 rounded-sm bg-red-50 flex items-center justify-center text-[#c94b41] font-bold text-[9px]">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#2a3439]">{h.body_location}</h4>
                        <p className="text-[10px] text-[#566166] font-medium mt-0.5 leading-snug">{h.description}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#e8eff3] border border-[rgba(169,180,185,0.2)] rounded-sm uppercase font-bold text-[#566166]">{h.icd_code}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold border ${
                            h.risk_level === "high_risk" ? "bg-red-50 border-red-200 text-[#c94b41]"
                            : h.risk_level === "active_claim" ? "bg-[#eef4ff] border-[#0053dc]/20 text-[#0053dc]"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                          }`}>{h.risk_level.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {clinical_hotspots.length === 0 && (
                    <p className="text-[11px] text-[#566166] italic">No documented findings.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page — routes between list and detail
// ─────────────────────────────────────────────────────────────
export function MembersPage({
  members,
  isLoading,
  selectedMember,
  onSelectMember,
  onOpenClaim,
}: MembersPageProps) {
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  async function handleSelect(memberId: string) {
    setActiveMemberId(memberId);
    setIsDetailLoading(true);
    try {
      await onSelectMember(memberId);
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleBack() {
    setActiveMemberId(null);
  }

  // Detail view
  if (activeMemberId) {
    const detailReady = selectedMember?.member.member_id === activeMemberId;

    if (!detailReady || isDetailLoading) {
      return (
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#0053dc] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-[#566166]">Loading member record…</p>
          </div>
        </div>
      );
    }

    return (
      <div className="-mx-6 -mt-6 bg-white rounded-sm border border-[rgba(169,180,185,0.1)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">
        <MemberDetailView data={selectedMember} onBack={handleBack} onOpenClaim={onOpenClaim} />
      </div>
    );
  }

  // List view
  return (
    <MembersListView
      members={members}
      isLoading={isLoading}
      loadingId={isDetailLoading ? activeMemberId : null}
      onSelect={handleSelect}
    />
  );
}
