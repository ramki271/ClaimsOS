import { useRef, useState } from "react";
import type { PolicyListItem } from "../../../shared/api/policies";

// Static demo data for ingestion metrics — aggregate endpoints not yet available
const BAR_HEIGHTS = [40, 55, 45, 70, 90, 60, 40, 35, 50, 65, 80, 75, 60, 45, 55];

const RECENT_UPLOADS = [
  { name: "Payer_Rulebook_V4.txt", size: "4.2 MB", time: "2 mins ago" },
  { name: "Coverage_Matrix_2024.md", size: "12.1 KB", time: "15 mins ago" },
  { name: "LCD_Local_Determinations.txt", size: "8.7 KB", time: "1 hour ago" },
];

const CLASSIFICATIONS = [
  { value: "POLICY_CORE", label: "Policy Core" },
  { value: "COVERAGE_RULE", label: "Coverage Rule" },
  { value: "CLINICAL_POLICY", label: "Clinical Policy" },
  { value: "CLINICAL_GUIDELINE", label: "Clinical Guideline" },
];

const ACCEPTED_FORMATS = [".txt", ".md", ".json", ".xml"];

function ingestionStatus(status: string): "Synchronized" | "Indexing" | "RAG Sync Failed" {
  if (status === "indexed") return "Synchronized";
  if (status === "indexing" || status === "pending") return "Indexing";
  return "RAG Sync Failed";
}

function statusDot(status: string) {
  const s = ingestionStatus(status);
  if (s === "RAG Sync Failed")
    return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9f403d]" />;
  if (s === "Indexing")
    return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-[#0053dc]" />;
}

function statusTextColor(status: string) {
  const s = ingestionStatus(status);
  if (s === "RAG Sync Failed") return "text-[#9f403d]";
  if (s === "Indexing") return "text-amber-600";
  return "text-[#566166]";
}

function pillColor(status: string) {
  const s = ingestionStatus(status);
  if (s === "RAG Sync Failed") return "bg-[#9f403d]";
  if (s === "Indexing") return "bg-amber-400";
  return "bg-[#0053dc]";
}

type PolicyManagerPageProps = {
  policies: PolicyListItem[];
  isPoliciesLoading: boolean;
  onUploadPolicy: (file: File, payerName: string, classification: string) => Promise<void>;
};

