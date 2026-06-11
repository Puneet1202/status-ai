// FILE: backend/src/server.node.js
// KAAM: WAHI Hono app (src/index.js) ko Node.js par chalata hai, aur `c.env` me
// ek SINGLE SQLite file (keyss-status.prod.db) ko D1 ki tarah inject karta hai.
// Hono + saara app code SAME rehta hai — sirf "jagah" (runtime) badli.
//
// Yeh app SEEDHE keyss-status.prod.db padhta/likhta hai — koi alag copy nahi.
// SQLite viewer me wahi file kholo, OTP/entries sab live usme dikhenge.
//
// Chalane ke liye:  npm run dev:node   (ya: node src/server.node.js)

import { readFileSync, existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import app from './index.js';
import { makeSqliteD1 } from './db/sqliteAdapter.js';
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
const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const env = {
  DB: makeSqliteD1(DB_FILE), // SEEDHE single SQLite file (D1-compatible API)
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret_change_me',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret_change_me',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  // 🧠 "Brain" (intent routing + extraction). Pick a provider with AI_PROVIDER and
  // set its key — switching is a .env change, no code edit. No key → deterministic.
  AI_PROVIDER: process.env.AI_PROVIDER || '',           // anthropic | openai | gemini | groq (default anthropic)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',         // FREE tier; OpenAI-compatible (ai-config routes it)
  // Base-URL overrides for OpenAI-compatible servers (Groq default, or point
  // 'openai' at Cerebras / a local Ollama). Empty → provider's own default URL.
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
  AI_MODEL: process.env.AI_MODEL || '',                 // override model; else provider default
  // Token guard: max AI messages per minute per employee (default 20). Caps a
  // chatty user from burning credit on the brain.
  AI_RATE_PER_MIN: process.env.AI_RATE_PER_MIN || '',
  // Report alerts: paste a Slack/Discord incoming-webhook URL → every "Report"
  // pings you with the transcript. Empty → reports still save to ai_feedback only.
  REPORT_WEBHOOK_URL: process.env.REPORT_WEBHOOK_URL || '',
  // OTP email (SendGrid). Empty → mailer logs the OTP to THIS terminal instead.
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || '',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || '',
  // Workers AI ko Node par REST se chalate hai. CF key ho to asli LLM (greetings
  // + update/delete natural), warna graceful stub (app crash nahi hota; add/get
  // waise bhi deterministic hai, LLM ki zaroorat nahi).
  AI: (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN)
    ? makeWorkersAI({ accountId: process.env.CF_ACCOUNT_ID, apiToken: process.env.CF_API_TOKEN })
    : makeStubAI(),
};

const AI_MODE = (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) ? 'REAL (Cloudflare REST)' : 'STUB (no key — add/get/report still 100% work)';

const port = Number(process.env.PORT || 8787);

// Which BRAIN provider/model is actually live (so a wrong .env is obvious at boot,
// not only after a confusing reply). Mirrors ai-config's selection logic.
const BRAIN_PROVIDER = ['anthropic', 'openai', 'gemini', 'groq'].includes(String(env.AI_PROVIDER).toLowerCase())
  ? String(env.AI_PROVIDER).toLowerCase() : 'anthropic';
const BRAIN_KEY = { anthropic: env.ANTHROPIC_API_KEY, openai: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY }[BRAIN_PROVIDER];
const BRAIN_MODEL = env.AI_MODEL || { anthropic: 'claude-haiku-4-5', openai: 'gpt-4o-mini', gemini: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' }[BRAIN_PROVIDER];

serve({ fetch: (req) => app.fetch(req, env), port }, (info) => {
  console.log(`✅ KEYSS live →  http://localhost:${info.port}`);
  console.log(`   DB: ${DB_FILE}  (single file — no copy)`);
  console.log(`   AI: ${AI_MODE}`);
  console.log(`   BRAIN: ${BRAIN_KEY ? `${BRAIN_PROVIDER} · ${BRAIN_MODEL}` : `OFF (no key for "${BRAIN_PROVIDER}") → deterministic engine`}`);
  console.log(`   OTP email: ${(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) ? 'SendGrid' : 'DEV (printed to this terminal)'}`);
});
