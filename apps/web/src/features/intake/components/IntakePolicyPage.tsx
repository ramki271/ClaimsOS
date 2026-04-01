import { useRef, useState } from "react";
import type {
  ClaimDocumentDraft,
  ClaimDocumentIntakeResponse,
  ClaimSubmission,
  DraftServiceLine,
  X12BatchUploadResponse,
} from "../../../shared/api/claims";

// ─────────────────────────────────────────────────────────────
// EditableDraft — flat string-keyed form state for the AI review step.
// All values are strings so inputs bind cleanly; converted to ClaimSubmission at submit.
// ─────────────────────────────────────────────────────────────
type EditableDraft = {
  claim_id: string;
  payer_name: string;
  plan_name: string;
  member_id: string;
  member_name: string;
  patient_id: string;
  provider_id: string;
  provider_name: string;
  place_of_service: string;
  diagnosis_codes_raw: string; // comma-separated
  procedure_codes_raw: string; // comma-separated
  amount_raw: string;
  date_of_service: string;
  // Preserved extracted service lines — used verbatim at submit when present
  _extractedServiceLines: import("../../../shared/api/claims").DraftServiceLine[];
};

function draftToEditable(draft: ClaimDocumentDraft): EditableDraft {
  return {
    claim_id: draft.claim_id ?? "",
    payer_name: draft.payer_name ?? "",
    plan_name: draft.plan_name ?? "",
    member_id: draft.member_id ?? "",
    member_name: draft.member_name ?? "",
    patient_id: draft.patient_id ?? "",
    provider_id: draft.provider_id ?? "",
    provider_name: draft.provider_name ?? "",
    place_of_service: draft.place_of_service ?? "",
    diagnosis_codes_raw: draft.diagnosis_codes.join(", "),
    procedure_codes_raw: draft.procedure_codes.join(", "),
    amount_raw: draft.amount != null ? String(draft.amount) : "",
    date_of_service: draft.date_of_service ?? "",
    _extractedServiceLines: draft.service_lines,
  };
}

