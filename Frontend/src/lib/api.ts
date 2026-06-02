// Central API base URL.
// In production set VITE_API_URL (e.g. https://api.yourcompany.com) in the
// environment / .env file. Falls back to the local wrangler dev server so
// local development keeps working with no extra setup.
//
// Read defensively (no dependency on vite/client type defs) so this compiles
// cleanly whether or not a vite-env.d.ts is present.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const API_BASE_URL = (env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '');
