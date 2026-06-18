// backend/src/ai/ai-config.js

// =========================================================================
// HOW MANY MODELS — one .env knob, code adjusts automatically.
//   AI_MODELS=3  → BRAIN + CHAT + FAST   (3 separate models — best speed/cost)
//   AI_MODELS=2  → BRAIN(=CHAT) + FAST   (chat reuses the brain; fast stays separate)
//   AI_MODELS=1  → ONE model does everything (simplest)
// Default = 3. A per-role override below (AI_CF_MODEL / AI_FAST_MODEL) ALWAYS wins.
// =========================================================================
function modelCount(env) {
  const n = parseInt(env?.AI_MODELS, 10);
  return [1, 2, 3].includes(n) ? n : 3;
}

// CHAT model — text replies + LLM work-block extraction.
//   AI_MODELS<3 → chat reuses the BRAIN model (so AI_CF_MODEL is ignored at 1-2).
//   AI_MODELS=3 → use AI_CF_MODEL (or the default below).
const DEFAULT_CF_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export function getChatModel(env) {
  if (modelCount(env) < 3) return getBrainModel(env);
  return (env && env.AI_CF_MODEL) || DEFAULT_CF_CHAT_MODEL;
}

// =========================================================================
// 🧠 "BRAIN" PROVIDER — the reliable LLM that routes intent + extracts args
// (see ../brainRouter.js). Everything is ENV-DRIVEN so switching the PROVIDER or
// MODEL is a .env change, NOT a code change:
//   AI_PROVIDER=anthropic|openai|gemini|groq   ← which company's model (default anthropic)
//   ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY  ← key for the chosen one
//   AI_MODEL=<model id>                   ← override the model (else provider default)
//   AI_BRAIN=off                          ← kill-switch (force deterministic mode)
// Brain is ON only when the SELECTED provider has a key; else the app runs the
// 100% deterministic engine (nothing breaks).
// =========================================================================
export const BRAIN_TIMEOUT_MS = 12000;