export function PolicyManagerPage({
  policies,
  isPoliciesLoading,
  onUploadPolicy,
}: PolicyManagerPageProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [payerName, setPayerName] = useState("Apex Health Plan");
  const [classification, setClassification] = useState("POLICY_CORE");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setUploadFile(file); setUploadError(null); }
  }

  async function handleUploadSubmit() {
    if (!uploadFile || !payerName.trim()) {
      setUploadError("A file and payer name are required.");
      return;
    }
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);
    try {
      await onUploadPolicy(uploadFile, payerName, classification);
      setUploadSuccess(`"${uploadFile.name}" indexed successfully.`);
      setUploadFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
            RAG Knowledge Base
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2a3439]">
            Policy Manager
          </h2>
          <p className="mt-1 text-sm font-medium text-[#566166]">
            System-wide ingestion metrics and RAG knowledge synchronization status.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            className="flex items-center gap-2 rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-4 py-2 text-xs font-bold tracking-tight text-[#2a3439] transition-colors hover:bg-slate-50"
            title="Re-indexing endpoint not yet available"
            type="button"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            Re-Index RAG
          </button>
          <button
            className="flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
            onClick={() => { setShowUploadForm((v) => !v); setUploadError(null); setUploadSuccess(null); }}
            type="button"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Ingest New Policy
          </button>
        </div>
      </div>

      {/* ── Ingest New Policy Form ── */}
      {showUploadForm && (
        <div className="rounded-sm border border-[#0053dc]/20 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#2a3439]">Ingest New Policy Document</h3>
            <button
              className="text-[10px] font-bold uppercase tracking-widest text-[#566166] hover:text-[#0053dc]"
              onClick={() => { setShowUploadForm(false); setUploadFile(null); setUploadError(null); setUploadSuccess(null); }}
              type="button"
            >
              Cancel
            </button>
          </div>

          {/* Drop zone */}
          <div
            className={`mb-5 rounded-sm border-2 border-dashed px-8 py-8 text-center transition-colors ${
              isDragging
                ? "border-[#0053dc] bg-[#eef4ff]"
                : "border-[rgba(169,180,185,0.3)] bg-[#f7f9fb] hover:border-[#0053dc]/40"
            }`}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDrop={handleFileDrop}
          >
            <input
              accept={ACCEPTED_FORMATS.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setUploadFile(file); setUploadError(null); }
              }}
              ref={fileInputRef}
              type="file"
            />
            {uploadFile ? (
              <div className="flex flex-col items-center gap-2">
                <span
                  className="material-symbols-outlined text-3xl text-[#0053dc]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  task
                </span>
                <p className="text-sm font-bold text-[#2a3439]">{uploadFile.name}</p>
                <p className="text-[10px] text-slate-400">{(uploadFile.size / 1024).toFixed(1)} KB · Ready</p>
                <button
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#c94b41]"
                  onClick={() => setUploadFile(null)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-[#566166]">upload_file</span>
                <p className="text-sm font-semibold text-[#2a3439]">Drop policy document here</p>
                <p className="text-[11px] text-slate-400">
                  or{" "}
                  <button
                    className="font-bold text-[#0053dc] underline decoration-[#0053dc]/30"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    browse
                  </button>
                  {" "}— {ACCEPTED_FORMATS.join(", ")}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
                Payer / Tenant Name
              </label>
              <input
                className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Apex Health Plan"
                type="text"
                value={payerName}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[#566166]">
                Classification
              </label>
              <select
                className="w-full rounded-sm border border-[rgba(169,180,185,0.3)] bg-white px-3 py-2 text-sm text-[#2a3439] outline-none focus:border-[#0053dc] focus:ring-1 focus:ring-[#0053dc]"
                onChange={(e) => setClassification(e.target.value)}
                value={classification}
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {uploadError && (
            <div className="mt-4 flex items-start gap-3 rounded-sm border-l-4 border-[#c94b41] bg-[#fdeceb] px-4 py-3">
              <span className="material-symbols-outlined mt-0.5 text-sm text-[#c94b41]">error</span>
              <p className="text-xs font-semibold text-[#752121]">{uploadError}</p>
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-4 flex items-center gap-3 rounded-sm border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3">
              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
              <p className="text-xs font-semibold text-emerald-700">{uploadSuccess}</p>
            </div>
          )}

          <div className="mt-5">
            <button
              className="rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-xs font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)] disabled:opacity-60"
              disabled={!uploadFile || isUploading}
              onClick={() => void handleUploadSubmit()}
              type="button"
            >
              {isUploading ? "Indexing..." : "Index Policy"}
            </button>
          </div>
        </div>
      )}

      {/* ── Bento: Ingestion Load + Repository Health ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ingestion Load Density — col-span-8 */}
        <div className="flex flex-col rounded-sm bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)] lg:col-span-8">
          <div className="mb-10 flex items-start justify-between">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#0053dc]">
                Live Performance
              </span>
              <h3 className="text-xl font-bold text-[#2a3439]">Ingestion Load Density</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-sm bg-[#dbe1ff]/40 px-2 py-1 text-[10px] font-bold uppercase text-[#0053dc]">
                Real-Time
              </span>
              <span className="rounded-sm bg-[#f0f4f7] px-2 py-1 text-[10px] font-bold uppercase text-[#566166]">
                24H
              </span>
            </div>
          </div>
          <div className="flex h-44 items-end gap-1.5 px-2">
            {BAR_HEIGHTS.map((h, i) => (
              <div
                className={`flex-1 rounded-t-sm ${i === 4 ? "bg-[#0053dc]" : "bg-[#dbe1ff]"}`}
                key={i}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-4 border-t border-slate-50 pt-8 text-center">
            {[
              { label: "Total Throughput", value: "14.2 GB/h" },
              { label: "Latency (Avg)", value: "114ms" },
              { label: "Success Rate", value: "99.98%", highlight: true },
              { label: "Queue Depth", value: `${policies.length} docs` },
            ].map((m) => (
              <div key={m.label}>
                <p className="mb-1 text-[10px] font-bold uppercase text-[#566166]">{m.label}</p>
                <p className={`text-lg font-bold ${m.highlight ? "text-[#0053dc]" : "text-[#2a3439]"}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Repository Health — col-span-4 dark card */}
        <div className="relative overflow-hidden rounded-sm bg-slate-900 p-6 text-white shadow-xl lg:col-span-4">
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-auto">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                RAG Intelligence
              </span>
              <h3 className="mb-6 text-xl font-bold">Repository Health</h3>
              <div className="space-y-5">
                {[
                  {
                    label: "Policy Documents",
                    value: `${policies.length} Indexed`,
                    pct: Math.min(policies.length * 10, 100),
                    bar: "bg-[#0053dc]",
                  },
                  {
                    label: "Total Chunks",
                    value: `${policies.reduce((s, p) => s + p.chunk_count, 0)}`,
                    pct: Math.min(policies.reduce((s, p) => s + p.chunk_count, 0) / 5, 100),
                    bar: "bg-blue-400",
                  },
                  {
                    label: "Query Accuracy",
                    value: "96.4%",
                    pct: 96,
                    bar: "bg-slate-400",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1.5 flex items-end justify-between">
                      <span className="text-[11px] text-slate-400">{item.label}</span>
                      <span className="text-xs font-bold">{item.value}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${item.bar}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 border-t border-white/10 pt-6">
              <button
                className="w-full rounded-sm border border-white/5 bg-slate-800 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                type="button"
              >
                Open Knowledge Studio
              </button>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-[#0053dc]/20 blur-3xl" />
        </div>
      </div>

      {/* ── Active Policy Ledger ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-[#2a3439]">
            <span className="material-symbols-outlined text-lg text-[#0053dc]">fact_check</span>
            Active Policy Ledger
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#566166]">
            {policies.length} {policies.length === 1 ? "document" : "documents"}
          </span>
        </div>

        <div className="overflow-hidden rounded-sm border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          {isPoliciesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              Loading policies...
            </div>
          ) : policies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#f0f4f7]">
                <span className="material-symbols-outlined text-2xl text-[#566166]">policy</span>
              </div>
              <p className="text-sm font-semibold text-[#2a3439]">No policies indexed yet</p>
              <p className="text-[11px] text-slate-400">
                Click "Ingest New Policy" above to add your first policy document.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  {["Policy / File", "Classification", "Chunks", "Ingestion Status", "Actions"].map(
                    (h, i) => (
                      <th
                        className={`px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest text-[#566166] ${i === 4 ? "text-right" : ""}`}
                        key={h}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {policies.map((policy) => (
                  <tr className="transition-colors hover:bg-slate-50/50" key={policy.id}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-1 rounded-full ${pillColor(policy.status)}`} />
                        <div>
                          <p className="text-sm font-bold text-[#2a3439]">{policy.title}</p>
                          <p className="font-mono text-[10px] uppercase tracking-tight text-slate-400">
                            {policy.filename}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                        {policy.classification.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-[#0053dc]"
                            style={{ width: `${Math.min((policy.chunk_count / 50) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[#566166]">
                          {policy.chunk_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {statusDot(policy.status)}
                        <span className={`text-[11px] font-bold ${statusTextColor(policy.status)}`}>
                          {ingestionStatus(policy.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        className="p-1.5 text-slate-400 transition-colors hover:text-[#0053dc]"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-lg">open_in_new</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Ingestion Intelligence ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-sm border border-slate-100 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <h4 className="mb-6 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-[#2a3439]">
            <span className="material-symbols-outlined text-base text-[#0053dc]">cloud_upload</span>
            Recent Upload Activity
          </h4>
          <div className="space-y-5">
            {RECENT_UPLOADS.map((upload) => (
              <div className="flex items-center justify-between" key={upload.name}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-50">
                    <span className="material-symbols-outlined text-sm text-[#0053dc]">description</span>
                  </div>
                  <div>
                    <p className="max-w-[140px] truncate text-[11px] font-bold text-[#2a3439]">
                      {upload.name}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {upload.size} · {upload.time}
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-tight text-[#0053dc]">
                  Complete
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-6 rounded-sm border border-slate-100 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:flex-row md:items-center lg:col-span-2">
          <div className="space-y-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#0053dc]">lightbulb</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#2a3439]">
                RAG Optimization Tip
              </h4>
            </div>
            <p className="text-sm leading-relaxed text-[#566166]">
              System has detected high variance in{" "}
              <span className="font-semibold text-[#2a3439]">"Reconstructive Surgery"</span> query
              results. Re-chunking policy documents for{" "}
              <span className="font-bold text-[#0053dc]">UHG_PR_2024</span> is estimated to improve
              extraction precision by{" "}
              <span className="font-bold text-[#2a3439]">14%</span>.
            </p>
          </div>
          <button
            className="shrink-0 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#0049c2] px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_4px_12px_rgba(0,83,220,0.18)]"
            type="button"
          >
            Execute Optimization
          </button>
        </div>
      </div>
    </section>
  );
}
