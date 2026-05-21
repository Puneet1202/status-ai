import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — KEYSS Status" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState(""); // Kept empty for real employee production logins
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [phase, setPhase] = useState<"idle" | "loading" | "success">("idle");
  const [apiError, setApiError] = useState<string | null>(null);

  const emailValid = /.+@.+\..+/.test(email);
  const passwordValid = password.length >= 4;

  // FIXED: Removed from inside the JSX return and placed cleanly at component level
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setApiError(null);

    if (!emailValid || !passwordValid) return;
    
    setPhase("loading");
    
    try {
      // Handshake established directly with our Cloudflare Worker execution port
      const res = await fetch("http://127.0.0.1:8787/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials execution fault");
      }

      const token = data.token || data.accessToken;
      const refreshToken = data.refresh_token;
      if (!data.user || !token) {
        throw new Error("Login response missing user session details");
      }

      const profileRes = await fetch("http://127.0.0.1:8787/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        credentials: "include"
      });
      const profileData = profileRes.ok ? await profileRes.json() : null;
      const profileUser = profileData?.success && profileData.user ? profileData.user : data.user;
      const profileName = profileUser.name?.trim();
      const loginName = data.user.name?.trim();

      // Success Hook: hydrate from /me so first dashboard render has the same profile as refresh.
      login({
        name: profileName && profileName.toLowerCase() !== "user" ? profileName : loginName || "User",
        email: profileUser.email,
        role: profileUser.role
      }, token, refreshToken);

      setPhase("success");
      
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 600);

    } catch (error: any) {
      setPhase("idle");
      setApiError(error.message || "Network validation connection dropped");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        
        {/* KEYSS Branded Header Logo Structure */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <span className="text-sm font-bold tracking-tight text-primary">K</span>
          </div>
          <div className="text-lg font-semibold tracking-tight">
            KEYSS <span className="text-muted-foreground font-medium">Status</span>
          </div>
        </div>

        {/* Form Container Container */}
        <div className="rounded-2xl border border-border bg-card/60 p-7 shadow-[var(--shadow-elevated)] backdrop-blur">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to log status, track hours, and manage leaves.</p>

          {/* Dynamic Error Feedback Matrix */}
          {apiError && (
            <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs font-medium text-destructive ring-1 ring-destructive/20">
              {apiError}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field
              icon={<Mail size={16} />}
              label="Email"
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
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={phase !== "idle"}
              className="group relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-80"
            >
              {phase === "idle" && <><LogIn size={16} /> Sign in</>}
              {phase === "loading" && <><Loader2 size={16} className="animate-spin" /> Authenticating…</>}
              {phase === "success" && <><CheckCircle2 size={16} /> Welcome</>}
            </button>
          </form>

          {/* ADDED: Seamless Route Toggle Switch for Registration */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            New employee on the roster?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline transition">
              Create an account
            </Link>
          </p>

          <p className="mt-3 text-center text-[10px] tracking-wide text-muted-foreground/70 uppercase">
            Protected by KEYSS SSO • Single sign-on active
          </p>
        </div>
      </div>
    </div>
  );
}

// Global Clean Field Component Component Mapping
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
