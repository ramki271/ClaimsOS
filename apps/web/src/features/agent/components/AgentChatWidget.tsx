import { useEffect, useRef, useState } from "react";
import { chatWithAgent, type AgentClaimLink } from "../../../shared/api/agent";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Role = "user" | "agent";

type Message = {
  id: number;
  role: Role;
  content: string;
  claimLinks?: AgentClaimLink[];
  ts: Date;
};

type Props = {
  activeView: string;
  claimId?: string | null;
  onOpenClaim?: (claimId: string) => void;
};

function formatAgentContent(content: string): string[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Context-aware suggested prompts
// ─────────────────────────────────────────────────────────────
function suggestedPrompts(activeView: string, claimId: string | null | undefined): string[] {
  if (activeView === "detail" && claimId) {
    return [
      `Summarize claim ${claimId}`,
      `Why was ${claimId} flagged for review?`,
      `Who is the member on ${claimId}?`,
      `What policies apply to ${claimId}?`,
    ];
  }
  if (activeView === "claims") {
    return [
      "How many claims are pending review?",
      "Show me recent denied claims",
      "What is today's approval rate?",
    ];
  }
  if (activeView === "members") {
    return [
      "Find member Harold Bennett",
      "Which members have open claims?",
      "Show eligibility for member M-9011182",
    ];
  }
  if (activeView === "policy") {
    return [
      "Which policies cover CPT 27447?",
      "What requires prior authorization?",
      "Show orthopedic surgery policies",
    ];
  }
  if (activeView === "providers") {
    return [
      "Is Rocky Mountain Orthopedics in-network?",
      "Show providers with surgical privileges",
      "Find providers by NPI",
    ];
  }
  return [
    "What claims are pending review?",
    "Show me today's adjudication summary",
    "Which members have upcoming renewals?",
    "What procedures require prior auth?",
  ];
}

// ─────────────────────────────────────────────────────────────
// ThinkingDots
// ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-end gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-300"
          style={{ animation: `agentBounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AgentChatWidget
// ─────────────────────────────────────────────────────────────
let _msgId = 0;
function nextId() { return ++_msgId; }

const WELCOME: Message = {
  id: 0,
  role: "agent",
  content: "Hi! I'm your ClaimsOS Agent. Ask me anything about claims, members, providers, or policies.",
  ts: new Date(),
};

export function AgentChatWidget({ activeView, claimId, onOpenClaim }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveClaimId = activeView === "detail" ? claimId : null;
  const prompts = suggestedPrompts(activeView, effectiveClaimId);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setInput("");
    const userMsg: Message = { id: nextId(), role: "user", content: trimmed, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const res = await chatWithAgent({
        message: trimmed,
        context: { active_view: activeView, claim_id: effectiveClaimId },
      });
      const agentMsg: Message = {
        id: nextId(),
        role: "agent",
        content: res.reply,
        claimLinks: res.claim_links ?? [],
        ts: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      if (!isOpen) setHasUnread(true);
    } catch {
      const errMsg: Message = {
        id: nextId(),
        role: "agent",
        content: "The agent backend isn't connected yet — check back once the API is live.",
        ts: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    setHasUnread(false);
  }

  const showPrompts = messages.length === 1; // only welcome message

  return (
    <>
      {/* Bounce keyframe injected once */}
      <style>{`
        @keyframes agentBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes agentPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,83,220,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(0,83,220,0); }
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* ── Expanded panel ── */}
        {isOpen && (
          <div
            className="flex w-[380px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_8px_40px_rgba(15,23,42,0.18)]"
            style={{ height: 540 }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a2d4a 100%)" }}
            >
              <div className="flex items-center gap-2.5">
                {/* Online pulse dot */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <span
                    className="material-symbols-outlined text-[18px] text-white"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    monitor_heart
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-400" />
                </div>
                <div>
                  <p className="text-[12px] font-bold leading-none text-white">ClaimsOS Agent</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/40">
                    AI · Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-sm bg-[#0053dc]/40 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#93b4ff]">
                  Beta
                </span>
                <button
                  className="ml-2 flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => setIsOpen(false)}
                  type="button"
                  aria-label="Minimize"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
              </div>
            </div>

            {/* Context pill */}
            {(activeView !== "dashboard" || effectiveClaimId) && (
              <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-100 bg-[#f7f9fb] px-4 py-2">
                <span className="material-symbols-outlined text-[11px] text-slate-400">location_on</span>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {effectiveClaimId ? `Claim ${effectiveClaimId}` : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "agent" && (
                    <div className="mr-2 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0053dc]/10">
                      <span
                        className="material-symbols-outlined text-[11px] text-[#0053dc]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        monitor_heart
                      </span>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-[1.55] ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-[#0053dc] text-white"
                        : "rounded-bl-sm bg-slate-50 text-[#2a3439] shadow-[0_1px_4px_rgba(15,23,42,0.07)]"
                    }`}
                  >
                    {msg.role === "agent" ? (
                      <div className="space-y-2">
                        {formatAgentContent(msg.content).map((line, index) => {
                          const isBullet = /^[-*•]/.test(line);
                          const body = isBullet ? line.replace(/^[-*•]\s*/, "") : line;
                          return (
                            <div
                              className={isBullet ? "flex items-start gap-2" : ""}
                              key={`${msg.id}-${index}`}
                            >
                              {isBullet && (
                                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#0053dc]/60" />
                              )}
                              <p className="whitespace-pre-wrap break-words text-[12px] leading-[1.55]">
                                {body}
                              </p>
                            </div>
                          );
                        })}
                        {!!msg.claimLinks?.length && (
                          <div className="pt-1">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                              Quick claim links
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.claimLinks.map((link) => (
                                <button
                                  key={`${msg.id}-${link.claim_id}`}
                                  className="rounded-full border border-[#0053dc]/20 bg-[#eef4ff] px-2.5 py-1 text-[10px] font-semibold text-[#0053dc] transition-colors hover:bg-[#0053dc] hover:text-white"
                                  onClick={() => onOpenClaim?.(link.claim_id)}
                                  type="button"
                                >
                                  {link.claim_id}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="mr-2 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0053dc]/10">
                    <span
                      className="material-symbols-outlined text-[11px] text-[#0053dc]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      monitor_heart
                    </span>
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-slate-50 shadow-[0_1px_4px_rgba(15,23,42,0.07)]">
                    <ThinkingDots />
                  </div>
                </div>
              )}

              {/* Suggested prompts — shown only on fresh session */}
              {showPrompts && !isThinking && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      className="rounded-full border border-[#0053dc]/20 bg-[#eef4ff] px-3 py-1.5 text-[10px] font-semibold text-[#0053dc] transition-colors hover:bg-[#0053dc] hover:text-white"
                      onClick={() => void sendMessage(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-slate-100 px-3 py-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
              >
                <input
                  ref={inputRef}
                  className="flex-1 rounded-full border border-[rgba(169,180,185,0.3)] bg-[#f7f9fb] px-4 py-2 text-[12px] text-[#2a3439] outline-none transition-colors placeholder:text-slate-300 focus:border-[#0053dc] focus:bg-white focus:ring-1 focus:ring-[#0053dc]/20"
                  disabled={isThinking}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about claims, members, policies…"
                  type="text"
                  value={input}
                />
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0053dc] text-white shadow-[0_2px_8px_rgba(0,83,220,0.25)] transition-opacity disabled:opacity-40"
                  disabled={!input.trim() || isThinking}
                  type="submit"
                  aria-label="Send"
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    send
                  </span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── FAB button ── */}
        <button
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#0053dc] to-[#003fa8] text-white shadow-[0_4px_20px_rgba(0,83,220,0.35)] transition-transform hover:scale-105 active:scale-95"
          onClick={isOpen ? () => setIsOpen(false) : handleOpen}
          style={!isOpen ? { animation: "agentPulse 2.5s ease-in-out infinite" } : undefined}
          type="button"
          aria-label={isOpen ? "Close agent" : "Open ClaimsOS Agent"}
        >
          <span
            className="material-symbols-outlined text-[24px] transition-all"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {isOpen ? "close" : "monitor_heart"}
          </span>
          {/* Unread badge */}
          {hasUnread && !isOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c94b41] text-[8px] font-bold text-white">
              !
            </span>
          )}
        </button>
      </div>
    </>
  );
}
