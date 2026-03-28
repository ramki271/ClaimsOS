import { useRef, useState } from "react";
import type { ClaimSubmission } from "../../../shared/api/claims";

type IntakePolicyPageProps = {
  claimDraft: string;
  setClaimDraft: (value: string) => void;
  onLoadDemo: () => void;
  onProcessClaim: () => void;
  onUploadX12: (file: File) => Promise<void>;
  isLoading: boolean;
  demoClaim: ClaimSubmission | null;
};

const ACCEPTED = [".txt", ".x12", ".edi", ".837"];

export function IntakePolicyPage({
  claimDraft,
  setClaimDraft,
  onLoadDemo,
  onProcessClaim,
  onUploadX12,
  isLoading,
  demoClaim,
}: IntakePolicyPageProps) {
  const [x12File, setX12File] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [x12Error, setX12Error] = useState<string | null>(null);
  const [isUploadingX12, setIsUploadingX12] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await onUploadX12(x12File);
      setX12File(null);
    } catch (err) {
      setX12Error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploadingX12(false);
    }
  }

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
            Submit claims via X12 837P file upload or structured JSON payload for immediate adjudication.
          </p>
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
                      {(x12File.size / 1024).toFixed(1)} KB · Ready to upload
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
                Feeds the full adjudication pipeline — validate → policy RAG → decision
              </p>
            </div>
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
              { icon: "upload_file", label: "X12 837P", sub: "Professional outpatient" },
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

        {/* Pipeline Steps */}
        <div className="bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Processing Pipeline
          </p>
          <div className="space-y-3">
            {[
              "Normalize & Validate",
              "Policy RAG Retrieval",
              "Adjudication Decision",
              "Confidence Scoring",
              "Audit & Persist",
            ].map((step, i) => (
              <div className="flex items-center gap-3" key={step}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0053dc] text-[9px] font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="text-xs font-medium text-[#566166]">{step}</span>
              </div>
            ))}
          </div>
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
