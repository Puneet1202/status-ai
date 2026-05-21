// FILE: Frontend/src/lib/app-state.tsx
import { createContext, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from "react";

export type StatusEntry = {
  id: string;
  client: string;
  project: string;
  module: string;
  employee: string;
  description: string;
  date: string; 
  start: string; 
  end: string; 
  hours: number;
};

export type UserPayload = { name: string; email: string; role?: string };

export type Ctx = {
  user: UserPayload | null;
  isReady: boolean; // true after client-side hydration complete
  login: (userData: UserPayload, token: string, refreshToken?: string) => void;
  logout: () => void;
  entries: StatusEntry[];
  addEntry: (e: Omit<StatusEntry, "id">) => void;
  clientRegistry: Record<string, string[]>;
  setClientRegistry: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
};

const AppCtx = createContext<Ctx | null>(null);

function displayNameFromEmail(email?: string) {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return "User";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeUser(userData: UserPayload): UserPayload {
  const rawName = userData.name?.trim();
  const hasRealName = rawName && rawName.toLowerCase() !== "user";
  return {
    ...userData,
    name: hasRealName ? rawName : displayNameFromEmail(userData.email),
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  // SSR-safe: server pe null, client pe localStorage se hydrate
  const [user, setUser] = useState<UserPayload | null>(null);

  // isReady: false on server/first render, true after client mount
  // Ye batata hai ki ab localStorage safely access ho sakta hai
  const [isReady, setIsReady] = useState(false);

  const sessionVersion = useRef(0);
  const [entries, setEntries] = useState<StatusEntry[]>([]);

  // Client-Project Registry sync state
  const [clientRegistry, setClientRegistry] = useState<Record<string, string[]>>(() => {
    return {
      "Key Software Services Pvt Ltd": ["Business Development", "Internal Tools", "HR Portal"],
      "Acme Holdings": ["Internal Tools", "Web Platform"],
      "Northwind": ["Mobile App", "API Gateway"],
      "Globex": ["Data Platform", "Analytics"],
    };
  });

  // Step 1: Client mount pe localStorage se user aur clientRegistry load karo
  useEffect(() => {
    try {
      const stored = localStorage.getItem("keyss_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }

      const storedRegistry = localStorage.getItem("keyss_client_registry");
      if (storedRegistry) {
        setClientRegistry(JSON.parse(storedRegistry));
      }
    } catch {
      localStorage.removeItem("keyss_user");
    }
    // isReady = true — ab portal layout decide kar sakta hai
    setIsReady(true);
  }, []);

  // Step 1.5: clientRegistry change hone pe save to localStorage
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("keyss_client_registry", JSON.stringify(clientRegistry));
  }, [clientRegistry, isReady]);

  // Step 2: Background mein /me se fresh data lo (optional, non-blocking)
  // Ye redirect NAHI karta — sirf naam/role update karta hai
  useEffect(() => {
    if (!isReady) return;

    const refreshUserData = async () => {
      const token = localStorage.getItem("keyss_token");
      if (!token) return; // token nahi = already logged out, kuch mat karo

      const currentVersion = sessionVersion.current;

      try {
        const res = await fetch("http://127.0.0.1:8787/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          credentials: "include",
        });

        // Agar logout ho gaya ya version change ho gaya toh skip
        if (sessionVersion.current !== currentVersion) return;

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            const normalizedUser = normalizeUser(data.user);
            setUser(normalizedUser);
            localStorage.setItem("keyss_user", JSON.stringify(normalizedUser));
          }
        }
        // 401 ya koi bhi error pe: TOKEN MAT HATAO
        // Redirect portal.tsx mein handle karta hai token check se
        // Yahan sirf silent fail
      } catch {
        // Network error: backend down ho sakta hai, user ko logout mat karo
      }
    };

    refreshUserData();
  }, [isReady]);

  const value = useMemo<Ctx>(() => ({
    user,
    isReady,
    login: (userData, token, refreshToken) => {
      const normalizedUser = normalizeUser(userData);
      sessionVersion.current += 1;
      setUser(normalizedUser);
      localStorage.setItem("keyss_user", JSON.stringify(normalizedUser));
      localStorage.setItem("keyss_token", token);
      if (refreshToken) {
        localStorage.setItem("keyss_refresh_token", refreshToken);
      }
    },
    logout: () => {
      sessionVersion.current += 1;
      setUser(null);
      localStorage.removeItem("keyss_user");
      localStorage.removeItem("keyss_token");
      localStorage.removeItem("keyss_refresh_token");
    },
    entries,
    addEntry: (e) => setEntries((prev) => [{ ...e, id: Math.random().toString(36).slice(2) }, ...prev]),
    clientRegistry,
    setClientRegistry,
  }), [user, isReady, entries, clientRegistry]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}

export const CLIENTS: Record<string, string[]> = {
  "Key Software Services Pvt Ltd": ["Business Development", "Internal Tools", "HR Portal"],
  "Acme Holdings": ["Internal Tools", "Web Platform"],
  "Northwind": ["Mobile App", "API Gateway"],
  "Globex": ["Data Platform", "Analytics"],
};

export const EMPLOYEES = ["Puneet Kumar", "Punit Kumar", "A. Rao", "M. Khan", "P. Iyer"];

export function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, "0");
  return `${String(displayH).padStart(2, "0")}:${displayM} ${ampm}`;
}