function editableToSubmission(e: EditableDraft): ClaimSubmission {
  const diagCodes = e.diagnosis_codes_raw.split(",").map((s) => s.trim()).filter(Boolean);
  const procCodes = e.procedure_codes_raw.split(",").map((s) => s.trim()).filter(Boolean);
  const amount = parseFloat(e.amount_raw) || 0;

  // Prefer extracted service lines when they're complete AND still consistent with
  // the user's reviewed proc codes and amount. If either drifted (user edited them),
  // rebuild from the edited top-level values so line data stays in sync.
  const extractedComplete = e._extractedServiceLines.filter(
    (l): l is DraftServiceLine & { procedure_code: string; charge_amount: number; units: number } =>
      l.procedure_code != null && l.charge_amount != null && l.units != null,
  );

  const extractedProcCodes = extractedComplete.map((l) => l.procedure_code);
  const extractedTotal = extractedComplete.reduce((sum, l) => sum + l.charge_amount, 0);
  const codesMatch =
    procCodes.length === extractedProcCodes.length &&
    procCodes.every((c, i) => c === extractedProcCodes[i]);
  const amountMatches = Math.abs(extractedTotal - amount) < 0.01;

  const serviceLines =
    extractedComplete.length > 0 && codesMatch && amountMatches
      ? extractedComplete.map((l, i) => ({
          line_number: l.line_number ?? i + 1,
          procedure_code: l.procedure_code,
          modifiers: l.modifiers,
          units: l.units,
          charge_amount: l.charge_amount,
        }))
      : procCodes.map((code, i) => ({
          line_number: i + 1,
          procedure_code: code,
          modifiers: [],
          units: 1,
          charge_amount:
            procCodes.length > 0
              ? Math.round((amount / procCodes.length) * 100) / 100
              : 0,
        }));

  return {
    claim_id: e.claim_id || `AI-${Date.now()}`,
    claim_type: "professional_outpatient",
    form_type: "CMS-1500",
    payer_name: e.payer_name,
    plan_name: e.plan_name,
    member_id: e.member_id,
    member_name: e.member_name,
    patient_id: e.patient_id || e.member_id,
    provider_id: e.provider_id || "PRV-AI",
    provider_name: e.provider_name,
    place_of_service: e.place_of_service || "11",
    diagnosis_codes: diagCodes,
    procedure_codes: procCodes,
    service_lines: serviceLines,
    amount,
    date_of_service: e.date_of_service,
  };
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
type IntakePolicyPageProps = {
  batchUploadResult: X12BatchUploadResponse | null;
  claimDraft: string;
  setClaimDraft: (value: string) => void;
  onLoadDemo: () => void;
  onProcessClaim: () => void;
  onUploadX12: (file: File) => Promise<void>;
  onUploadX12Batch: (file: File) => Promise<void>;
  onIntakeDocument: (
    file: File,
    autoProcess: boolean,
    payerNameHint?: string,
  ) => Promise<ClaimDocumentIntakeResponse>;
  onSubmitDraft: (claim: ClaimSubmission) => Promise<void>;
  onViewProcessedClaim: (claimId: string) => void;
  isLoading: boolean;
  demoClaim: ClaimSubmission | null;
};

const ACCEPTED = [".txt", ".x12", ".edi", ".837"];
const AI_ACCEPTED = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function IntakePolicyPage({
  batchUploadResult,
  claimDraft,
  setClaimDraft,
  onLoadDemo,
  onProcessClaim,
  onUploadX12,
  onUploadX12Batch,
  onIntakeDocument,
  onSubmitDraft,
  onViewProcessedClaim,
  isLoading,
  demoClaim,
}: IntakePolicyPageProps) {
  // X12 state
  const [x12File, setX12File] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");
  const [isDragging, setIsDragging] = useState(false);
  const [x12Error, setX12Error] = useState<string | null>(null);
  const [isUploadingX12, setIsUploadingX12] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Intake state
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiDraft, setAiDraft] = useState<ClaimDocumentIntakeResponse | null>(null);
  const [editableDraft, setEditableDraft] = useState<EditableDraft | null>(null);
  const [isDraggingAi, setIsDraggingAi] = useState(false);
  const [payerHint, setPayerHint] = useState("Apex Health Plan");
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Derived — recomputed each render from aiDraft
  const missingSet = new Set(aiDraft?.missing_fields ?? []);
  const lowConfMap = new Map((aiDraft?.low_confidence_fields ?? []).map((f) => [f.field, f]));

  // A draft is processable only when all fields required by ClaimSubmission are filled.
  const isReadyToProcess =
    editableDraft != null &&
    editableDraft.member_name.trim() !== "" &&
    editableDraft.member_id.trim() !== "" &&
    editableDraft.payer_name.trim() !== "" &&
    editableDraft.plan_name.trim() !== "" &&
    editableDraft.provider_name.trim() !== "" &&
    editableDraft.date_of_service.trim() !== "" &&
    editableDraft.diagnosis_codes_raw.trim() !== "" &&
    editableDraft.procedure_codes_raw.trim() !== "" &&
    parseFloat(editableDraft.amount_raw) > 0;

  // Count still-empty originally-missing fields for the callout
  const stillMissingCount =
    aiDraft?.missing_fields.filter((f) => {
      const k =
        f === "diagnosis_codes" ? "diagnosis_codes_raw"
        : f === "procedure_codes" ? "procedure_codes_raw"
        : f === "amount" ? "amount_raw"
        : (f as keyof EditableDraft);
      return !editableDraft?.[k]?.toString().trim();
    }).length ?? 0;

  // ── helpers ────────────────────────────────────────────────

  function setEditableField(key: keyof EditableDraft, value: string) {
    setEditableDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // Renders a labelled editable input for the draft review form.
  // Dynamically highlights fields that are still missing or low-confidence.
  function renderInputField(
    editKey: keyof EditableDraft,
    backendKey: string,
    label: string,
    placeholder: string,
    opts: { fullWidth?: boolean; multiline?: boolean } = {},
  ) {
    if (!editableDraft) return null;
    const val = String(editableDraft[editKey]);
    const isEmpty = val.trim() === "";
    const wasOriginallyMissing = missingSet.has(backendKey);
    const lowConf = lowConfMap.get(backendKey);
    const stillMissing = wasOriginallyMissing && isEmpty;

    const inputClass = [
      "w-full rounded-sm border px-3 py-2 text-sm text-[#2a3439] outline-none focus:ring-1",
      stillMissing
        ? "border-amber-400 bg-amber-50 focus:ring-amber-400"
        : lowConf
        ? "border-yellow-300 bg-yellow-50/40 focus:ring-yellow-300"
        : "border-[rgba(169,180,185,0.3)] bg-white focus:ring-[#0053dc]",
    ].join(" ");

    return (
      <div className={opts.fullWidth ? "col-span-2" : ""} key={editKey}>
        <div className="mb-1.5 flex items-center gap-2">
          <label className="block text-[9px] font-bold uppercase tracking-widest text-[#566166]">
            {label}
          </label>
          {stillMissing && (
            <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700">
              Required
            </span>
          )}
          {!stillMissing && lowConf && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
              <span className="material-symbols-outlined text-[11px]">warning</span>
              {lowConf.confidence} confidence
            </span>
          )}
        </div>
        {opts.multiline ? (
          <textarea
            className={`${inputClass} h-16 resize-none`}
            onChange={(e) => setEditableField(editKey, e.target.value)}
            placeholder={placeholder}
            value={val}
          />
        ) : (
          <input
            className={inputClass}
            onChange={(e) => setEditableField(editKey, e.target.value)}
            placeholder={placeholder}
            type="text"
            value={val}
          />
        )}
        {lowConf && (
          <p className="mt-1 text-[10px] text-amber-600">{lowConf.reason}</p>
        )}
      </div>
    );
  }

  // ── handlers ───────────────────────────────────────────────

  async function handleAiExtract() {
    if (!aiFile) return;
    setAiError(null);
    setIsAiExtracting(true);
    try {
      const response = await onIntakeDocument(aiFile, false, payerHint.trim() || undefined);
      setAiDraft(response);
      setEditableDraft(draftToEditable(response.claim_draft));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Extraction failed. Please try again.");
    } finally {
      setIsAiExtracting(false);
    }
  }

  async function handleSubmitReviewedDraft() {
    if (!editableDraft) return;
    setAiError(null);
    setIsAiProcessing(true);
    try {
      await onSubmitDraft(editableToSubmission(editableDraft));
      // App.tsx navigates to detail on success — no local cleanup needed
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Processing failed. Please try again.");
      setIsAiProcessing(false);
    }
  }

  function resetAiIntake() {
    setAiFile(null);
    setAiDraft(null);
    setEditableDraft(null);
    setAiError(null);
    setIsAiExtracting(false);
    setIsAiProcessing(false);
  }

  function handleFileSelect(file: File) {
    setX12File(file);
    setX12Error(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleX12Submit() {
    if (!x12File) return;
    setX12Error(null);
    setIsUploadingX12(true);
    try {
      if (uploadMode === "batch") {
        await onUploadX12Batch(x12File);
      } else {
        await onUploadX12(x12File);
      }
      setX12File(null);
    } catch (err) {
      setX12Error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploadingX12(false);
    }
  }

  // ── render ─────────────────────────────────────────────────

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
      {/* ── Main column ── */}
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
            Claim Submission
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2a3439]">
            Claim Intake
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Submit claims via AI document intake, X12 837P file upload, or structured JSON payload for immediate adjudication.
          </p>
        </div>

        {/* ── AI Document Intake ── */}
        <div className="overflow-hidden bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-[rgba(169,180,185,0.1)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-[#0053dc]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                document_scanner
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#2a3439]">AI Document Intake</h3>
                <p className="text-[10px] text-slate-400">
                  Upload a claim image, PDF, or document — AI extracts and normalizes the data for review
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-sm bg-[#0053dc]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#0053dc]">
              <span
                className="material-symbols-outlined text-[11px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              AI OCR
            </span>
          </div>

          <div className="p-6">
            {aiDraft && editableDraft ? (
              /* ── Draft Review (editable) ── */
              <div className="space-y-5">
                {/* Extraction summary */}
                <div className="flex items-start gap-3 rounded-sm bg-[#f0f4f7] px-4 py-3">
                  <span
                    className="material-symbols-outlined mt-0.5 text-[#0053dc]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-sm bg-[#0053dc]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0053dc]">
                        {aiDraft.source_type}
                      </span>
                      {aiFile && (
                        <span className="text-[10px] text-slate-400">{aiFile.name}</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#2a3439]">{aiDraft.extraction_summary}</p>
                  </div>
                  <button
                    className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc]"
                    onClick={resetAiIntake}
                    type="button"
                  >
                    ← Start Over
                  </button>
                </div>

                {/* Dynamic missing-fields callout */}
                {stillMissingCount > 0 && (
                  <div className="flex items-start gap-2 rounded-sm border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
                    <span className="material-symbols-outlined mt-0.5 text-sm text-amber-600">warning</span>
                    <p className="text-xs font-semibold text-amber-800">
                      {stillMissingCount} field{stillMissingCount !== 1 ? "s" : ""} still need{stillMissingCount === 1 ? "s" : ""} input before this claim can be processed.
                      Fields marked <span className="font-bold">Required</span> must be filled.
                    </p>
                  </div>
                )}

                {/* Editable field grid */}
                <div className="grid grid-cols-2 gap-3">
                  {renderInputField("member_name", "member_name", "Member Name", "Elena Martinez")}
                  {renderInputField("member_id", "member_id", "Member ID", "M-4421907")}
                  {renderInputField("provider_name", "provider_name", "Provider Name", "Front Range Family Medicine")}
                  {renderInputField("payer_name", "payer_name", "Payer", "Apex Health Plan")}
                  {renderInputField("plan_name", "plan_name", "Plan", "Commercial PPO 500")}
                  {renderInputField("date_of_service", "date_of_service", "Date of Service", "2026-03-01")}
                  {renderInputField("amount_raw", "amount", "Billed Amount ($)", "150.00")}
                  {renderInputField("place_of_service", "place_of_service", "Place of Service", "11")}
                  {renderInputField(
                    "diagnosis_codes_raw",
                    "diagnosis_codes",
                    "Diagnosis Codes",
                    "E11.9, I10",
                    { fullWidth: true },
                  )}
                  {renderInputField(
                    "procedure_codes_raw",
                    "procedure_codes",
                    "Procedure Codes",
                    "99213",
                    { fullWidth: true },
                  )}
                </div>

                {/* Review notes from AI */}
                {aiDraft.review_notes.length > 0 && (
                  <div className="rounded-sm border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                      AI Review Notes
                    </p>
                    <ul className="space-y-1">
                      {aiDraft.review_notes.map((note, i) => (
                        <li className="flex items-start gap-2 text-xs text-amber-800" key={i}>
                          <span className="mt-0.5 shrink-0 text-amber-500">›</span>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Error */}
                {aiError && (
                  <div className="flex items-start gap-3 rounded-sm border-l-4 border-[#c94b41] bg-[#fdeceb] px-4 py-3">
                    <span className="material-symbols-outlined mt-0.5 text-sm text-[#c94b41]">error</span>
                    <p className="text-xs font-semibold text-[#752121]">{aiError}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
                  <button
                    className={`flex items-center gap-2 rounded-sm px-6 py-2.5 text-xs font-bold tracking-tight text-white disabled:opacity-60 ${
                      isReadyToProcess
                        ? "bg-gradient-to-br from-[#0053dc] to-[#0049c2] shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
                        : "bg-amber-400"
                    }`}
                    disabled={!isReadyToProcess || isAiProcessing}
                    onClick={() => void handleSubmitReviewedDraft()}
                    type="button"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {isAiProcessing ? "pending" : isReadyToProcess ? "send" : "edit_note"}
                    </span>
                    {isAiProcessing
                      ? "Processing…"
                      : isReadyToProcess
                      ? "Process Claim"
                      : "Review & Complete Draft"}
                  </button>
                  {!isReadyToProcess && !isAiProcessing && (
                    <p className="text-[11px] text-amber-700">
                      Fill in the highlighted required fields to continue.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* ── Upload Mode ── */
              <div className="space-y-5">
                {/* Drop zone */}
                <div
                  className={`rounded-sm border-2 border-dashed px-8 py-10 text-center transition-colors ${
                    isDraggingAi
                      ? "border-[#0053dc] bg-[#eef4ff]"
                      : "border-[rgba(169,180,185,0.3)] bg-[#f7f9fb] hover:border-[#0053dc]/40"
                  }`}
                  onDragLeave={() => setIsDraggingAi(false)}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingAi(true); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingAi(false);
                    const file = e.dataTransfer.files[0];
                    if (file) { setAiFile(file); setAiError(null); }
                  }}
                >
                  <input
                    accept={AI_ACCEPTED.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setAiFile(file); setAiError(null); }
                    }}
                    ref={aiFileInputRef}
                    type="file"
                  />
                  {aiFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#eef4ff]">
                        <span
                          className="material-symbols-outlined text-2xl text-[#0053dc]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {/\.(png|jpg|jpeg|webp)$/i.test(aiFile.name) ? "image" : "description"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#2a3439]">{aiFile.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {(aiFile.size / 1024).toFixed(1)} KB · Ready for AI extraction
                        </p>
                      </div>
                      <button
                        className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#c94b41]"
                        onClick={() => { setAiFile(null); setAiError(null); }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#eef4ff]">
                        <span className="material-symbols-outlined text-2xl text-[#0053dc]">
                          document_scanner
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2a3439]">
                          Drop a claim document or image here
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          or{" "}
                          <button
                            className="font-bold text-[#0053dc] underline decoration-[#0053dc]/30"
                            onClick={() => aiFileInputRef.current?.click()}
                            type="button"
                          >
                            browse to select
                          </button>
                          {" "}— {AI_ACCEPTED.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payer hint */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
                    Payer Name Hint{" "}
                    <span className="normal-case text-slate-300">(optional — helps AI match the right plan)</span>
                  </label>
                  <input
                    className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
                    onChange={(e) => setPayerHint(e.target.value)}
                    placeholder="Apex Health Plan"
                    type="text"
                    value={payerHint}
                  />
                </div>

                {/* Error */}
                {aiError && (
                  <div className="flex items-start gap-3 rounded-sm border-l-4 border-[#c94b41] bg-[#fdeceb] px-4 py-3">
                    <span className="material-symbols-outlined mt-0.5 text-sm text-[#c94b41]">error</span>
                    <p className="text-xs font-semibold text-[#752121]">{aiError}</p>
                  </div>
                )}

                {/* Action */}
                <div className="flex items-center gap-3">
                  <button
                    className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-60"
                    disabled={!aiFile || isAiExtracting}
                    onClick={() => void handleAiExtract()}
                    type="button"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {isAiExtracting ? "pending" : "auto_awesome"}
                    </span>
                    {isAiExtracting ? "Extracting…" : "Extract Claim"}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    AI reads the document and creates a reviewable claim draft
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── X12 Upload ── */}
        <div className="bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-[rgba(169,180,185,0.1)] px-6 py-4">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[#0053dc]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                upload_file
              </span>
              <h3 className="text-sm font-bold text-[#2a3439]">X12 / EDI Upload</h3>
            </div>
            <div className="flex gap-2">
              {ACCEPTED.map((ext) => (
                <span
                  className="rounded-sm bg-[#f0f4f7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#566166]"
                  key={ext}
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {([
                ["single", "Single Claim"],
                ["batch", "Batch Upload"],
              ] as const).map(([mode, label]) => (
                <button
                  className={`rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    uploadMode === mode
                      ? "bg-[#0053dc] text-white"
                      : "bg-[#f0f4f7] text-[#566166] hover:bg-[#e4ebf0]"
                  }`}
                  key={mode}
                  onClick={() => {
                    setUploadMode(mode);
                    setX12Error(null);
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
              <p className="text-[11px] text-slate-400">
                {uploadMode === "batch"
                  ? "Use for files containing multiple CLM claim groupings."
                  : "Use for one professional claim per file."}
              </p>
            </div>

            {/* Drop zone */}
            <div
              className={`relative rounded-sm border-2 border-dashed px-8 py-10 text-center transition-colors ${
                isDragging
                  ? "border-[#0053dc] bg-[#eef4ff]"
                  : "border-[rgba(169,180,185,0.3)] bg-[#f7f9fb] hover:border-[#0053dc]/40"
              }`}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDrop={handleDrop}
            >
              <input
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                ref={fileInputRef}
                type="file"
              />
              {x12File ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#eef4ff]">
                    <span
                      className="material-symbols-outlined text-2xl text-[#0053dc]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      task
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2a3439]">{x12File.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {(x12File.size / 1024).toFixed(1)} KB · Ready for {uploadMode} upload
                    </p>
                  </div>
                  <button
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#c94b41]"
                    onClick={() => setX12File(null)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#eef4ff]">
                    <span className="material-symbols-outlined text-2xl text-[#0053dc]">
                      upload_file
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2a3439]">
                      Drop your 837P file here
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      or{" "}
                      <button
                        className="font-bold text-[#0053dc] underline decoration-[#0053dc]/30"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        browse to select
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {x12Error && (
              <div className="mt-4 flex items-start gap-3 rounded-sm border-l-4 border-[#c94b41] bg-[#fdeceb] px-4 py-3">
                <span className="material-symbols-outlined mt-0.5 text-sm text-[#c94b41]">error</span>
                <p className="text-xs font-semibold text-[#752121]">{x12Error}</p>
              </div>
            )}

            {/* Upload action */}
            <div className="mt-4 flex items-center gap-3">
              <button
                className="rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-60"
                disabled={!x12File || isUploadingX12}
                onClick={() => void handleX12Submit()}
                type="button"
              >
                {isUploadingX12 ? "Processing..." : "Submit X12 Claim"}
              </button>
              <p className="text-[11px] text-slate-400">
                {uploadMode === "batch"
                  ? "Splits one file into per-claim processing results."
                  : "Feeds the full adjudication pipeline — validate → policy RAG → decision"}
              </p>
            </div>

            {batchUploadResult && (
              <div className="mt-6 rounded-sm border border-[rgba(169,180,185,0.18)] bg-[#f8fafc] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
                      Batch Upload Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#2a3439]">
                      {batchUploadResult.processed_claims} processed, {batchUploadResult.failed_claims} failed
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <MetricPill label="Total" value={String(batchUploadResult.total_claims)} />
                    <MetricPill label="Processed" value={String(batchUploadResult.processed_claims)} tone="success" />
                    <MetricPill label="Failed" value={String(batchUploadResult.failed_claims)} tone={batchUploadResult.failed_claims ? "danger" : "neutral"} />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {batchUploadResult.results.map((item) => (
                    <div
                      className="flex flex-col gap-3 rounded-sm border border-[rgba(169,180,185,0.12)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      key={`${item.claim_id ?? "unknown"}-${item.status}`}
                    >
                      <div>
                        <p className="text-xs font-bold text-[#2a3439]">{item.claim_id ?? "Unknown claim"}</p>
                        {item.error ? (
                          <p className="mt-0.5 text-[11px] text-[#9f403d]">{item.error}</p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-[#566166]">
                            {item.result?.claim.member_name} · {item.result?.decision.outcome ?? "processed"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            item.status === "processed"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-[#fdeceb] text-[#c94b41]"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.status === "processed" && item.result && (
                          <button
                            className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc] underline decoration-[#0053dc]/30"
                            onClick={() => onViewProcessedClaim(item.result!.claim.claim_id)}
                            type="button"
                          >
                            Open Claim
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── JSON Claim Editor ── */}
        <div className="bg-white p-7 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#2a3439]">JSON Claim Payload</h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Submit a structured claim JSON directly through the adjudication pipeline.
              </p>
            </div>
            <span className="rounded-sm bg-[#eef4ff] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0053dc]">
              CMS-1500 / POS 11
            </span>
          </div>

          <textarea
            className="mt-5 h-[300px] w-full rounded-sm border border-slate-800 bg-[#0f172a] p-5 font-mono text-sm leading-6 text-slate-100 outline-none focus:ring-1 focus:ring-[#0053dc]"
            onChange={(e) => setClaimDraft(e.target.value)}
            spellCheck={false}
            value={claimDraft}
          />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className="rounded-sm border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold tracking-tight text-slate-700 transition-colors hover:bg-slate-50"
              onClick={onLoadDemo}
              type="button"
            >
              Load Demo Claim
            </button>
            <button
              className="rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-60"
              disabled={isLoading}
              onClick={onProcessClaim}
              type="button"
            >
              {isLoading ? "Processing..." : "Process Claim"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-5">
        {/* Format Guide */}
        <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Supported Formats
          </p>
          <div className="space-y-3">
            {[
              { icon: "document_scanner", label: "AI Intake", sub: "Image, PDF, DOCX — OCR + extract" },
              { icon: "upload_file", label: "X12 837P", sub: "Professional outpatient" },
              { icon: "stacks", label: "X12 Batch", sub: "Multiple CLM groupings" },
              { icon: "data_object", label: "JSON Payload", sub: "Canonical claim object" },
            ].map((f) => (
              <div className="flex items-center gap-3" key={f.label}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#eef4ff]">
                  <span className="material-symbols-outlined text-sm text-[#0053dc]">{f.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2a3439]">{f.label}</p>
                  <p className="text-[10px] text-slate-400">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Activity */}
        <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Agent Activity
          </p>
          <p className="mb-5 text-[10px] text-slate-300">AI pipeline status</p>
          <IntakeAgentRail
            isExtracting={isAiExtracting}
            hasDraft={aiDraft != null}
            isProcessing={isAiProcessing}
          />
        </div>

        {/* Seed Claim Snapshot */}
        <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Demo Claim Preview
          </p>
          <div className="space-y-3 text-xs text-slate-500">
            {(
              [
                ["Claim ID", demoClaim?.claim_id],
                ["Member", demoClaim?.member_name],
                ["Payer", demoClaim?.payer_name],
                ["Type", demoClaim?.claim_type],
                ["Procedures", demoClaim?.procedure_codes.join(", ")],
                ["Diagnoses", demoClaim?.diagnosis_codes.join(", ")],
                ["Amount", demoClaim ? `$${demoClaim.amount.toFixed(2)}` : undefined],
              ] as [string, string | undefined][]
            ).map(([label, val]) => (
              <div className="flex flex-col gap-0.5" key={label}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </span>
                <span className="font-semibold text-[#2a3439]">{val ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// IntakeAgentRail — live agent pipeline status for the sidebar
// ─────────────────────────────────────────────────────────────
type AgentStatus = "completed" | "active" | "pending";

type AgentStep = {
  label: string;
  copy: string;
  status: AgentStatus;
};

function agentIcon(status: AgentStatus) {
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
  return (
    <span className="material-symbols-outlined text-[18px] text-slate-200">
      radio_button_unchecked
    </span>
  );
}

function IntakeAgentRail({
  isExtracting,
  hasDraft,
  isProcessing,
}: {
  isExtracting: boolean;
  hasDraft: boolean;
  isProcessing: boolean;
}) {
  const steps: AgentStep[] = isExtracting
    ? [
        { label: "AI Intake Agent", copy: "Reading and extracting claim data…", status: "active" },
        { label: "AI Validation Agent", copy: "Verifies required claim fields", status: "pending" },
        { label: "AI Policy Agent", copy: "Retrieves payer policy evidence", status: "pending" },
        { label: "AI Adjudication Agent", copy: "Determines claim outcome", status: "pending" },
      ]
    : isProcessing
    ? [
        { label: "AI Intake Agent", copy: "Extracted a reviewable claim draft", status: "completed" },
        { label: "AI Validation Agent", copy: "Verifying required claim fields…", status: "active" },
        { label: "AI Policy Agent", copy: "Retrieving payer policy evidence…", status: "active" },
        { label: "AI Adjudication Agent", copy: "Determining claim outcome…", status: "active" },
      ]
    : hasDraft
    ? [
        { label: "AI Intake Agent", copy: "Extracted a reviewable claim draft", status: "completed" },
        { label: "AI Validation Agent", copy: "Waiting for reviewed draft", status: "pending" },
        { label: "AI Policy Agent", copy: "Retrieves payer policy evidence", status: "pending" },
        { label: "AI Adjudication Agent", copy: "Determines claim outcome", status: "pending" },
      ]
    : [
        { label: "AI Intake Agent", copy: "Awaiting document upload", status: "pending" },
        { label: "AI Validation Agent", copy: "Verifies required claim fields", status: "pending" },
        { label: "AI Policy Agent", copy: "Retrieves payer policy evidence", status: "pending" },
        { label: "AI Adjudication Agent", copy: "Determines claim outcome", status: "pending" },
      ];

  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute bottom-2 left-[8px] top-2 w-px bg-slate-100" />
      {steps.map((step, i) => (
        <div className="relative flex items-start gap-3" key={i}>
          <div className="absolute -left-[22px] top-0">{agentIcon(step.status)}</div>
          <div>
            <p
              className={`text-[11px] font-bold leading-tight ${
                step.status === "completed"
                  ? "text-[#2a3439]"
                  : step.status === "active"
                  ? "text-[#0053dc]"
                  : "text-slate-400"
              }`}
            >
              {step.label}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{step.copy}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "bg-[#fdeceb] text-[#c94b41]"
        : "bg-[#eef4ff] text-[#0053dc]";

  return (
    <div className={`rounded-sm px-3 py-2 text-right ${toneClasses}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-sm font-extrabold">{value}</p>
    </div>
  );
}
