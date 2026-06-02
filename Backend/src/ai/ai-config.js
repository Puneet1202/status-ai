// backend/src/ai/ai-config.js
// =========================================================================
// CENTRAL AI CONFIGURATION
// =========================================================================
// Change ONE variable to switch the entire AI backend. No code changes needed.
//
// PROVIDER OPTIONS:
//   'cloudflare' — Cloudflare Workers AI (free, built-in, 70B Llama)
//   'openai'     — OpenAI GPT-4o-mini (95%+ accuracy, $0.15/1M tokens)
//   'groq'       — Groq Llama 3.3 70B (free 6k req/day, 6x faster)
//   'auto'       — Try openai → groq → cloudflare (best availability)
//
// RECOMMENDED FOR PRODUCTION: 'openai' (most accurate tool-calling)
// RECOMMENDED FOR FREE:       'groq'   (fastest, free tier)
// RECOMMENDED FOR TESTING:    'cloudflare' (no extra API key needed)
// =========================================================================

export const AI_PROVIDER = 'auto'; // 'cloudflare' | 'openai' | 'groq' | 'auto'

// ── Model names (used when PROVIDER = 'cloudflare') ──────────────────────
export const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5';

// ── Budget / Safety Limits ────────────────────────────────────────────────
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOTAL_CHARS = 52000;

// ── Extraction Mode ───────────────────────────────────────────────────────
// 'regex-first': deterministic regex → LLM rescue only if regex fails
// 'llm-first':  LLM extracts → regex fallback if LLM is empty/slow
export const EXTRACTION_MODE = 'regex-first';

// Timeout for the extraction-only LLM call (shorter than full AI call)
export const EXTRACT_TIMEOUT_MS = 10000;

// ── Conversation Memory ───────────────────────────────────────────────────
// Last N chat messages forwarded to the model. 10 = ~5 user/assistant turns.
export const MAX_HISTORY_MESSAGES = 16; // Increased from 10 for better context

// ── Timeout Guard ─────────────────────────────────────────────────────────
// Hard ceiling for a single AI call. Reject + graceful retry if stalled.
// OpenAI/Groq are much faster (~2-4s) so 20s is more than enough.
// Keep cloudflare at 25s (slower edge inference).
export const AI_TIMEOUT_MS = 25000;

// ── Rate Limiting (for API Key system) ────────────────────────────────────
export const RATE_LIMIT_FREE = 100;        // requests per day
export const RATE_LIMIT_PRO = 5000;        // requests per day
export const RATE_LIMIT_ENTERPRISE = 99999; // effectively unlimited