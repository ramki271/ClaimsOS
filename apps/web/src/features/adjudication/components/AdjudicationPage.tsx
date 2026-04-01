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
  // Normalize microseconds (>3 decimal places) to milliseconds so Date.parse works in all browsers
  const normalized = createdAt.replace(/(\.\d{3})\d+/, "$1");
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ACTIVE_EVENTS = new Set([
  "claim_received",
  "validation_completed",
  "policy_retrieval_completed",
  "adjudication_completed",
  "claim_processed",
  "manual_review",
]);

// ─────────────────────────────────────────────────────────────
// AuditTrail
// ─────────────────────────────────────────────────────────────
function AuditTrailPanel({ events }: { events: AuditEvent[] }) {
  // Sort newest first, then deduplicate keeping the latest of each event_type.
  // The backend appends a full sequence on every reprocessing run; we only show the most recent run.
  const sorted = [...events].sort((a, b) => {
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    const normalize = (s: string) => s.replace(/(\.\d{3})\d+/, "$1");
    return new Date(normalize(b.created_at)).getTime() - new Date(normalize(a.created_at)).getTime();
  });
  const seen = new Set<string>();
  const deduped = sorted.filter((e) => {
    if (seen.has(e.event_type)) return false;
    seen.add(e.event_type);
    return true;
  });

  return (
    <div className="relative space-y-8 pl-6">
      <div className="absolute bottom-1 left-[7px] top-1 w-[1.5px] bg-slate-100" />
      {deduped.map((event, i) => (
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
// ResolveReviewForm — explicit 3-option disposition for review claims
// ─────────────────────────────────────────────────────────────
const DISPOSITIONS = [
  {
    key: "approve" as const,
    label: "Approve",
    icon: "check_circle",
    activeClass: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    key: "deny" as const,
    label: "Deny",
    icon: "cancel",
    activeClass: "border-[#9f403d] bg-[#9f403d] text-white",
  },
  {
    key: "keep_in_review" as const,
    label: "Keep Under Review",
    icon: "pending",
    activeClass: "border-amber-500 bg-amber-500 text-white",
  },
] as const;

type Disposition = (typeof DISPOSITIONS)[number]["key"];

function ResolveReviewForm({
  onSubmit,
  onCancel,
  aiOutcome,
}: {
  onSubmit: (review: ClaimReviewRequest) => Promise<void>;
  onCancel: () => void;
  aiOutcome: string;
}) {
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!disposition) {
      setError("Select a disposition before submitting.");
      return;
    }
    if (!notes.trim()) {
      setError("Reviewer notes are required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: ClaimReviewRequest =
        disposition === "keep_in_review"
          ? {
              reviewer_name: reviewerName.trim() || undefined,
              reviewer_notes: notes.trim(),
              review_status: "in_review",
            }
          : {
              reviewer_name: reviewerName.trim() || undefined,
              reviewer_notes: notes.trim(),
              review_status: "resolved",
              override_outcome: disposition,
            };
      await onSubmit(payload);
    } catch {
      setError("Failed to submit. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Context banner */}
      <div className="rounded-sm bg-amber-50 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-amber-800">
          This claim is pending manual review. Select a final disposition to resolve adjudication.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">
            AI Recommendation
          </span>
          <span className="rounded-sm bg-[#dbe1ff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#003798]">
            {aiOutcome || "Review"}
          </span>
        </div>
      </div>

      {/* Disposition — required */}
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
          Disposition <span className="text-[#9f403d]">*</span>
        </label>
        <div className="flex flex-col gap-2">
          {DISPOSITIONS.map(({ key, label, icon, activeClass }) => (
            <button
              className={`flex items-center gap-3 rounded-sm border px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors ${
                disposition === key
                  ? activeClass
                  : "border-[rgba(169,180,185,0.3)] bg-white text-[#566166] hover:bg-slate-50"
              }`}
              key={key}
              onClick={() => setDisposition(key)}
              type="button"
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {icon}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviewer name */}
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

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
          Notes <span className="text-[#9f403d]">*</span>
        </label>
        <textarea
          className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe your findings and rationale for this disposition…"
          rows={3}
          value={notes}
        />
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
          {isSubmitting ? "Submitting…" : "Submit Disposition"}
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
// AgentWorkflowPanel — agentic pipeline status for the right rail
// ─────────────────────────────────────────────────────────────
type AgentPipelineStatus = "completed" | "active" | "escalated" | "pending";

type AgentPipelineStep = {
  label: string;
  copy: string;
  status: AgentPipelineStatus;
};

function PipelineStepIcon({ status }: { status: AgentPipelineStatus }) {
  if (status === "completed")
    return (
      <span
        className="material-symbols-outlined text-[18px] text-emerald-500"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        check_circle
      </span>
    );
  if (status === "active")
    return (
      <span
        className="material-symbols-outlined animate-pulse text-[18px] text-[#0053dc]"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        pending
      </span>
    );
  if (status === "escalated")
    return (
      <span
        className="material-symbols-outlined text-[18px] text-amber-500"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        warning
      </span>
    );
  return (
    <span className="material-symbols-outlined text-[18px] text-slate-200">
      radio_button_unchecked
    </span>
  );
}

function AgentWorkflowPanel({ result }: { result: ClaimDetailResponse | null }) {
  if (!result) {
    // Empty state — show all pending
    const emptySteps: AgentPipelineStep[] = [
      { label: "AI Intake Agent", copy: "Normalizes raw claim data", status: "pending" },
      { label: "AI Validation Agent", copy: "Verifies required claim fields", status: "pending" },
      { label: "AI Policy Agent", copy: "Retrieves payer policy evidence", status: "pending" },
      { label: "AI Adjudication Agent", copy: "Determines claim outcome", status: "pending" },
      { label: "Human Review Agent", copy: "Final disposition when required", status: "pending" },
    ];
    return <PipelineStepList steps={emptySteps} />;
  }

  const outcome = result.decision?.outcome ?? "";
  const requiresReview = result.requires_human_review;
  const reviewStatus = result.review_state?.status ?? null;
  const isResolved = reviewStatus === "resolved";

  const steps: AgentPipelineStep[] = [
    {
      label: "AI Intake Agent",
      copy: "Normalized and ingested claim data",
      status: "completed",
    },
    {
      label: "AI Validation Agent",
      copy: result.validation?.is_valid
        ? "Verified required claim fields"
        : result.validation?.issues?.length
        ? `${result.validation.issues.length} issue${result.validation.issues.length > 1 ? "s" : ""} flagged`
        : "Verified required claim fields",
      status: "completed",
    },
    {
      label: "AI Policy Agent",
      copy:
        result.matched_policies?.length
          ? `Retrieved ${result.matched_policies.length} matching polic${result.matched_policies.length > 1 ? "ies" : "y"}`
          : "No matching policies found",
      status: result.matched_policies?.length ? "completed" : "escalated",
    },
    {
      label: "AI Adjudication Agent",
      copy:
        outcome === "review"
          ? "Recommended manual review — escalated"
          : outcome === "approve"
          ? "Recommended approval"
          : outcome === "deny"
          ? "Recommended denial"
          : "Decision rendered",
      status: outcome === "review" ? "escalated" : "completed",
    },
    {
      label: "Human Review Agent",
      copy: !requiresReview
        ? "Not required for this claim"
        : isResolved
        ? reviewStatus === "resolved"
          ? `Resolved${result.review_state?.reviewer_name ? ` by ${result.review_state.reviewer_name}` : ""}`
          : "Review complete"
        : "Awaiting reviewer disposition",
      status: !requiresReview
        ? "pending"
        : isResolved
        ? "completed"
        : "active",
    },
  ];

  return <PipelineStepList steps={steps} />;
}

function PipelineStepList({ steps }: { steps: AgentPipelineStep[] }) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute bottom-2 left-[8px] top-2 w-px bg-slate-100" />
      {steps.map((step, i) => (
        <div className="relative flex items-start gap-3" key={i}>
          <div className="absolute -left-[22px] top-0">
            <PipelineStepIcon status={step.status} />
          </div>
          <div>
            <p
              className={`text-[11px] font-bold leading-tight ${
                step.status === "completed"
                  ? "text-[#2a3439]"
                  : step.status === "active"
                  ? "text-[#0053dc]"
                  : step.status === "escalated"
                  ? "text-amber-700"
                  : "text-slate-400"
              }`}
            >
              {step.label}
            </p>
            <p
              className={`mt-0.5 text-[10px] leading-tight ${
                step.status === "escalated" ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {step.copy}
            </p>
          </div>
        </div>
      ))}
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
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const oc = outcomeStyle(result?.decision.outcome ?? "review");
  const reviewState = result?.review_state ?? null;
  const outcome = result?.decision.outcome ?? "";

  // A claim needs the explicit disposition flow if the AI outcome is "review"
  // or the backend flagged it for human review and it hasn't been resolved yet.
  const isReviewClaim =
    outcome === "review" ||
    (result?.requires_human_review === true && reviewState?.status !== "resolved");
  const isResolved = confirmed || reviewState?.status === "resolved";

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
    setShowResolveModal(false);
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
          {/* Request Info — secondary action, available for all claims */}
          {!isReviewClaim && (
            <button
              className="rounded-sm border border-[rgba(169,180,185,0.3)] px-6 py-2.5 text-xs font-bold tracking-tight text-[#2a3439] transition-colors hover:bg-[#e1e9ee]"
              onClick={() => setShowReviewForm(true)}
              type="button"
            >
              Add Notes
            </button>
          )}

          {/* Primary CTA */}
          {isReviewClaim ? (
            /* Review claim — must go through explicit disposition form */
            <button
              className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_8px_24px_rgba(0,83,220,0.2)] disabled:opacity-60"
              disabled={!result || isResolved}
              onClick={() => setShowResolveModal(true)}
              type="button"
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isResolved ? "task_alt" : "gavel"}
              </span>
              {isResolved ? "Review Resolved" : "Resolve Review"}
            </button>
          ) : (
            /* Approved / denied claim — simple one-click confirm */
            <button
              className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_8px_24px_rgba(0,83,220,0.2)] disabled:opacity-60"
              disabled={!result || isConfirming || isResolved}
              onClick={() => void handleConfirmDecision()}
              type="button"
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isResolved ? "task_alt" : "check_circle"}
              </span>
              {isConfirming ? "Confirming…" : isResolved ? "Decision Confirmed" : "Confirm Decision"}
            </button>
          )}
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
            {reviewState.status !== "resolved" && result?.decision.review_triggers?.length ? (
              <ul className="mt-2 space-y-0.5">
                {result.decision.review_triggers.map((t, i) => (
                  <li className="text-xs text-amber-700 before:mr-1.5 before:content-['›']" key={i}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      {/* Prior Auth Banner */}
      {result?.utilization_context?.prior_auth_required === true &&
        result.utilization_context.prior_auth_status === "pending_review" && (
          <div className="flex items-start gap-4 rounded-sm border border-purple-200 bg-purple-50 px-6 py-4">
            <span
              className="material-symbols-outlined mt-0.5 text-purple-600"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              assignment_late
            </span>
            <div className="flex-1 text-sm">
              <p className="font-bold text-purple-900">Prior Authorization Required — Pending Review</p>
              {result.utilization_context.review_reason && (
                <p className="mt-0.5 text-purple-800">{result.utilization_context.review_reason}</p>
              )}
              {result.utilization_context.trigger_codes.length > 0 && (
                <p className="mt-1 text-[11px] text-purple-700">
                  Trigger codes: {result.utilization_context.trigger_codes.join(", ")}
                </p>
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
                    "Process a claim via Intake to populate AI synthesis, policy retrieval results, and adjudication reasoning."}"
                </p>
              </div>

              {/* Passed / failed checks */}
              {(result?.decision.passed_checks?.length || result?.decision.failed_checks?.length) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {result.decision.passed_checks?.length ? (
                    <div>
                      <p className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-emerald-600">
                        Passed Checks
                      </p>
                      <ul className="space-y-1.5">
                        {result.decision.passed_checks.map((c) => (
                          <li className="flex items-start gap-2" key={c.code}>
                            <span
                              className="material-symbols-outlined mt-px text-sm text-emerald-500"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check_circle
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold text-[#2a3439]">{c.label}</p>
                              {c.summary && (
                                <p className="text-[10px] text-[#566166]">{c.summary}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.decision.failed_checks?.length ? (
                    <div>
                      <p className="mb-2 text-[9px] font-extrabold uppercase tracking-widest text-[#c94b41]">
                        Failed Checks
                      </p>
                      <ul className="space-y-1.5">
                        {result.decision.failed_checks.map((c) => (
                          <li className="flex items-start gap-2" key={c.code}>
                            <span
                              className="material-symbols-outlined mt-px text-sm text-[#c94b41]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              cancel
                            </span>
                            <div>
                              <p className="text-[11px] font-semibold text-[#2a3439]">{c.label}</p>
                              {c.summary && (
                                <p className="text-[10px] text-[#566166]">{c.summary}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 3 metric tiles */}
              <div className="grid grid-cols-3 gap-6 pt-4">
                {/* Policy Match */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Policy Match
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {result?.insights?.policy_match?.value ?? "--"}
                  </p>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#0053dc]"
                      style={{ width: `${Math.round((result?.insights?.policy_match?.score ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Duplication Risk */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Duplication Risk
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {result?.insights?.duplication_risk?.value ?? "--"}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        result?.insights?.duplication_risk?.status
                          ? "bg-[#0053dc]"
                          : "bg-slate-200"
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        ["moderate", "high"].includes(result?.insights?.duplication_risk?.status ?? "")
                          ? "bg-[#0053dc]"
                          : "bg-slate-200"
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        result?.insights?.duplication_risk?.status === "high"
                          ? "bg-[#0053dc]"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>
                </div>

                {/* Network Parity */}
                <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-[#f0f4f7] p-5">
                  <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#566166]">
                    Network Parity
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[#2a3439]">
                    {result?.insights?.network_parity?.value ?? "--"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[#0053dc]">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {result?.insights?.network_parity?.status === "pending"
                        ? "pending"
                        : result?.insights?.network_parity?.status === "mismatch"
                          ? "warning"
                          : "verified"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">
                      {(result?.insights?.network_parity?.status ?? "--").replace("_", " ")}
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

          {/* Agent Workflow */}
          <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                Agent Workflow
              </h3>
              <span className="flex items-center gap-1 rounded-sm bg-[#0053dc]/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#0053dc]">
                <span
                  className="material-symbols-outlined text-[10px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                AI Trace
              </span>
            </div>
            <AgentWorkflowPanel result={result} />
          </div>

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
                      <p className="text-xs font-bold text-[#2a3439]">
                        {policy.document_label ?? policy.title}
                      </p>
                      {i === 0 && (
                        <span className="rounded-sm bg-[#0053dc]/10 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-[#0053dc]">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    {policy.source_reference && (
                      <p className="mb-1 text-[10px] font-semibold text-[#0053dc]">
                        {policy.source_reference}
                      </p>
                    )}
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

          {/* Provider Contract Context */}
          {result?.provider_context && (() => {
            const pc = result.provider_context!;
            const networkOk = pc.network_status === "in_network";
            const contractOk = pc.contract_status === "active";

            function statusChip(ok: boolean, label: string) {
              return (
                <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  ok ? "bg-emerald-50 text-emerald-700" : "bg-[#fdeceb] text-[#c94b41]"
                }`}>
                  <span
                    className="material-symbols-outlined text-[10px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {ok ? "check_circle" : "cancel"}
                  </span>
                  {label}
                </span>
              );
            }

            return (
              <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
                <h3 className="mb-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                  Provider Contract
                </h3>

                <div className="mb-4">
                  <p className="text-sm font-bold text-[#2a3439]">{pc.provider_name}</p>
                  {pc.specialty && (
                    <p className="text-[11px] text-[#566166]">{pc.specialty}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Network Status</span>
                    {statusChip(networkOk, pc.network_status.replace(/_/g, " "))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Contract Status</span>
                    {statusChip(contractOk, pc.contract_status)}
                  </div>

                  {pc.contract_tier && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#566166]">Contract Tier</span>
                      <span className="text-[11px] font-bold text-[#2a3439]">{pc.contract_tier}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Plan Participation</span>
                    {statusChip(pc.participates_in_plan, pc.participates_in_plan ? "Participates" : "Not Participating")}
                  </div>

                  {pc.specialty_match !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#566166]">Specialty Alignment</span>
                      {statusChip(pc.specialty_match ?? false, pc.specialty_match ? "Matched" : "Mismatch")}
                    </div>
                  )}

                  {(pc.network_effective_date || pc.network_end_date) && (
                    <div className="border-t border-slate-50 pt-3">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#566166]">
                        Coverage Window
                      </p>
                      <p className="text-[11px] font-medium text-[#2a3439]">
                        {pc.network_effective_date ?? "—"} → {pc.network_end_date ?? "Open"}
                      </p>
                    </div>
                  )}

                  {pc.specialty_match_reason && (
                    <p className="border-t border-slate-50 pt-3 text-[11px] italic text-[#566166]">
                      {pc.specialty_match_reason}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Utilization / Prior Auth */}
          {result?.utilization_context && (() => {
            const uc = result.utilization_context!;
            const levelColors: Record<string, string> = {
              routine: "bg-emerald-50 text-emerald-700",
              elevated: "bg-amber-50 text-amber-700",
              prior_auth: "bg-purple-50 text-purple-700",
            };
            const authStatusColors: Record<string, string> = {
              not_required: "bg-slate-100 text-slate-600",
              pending_review: "bg-amber-50 text-amber-700",
              satisfied: "bg-emerald-50 text-emerald-700",
            };
            const levelLabel = uc.utilization_level.replace(/_/g, " ");
            const authLabel = uc.prior_auth_status.replace(/_/g, " ");
            return (
              <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
                <h3 className="mb-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                  Utilization / Prior Auth
                </h3>

                {uc.review_reason && (
                  <p className="mb-4 text-[11px] italic leading-relaxed text-[#566166]">
                    {uc.review_reason}
                  </p>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Utilization Level</span>
                    <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${levelColors[uc.utilization_level] ?? "bg-slate-100 text-slate-600"}`}>
                      {levelLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Prior Auth Required</span>
                    <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      uc.prior_auth_required ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {uc.prior_auth_required ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#566166]">Auth Status</span>
                    <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${authStatusColors[uc.prior_auth_status] ?? "bg-slate-100 text-slate-600"}`}>
                      {authLabel}
                    </span>
                  </div>

                  {uc.trigger_codes.length > 0 && (
                    <div className="border-t border-slate-50 pt-3">
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-[#566166]">
                        Trigger Codes
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {uc.trigger_codes.map((code) => (
                          <span
                            className="rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#2a3439]"
                            key={code}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Documentation / Review Form */}
          <div className="rounded-sm border border-[rgba(169,180,185,0.1)] bg-white p-6 shadow-sm">
            {showReviewForm ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-display text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
                    {isReviewClaim ? "Resolve Review" : "Add Notes"}
                  </h3>
                  <button
                    className="text-[11px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc]"
                    onClick={() => setShowReviewForm(false)}
                    type="button"
                  >
                    ← Back
                  </button>
                </div>
                {isReviewClaim ? (
                  <ResolveReviewForm
                    aiOutcome={outcome}
                    onCancel={() => setShowReviewForm(false)}
                    onSubmit={handleSubmitReview}
                  />
                ) : (
                  <ReviewForm
                    onCancel={() => setShowReviewForm(false)}
                    onSubmit={handleSubmitReview}
                  />
                )}
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
                  {result?.decision.cited_rules?.length ? (() => {
                    // Build lookup: policy_id → matched policy (for resolving OpenAI file IDs to titles)
                    const policyMap = new Map(
                      (result.matched_policies ?? []).map((p) => [p.policy_id, p])
                    );
                    return result.decision.cited_rules.map((rule) => {
                      const matched = policyMap.get(rule);
                      const displayTitle = matched?.document_label
                        ?? matched?.title
                        ?? (rule.startsWith("file-") ? "Policy Document" : rule);
                      const displayMeta = matched?.source_reference
                        ?? (matched ? `${Math.round(matched.relevance_score * 100)}% relevance match` : "Policy Reference");
                      return (
                        <div
                          className="group flex cursor-pointer items-center gap-4 rounded-sm border border-transparent p-2.5 transition-all hover:border-slate-100 hover:bg-slate-50"
                          key={rule}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-500">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-bold text-[#2a3439]">{displayTitle}</p>
                            <p className="text-[10px] text-[#566166]">{displayMeta}</p>
                          </div>
                          <span className="material-symbols-outlined text-sm text-[#0053dc] opacity-0 transition-opacity group-hover:opacity-100">
                            open_in_new
                          </span>
                        </div>
                      );
                    });
                  })() : (
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

      {/* ── Resolve Review Modal ── */}
      {showResolveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResolveModal(false); }}
        >
          <div className="w-full max-w-md rounded-sm bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[rgba(169,180,185,0.15)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="material-symbols-outlined text-[#0053dc]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  gavel
                </span>
                <h3 className="font-display text-sm font-bold text-[#2a3439]">Resolve Review</h3>
              </div>
              <button
                className="text-[#566166] hover:text-[#2a3439]"
                onClick={() => setShowResolveModal(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6">
              <ResolveReviewForm
                aiOutcome={outcome}
                onCancel={() => setShowResolveModal(false)}
                onSubmit={handleSubmitReview}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
