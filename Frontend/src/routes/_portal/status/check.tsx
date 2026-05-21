import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, Download, Filter, ChevronDown } from "lucide-react";
import { useApp, formatTo12Hour } from "@/lib/app-state";

export const Route = createFileRoute("/_portal/status/check")({
  head: () => ({ meta: [{ title: "Check Status — KEYSS" }] }),
  component: CheckStatus,
});

type Range = { from: string; to: string };

function CheckStatus() {
  const { user, clientRegistry } = useApp();
  const isAdmin = user?.role === "admin" || user?.email === "aarav@keyss.io";

  // 1. Core Dynamic Database State Management
  const [dbEntries, setDbEntries] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [range, setRange] = useState<Range>(() => quickRange("week"));
  const [employee, setEmployee] = useState("all");
  const [client, setClient] = useState("all");
  const [project, setProject] = useState("all");
  const [applied, setApplied] = useState({ range, employee, client, project });

  // =========================================================================
  // 🛰️ TELEMETRY PULL: Sync Database Rows directly from Hono Worker Runtime
  // =========================================================================
  const syncServerTelemetry = async () => {
    try {
      const token = localStorage.getItem("keyss_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const queryUrl = `http://127.0.0.1:8787/api/timesheet/admin/all-logs?dateFrom=${applied.range.from}&dateTo=${applied.range.to}&employeeName=${applied.employee}&clientName=${applied.client}`;
      const res = await fetch(queryUrl, {
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        const logsPayload = data.telemetry_logs || [];
        setDbEntries(logsPayload);
      }
    } catch (err) {
      console.error("[Critical Telemetry Extraction Interception]:", err);
    }
  };

  useEffect(() => {
    syncServerTelemetry();
  }, [applied]);

  // Fetch real employee list dynamically for admin filters
  useEffect(() => {
    if (!isAdmin) return;

    const fetchEmployees = async () => {
      try {
        const token = localStorage.getItem("keyss_token");
        if (!token) return;
        const res = await fetch("http://127.0.0.1:8787/api/auth/users", {
          headers: {
            "Authorization": `Bearer ${token}`
          },
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.users) {
            const names = data.users.map((u: any) => u.name?.trim()).filter(Boolean);
            setDbEmployees(names);
          }
        }
      } catch (err) {
        console.error("[Fetch Employees Error]:", err);
      }
    };

    fetchEmployees();
  }, [isAdmin]);

  // =========================================================================
  // 🎛️ HIGH PERFORMANCE PIPELINE FILTER ENGINE (Using Native useMemo)
  // =========================================================================
  const filtered = useMemo(() => {
    return dbEntries.filter((e) => {
      // Handle combining strings fallback match logic safely 
      const projName = (e.project_name || "").toLowerCase();
      const empName = (e.employee_name || user?.name || "User").toLowerCase();
      const logDate = e.entry_date || "";

      const matchFrom = !applied.range.from || logDate >= applied.range.from;
      const matchTo = !applied.range.to || logDate <= applied.range.to;
      const matchEmp = applied.employee === "all" || 
        empName.includes(applied.employee.toLowerCase()) || 
        applied.employee.toLowerCase().includes(empName);
      
      // Dynamic split execution maps to counter project template bounds securely
      const matchClient = applied.client === "all" || projName.includes(applied.client.toLowerCase());
      const matchProj = applied.project === "all" || projName.includes(applied.project.toLowerCase());

      return matchFrom && matchTo && matchEmp && matchClient && matchProj;
    });
  }, [dbEntries, applied, user]);

  const totalHours = filtered.reduce((s, e) => s + Number(e.duration_hours || e.hours || 0), 0);

  // =========================================================================
  // 📥 EXPORT EXTRACTOR UTILITY: Production Grade Sanitized CSV Stream
  // =========================================================================
  const exportCsv = () => {
    const headers = ["CLIENT & PROJECT", "EMPLOYEE", "MODULE", "TASK DESCRIPTION", "DATE", "START TIME", "END TIME", "HRS"];
    const rows = filtered.map((e) => [
      e.project_name || "General",
      e.employee_name || user?.name || "User",
      e.module_name || "General",
      (e.task_description || e.description || "").replace(/\n/g, " "),
      e.entry_date,
      e.start_time || e.start,
      e.end_time || e.end,
      Number(e.duration_hours || e.hours || 0)
    ]);
    
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyss-status-report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Admin role check is moved to top function declaration layer

  const employeeClients = useMemo(() => {
    const cls = new Set<string>();
    dbEntries.forEach((e) => {
      const proj = e.project_name || "";
      if (proj.includes(" › ")) {
        cls.add(proj.split(" › ")[0]);
      } else {
        cls.add("General");
      }
    });
    return Array.from(cls);
  }, [dbEntries]);

  const employeeProjects = useMemo(() => {
    const projs = new Set<string>();
    dbEntries.forEach((e) => {
      const proj = e.project_name || "";
      if (proj.includes(" › ")) {
        const parts = proj.split(" › ");
        if (client === "all" || parts[0] === client) {
          projs.add(parts[1]);
        }
      } else {
        projs.add(proj);
      }
    });
    return Array.from(projs);
  }, [dbEntries, client]);

  const projects = client === "all" ? Object.values(clientRegistry || {}).flat() : (clientRegistry || {})[client] ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Telemetry</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Check Status</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search and filter employee status entries.</p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-xs font-medium hover:border-primary/50 disabled:opacity-40">
          <Download size={14} /> Export CSV
        </button>
      </header>

      {/* Filters Form Segment */}
      <section className="rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elevated)] backdrop-blur">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-medium"><Filter size={14} className="text-primary" /> Search Filters</div>
          <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="border-t border-border p-5">
            <div className="flex flex-wrap gap-2">
              {(["today","yesterday","week","month","lastMonth"] as const).map((k) => (
                <button key={k} onClick={() => setRange(quickRange(k))} className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary/50 hover:text-foreground">
                  {labelOf(k)}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DateField label="Date Range — From" required value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
              <DateField label="Date Range — To" required value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
              {isAdmin && (
                <SelectField label="Employee" value={employee} onChange={setEmployee} options={[["all","All employees"], ...dbEmployees.map((e) => [e, e] as [string,string])]} />
              )}
              <SelectField label="Client" value={client} onChange={(v) => { setClient(v); setProject("all"); }} options={isAdmin ? [["all","All clients"], ...Object.keys(clientRegistry || {}).map((c) => [c,c] as [string,string])] : [["all","All clients"], ...employeeClients.map((c) => [c,c] as [string,string])]} />
              <SelectField label="Project" value={project} onChange={setProject} options={isAdmin ? [["all","All projects"], ...projects.map((p) => [p,p] as [string,string])] : [["all","All projects"], ...employeeProjects.map((p) => [p,p] as [string,string])]} />
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setApplied({ range, employee, client, project })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">
                <Search size={14} /> Search
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Dynamic Results Sheet Container */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">{filtered.length} {filtered.length === 1 ? "result" : "results"}</div>
          <div className="text-xs text-muted-foreground">Total <span className="font-semibold text-foreground">{totalHours.toFixed(1)}h</span></div>
        </div>

        {/* Desktop Data Grid Layout View */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elevated)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Client / Assignment</Th><Th>Employee</Th><Th>Module</Th>
                  <Th className="min-w-[320px]">Task Description</Th>
                  <Th>Date</Th><Th>Time Range</Th><Th className="text-right">Hrs</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border/70 align-top hover:bg-accent/40 transition">
                    <Td className="font-medium max-w-[200px]">
                      <div className="truncate text-foreground">{e.project_name?.split(" › ")[0] || e.project_name}</div>
                      <div className="truncate text-xs text-muted-foreground font-normal mt-0.5">{e.project_name?.split(" › ")[1] || "Core Sprint"}</div>
                    </Td>
                    <td className="px-4 py-3 font-medium text-foreground/90">{e.employee_name || user?.name || "User"}</td>
                    <Td>
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-muted rounded border border-border/60 uppercase tracking-wide text-muted-foreground">
                        {e.module_name || "General"}
                      </span>
                    </Td>
                    <Td className="whitespace-normal break-words text-foreground/90 leading-relaxed">{e.task_description || e.description}</Td>
                    <Td className="whitespace-nowrap font-medium text-muted-foreground">{e.entry_date}</Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground/90">{formatTo12Hour(e.start_time || e.start)} → {formatTo12Hour(e.end_time || e.end)}</Td>
                    <Td className="text-right"><HourBadge hours={Number(e.duration_hours || e.hours || 0)} /></Td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground font-normal">No entries intercepted inside the network database parameters bounds.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Stacked Responsive Cards View */}
        <div className="space-y-3 lg:hidden">
          {filtered.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-card/60 p-4 shadow-[var(--shadow-elevated)] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{e.project_name?.split(" › ")[0] || e.project_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{e.project_name?.split(" › ")[1] || "Core"} · {e.module_name || "General"}</div>
                </div>
                <HourBadge hours={Number(e.duration_hours || e.hours || 0)} />
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-normal">{e.task_description || e.description}</p>
              <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-border/30">
                <span>{e.employee_name || user?.name || "User"}</span>
                <span className="font-mono">{e.entry_date} · {formatTo12Hour(e.start_time || e.start)} – {formatTo12Hour(e.end_time || e.end)}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground font-normal">No entries match the current telemetry filter parameters bounds.</div>
          )}
        </div>
      </section>
    </div>
  );
}

// Retaining original UI structural primitive functions
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function HourBadge({ hours }: { hours: number }) {
  const tone = hours >= 2 ? "bg-primary/20 text-primary ring-primary/30"
    : hours >= 1 ? "bg-success/15 text-success ring-success/30"
    : "bg-warning/15 text-warning ring-warning/30";
  const txt = hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>{txt}</span>;
}

function DateField({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (s: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}{required && <span className="text-destructive"> *</span>}</div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 [color-scheme:dark]" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
          {options.map(([v,l]) => <option key={v} value={v} className="bg-slate-900 text-foreground">{l}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
      </div>
    </label>
  );
}

function quickRange(k: "today" | "yesterday" | "week" | "month" | "lastMonth"): Range {
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0,10);
  if (k === "today") return { from: iso(d), to: iso(d) };
  if (k === "yesterday") { const y = new Date(d); y.setDate(d.getDate()-1); return { from: iso(y), to: iso(y) }; }
  if (k === "week") { const f = new Date(d); f.setDate(d.getDate()-d.getDay()); return { from: iso(f), to: iso(d) }; }
  if (k === "month") { const f = new Date(d.getFullYear(), d.getMonth(), 1); return { from: iso(f), to: iso(d) }; }
  const f = new Date(d.getFullYear(), d.getMonth()-1, 1);
  const t = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: iso(f), to: iso(t) };
}
function labelOf(k: string) { return ({ today:"Today", yesterday:"Yesterday", week:"This Week", month:"This Month", lastMonth:"Last Month" } as Record<string,string>)[k]; }