// FILE: backend/src/ai/providers/groq.js
// =========================================================================
// GROQ PROVIDER — Llama 3.3 70B on Groq infrastructure
// =========================================================================
// Groq = same Llama 3.3 70B model but on dedicated hardware.
// Result: 6x FASTER than Cloudflare Workers AI + FREE tier available.
// Tool calling works the same as OpenAI (OpenAI-compatible API).
//
// Env vars required:
//   GROQ_API_KEY = gsk_...   (get free at console.groq.com)
//   GROQ_MODEL   = llama-3.3-70b-versatile  (optional override)
//
// Free tier: 6,000 req/day, 500,000 tokens/day — enough for 1000 users.
// =========================================================================

import { AI_TIMEOUT_MS, MAX_MESSAGE_CHARS } from '../ai-config.js';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function withTimeout(promise, ms, label = 'GROQ') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeMessages(messages = []) {
  const out = [];
  for (const item of messages) {
    if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;
    const role = ['system', 'assistant', 'user'].includes(item.role) ? item.role : 'user';
    let content = item.content.trim();
    if (content.length > MAX_MESSAGE_CHARS) {
      content = content.slice(0, MAX_MESSAGE_CHARS) + '\n[truncated]';
    }
    const prev = out[out.length - 1];
    if (prev && prev.role === role && role !== 'system') {
      prev.content += '\n' + content;
    } else {
      out.push({ role, content });
    }
  }
  return out;
}

/**
 * Main Groq request. OpenAI-compatible API — same tool_calls shape.
 */
export async function askGroq(systemPrompt, message, history = [], env, tools = null) {
  const apiKey = env?.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY missing in environment.');
  }

  const model = env?.GROQ_MODEL || DEFAULT_MODEL;

  const messages = normalizeMessages([
    { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
    ...history,
    { role: 'user', content: message || 'Hello' },
  ]);

  const payload = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: 1200,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await withTimeout(
    fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }),
    AI_TIMEOUT_MS,
    'GROQ'
  );

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('Groq returned empty choices');

  const msg = choice.message;

  // Return in Cloudflare-compatible shape
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0];
    return {
      tool_calls: [
        {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      ],
    };
  }

  return msg.content?.trim() || '';
}
