// backend/src/ai/ai-config.js

// Production Core Models Reference
export const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5';

// =========================================================================
// 🧠 "BRAIN" PROVIDER — the reliable LLM that routes intent + extracts args
// (see ../claudeRouter.js). Everything here is ENV-DRIVEN so switching the model
// is a .env change, NOT a code change:
//   ANTHROPIC_API_KEY=sk-ant-...   ← present → brain ON. Remove it → deterministic only.
//   AI_MODEL=claude-haiku-4-5      ← swap the model here; no code edit needed.
//   AI_BRAIN=off                   ← optional kill-switch (keep the key, force OFF).
// Haiku 4.5 is the default: top-tier tool-calling, fast (~1s), very cheap.
// =========================================================================
export const DEFAULT_BRAIN_MODEL = 'claude-haiku-4-5';
export const BRAIN_TIMEOUT_MS = 12000;

// ON when an Anthropic key is present, unless explicitly killed via AI_BRAIN=off.
// No key → the app runs exactly as before (100% deterministic, nothing breaks).
export function isBrainEnabled(env) {
  if (!env || !env.ANTHROPIC_API_KEY) return false;
  const flag = String(env.AI_BRAIN || '').toLowerCase();
  if (flag === 'off' || flag === 'false' || flag === '0' || flag === 'no') return false;
  return true;
}

// The model the brain uses — overridable per-env without touching code.
export function getBrainModel(env) {
  return (env && (env.AI_MODEL || env.ANTHROPIC_MODEL)) || DEFAULT_BRAIN_MODEL;
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