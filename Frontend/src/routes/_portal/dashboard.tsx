// FILE: Frontend/src/routes/_portal.dashboard.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useApp } from "@/lib/app-state";
import { Clock, TrendingUp, Users, FileCheck } from "lucide-react";

export const Route = createFileRoute("/_portal/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — KEYSS Status" }] }),
  component: Dashboard,
});

interface StatItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint: string;
}

function Dashboard() {
  const { user, entries } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const todayHours = (entries || []).filter((e) => e.date === today).reduce((s, e) => s + e.hours, 0);

  const stats: StatItem[] = [
    { label: "Hours today", value: `${todayHours.toFixed(1)}h`, icon: Clock, hint: "of 8h target" },
    { label: "This week", value: `${(todayHours + 14).toFixed(1)}h`, icon: TrendingUp, hint: "+12% vs last" },
    { label: "Team online", value: "12", icon: Users, hint: "of 18 active" },
    { label: "Leaves pending", value: "2", icon: FileCheck, hint: "awaiting approval" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Hi, <span className="capitalize">{user?.name || "User"}</span>.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's a snapshot of your day across active engagements.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => {
          const IconComponent = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card/60 p-4 shadow-[var(--shadow-elevated)] backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <IconComponent size={15} className="text-primary" />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </div>
          );
        })}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <Link to="/status/enter" className="group rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] transition hover:border-primary/40">
          <div className="text-sm font-medium">Log a status entry</div>
          <p className="mt-1 text-xs text-muted-foreground">Capture work against a client and project.</p>
          <div className="mt-4 text-xs font-medium text-primary group-hover:translate-x-0.5 transition">Open logger →</div>
        </Link>
        <Link to="/status/check" className="group rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] transition hover:border-primary/40">
          <div className="text-sm font-medium">Check team status</div>
          <p className="mt-1 text-xs text-muted-foreground">Filter by employee, client, or project.</p>
          <div className="mt-4 text-xs font-medium text-primary group-hover:translate-x-0.5 transition">Open dashboard →</div>
        </Link>
        <Link to="/leaves/application" className="group rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] transition hover:border-primary/40">
          <div className="text-sm font-medium">Apply for leave</div>
          <p className="mt-1 text-xs text-muted-foreground">Submit and track leave applications.</p>
          <div className="mt-4 text-xs font-medium text-primary group-hover:translate-x-0.5 transition">Open form →</div>
        </Link>
      </section>
    </div>
  );
}