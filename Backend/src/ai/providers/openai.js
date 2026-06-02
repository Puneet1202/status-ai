// FILE: backend/src/ai/providers/openai.js
// =========================================================================
// OPENAI PROVIDER — GPT-4o-mini (95%+ tool-calling accuracy)
// =========================================================================
// Uses global fetch (available in Cloudflare Workers + Node.js).
// Drop-in replacement for cloudflare.js — same input/output shape.
//
// Env vars required (add to wrangler.toml [vars] or secrets):
//   OPENAI_API_KEY = sk-...
//   OPENAI_MODEL   = gpt-4o-mini   (optional override)
// =========================================================================

import { AI_TIMEOUT_MS, MAX_MESSAGE_CHARS } from '../ai-config.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

function withTimeout(promise, ms, label = 'OPENAI') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Normalize messages — same logic as cloudflare.js normalizeMessages
export function normalizeMessagesOAI(messages = []) {
  const out = [];
  for (const item of messages) {
    if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;
    const role = ['system', 'assistant', 'user'].includes(item.role) ? item.role : 'user';
    let content = item.content.trim();
    if (content.length > MAX_MESSAGE_CHARS) {
      content = content.slice(0, MAX_MESSAGE_CHARS) + '\n[truncated]';
    }
    // OpenAI does NOT allow consecutive same-role messages — merge them
    const prev = out[out.length - 1];
    if (prev && prev.role === role && role !== 'system') {
      prev.content += '\n' + content;
    } else {
      out.push({ role, content });
    }
  }
  return out;
}

// Convert our tool schema (Cloudflare/Llama format) to OpenAI format.
// They are identical — both follow OpenAI's function-calling spec.
function toOAITools(tools) {
  if (!tools || !tools.length) return undefined;
  return tools; // Already in { type: 'function', function: { name, description, parameters } } format
}

/**
 * Main OpenAI request. Same signature as askCloudflareAI.
 * Returns either a string (text reply) or an object with tool_calls.
 */
export async function askOpenAI(systemPrompt, message, history = [], env, tools = null) {
  const apiKey = env?.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing in environment. Add it to wrangler.toml secrets.');
  }

  const model = env?.OPENAI_MODEL || DEFAULT_MODEL;

  const messages = normalizeMessagesOAI([
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

  const oaiTools = toOAITools(tools);
  if (oaiTools) {
    payload.tools = oaiTools;
    payload.tool_choice = 'auto'; // let model decide when to call tools
  }

  const response = await withTimeout(
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }),
    AI_TIMEOUT_MS,
    'OPENAI'
  );

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('OpenAI returned empty choices array');

  const msg = choice.message;

  // Tool call response — return in Cloudflare-compatible shape
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0]; // we only use the first tool call
    return {
      tool_calls: [
        {
          name: tc.function.name,
          arguments: tc.function.arguments, // JSON string — same as CF Workers AI
        },
      ],
    };
  }

  // Plain text response
  return msg.content?.trim() || '';
}
