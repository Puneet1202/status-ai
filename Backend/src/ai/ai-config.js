// backend/src/ai/ai-config.js

// Production Core Models Reference
export const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5';

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
// LOCKED to 'regex-first': common formats are parsed instantly (free, no
// latency); the LLM only rescues a format the regex can't parse. Best
// speed/cost while still escaping the per-format "treadmill".
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