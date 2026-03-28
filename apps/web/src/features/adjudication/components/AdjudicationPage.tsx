import { useState } from "react";
import type { AuditEvent, ClaimDetailResponse, ClaimReviewRequest } from "../../../shared/api/claims";

type AdjudicationPageProps = {
  result: ClaimDetailResponse | null;
  onSelectClaim: (claimId: string) => void;
  onBackToClaims: () => void;
  onSubmitReview: (claimId: string, review: ClaimReviewRequest) => Promise<void>;
};

function outcomeStyle(outcome: string) {
  if (outcome === "approve")
    return { bg: "bg-[#dbe1ff] text-[#003798]", label: "Approved" };
  if (outcome === "deny")
    return { bg: "bg-[#fe8983]/20 text-[#752121]", label: "Denied" };
  return { bg: "bg-[#dbe1ff] text-[#0048bf]", label: "Under Review" };
}

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatEventTime(createdAt: string | null): string {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const ACTIVE_EVENTS = new Set([
  "claim_processed",
  "adjudication_completed",
  "policy_retrieval_completed",
  "manual_review",
]);

// ─────────────────────────────────────────────────────────────
// AuditTrail
// ─────────────────────────────────────────────────────────────
function AuditTrailPanel({ events }: { events: AuditEvent[] }) {
  const sorted = [...events].sort((a, b) => {
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="relative space-y-8 pl-6">
      <div className="absolute bottom-1 left-[7px] top-1 w-[1.5px] bg-slate-100" />
      {sorted.map((event, i) => (
        <div className="relative" key={i}>
          <div
            className={`absolute -left-[23px] top-0 h-3 w-3 rounded-full border-2 border-white ${
              ACTIVE_EVENTS.has(event.event_type)
                ? "bg-[#0053dc] ring-4 ring-[#0053dc]/5"
                : "bg-slate-200"
            }`}
          />
          <p className="mb-1.5 text-[9px] font-extrabold uppercase leading-none tracking-widest text-[#566166]">
            {formatEventTime(event.created_at)}
          </p>
          <p className="text-xs font-bold text-[#2a3439]">{formatEventType(event.event_type)}</p>
          {typeof event.payload?.outcome === "string" && (
            <p className="mt-1 text-[11px] text-[#566166]">
              Outcome: {event.payload.outcome as string}
            </p>
          )}
          {typeof event.payload?.reviewer_notes === "string" && (
            <p className="mt-1 text-[11px] italic text-[#566166]">
              "{event.payload.reviewer_notes as string}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// Static fallback trail
const FALLBACK_TRAIL = [
  { label: "AI Synthesis Completed", copy: "System identified policy match and confidence score.", time: "10:42 AM", active: true },
  { label: "Documents Ingested", copy: "Claim attachments validated via OCR pipeline.", time: "09:15 AM", active: false },
  { label: "Claim Submitted", copy: "Via Provider Portal.", time: "09:00 AM", active: false },
];

// ─────────────────────────────────────────────────────────────
// ReviewForm
// ─────────────────────────────────────────────────────────────
function ReviewForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (review: ClaimReviewRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [reviewerName, setReviewerName] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideOutcome, setOverrideOutcome] = useState<"approve" | "deny" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!notes.trim()) {
      setError("Reviewer notes are required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        reviewer_name: reviewerName.trim() || undefined,
        reviewer_notes: notes.trim(),
        review_status: "resolved",
        override_outcome: overrideOutcome || undefined,
      });
    } catch {
      setError("Failed to submit review. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
          Reviewer Name <span className="normal-case text-slate-300">(optional)</span>
        </label>
        <input
          className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="Dr. Aris Thorne"
          type="text"
          value={reviewerName}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
          Notes <span className="text-[#9f403d]">*</span>
        </label>
        <textarea
          className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe your review findings..."
          rows={3}
          value={notes}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
          Override Decision <span className="normal-case text-slate-300">(optional)</span>
        </label>
        <div className="flex gap-2">
          {(["approve", "deny"] as const).map((o) => (
            <button
              className={`flex-1 rounded-sm py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                overrideOutcome === o
                  ? o === "approve"
                    ? "bg-emerald-500 text-white"
                    : "bg-[#9f403d] text-white"
                  : "border border-[rgba(169,180,185,0.3)] bg-white text-slate-600 hover:bg-slate-50"
              }`}
              key={o}
              onClick={() => setOverrideOutcome(overrideOutcome === o ? "" : o)}
              type="button"
            >
              {o}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="rounded-sm bg-[#fe8983]/20 px-3 py-2 text-xs font-semibold text-[#752121]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] py-2.5 text-xs font-bold tracking-tight text-white disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>
        <button
          className="rounded-sm border border-[rgba(169,180,185,0.3)] px-4 py-2.5 text-xs font-bold text-[#2a3439] hover:bg-slate-50"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export function AdjudicationPage({
  result,
  onSelectClaim: _onSelectClaim,
  onBackToClaims,
  onSubmitReview,
}: AdjudicationPageProps) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const confidence = result ? Math.round(result.confidence_score * 100) : null;
  const oc = outcomeStyle(result?.decision.outcome ?? "review");
  const reviewState = result?.review_state ?? null;
  const outcome = result?.decision.outcome ?? "";

  // Service line helpers
  const serviceLines = result?.claim.service_lines ?? [];
  const grossBilled = serviceLines.reduce((s, l) => s + l.charge_amount, 0);
  const lineAllowed = (charge: number) =>
    outcome === "approve" ? charge : outcome === "deny" ? 0 : charge;
  const payableTotal = serviceLines.reduce((s, l) => s + lineAllowed(l.charge_amount), 0);
  const networkSavings = grossBilled - payableTotal;

  async function handleConfirmDecision() {
    if (!result) return;
    setIsConfirming(true);
    try {
      await onSubmitReview(result.claim.claim_id, {
        reviewer_notes: "AI decision confirmed by reviewer.",
        review_status: "resolved",
      });
      setConfirmed(true);
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleSubmitReview(review: ClaimReviewRequest) {
    if (!result) return;
    await onSubmitReview(result.claim.claim_id, review);
    setShowReviewForm(false);
    setConfirmed(true);
  }

  return (
    <section className="space-y-8">

      {/* ── Adjudication Header ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#566166]">
            <button
              className="uppercase transition-colors hover:text-[#0053dc]"
              onClick={onBackToClaims}
              type="button"
            >
              Claims Hub
            </button>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-[#0053dc]">Detail View</span>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-4xl font-bold tracking-tighter text-[#2a3439]">
              {result?.claim.claim_id ?? "Claim Detail"}
            </h2>
            <span className={`rounded-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${oc.bg}`}>
              {oc.label}
            </span>
            {reviewState && (
              <span
                className={`rounded-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  reviewState.status === "resolved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                Review: {reviewState.status}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm font-medium text-[#566166]">
            Member:{" "}
            <span className="font-semibold text-[#2a3439]">
              {result
                ? `${result.claim.member_name} (ID: ${result.claim.member_id})`
                : "—"}
            </span>
            {result?.claim.date_of_service && (
              <> &bull; Submitted: {result.claim.date_of_service}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            className="rounded-sm border border-[rgba(169,180,185,0.3)] px-6 py-2.5 text-xs font-bold tracking-tight text-[#2a3439] transition-colors hover:bg-[#e1e9ee]"
            onClick={() => setShowReviewForm(true)}
            type="button"
          >
            Request Info
          </button>
          <button
            className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_8px_24px_rgba(0,83,220,0.2)] disabled:opacity-60"
            disabled={!result || isConfirming || confirmed}
            onClick={() => void handleConfirmDecision()}
            type="button"
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {confirmed ? "task_alt" : "check_circle"}
            </span>
            {isConfirming ? "Confirming..." : confirmed ? "Decision Confirmed" : "Finalize Adjudication"}
          </button>
        </div>
      </div>

      {/* ── Status banners ── */}
      {confirmed && !reviewState && (
        <div className="flex items-center gap-3 border-l-4 border-emerald-500 bg-emerald-50 px-6 py-4">
          <span
            className="material-symbols-outlined text-sm text-emerald-600"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            task_alt
          </span>
          <p className="text-sm font-semibold text-emerald-800">
            Adjudication finalized. The record has been updated.
          </p>
        </div>
      )}

      {reviewState && (
        <div
          className={`flex items-start gap-4 border-l-4 px-6 py-4 ${
            reviewState.status === "resolved"
              ? "border-emerald-500 bg-emerald-50"
              : "border-amber-500 bg-amber-50"
          }`}
        >
          <span
            className={`material-symbols-outlined mt-0.5 text-sm ${
              reviewState.status === "resolved" ? "text-emerald-600" : "text-amber-600"
            }`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {reviewState.status === "resolved" ? "task_alt" : "pending"}
          </span>
          <div className="flex-1 text-sm">
            <p className={`font-bold ${reviewState.status === "resolved" ? "text-emerald-800" : "text-amber-800"}`}>
              {reviewState.status === "resolved" ? "Human Review Resolved" : "Human Review In Progress"}
            </p>
            <p className={`mt-0.5 ${reviewState.status === "resolved" ? "text-emerald-700" : "text-amber-700"}`}>
              {reviewState.reason}
              {reviewState.reviewer_name && ` · Reviewed by ${reviewState.reviewer_name}`}
            </p>
            {reviewState.reviewer_notes && (
              <p className="mt-1 text-xs italic opacity-80">"{reviewState.reviewer_notes}"</p>
            )}
          </div>
        </div>
      )}

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">

        {/* ────── Left: col-span-8 ────── */}
        <div className="space-y-8 xl:col-span-8">

          {/* AI Adjudication Synthesis */}
          <div className="relative overflow-hidden rounded-sm border-l-4 border-[#0053dc] bg-white p-8 shadow-sm">
            <div className="absolute -right-4 -top-4 opacity-[0.03]">
              <span className="material-symbols-outlined text-[160px]">psychology</span>
            </div>

            <div className="relative mb-6 flex items-center gap-3">
              <span
                className="material-symbols-outlined text-[#0053dc]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                insights
              </span>
              <h3 className="font-display text-lg font-bold text-[#2a3439]">
                AI Adjudication Synthesis
              </h3>
            </div>

            <div className="relative space-y-8">
              {/* Italic quote with left bar */}
              <div className="flex gap-4">
                <div className="h-auto w-1 rounded-full bg-[#e8eff3]" />
                <p className="flex-1 text-sm font-medium italic leading-relaxed text-[#2a3439]">
                  "{result?.decision.rationale ??
                    "Process a claim via Policy Manager to populate AI synthesis, policy retrieval results, and adjudication reasoning."}"
                </p>
              </div>

              {/* 3 metric tiles */}
              <div className="grid grid-cols-3 gap-6 pt-4">
                {/* Policy Match */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Policy Match
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {confidence !== null ? `${confidence}%` : "--"}
                  </p>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#0053dc]"
                      style={{ width: `${confidence ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Duplication Risk */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Duplication Risk
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {result?.validation.is_valid ? "Low" : "Medium"}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <div className="h-1 flex-1 rounded-full bg-[#0053dc]" />
                    <div className="h-1 flex-1 rounded-full bg-slate-200" />
                    <div className="h-1 flex-1 rounded-full bg-slate-200" />
                  </div>
                </div>

                {/* Network Parity */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Network Parity
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {result?.requires_human_review ? "Review" : "Tier 1"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[#0053dc]">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {result?.requires_human_review ? "pending" : "verified"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">
                      {result?.requires_human_review ? "Pending" : "Verified"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line Item Adjudication */}
          <div className="overflow-hidden rounded-sm border border-[rgba(169,180,185,0.1)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[rgba(169,180,185,0.1)] bg-slate-50 px-6 py-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#2a3439]">
                Line Item Adjudication
              </h3>
              <button
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#0053dc]"
                type="button"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                Filter Ledger
              </button>
            </div>

            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[rgba(169,180,185,0.1)] bg-slate-50/50">
                  <th className="px-6 py-3 text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                    CPT / HCPCS Code
                  </th>
                  <th className="px-6 py-3 text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                    Description
                  </th>
                  <th className="px-6 py-3 text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                    Billed
                  </th>
                  <th className="px-6 py-3 text-right text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                    Allowed
                  </th>
                  <th className="px-6 py-3 text-center text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceLines.length > 0 ? (
                  serviceLines.map((line) => {
                    const allowed = lineAllowed(line.charge_amount);
                    const isDenied = outcome === "deny";
                    return (
                      <tr
                        className={`transition-colors hover:bg-slate-50 ${isDenied ? "bg-red-50/20" : ""}`}
                        key={line.line_number}
                      >
                        <td className="px-6 py-5">
                          <p className="text-xs font-bold text-[#2a3439]">{line.procedure_code}</p>
                          {line.modifiers.length > 0 && (
                            <p className="text-[10px] font-medium text-[#566166]">
                              MOD: {line.modifiers.join(", ")}
                            </p>
                          )}
                          {line.units > 1 && (
                            <p className="text-[10px] font-medium text-[#566166]">
                              UNITS: {line.units}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-xs font-medium text-[#2a3439]">
                            Procedure {line.procedure_code}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-xs font-bold text-[#2a3439]">
                            ${line.charge_amount.toFixed(2)}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <p
                            className={`text-xs font-extrabold ${
                              isDenied ? "text-[#9f403d]" : "text-[#0053dc]"
                            }`}
                          >
                            ${allowed.toFixed(2)}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span
                            className={`material-symbols-outlined ${
                              isDenied ? "text-[#9f403d]" : "text-[#0053dc]"
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {isDenied ? "error" : "check_circle"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-400" colSpan={5}>
                      Process a claim to populate line items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Footer totals */}
            <div className="flex items-center justify-between border-t border-[rgba(169,180,185,0.1)] bg-slate-50 px-6 py-6">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#566166]">
                Summary Calculation
              </p>
              <div className="flex gap-10">
                <div className="text-right">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#566166]">
                    Gross Billed
                  </p>
                  <p className="text-sm font-bold text-[#2a3439]">
                    ${grossBilled.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#566166]">
                    Network Savings
                  </p>
                  <p className="text-sm font-bold text-[#2a3439]">
                    -${networkSavings.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[9px] font-extrabold uppercase tracking-wider text-[#0053dc]">
                    Payable Total
                  </p>
                  <p className="font-display text-xl font-extrabold text-[#0053dc]">
                    ${payableTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ────── Right: col-span-4 ────── */}
        <div className="space-y-8 xl:col-span-4">

          {/* Policy Matches */}
          <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
              Policy Matches
            </h3>
            {result?.matched_policies?.length ? (
              <div className="space-y-4">
                {result.matched_policies.slice(0, 3).map((policy, i) => (
                  <div
                    className={`p-4 ${
                      i === 0
                        ? "border-l-2 border-[#0053dc] bg-slate-50"
                        : "cursor-pointer border-l-2 border-transparent bg-white transition-colors hover:border-slate-300"
                    }`}
                    key={policy.policy_id}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <p className="text-xs font-bold text-[#2a3439]">{policy.title}</p>
                      {i === 0 && (
                        <span className="rounded-sm bg-[#0053dc]/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-[#0053dc]">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <p className="mb-4 text-[11px] leading-relaxed text-[#566166]">
                      {policy.summary}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-[#0053dc]">attachment</span>
                      <span className="text-[10px] font-bold text-[#0053dc] underline decoration-[#0053dc]/30">
                        {Math.round(policy.relevance_score * 100)}% relevance match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Policy matches will appear after processing a claim.
              </p>
            )}
          </div>

          {/* Documentation / Review Form */}
          <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
            {showReviewForm ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                    Manual Review
                  </h3>
                  <button
                    className="text-[11px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc]"
                    onClick={() => setShowReviewForm(false)}
                    type="button"
                  >
                    ← Back
                  </button>
                </div>
                <ReviewForm
                  onCancel={() => setShowReviewForm(false)}
                  onSubmit={handleSubmitReview}
                />
              </>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                    Documentation
                  </h3>
                  {result?.decision.cited_rules?.length ? (
                    <span className="text-[9px] font-extrabold uppercase text-[#566166]">
                      {result.decision.cited_rules.length} REFS
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {result?.decision.cited_rules?.length ? (
                    result.decision.cited_rules.map((rule) => (
                      <div
                        className="group flex cursor-pointer items-center gap-4 rounded-sm border border-transparent p-2.5 transition-all hover:border-slate-100 hover:bg-slate-50"
                        key={rule}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-500">
                          <span className="material-symbols-outlined">description</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#2a3439]">{rule}</p>
                          <p className="text-[10px] text-[#566166]">Policy Reference</p>
                        </div>
                        <span className="material-symbols-outlined text-sm text-[#0053dc] opacity-0 transition-opacity group-hover:opacity-100">
                          open_in_new
                        </span>
                      </div>
                    ))
                  ) : (
                    <>
                      {[
                        { name: "Claim_Submission.json", meta: "Auto-ingested" },
                        { name: "Validation_Report.txt", meta: "System generated" },
                      ].map((doc) => (
                        <div
                          className="group flex cursor-pointer items-center gap-4 rounded-sm border border-transparent p-2.5 transition-all hover:border-slate-100 hover:bg-slate-50"
                          key={doc.name}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-500">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-[#2a3439]">{doc.name}</p>
                            <p className="text-[10px] text-[#566166]">{doc.meta}</p>
                          </div>
                          <span className="material-symbols-outlined text-sm text-[#0053dc] opacity-0 transition-opacity group-hover:opacity-100">
                            download
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="mt-6 space-y-2">
                  <button
                    className="w-full rounded-sm border border-[rgba(169,180,185,0.2)] py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439] transition-colors hover:bg-slate-50"
                    disabled={!result}
                    onClick={() => setShowReviewForm(true)}
                    type="button"
                  >
                    Override / Submit Review
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Audit Trail */}
          <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
            <h3 className="mb-8 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
              Audit Trail
            </h3>
            {result?.audit_trail?.length ? (
              <AuditTrailPanel events={result.audit_trail} />
            ) : (
              <div className="relative space-y-8 pl-6">
                <div className="absolute bottom-1 left-[7px] top-1 w-[1.5px] bg-slate-100" />
                {FALLBACK_TRAIL.map((item) => (
                  <div className="relative" key={item.label}>
                    <div
                      className={`absolute -left-[23px] top-0 h-3 w-3 rounded-full border-2 border-white ${
                        item.active ? "bg-[#0053dc] ring-4 ring-[#0053dc]/5" : "bg-slate-200"
                      }`}
                    />
                    <p className="mb-1.5 text-[9px] font-extrabold uppercase leading-none tracking-widest text-[#566166]">
                      {item.time}
                    </p>
                    <p className="text-xs font-bold text-[#2a3439]">{item.label}</p>
                    <p className="mt-1 text-[11px] text-[#566166]">{item.copy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
