import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { LayoutGrid, ClipboardList, CalendarDays, FileText, ShieldCheck, ChevronDown, LogOut, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-state";

type Item = { to: string; label: string };

const groups: { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; to?: string; items?: Item[] }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  { id: "status", label: "Status", icon: ClipboardList, items: [
    { to: "/status/enter", label: "Enter Status" },
    { to: "/status/check", label: "Check Status" },
  ]},
  { id: "leaves", label: "Leaves", icon: CalendarDays, items: [
    { to: "/leaves/application", label: "Leave Application" },
    { to: "/leaves/attendance", label: "Attendance" },
  ]},
  { id: "policy", label: "Company Policy", icon: FileText, to: "/policy" },
  { id: "admin", label: "Admin", icon: ShieldCheck, items: [
    { to: "/admin", label: "Role Telemetry" },
  ]},
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useApp();

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (g.id === "admin") {
        return user?.role === "admin";
      }
      return true;
    });
  }, [user]);

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const g of filteredGroups) if (g.items?.some((i) => path.startsWith(i.to))) o[g.id] = true;
    return o;
  });

  return (
    <aside className="hidden lg:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <span className="text-xs font-bold text-primary">K</span>
        </div>
        <div className="text-sm font-semibold tracking-tight">KEYSS <span className="text-muted-foreground font-medium">Status</span></div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {filteredGroups.map((g) => {
          const Icon = g.icon;
          if (g.to) {
            const active = path === g.to;
            return (
              <Link
                key={g.id}
                to={g.to}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-elevated)]" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"}`}
              >
                <Icon size={16} className={active ? "text-primary" : ""} />
                {g.label}
              </Link>
            );
          }
          const isOpen = open[g.id] ?? false;
          const groupActive = g.items?.some((i) => path.startsWith(i.to));
          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${groupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"}`}
              >
                <Icon size={16} className={groupActive ? "text-primary" : ""} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={14} className={`transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && g.items && (
                <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-sidebar-border pl-3">
                  {g.items.map((it) => {
                    const active = path === it.to;
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"}`}
                        >
                          <ChevronRight size={12} className={active ? "text-primary" : "opacity-50"} />
                          {it.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{user?.name?.[0] ?? "?"}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Link to="/login" onClick={logout} className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground" aria-label="Sign out">
            <LogOut size={15} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
