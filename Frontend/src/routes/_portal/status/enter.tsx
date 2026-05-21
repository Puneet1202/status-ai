import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Clock, Send, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useApp, formatTo12Hour } from "@/lib/app-state";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_portal/status/enter")({
  head: () => ({ meta: [{ title: "Enter Status — KEYSS" }] }),
  component: EnterStatus,
});

// Time options HH:MM — 08:00 se 22:00 tak, har 15 min
function generateTimeOptions() {
  const opts: string[] = [];
  for (let h = 8; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
}
const TIME_OPTIONS = generateTimeOptions();

function EnterStatus() {
  const { user, clientRegistry } = useApp();
  const [client, setClient] = useState<string>("Key Software Services Pvt Ltd");
  const [project, setProject] = useState<string>("Business Development");
  const [module, setModule] = useState("");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("11:30");
  const [description, setDescription] = useState("");

  // Default client & project fallback sync
  useEffect(() => {
    const clientsKeys = Object.keys(clientRegistry || {});
    if (clientsKeys.length > 0) {
      if (!clientsKeys.includes(client)) {
        const firstClient = clientsKeys[0];
        setClient(firstClient);
        setProject(clientRegistry[firstClient]?.[0] || "");
      }
    }
  }, [clientRegistry]);

  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [todaysLogs, setTodaysLogs] = useState<any[]>([]);

  const hours = useMemo(() => diffHours(start, end), [start, end]);
  const cap = 8;
  const pct = Math.min(100, Math.max(0, (hours / cap) * 100));

  const fetchActiveDailyLogs = async () => {
    try {
      const res = await apiFetch("http://127.0.0.1:8787/api/timesheet/admin/all-logs");
      if (res.ok) {
        const data = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        const filtered = (data.telemetry_logs || []).filter((log: any) => log.entry_date === today);
        setTodaysLogs(filtered);
      }
    } catch (err) {
      console.error("[Telemetry Sync Error]:", err);
    }
  };

  useEffect(() => {
    fetchActiveDailyLogs();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || hours <= 0) return;

    setPhase("loading");
    setFeedbackMsg("");

    try {
      const today = new Date().toISOString().slice(0, 10);

      const res = await apiFetch("http://127.0.0.1:8787/api/timesheet/submit", {
        method: "POST",
        body: JSON.stringify({
          entry_date: today,
          start_time: start,
          end_time: end,
          duration_hours: Number(hours.toFixed(2)),
          module_name: module || "General",
          task_description: description,
          project_name: `${client} › ${project}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submission failed");

      setPhase("success");
      setDescription("");
      setModule("");

      // Side panel refresh karo — navigate mat karo
      await fetchActiveDailyLogs();

      setTimeout(() => setPhase("idle"), 2500);
    } catch (error: any) {
      setPhase("error");
      setFeedbackMsg(error.message || "Network error");
      setTimeout(() => setPhase("idle"), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Enter Status</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log focused work blocks. Be specific — what did you build or fix?</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT — Logger Form */}
        <form onSubmit={submit} className="lg:col-span-3 rounded-2xl border border-border bg-card/60 p-5 lg:p-6 shadow-[var(--shadow-elevated)] backdrop-blur space-y-4">

          {phase === "success" && (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-xs font-medium text-success ring-1 ring-success/20">
              <CheckCircle2 size={14} /> Entry submitted! Check the panel on the right.
            </div>
          )}
          {phase === "error" && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive ring-1 ring-destructive/20">
              <AlertCircle size={14} /> {feedbackMsg}
            </div>
          )}

          {/* Client + Project */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Client"
              value={client}
              onChange={(v) => { setClient(v); setProject(clientRegistry[v]?.[0] || ""); }}
              options={Object.keys(clientRegistry || {})}
            />
            <Select
              label="Project"
              value={project}
              onChange={setProject}
              options={clientRegistry[client] ?? []}
            />
          </div>

          {/* Work Hours — Custom Dropdown Time Pickers */}
          <div>
            <Label>Work Hours</Label>
            <div className="flex items-center gap-3">
              <TimeSelect label="START" value={start} onChange={setStart} />
              <div className="flex h-7 items-center gap-1 rounded-full bg-primary/15 px-3 text-xs font-semibold text-primary ring-1 ring-primary/30 shrink-0">
                <Clock size={12} /> {formatHours(hours)}
              </div>
              <TimeSelect label="END" value={end} onChange={setEnd} />
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? "var(--color-destructive)" : "var(--color-success, #22c55e)",
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>{formatHours(hours)} logged</span>
                <span>{cap}h work day</span>
              </div>
            </div>
          </div>

          {/* Module */}
          <div>
            <Label>Module (optional)</Label>
            <input
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="e.g. Auth, Onboarding, Reports"
              className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Task Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe what you worked on today... Be specific - what did you build or fix?"
              className="w-full resize-y rounded-xl bg-background/40 p-3 text-sm leading-relaxed outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60"
            />
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles size={11} /> Markdown supported. Bullets, **bold**, and `code` render in reports.
            </div>
          </div>

          <button
            type="submit"
            disabled={phase === "loading" || hours <= 0 || !description.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-50"
          >
            {phase === "loading"
              ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              : <><Send size={15} /> Submit Status</>}
          </button>
        </form>

        {/* RIGHT — Today's Entries Panel */}
        <aside className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] backdrop-blur">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">Today's Entries</h2>
            <span className="text-xs text-muted-foreground">
              {todaysLogs.length} {todaysLogs.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {/* Total hours today */}
          {todaysLogs.length > 0 && (
            <div className="mb-3 text-[11px] text-primary font-semibold">
              Total: {formatHours(todaysLogs.reduce((s, l) => s + l.duration_hours, 0))} logged today
            </div>
          )}

          {todaysLogs.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Clock size={16} className="text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No entries yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Submit your first status entry above.</p>
            </div>
          ) : (
            <ol className="relative mt-2 space-y-3 border-l border-border/70 pl-5 overflow-y-auto max-h-[520px]">
              {todaysLogs.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">
                          {e.project_name?.split(" › ")[1] || e.project_name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {e.project_name?.split(" › ")[0]} · {e.module_name}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary ring-1 ring-primary/30">
                        {formatHours(e.duration_hours)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-3">
                      {e.task_description}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Clock size={9} />
                      {formatTo12Hour(e.start_time)} → {formatTo12Hour(e.end_time)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900"
        >
          {options.map((o) => <option key={o} value={o} className="bg-slate-900 text-foreground">{o}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
      </div>
    </label>
  );
}

// Custom dropdown time selector — native browser picker ki jagah
function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Agar current value TIME_OPTIONS mein nahi hai toh add karo
  const options = TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [value, ...TIME_OPTIONS].sort();

  return (
    <div className="flex-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-8 text-sm font-mono outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900"
        >
          {options.map((t) => <option key={t} value={t} className="bg-slate-900">{formatTo12Hour(t)}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">▾</span>
      </div>
    </div>
  );
}

function diffHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh + em / 60 - sh - sm / 60);
}

function formatHours(h: number) {
  if (h <= 0) return "0m";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}