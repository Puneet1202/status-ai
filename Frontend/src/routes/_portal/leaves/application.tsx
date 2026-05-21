import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_portal/leaves/application")({
  head: () => ({ meta: [{ title: "Leave Application — KEYSS" }] }),
  component: LeaveApp,
});

const types = ["Casual", "Sick", "Earned", "Work From Home", "Unpaid"];

function LeaveApp() {
  const [type, setType] = useState(types[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; type: string; from: string; to: string; status: "pending" | "approved" }[]>([
    { id: "L-1042", type: "Sick", from: "2025-05-04", to: "2025-05-05", status: "approved" },
  ]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    setSubmitted((s) => [{ id: `L-${1000 + Math.floor(Math.random()*900)}`, type, from, to, status: "pending" }, ...s]);
    setReason("");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leaves</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Leave Application</h1>
      </header>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-6 shadow-[var(--shadow-elevated)]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60">
              {types.map((t) => <option key={t} className="bg-card">{t}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 [color-scheme:dark]" /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 [color-scheme:dark]" /></Field>
        </div>
        <div className="mt-4">
          <Field label="Reason">
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief context for your manager…" className="w-full rounded-xl bg-background/40 p-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60" />
          </Field>
        </div>
        <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"><Send size={15} /> Submit application</button>
      </form>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Recent applications</h2>
      <div className="space-y-2">
        {submitted.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
            <div>
              <div className="text-sm font-medium">{l.type} · {l.id}</div>
              <div className="text-xs text-muted-foreground">{l.from} → {l.to}</div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${l.status === "approved" ? "bg-success/15 text-success ring-success/30" : "bg-warning/15 text-warning ring-warning/30"}`}>{l.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
