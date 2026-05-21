import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/leaves/attendance")({
  head: () => ({ meta: [{ title: "Attendance — KEYSS" }] }),
  component: Attendance,
});

function Attendance() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leaves</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Calendar overview for the current month.</p>
      </header>
      <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)]">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const tone = d % 7 === 0 ? "bg-muted/30 text-muted-foreground" : d === 12 ? "bg-warning/15 text-warning ring-1 ring-warning/30" : d === 17 ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30" : "bg-success/10 text-success ring-1 ring-success/30";
            return <div key={d} className={`aspect-square rounded-lg p-2 text-xs font-medium ${tone}`}>{d}</div>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Legend tone="bg-success/40" label="Present" />
          <Legend tone="bg-warning/50" label="Half-day" />
          <Legend tone="bg-destructive/50" label="Leave" />
          <Legend tone="bg-muted/60" label="Weekend" />
        </div>
      </div>
    </div>
  );
}
function Legend({ tone, label }: { tone: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${tone}`} /> {label}</span>;
}
