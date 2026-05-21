import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, User, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create Account — KEYSS Status" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [phase, setPhase] = useState<"idle" | "loading" | "success">("idle");
  const [apiError, setApiError] = useState<string | null>(null);

  // Structural Validation Hooks
  const nameValid = name.trim().length >= 2;
  const emailValid = /.+@.+\..+/.test(email);
  const passwordValid = password.length >= 6;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    setApiError(null);

    if (!nameValid || !emailValid || !passwordValid) return;
    setPhase("loading");

    try {
      // Connects cleanly to our live serverless Hono backend execution instance
      const response = await fetch("http://127.0.0.1:8787/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed on server matrix");
      }

      setPhase("success");
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 1000);

    } catch (error: any) {
      setPhase("idle");
      setApiError(error.message || "Network validation connection dropped");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* KEYSS Branded Header Layout matching Login Exactly */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <span className="text-sm font-bold tracking-tight text-primary">K</span>
          </div>
          <div className="text-lg font-semibold tracking-tight">
            KEYSS <span className="text-muted-foreground font-medium">Status</span>
          </div>
        </div>

        {/* Form Container Glassmorphism Matrix */}
        <div className="rounded-2xl border border-border bg-card/60 p-7 shadow-[var(--shadow-elevated)] backdrop-blur">
          <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register your profile to start logging daily sprint tasks.</p>

          {apiError && (
            <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive ring-1 ring-destructive/20">
              {apiError}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field
              icon={<User size={16} />}
              label="Full Name"
              value={name}
              onChange={setName}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              valid={nameValid}
              showState={touched.name}
              type="text"
              placeholder="John Doe"
            />
            <Field
              icon={<Mail size={16} />}
              label="Corporate Email Address"
              value={email}
              onChange={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              valid={emailValid}
              showState={touched.email}
              type="email"
              placeholder="you@company.com"
            />
            <Field
              icon={<Lock size={16} />}
              label="Password"
              value={password}
              onChange={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              valid={passwordValid}
              showState={touched.password}
              type="password"
              placeholder="Minimum 6 characters"
            />

            <button
              type="submit"
              disabled={phase !== "idle"}
              className="group relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-80"
            >
              {phase === "idle" && <><UserPlus size={16} /> Register Account</>}
              {phase === "loading" && <><Loader2 size={16} className="animate-spin" /> Provisioning Node...</>}
              {phase === "success" && <><CheckCircle2 size={16} /> Account Created!</>}
            </button>
          </form>

          {/* Clean Dynamic Redirect Trigger Mapping Links */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already have a profile?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline transition">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Global Clean Field Scaffolding Interface mapping Input parameters exactly
function Field({ icon, label, value, onChange, onBlur, valid, showState, type, placeholder }: {
  icon: React.ReactNode; label: string; value: string; onChange: (s: string) => void; onBlur: () => void;
  valid: boolean; showState: boolean; type: string; placeholder: string;
}) {
  const ringClass = !showState
    ? "ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/60"
    : valid
      ? "ring-1 ring-success/50 focus-within:ring-2 focus-within:ring-success/70"
      : "ring-1 ring-destructive/60 focus-within:ring-2 focus-within:ring-destructive/70";
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className={`flex items-center gap-2 rounded-xl bg-background/40 px-3 transition ${ringClass}`}>
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </label>
  );
}