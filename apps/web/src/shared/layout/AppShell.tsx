import type { PropsWithChildren } from "react";

type ViewId = "dashboard" | "claims" | "intake" | "policy" | "providers" | "reports" | "detail";

type AppShellProps = PropsWithChildren<{
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
}>;

const navItems: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "claims", label: "Claims Hub", icon: "fact_check" },
  { id: "intake", label: "Intake", icon: "upload_file" },
  { id: "policy", label: "Policy Manager", icon: "policy" },
  { id: "providers", label: "Providers", icon: "groups" },
  { id: "reports", label: "Reports", icon: "analytics" },
];

function SidebarLink({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center rounded-sm px-3 py-2.5 text-left text-sm tracking-tight transition-colors duration-150 ${
        active
          ? "border-l-2 border-[#0053dc] bg-white font-bold text-[#0053dc]"
          : "font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-900"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined mr-3 text-[20px]"
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export function AppShell({ activeView, setActiveView, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[#f7f9fb] text-[#2a3439]">
      {/* Sidebar */}
      <aside className="sticky top-0 left-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-100 xl:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#0053dc]">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-lg text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tighter text-slate-900">
                ClaimsOS
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Clinical Architect
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <SidebarLink
              active={
                item.id === activeView ||
                (item.id === "claims" && activeView === "detail")
              }
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={() => setActiveView(item.id)}
            />
          ))}
          <SidebarLink
            active={false}
            icon="settings"
            label="Settings"
            onClick={() => undefined}
          />
        </nav>

        <div className="mb-4 mt-auto flex flex-col gap-1 px-3">
          <button
            className="flex items-center rounded-sm px-3 py-2 text-sm font-semibold tracking-tight text-slate-500 transition-colors duration-150 hover:bg-slate-200"
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-outlined mr-3 text-sm">
              help_outline
            </span>
            Help Center
          </button>
          <button
            className="flex items-center rounded-sm px-3 py-2 text-sm font-semibold tracking-tight text-slate-500 transition-colors duration-150 hover:bg-slate-200"
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-outlined mr-3 text-sm">
              logout
            </span>
            Logout
          </button>
        </div>

        <div className="m-3 rounded-xl border border-white/50 bg-slate-200/50 p-4">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined shrink-0 text-[40px] text-[#566166]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_circle
            </span>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-bold text-slate-900">Dr. Aris Thorne</p>
              <p className="truncate text-[10px] text-slate-500">Senior Adjudicator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-100 bg-white px-8 shadow-sm">
          <div className="flex flex-1 items-center gap-6">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                search
              </span>
              <input
                className="w-full rounded-sm border-none bg-[#f0f4f7] py-2 pl-10 pr-4 text-sm text-[#2a3439] outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-[#0053dc]"
                placeholder="Search claims or member ID..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-500 transition-colors hover:text-[#0053dc]" type="button">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#0053dc]" />
            </button>
            <button className="p-2 text-slate-500 transition-colors hover:text-[#0053dc]" type="button">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
