// FILE: backend/src/ai/providers/openai.js
// OpenAI (GPT) provider — Chat Completions with tool-calling. Raw fetch (no SDK)
// so it runs on Node AND Cloudflare Workers with zero extra deps.
//
// Same interface as the Anthropic/Gemini providers: returns { toolCall, text }.
// Our tool schemas are ALREADY in OpenAI shape ({type:'function', function:{...}}),
// so no conversion is needed.

function toOpenAITools(schemas) {
  return schemas.map((s) =>
    s && s.type === "function" && s.function ? s : { type: "function", function: s }
  );
}

export async function askOpenAI({ apiKey, model, system, message, history = [], tools = null, timeoutMs = 12000, maxTokens = 1024, baseUrl }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const url = (baseUrl || "https://api.openai.com/v1") + "/chat/completions";

  const messages = [
    { role: "system", content: system || "You are a helpful timesheet assistant." },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message || "" },
  ];
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.1 };
  if (tools && tools.length) {
    body.tools = toOpenAITools(tools);
    body.tool_choice = "auto";
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const data = await resp.json();
  const msg = data?.choices?.[0]?.message;
  const tc = msg?.tool_calls?.[0];
  if (tc?.function) {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* leave {} */ }
    return { toolCall: { name: tc.function.name, arguments: args }, text: null };
  }
  return { toolCall: null, text: (msg?.content || "").trim() };
}
