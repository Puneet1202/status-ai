// backend/src/ai/ai-config.js

// Production Core Models Reference
export const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5';

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

// Sensible default model per provider (used when AI_MODEL isn't set).
const PROVIDER_DEFAULTS = {
  anthropic: 'claude-haiku-4-5', // top tool-calling, fast, cheap
  openai: 'gpt-4o-mini',          // ~7x cheaper than Haiku
  gemini: 'gemini-2.0-flash',     // ~10x cheaper
  groq: 'llama-3.3-70b-versatile', // FREE tier, OpenAI-compatible, solid tool-calling
};
export const DEFAULT_BRAIN_MODEL = PROVIDER_DEFAULTS.anthropic; // kept for back-compat

// Which provider runs the brain (AI_PROVIDER); defaults to anthropic.
export function getProvider(env) {
  const p = String(env?.AI_PROVIDER || 'anthropic').toLowerCase();
  return ['anthropic', 'openai', 'gemini', 'groq'].includes(p) ? p : 'anthropic';
}

// The API key for the selected provider.
export function getProviderKey(env, provider = getProvider(env)) {
  if (provider === 'openai') return env?.OPENAI_API_KEY || '';
  if (provider === 'gemini') return env?.GEMINI_API_KEY || '';
  if (provider === 'groq') return env?.GROQ_API_KEY || '';
  return env?.ANTHROPIC_API_KEY || '';
}

// Base URL for OpenAI-compatible providers. Groq speaks the OpenAI protocol, so
// it reuses the openai adapter with its own URL. OPENAI_BASE_URL lets the plain
// 'openai' provider point at ANY other OpenAI-compatible server too (Cerebras,
// Ollama on an office machine, etc.) — still just a .env change, no code edit.
export function getProviderBaseUrl(env, provider = getProvider(env)) {
  if (provider === 'groq') return env?.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  if (provider === 'openai') return env?.OPENAI_BASE_URL || '';
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
// this 8B replies in ~0.5-1s — dynamic AND fast. Used ONLY for small talk;
// structured/tool work still uses CHAT_MODEL where accuracy matters.
export const CHAT_MODEL_FAST = '@cf/meta/llama-3.1-8b-instruct';
// Short leash for the casual call — if even the small model stalls, the caller
// falls back to a friendly canned line, so the user NEVER sees a timeout.
export const FAST_TIMEOUT_MS = 8000;

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