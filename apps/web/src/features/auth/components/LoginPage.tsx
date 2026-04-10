import { useState } from "react";

const VALID_EMAIL = "adjudicator@apexhealth.com";
const VALID_PASSWORD = "Apex2026!";

type Props = {
  onLogin: () => void;
};

const features = [
  {
    icon: "document_scanner",
    label: "AI Document Intake",
    sub: "OCR extraction from claim packets, PDFs, and fax images",
  },
  {
    icon: "policy",
    label: "Policy RAG",
    sub: "Semantic retrieval of payer policy evidence at adjudication time",
  },
  {
    icon: "fact_check",
    label: "Autonomous Adjudication",
    sub: "Hybrid rules and LLM reasoning — approve, deny, or route to review",
  },
  {
    icon: "monitor_heart",
    label: "Confidence-Gated Review",
    sub: "Human-in-the-loop escalation for low-confidence decisions",
  },
  {
    icon: "groups",
    label: "Member & Provider Intelligence",
    sub: "Eligibility, network status, and provider credentialing at adjudication time",
  },
];

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState(VALID_EMAIL);
  const [password, setPassword] = useState(VALID_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate a brief auth round-trip
    setTimeout(() => {
      if (email.trim() === VALID_EMAIL && password === VALID_PASSWORD) {
        onLogin();
      } else {
        setError("Invalid credentials. Please check your email and password.");
        setIsLoading(false);
      }
    }, 600);
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Left panel ── */}
      <div
        className="relative hidden w-[42%] max-w-[520px] shrink-0 flex-col overflow-hidden xl:flex"
        style={{ background: "#0b1120" }}
      >
        {/* Decorative orbs */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: "-80px",
            right: "-60px",
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,83,220,0.45) 0%, transparent 70%)",
            filter: "blur(48px)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: 80,
            left: "-80px",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,83,220,0.3) 0%, transparent 70%)",
            filter: "blur(56px)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            top: "42%",
            right: "10%",
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(110,168,254,0.18) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />

        {/* Logo — pinned top */}
        <div className="relative z-10 shrink-0 px-10 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#0053dc]">
              <span
                className="material-symbols-outlined text-xl text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <div>
              <p className="text-base font-bold tracking-tighter text-white">ClaimsOS</p>
            </div>
          </div>
        </div>

        {/* Headline + feature list — lower-center like reference */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-10">
          <h2 className="text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
            AI Powered<br />Claims<br />Intelligence
          </h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            AI-driven adjudication from intake to decision — policy-aware, auditable, and built for scale.
          </p>

          <div className="mt-10 space-y-6">
            {features.map((f) => (
              <div key={f.label} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-white/8">
                  <span
                    className="material-symbols-outlined text-[20px] text-[#6ea8fe]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {f.icon}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{f.label}</p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-400">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright — pinned bottom */}
        <div className="relative z-10 shrink-0 px-10 pb-8">
          <p className="text-[10px] text-slate-500">© 2026 ClaimsOS · Enterprise Edition</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 items-center justify-center bg-[#f7f9fb] px-6">
        <div className="w-full max-w-[400px] -mt-8">

          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2 xl:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#0053dc]">
              <span
                className="material-symbols-outlined text-base text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <p className="font-bold tracking-tighter text-[#2a3439]">ClaimsOS</p>
          </div>

          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-[#0f172a]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to your adjudication workspace
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#566166]">
                Email address
              </label>
              <input
                autoComplete="email"
                autoFocus
                className="w-full rounded-sm border border-[rgba(169,180,185,0.35)] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-all placeholder:text-slate-300 focus:border-[#0053dc] focus:ring-2 focus:ring-[#0053dc]/15"
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@apexhealth.com"
                type="email"
                value={email}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#566166]">
                Password
              </label>
              <div className="relative">
                <input
                  autoComplete="current-password"
                  className="w-full rounded-sm border border-[rgba(169,180,185,0.35)] bg-white px-4 py-3 pr-11 text-sm text-[#0f172a] outline-none transition-all placeholder:text-slate-300 focus:border-[#0053dc] focus:ring-2 focus:ring-[#0053dc]/15"
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#0053dc]"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-sm border-l-4 border-[#c94b41] bg-[#fdeceb] px-4 py-3">
                <span className="material-symbols-outlined text-sm text-[#c94b41]">error</span>
                <p className="text-[12px] font-semibold text-[#752121]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-[#0053dc] to-[#003fa8] py-3 text-sm font-bold tracking-tight text-white shadow-[0_4px_16px_rgba(0,83,220,0.28)] transition-opacity disabled:opacity-60"
              disabled={isLoading || !email || !password}
              type="submit"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-slate-400">
            Need access? Contact your Apex Health Plan administrator.
          </p>

          {/* Powered by */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-slate-300">Powered by</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#0053dc]">
              <span
                className="material-symbols-outlined text-[12px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                monitor_heart
              </span>
              ClaimsOS AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
