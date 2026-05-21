import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, ClipboardCheck, Users, CalendarDays, BookOpen } from "lucide-react";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/status/enter", label: "Status", icon: ClipboardCheck },
  { to: "/status/check", label: "Team", icon: Users },
  { to: "/leaves/application", label: "Leaves", icon: CalendarDays },
  { to: "/policy", label: "Policy", icon: BookOpen },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 rounded-2xl border border-border bg-card/90 p-1.5 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = path === it.to || (it.to !== "/dashboard" && path.startsWith(it.to));
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold tracking-wide transition-all ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
