// FILE: Frontend/src/lib/api.ts
// Central fetch wrapper — token inject karta hai, 401 pe automatically refresh karta hai ya logout karta hai

const BACKEND = "http://127.0.0.1:8787";

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = typeof window !== "undefined" ? localStorage.getItem("keyss_token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Content-Type sirf body hone par
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // 401 aane par automatically refresh token attempt karo
  if (res.status === 401 && !url.includes("/api/auth/refresh") && !url.includes("/api/auth/login")) {
    try {
      const storedRefreshToken = typeof window !== "undefined" ? localStorage.getItem("keyss_refresh_token") : null;
      const refreshRes = await fetch(`${BACKEND}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
        credentials: "include",
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.token;
        const newRefreshToken = refreshData.refresh_token;
        if (newToken) {
          localStorage.setItem("keyss_token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("keyss_refresh_token", newRefreshToken);
          }
          if (refreshData.user) {
            localStorage.setItem("keyss_user", JSON.stringify(refreshData.user));
          }

          // Naye token ke saath request retry karo
          headers["Authorization"] = `Bearer ${newToken}`;
          res = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
          });
        }
      } else {
        // Refresh token invalid/expired ho chuka hai — clear local storage & redirect to login
        localStorage.removeItem("keyss_token");
        localStorage.removeItem("keyss_refresh_token");
        localStorage.removeItem("keyss_user");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    } catch (err) {
      console.error("[Silent Background Token Refresh Network Error]:", err);
    }
  }

  return res;
}

