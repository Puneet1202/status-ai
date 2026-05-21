import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, Users, Activity, AlertTriangle, Trash2, Plus, Layers, UserPlus } from "lucide-react";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/_portal/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — KEYSS" }] }),
  component: Admin,
});

type EmployeeNode = {
  name: string;
  email: string;
  role: string;
};

type AssignmentNode = {
  id: string;
  employee: string;
  client: string;
  project: string;
};

function Admin() {
  const { user, clientRegistry, setClientRegistry } = useApp();
  const isAdmin = user?.role === "admin";

  // Tab State
  const [activeTab, setActiveTab] = useState<"roster" | "assignments" | "clients">("roster");

  // Roster Management Stateful Registry
  const [roster, setRoster] = useState<EmployeeNode[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("keyss_roster");
      if (stored) return JSON.parse(stored);
    }
    return [
      { name: "Puneet Kumar", email: "puneet@keyss.io", role: "employee" },
      { name: "Punit Kumar", email: "punit@keyss.io", role: "employee" },
      { name: "Aarav Rao", email: "aarav@keyss.io", role: "admin" },
      { name: "A. Rao", email: "arao@keyss.io", role: "employee" },
      { name: "M. Khan", email: "mkhan@keyss.io", role: "employee" },
      { name: "P. Iyer", email: "piyer@keyss.io", role: "employee" }
    ];
  });

  // Client-Project Registry pulled directly from global AppState context

  // Dynamic Assignments Stateful Map
  const [assignments, setAssignments] = useState<AssignmentNode[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("keyss_assignments");
      if (stored) return JSON.parse(stored);
    }
    return [
      { id: "a1", employee: "Puneet Kumar", client: "Key Software Services Pvt Ltd", project: "Business Development" },
      { id: "a2", employee: "Punit Kumar", client: "Acme Holdings", project: "Internal Tools" },
      { id: "a3", employee: "A. Rao", client: "Key Software Services Pvt Ltd", project: "HR Portal" },
      { id: "a4", employee: "M. Khan", client: "Northwind", project: "Mobile App" }
    ];
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("keyss_roster", JSON.stringify(roster));
  }, [roster]);

  // Redundant Client Registry local sync removed (handled globally by AppStateProvider)

  useEffect(() => {
    localStorage.setItem("keyss_assignments", JSON.stringify(assignments));
  }, [assignments]);

  // Roster Fields Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("employee");

  // Assignment Fields Form State
  const [assignEmployee, setAssignEmployee] = useState("");
  const [assignClient, setAssignClient] = useState("");
  const [assignProject, setAssignProject] = useState("");

  // Client Registry Form State
  const [newClientName, setNewClientName] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjName, setNewProjName] = useState("");

  // Initialize dropdown fallbacks
  useEffect(() => {
    if (roster.length > 0 && !assignEmployee) setAssignEmployee(roster[0].name);
    const clientsKeys = Object.keys(clientRegistry);
    if (clientsKeys.length > 0) {
      if (!assignClient) {
        setAssignClient(clientsKeys[0]);
        setAssignProject(clientRegistry[clientsKeys[0]][0] || "");
      }
      if (!newProjClient) setNewProjClient(clientsKeys[0]);
    }
  }, [roster, clientRegistry]);

  // Re-adjust project selector when client selector changes
  const handleAssignClientChange = (c: string) => {
    setAssignClient(c);
    setAssignProject(clientRegistry[c]?.[0] || "");
  };

  // Add Employee access node
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    if (roster.some(emp => emp.email.toLowerCase() === newEmail.toLowerCase())) return;

    setRoster(prev => [...prev, { name: newName, email: newEmail, role: newRole }]);
    setNewName("");
    setNewEmail("");
  };

  // Delete Employee access node
  const handleDeleteEmployee = (email: string) => {
    setRoster(prev => prev.filter(emp => emp.email !== email));
  };

  // Add Assignment Node
  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployee || !assignClient || !assignProject) return;
    if (assignments.some(a => a.employee === assignEmployee && a.client === assignClient && a.project === assignProject)) return;

    setAssignments(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        employee: assignEmployee,
        client: assignClient,
        project: assignProject
      }
    ]);
  };

  // Delete Assignment Node
  const handleDeleteAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  // Add Client
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    if (clientRegistry[newClientName]) return;

    setClientRegistry(prev => ({
      ...prev,
      [newClientName]: []
    }));
    setNewClientName("");
  };

  // Add Project to Client
  const handleAddProjectToClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjClient || !newProjName.trim()) return;
    if (clientRegistry[newProjClient]?.includes(newProjName)) return;

    setClientRegistry(prev => ({
      ...prev,
      [newProjClient]: [...(prev[newProjClient] || []), newProjName]
    }));
    setNewProjName("");
  };

  // Delete project mapping node from client
  const handleDeleteProjectFromClient = (clientKey: string, projKey: string) => {
    setClientRegistry(prev => ({
      ...prev,
      [clientKey]: (prev[clientKey] || []).filter(p => p !== projKey)
    }));
  };

  // Stats calculation
  const totalProjects = useMemo(() => {
    return Object.values(clientRegistry).flat().length;
  }, [clientRegistry]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <AlertTriangle size={30} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          You do not have administrative privileges to access this control portal. If you believe this is an error, please contact the network operations center.
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Privileged Nodes", value: roster.filter(r => r.role === "admin").length.toString(), icon: ShieldCheck },
    { label: "Company Roster", value: roster.length.toString(), icon: Users },
    { label: "Active Projects", value: totalProjects.toString(), icon: Layers },
    { label: "Total Assignments", value: assignments.length.toString(), icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Privileged Control</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin · Operational Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage organizational rosters, map project parameters, and edit client bindings.</p>
      </header>

      {/* Grid Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
        {stats.map((s) => {
          const I = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card/60 p-4 shadow-[var(--shadow-elevated)] backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <I size={15} className="text-primary" />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
            </div>
          );
        })}
      </section>

      {/* Premium Segmented Tabs Controller */}
      <section className="mb-6">
        <div className="flex border-b border-border/80 text-sm">
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${activeTab === "roster" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Roster Provisioning
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${activeTab === "assignments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Project Assignments
          </button>
          <button
            onClick={() => setActiveTab("clients")}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${activeTab === "clients" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Client Dictionary
          </button>
        </div>
      </section>

      {/* Stateful Tab Layout panels */}
      <section className="space-y-6">
        {activeTab === "roster" && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Roster form - add */}
            <form onSubmit={handleAddEmployee} className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] backdrop-blur space-y-4 h-fit">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground"><UserPlus size={16} className="text-primary" /> Provision Access Node</div>
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Full Name</div>
                  <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Puneet Kumar" className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Email Address</div>
                  <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="e.g. employee@keyss.io" className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Security Role</div>
                  <div className="relative">
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
                      <option value="employee" className="bg-slate-900">Employee</option>
                      <option value="admin" className="bg-slate-900">Admin</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
                  </div>
                </label>
              </div>
              <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 transition">
                <Plus size={14} /> Provision Node
              </button>
            </form>

            {/* Roster table */}
            <div className="lg:col-span-3 rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elevated)] overflow-hidden">
              <div className="p-4 border-b border-border bg-background/30 flex justify-between items-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roster Directory</div>
                <div className="text-[11px] text-muted-foreground font-medium">{roster.length} registered</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-background/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map(emp => (
                      <tr key={emp.email} className="border-t border-border/50 hover:bg-accent/20 transition">
                        <td className="px-4 py-3 font-semibold text-foreground">{emp.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${emp.role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border/40'}`}>
                            {emp.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteEmployee(emp.email)}
                            disabled={emp.email === user?.email}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 text-[11px] font-medium text-destructive hover:bg-destructive/15 disabled:opacity-30 disabled:pointer-events-none transition"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Assignments form */}
            <form onSubmit={handleAddAssignment} className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] backdrop-blur space-y-4 h-fit">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground"><Plus size={16} className="text-primary" /> Bind Project Assignment</div>
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Select Employee</div>
                  <div className="relative">
                    <select value={assignEmployee} onChange={e => setAssignEmployee(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
                      {roster.map(emp => <option key={emp.email} value={emp.name} className="bg-slate-900">{emp.name}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
                  </div>
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Select Client</div>
                  <div className="relative">
                    <select value={assignClient} onChange={e => handleAssignClientChange(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
                      {Object.keys(clientRegistry).map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
                  </div>
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Select Project</div>
                  <div className="relative">
                    <select value={assignProject} onChange={e => setAssignProject(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
                      {(clientRegistry[assignClient] || []).map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                      {(clientRegistry[assignClient] || []).length === 0 && <option value="" className="bg-slate-900">— No projects —</option>}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
                  </div>
                </label>
              </div>
              <button type="submit" disabled={!(clientRegistry[assignClient] || []).length} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-40 transition">
                <Plus size={14} /> Bind Assignment
              </button>
            </form>

            {/* Assignments table */}
            <div className="lg:col-span-3 rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elevated)] overflow-hidden">
              <div className="p-4 border-b border-border bg-background/30 flex justify-between items-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Assignments Map</div>
                <div className="text-[11px] text-muted-foreground font-medium">{assignments.length} bindings</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-background/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Project Parameter</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} className="border-t border-border/50 hover:bg-accent/20 transition">
                        <td className="px-4 py-3 font-semibold text-foreground">{a.employee}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.client}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-muted rounded border border-border/60 uppercase tracking-wide text-muted-foreground">
                            {a.project}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 text-[11px] font-medium text-destructive hover:bg-destructive/15 transition"
                          >
                            <Trash2 size={11} /> Unbind
                          </button>
                        </td>
                      </tr>
                    ))}
                    {assignments.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">No active assignments binded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Forms section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Add Client form */}
              <form onSubmit={handleAddClient} className="rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] backdrop-blur space-y-4">
                <div className="flex items-center gap-2 font-medium text-sm text-foreground"><Plus size={16} className="text-primary" /> Register Client Account</div>
                <label className="block">
                  <div className="mb-1 text-xs text-muted-foreground">Client Name</div>
                  <input type="text" required value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="e.g. Stark Industries" className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60" />
                </label>
                <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 transition">
                  <Plus size={14} /> Register Client
                </button>
              </form>

              {/* Add Project form */}
              <form onSubmit={handleAddProjectToClient} className="rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-elevated)] backdrop-blur space-y-4">
                <div className="flex items-center gap-2 font-medium text-sm text-foreground"><Plus size={16} className="text-primary" /> Append Project to Client</div>
                <div className="space-y-3">
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">Choose Client</div>
                    <div className="relative">
                      <select value={newProjClient} onChange={e => setNewProjClient(e.target.value)} className="h-10 w-full appearance-none rounded-xl bg-background/40 pl-3 pr-9 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60 text-foreground bg-slate-900">
                        {Object.keys(clientRegistry).map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">▾</span>
                    </div>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">Project Name</div>
                    <input type="text" required value={newProjName} onChange={e => setNewProjName(e.target.value)} placeholder="e.g. Iron Legion" className="h-10 w-full rounded-xl bg-background/40 px-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/60" />
                  </label>
                </div>
                <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 transition">
                  <Plus size={14} /> Append Project
                </button>
              </form>
            </div>

            {/* Registry table */}
            <div className="lg:col-span-3 rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-elevated)] overflow-hidden">
              <div className="p-4 border-b border-border bg-background/30 flex justify-between items-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Mappings Directory</div>
                <div className="text-[11px] text-muted-foreground font-medium">{Object.keys(clientRegistry).length} clients registered</div>
              </div>
              <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                {Object.entries(clientRegistry).map(([clientName, projs]) => (
                  <div key={clientName} className="p-4 space-y-2 hover:bg-accent/10 transition">
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-bold text-foreground">{clientName}</div>
                      <div className="text-[10px] text-muted-foreground">{projs.length} active assignments</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {projs.map(p => (
                        <div key={p} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-muted rounded border border-border/50 text-muted-foreground group">
                          <span>{p}</span>
                          <button
                            onClick={() => handleDeleteProjectFromClient(clientName, p)}
                            className="text-muted-foreground/60 hover:text-destructive hover:scale-105 transition"
                            title="Delete project parameter mapping"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {projs.length === 0 && (
                        <div className="text-[10px] text-muted-foreground/60 italic">No project nodes registered for this client.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
