import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_portal/policy")({
  head: () => ({ meta: [{ title: "Company Policy — KEYSS" }] }),
  component: Policy,
});

const sections = [
  { title: "Code of Conduct", body: "All employees represent KEYSS with integrity, respect, and professionalism." },
  { title: "Working Hours", body: "Standard work hours are 09:30 to 18:30 IST with a one-hour break, Monday through Friday." },
  { title: "Leave Policy", body: "Casual: 12 days/yr · Sick: 8 days/yr · Earned: 18 days/yr. Apply via the Leaves portal." },
  { title: "Information Security", body: "Treat client data as confidential. Use SSO and approved devices only." },
  { title: "Reimbursements", body: "Submit verified receipts within 30 days of the expense via the HR Helpdesk." },
];

function Policy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30"><FileText size={18} className="text-primary" /></div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Document</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Company Policy</h1>
        </div>
      </header>
      <article className="space-y-4">
        {sections.map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)]">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{s.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