// Local Ollama (CPU, no GPU) is MUCH slower than Groq/cloud — first call also pays
// a cold model-load. 12s aborts before qwen replies. So the brain timeout is
// per-provider: ollama gets a long leash, cloud stays snappy. Override anytime
// with AI_BRAIN_TIMEOUT_MS in .env.
export function getBrainTimeout(env) {
  // .env override: AI_BRAIN_TIMEOUT_MS. Set 0 (ya "none"/"off") = NO LIMIT — jitna
  // time lage lagne do (slow local model debug karne ke liye). Khaali → smart default.
  const raw = env?.AI_BRAIN_TIMEOUT_MS;
  if (raw !== undefined && raw !== '') {
    if (['0', 'none', 'off', 'no', 'unlimited'].includes(String(raw).toLowerCase())) return 0; // 0 = no abort
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return getProvider(env) === 'ollama' ? 90000 : BRAIN_TIMEOUT_MS;
}

// Sensible default model per provider (used when AI_MODEL isn't set).
const PROVIDER_DEFAULTS = {
  anthropic: 'claude-haiku-4-5', // top tool-calling, fast, cheap
  openai: 'gpt-4o-mini',          // ~7x cheaper than Haiku
  gemini: 'gemini-2.0-flash',     // ~10x cheaper
  groq: 'llama-3.3-70b-versatile', // FREE tier, OpenAI-compatible, solid tool-calling
  ollama: 'qwen3.5:latest',        // LOCAL, 100% free; OpenAI-compatible at :11434/v1
  cloudflare: '@cf/qwen/qwen3-30b-a3b-fp8', // CF Workers AI; supports Function calling (397B does NOT)
};
export const DEFAULT_BRAIN_MODEL = PROVIDER_DEFAULTS.anthropic; // kept for back-compat

// Which provider runs the brain (AI_PROVIDER); defaults to anthropic.
export function getProvider(env) {
  const p = String(env?.AI_PROVIDER || 'anthropic').toLowerCase();
  return ['anthropic', 'openai', 'gemini', 'groq', 'ollama', 'cloudflare'].includes(p) ? p : 'anthropic';
}

// The API key for the selected provider.
export function getProviderKey(env, provider = getProvider(env)) {
  if (provider === 'openai') return env?.OPENAI_API_KEY || '';
  if (provider === 'gemini') return env?.GEMINI_API_KEY || '';
  if (provider === 'groq') return env?.GROQ_API_KEY || '';
  // Ollama local needs no key; return a dummy so the brain stays ENABLED and the
  // openai adapter (which requires a non-empty key) is satisfied.
  if (provider === 'ollama') return env?.OLLAMA_API_KEY || 'ollama';
  // Cloudflare Workers AI: the CF API token (same one used for the AI binding).
  if (provider === 'cloudflare') return env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || '';
  return env?.ANTHROPIC_API_KEY || '';
}

// Base URL for OpenAI-compatible providers. Groq speaks the OpenAI protocol, so
// it reuses the openai adapter with its own URL. OPENAI_BASE_URL lets the plain
// 'openai' provider point at ANY other OpenAI-compatible server too (Cerebras,
// Ollama on an office machine, etc.) — still just a .env change, no code edit.
export function getProviderBaseUrl(env, provider = getProvider(env)) {
  if (provider === 'groq') return env?.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  if (provider === 'openai') return env?.OPENAI_BASE_URL || '';
  // Ollama default local endpoint; OLLAMA_BASE_URL overrides (e.g. a heavy laptop/cloud IP).
  if (provider === 'ollama') return env?.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  // Cloudflare Workers AI OpenAI-compatible endpoint — built from the account id.
  if (provider === 'cloudflare') {
    const acct = env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || '';
    return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1`;
  }
  return '';
}

// ON when the chosen provider has a key, unless AI_BRAIN=off forces it off.
export function isBrainEnabled(env) {
  const flag = String(env?.AI_BRAIN || '').toLowerCase();
  if (['off', 'false', '0', 'no'].includes(flag)) return false;
  return !!getProviderKey(env);
}

// The model the brain uses — AI_MODEL overrides; else the provider's default.
export function getBrainModel(env) {
  return (env && (env.AI_MODEL || env.ANTHROPIC_MODEL)) || PROVIDER_DEFAULTS[getProvider(env)] || DEFAULT_BRAIN_MODEL;
}

// Small, FAST model for casual/natural conversation (greetings, chit-chat).
// The 70B is too slow over REST for chat (caused WORKERS_AI_TIMEOUT on "hey");
// this small model replies in ~0.5-1s — dynamic AND fast. Used ONLY for small talk;
// structured/tool work still uses the CF chat model where accuracy matters.
// ENV-DRIVEN: AI_FAST_MODEL=<@cf/... slug>  ← change from .env, no code edit.
// NOTE: '@cf/meta/llama-3.1-8b-instruct' was DEPRECATED by Cloudflare 2026-05-30
// (REST error 410), which broke greetings → canned fallback. Default is now the
// current Llama 3.2 3B (small + fast + still available).
// FAST model — greetings / small talk.
//   AI_MODELS=1 → fast reuses the BRAIN model (so AI_FAST_MODEL is ignored at 1).
//   AI_MODELS=2 or 3 → use AI_FAST_MODEL (or the default below).
const DEFAULT_CF_FAST_MODEL = '@cf/meta/llama-3.2-3b-instruct';
export function getFastModel(env) {
  if (modelCount(env) < 2) return getBrainModel(env);
  return (env && env.AI_FAST_MODEL) || DEFAULT_CF_FAST_MODEL;
}
// Short leash for the casual call — if even the small model stalls, the caller
// falls back to a friendly canned line, so the user NEVER sees a timeout.
export const FAST_TIMEOUT_MS = 8000;

// =========================================================================
// TASK-SELECTION REQUIREMENT — single ON/OFF knob (no code delete).
//   AI_REQUIRE_TASK=true   → logging needs project + at least one ticked task.
//   AI_REQUIRE_TASK=false  → logging needs ONLY a project (task feature paused).
// Default = true (so the feature comes back the moment the env is removed). The
// frontend has a MATCHING toggle (REQUIRE_TASK in AIChatbot.jsx) — set both the
// same. All the task code stays in place; this just gates the *requirement*.
// =========================================================================
export function requireTask(env) {
  const flag = String(env?.AI_REQUIRE_TASK ?? '').toLowerCase();
  if (['off', 'false', '0', 'no'].includes(flag)) return false;
  return true;
}

// Budget Management Hard-Limits
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOTAL_CHARS = 52000;

// =========================================================================
// =========================================================================
// HYBRID EXTRACTION MODE
// =========================================================================
// 'llm-first'  : LLM extracts work blocks (understands ANY format/language);
//                the regex parser is the fallback when the LLM is empty/slow.
// 'regex-first': deterministic parser primary (instant, free); LLM only rescues
//                when regex finds nothing. Flip here if the LLM proves slow/flaky.
// Either way the tool handler validates everything (2h cap, overlap, lunch,
// dedup) — bad data is never saved.
//
// LOCKED to 'regex-first': for ENGLISH the deterministic parser is 100%
// repeatable, instant and free — exactly what "professional, no mistakes" needs.
// The 70B LLM is FLAKY for structured extraction (same input → sometimes a
// perfect JSON array, sometimes empty), so it is NOT trusted as primary; it only
// rescues a format the regex can't parse at all. (Hinglish needs the LLM and is
// a separate, later task — see note below.) The handler validates everything.
//
// HINGLISH TODO: regex mangles Hinglish ("9 se 11 ... 11 sse 1 ... 1 se 2 lunch")
// — misses blocks, keeps lunch as work, repeats the sentence as each label. When
// Hinglish becomes a priority, the fix is a targeted Hinglish path (improve the
// "se" connector + trailing-lunch detection in timeParser.js), NOT a blanket
// switch to the flaky llm-first.
export const EXTRACTION_MODE = 'regex-first';
// Shorter leash for the extraction call so a slow model falls back to regex fast.
export const EXTRACT_TIMEOUT_MS = 10000;

// SHORT-TERM WORKING MEMORY (Sliding Window)
// =========================================================================
// Last N chat messages forwarded to the model. 10 = ~5 user/assistant turns.
// This is the ONE knob to tune conversational memory depth vs token cost.
export const MAX_HISTORY_MESSAGES = 10;

// =========================================================================
// TIMEOUT GUARD (Workers AI hang protection)
// =========================================================================
// Hard ceiling for a single env.AI.run call. If the edge model stalls past
// this, we reject fast and return a graceful retry message instead of hanging
// the request until the platform kills it.
//
// NOTE: 12s was too tight for heavy batch extraction — a single 70B call that
// must parse a long, multilingual, multi-block message (6+ entries with breaks)
// routinely needs 15-22s. Raised to 25s. The frontend AbortController MUST stay
// strictly above this (see AIChatbot.jsx) so the backend's graceful timeout
// reply wins the race instead of the client aborting first.
export const AI_TIMEOUT_MS = 25000;