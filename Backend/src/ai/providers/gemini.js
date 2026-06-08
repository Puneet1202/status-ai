// FILE: backend/src/ai/providers/gemini.js
// Google Gemini provider — function calling. Raw fetch (no SDK), so it runs on
// Node AND Cloudflare Workers. Same interface as the other providers:
// returns { toolCall, text }. Gemini is ~10x cheaper than Haiku.

// Gemini wants tools as { function_declarations: [{name, description, parameters}] }.
// Our schemas are OpenAI-shaped; pull out the inner function object.
function toGeminiTools(schemas) {
  const decls = schemas.map((s) => {
    const fn = s.function || s;
    return { name: fn.name, description: fn.description, parameters: fn.parameters };
  });
  return [{ function_declarations: decls }];
}

export async function askGemini({ apiKey, model, system, message, history = [], tools = null, timeoutMs = 12000, maxTokens = 1024 }) {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Gemini roles are 'user' | 'model' (not 'assistant').
  const contents = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: message || "" }] },
  ];
  const body = {
    system_instruction: { parts: [{ text: system || "You are a helpful timesheet assistant." }] },
    contents,
    generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
  };
  if (tools && tools.length) {
    body.tools = toGeminiTools(tools);
    body.tool_config = { function_calling_config: { mode: "AUTO" } };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const fc = parts.find((p) => p.functionCall);
  if (fc) {
    return { toolCall: { name: fc.functionCall.name, arguments: fc.functionCall.args || {} }, text: null };
  }
  const text = parts.filter((p) => p.text).map((p) => p.text).join("").trim();
  return { toolCall: null, text };
}
