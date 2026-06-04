// FILE: backend/src/server.node.js
// KAAM: WAHI Hono app (src/index.js) ko Cloudflare Workers ke bajaye Node.js par
// chalata hai, aur `c.env` me MariaDB-backed DB + secrets inject karta hai.
// Hono + saara app code SAME rehta hai — sirf "jagah" (runtime) aur DB badle.
//
// Chalane ke liye:  npm run dev:node   (ya: node src/server.node.js)

import { readFileSync, existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import app from './index.js';
import { makeD1CompatDB } from './db/mysqlAdapter.js';
import { makeWorkersAI, makeStubAI } from './ai/providers/cloudflareRest.js';

// --- chhota .env loader (koi extra package nahi chahiye) ---
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile();

// --- ye object Cloudflare ke `c.env` ki jagah leta hai ---
const env = {
  DB: makeD1CompatDB(), // D1 ki jagah MariaDB (D1-compatible adapter)
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret_change_me',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret_change_me',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  AI_PROVIDER: process.env.AI_PROVIDER || 'cloudflare',
  // Workers AI ko Node par REST se chalate hai. CF key ho to asli LLM (greetings
  // + update/delete natural), warna graceful stub (app crash nahi hota; add/get
  // waise bhi deterministic hai, LLM ki zaroorat nahi).
  AI: (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN)
    ? makeWorkersAI({ accountId: process.env.CF_ACCOUNT_ID, apiToken: process.env.CF_API_TOKEN })
    : makeStubAI(),
};

const AI_MODE = (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) ? 'REAL (Cloudflare REST)' : 'STUB (no key — add/get/report still 100% work)';

const port = Number(process.env.PORT || 8787);

serve({ fetch: (req) => app.fetch(req, env), port }, (info) => {
  console.log(`✅ KEYSS (Node + MariaDB) live →  http://localhost:${info.port}`);
  console.log(`   DB: ${process.env.DB_NAME || 'statusk_test_2026'} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
  console.log(`   AI: ${AI_MODE}`);
});
