// FILE: backend/src/ai/providers/anthropic.js
// Claude (Anthropic) provider — the reliable "brain" that understands intent and
// extracts tool arguments via native tool-calling. This is what makes the app
// robust to ANY phrasing without hand-written regex (see ../claudeRouter.js).
//
// Portable: uses the official @anthropic-ai/sdk, which runs on both Node and
// Cloudflare Workers. Model + key come from env (see ai-config.js / server.node.js)
// so switching models is a .env change, NOT a code change.

import Anthropic from "@anthropic-ai/sdk";

// Our tools are stored in OpenAI/Workers shape ({name, description, parameters}).
// Anthropic wants {name, description, input_schema}. Convert, and put ONE cache
// breakpoint on the last tool so the stable tools+system prefix is cached
// (≈0.1× cost on repeat calls). Caching is silent if the prefix is below the
// model minimum — harmless either way.
function toAnthropicTools(schemas) {
  const tools = schemas.map((s) => {
    const fn = s.function || s;
    return { name: fn.name, description: fn.description, input_schema: fn.parameters };
  });
  if (tools.length) {
    tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } };
  }
  return tools;
}

// One Messages API call. Returns { toolCall: {name, arguments} | null, text }.
// On the happy path Claude returns a tool_use block (the routed action); if it
// just wants to chat it returns text. Errors propagate so the caller can fall
// back to the deterministic engine.
export async function askAnthropic({ apiKey, model, system, message, history = [], tools = null, timeoutMs = 12000, maxTokens = 1024 }) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });

  const params = {
    model,
    max_tokens: maxTokens,
    // System carries the routing instructions + today's date + selected project.
    // cache_control here caches tools + system together (render order: tools→system).
    system: [{ type: "text", text: system || "You are a helpful timesheet assistant.", cache_control: { type: "ephemeral" } }],
    messages: [...history, { role: "user", content: message || "" }],
  };
  if (tools && tools.length) {
    params.tools = toAnthropicTools(tools);
    params.tool_choice = { type: "auto" };
  }

  const resp = await client.messages.create(params);

  const toolUse = Array.isArray(resp?.content) ? resp.content.find((b) => b.type === "tool_use") : null;
  if (toolUse) {
    return { toolCall: { name: toolUse.name, arguments: toolUse.input || {} }, text: null, usage: resp.usage };
  }
  const textBlock = Array.isArray(resp?.content) ? resp.content.find((b) => b.type === "text") : null;
  return { toolCall: null, text: textBlock?.text?.trim() || "", usage: resp?.usage };
}
