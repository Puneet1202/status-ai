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
export async function askAnthropic({ apiKey, model, system, systemStable = null, systemDynamic = null, message, history = [], tools = null, timeoutMs = 12000, maxTokens = 1024, toolChoice = "auto" }) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });

  // System as cacheable blocks. When the caller provides the stable/dynamic split,
  // the cache breakpoint sits at the END of the STABLE block (rules + tool guidance)
  // so that big prefix is reused at ~0.1× cost on every call; the tiny DYNAMIC
  // block (today's date + selected project) follows UN-cached, so changing project
  // or day never busts the cache. Falls back to a single cached block (back-compat).
  const systemBlocks = systemStable
    ? [
        { type: "text", text: systemStable, cache_control: { type: "ephemeral" } },
        ...(systemDynamic ? [{ type: "text", text: systemDynamic }] : []),
      ]
    : [{ type: "text", text: system || "You are a helpful timesheet assistant.", cache_control: { type: "ephemeral" } }];

  const params = {
    model,
    max_tokens: maxTokens,
    // cache_control on the stable block caches tools + stable system together
    // (render order: tools → system), the largest repeated part of every request.
    system: systemBlocks,
    messages: [...history, { role: "user", content: message || "" }],
  };
  if (tools && tools.length) {
    params.tools = toAnthropicTools(tools);
    // "required" → {type:"any"}: anti-fabrication retry me model ko koi na koi
    // tool call karna HI hota hai (khud success-text nahi likh sakta).
    params.tool_choice = toolChoice === "required" ? { type: "any" } : { type: "auto" };
  }

  const resp = await client.messages.create(params);

  const toolUse = Array.isArray(resp?.content) ? resp.content.find((b) => b.type === "tool_use") : null;
  if (toolUse) {
    return { toolCall: { name: toolUse.name, arguments: toolUse.input || {} }, text: null, usage: resp.usage };
  }
  const textBlock = Array.isArray(resp?.content) ? resp.content.find((b) => b.type === "text") : null;
  return { toolCall: null, text: textBlock?.text?.trim() || "", usage: resp?.usage };
}
