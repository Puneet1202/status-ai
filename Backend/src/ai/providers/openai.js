// FILE: backend/src/ai/providers/openai.js
// OpenAI (GPT) provider — Chat Completions with tool-calling. Raw fetch (no SDK)
// so it runs on Node AND Cloudflare Workers with zero extra deps.
//
// Same interface as the Anthropic/Gemini providers: returns { toolCall, text }.
// Our tool schemas are ALREADY in OpenAI shape ({type:'function', function:{...}}),
// so no conversion is needed.

// Groq tool-args ko schema ke against STRICTLY validate karta hai, aur gpt-oss
// optional params me `null` bhejta hai ("from_date": null = "nahi diya") → 400
// "expected string, but got null" → poori call mar jaati hai. Fix: har OPTIONAL
// param ko nullable bana do (type: ["string","null"], enum me null add). Handlers
// pehle se null-safe hai (null = absent treat karte hai), to behaviour same.
function nullableOptionals(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return node;
  const out = { ...node };
  if (out.type === "object" && out.properties) {
    const req = new Set(out.required || []);
    const props = {};
    for (const [k, v] of Object.entries(out.properties)) {
      let p = nullableOptionals(v);
      if (!req.has(k) && typeof p.type === "string") {
        p = { ...p, type: [p.type, "null"] };
        if (Array.isArray(p.enum) && !p.enum.includes(null)) p.enum = [...p.enum, null];
      }
      props[k] = p;
    }
    out.properties = props;
  }
  if (out.items) out.items = nullableOptionals(out.items);
  return out;
}

function toOpenAITools(schemas) {
  return schemas.map((s) => {
    const fn = s && s.type === "function" && s.function ? s.function : s;
    return { type: "function", function: { ...fn, parameters: nullableOptionals(fn.parameters) } };
  });
}

// Kuch models (Qwen, Hermes-style) structured `tool_calls` ke BAJAY text content me
// `<tool_call>{"name":..,"arguments":..}</tool_call>` likh dete hai. Use bhi pakdo,
// warna asli tool-call user ko raw text ki tarah dikh jaata hai. Structured format
// hamesha primary hai — ye sirf fallback hai jab provider text me bhejta hai.
function parseTextToolCall(content) {
  if (!content || typeof content !== "string") return null;
  // <tool_call>...</tool_call> ya <function_call>...</function_call> ke beech ka JSON
  let m = content.match(/<(?:tool_call|function_call)>\s*([\s\S]*?)\s*<\/(?:tool_call|function_call)>/i);
  let blob = m ? m[1] : null;
  // Tag na ho par poora content hi ek JSON {name, arguments} ho to wahi try karo.
  if (!blob) {
    const t = content.trim();
    if (t.startsWith("{") && /"name"\s*:/.test(t) && /"arguments"\s*:/.test(t)) blob = t;
  }
  if (!blob) return null;
  try {
    const obj = JSON.parse(blob);
    const name = obj?.name || obj?.function?.name;
    let args = obj?.arguments ?? obj?.function?.arguments ?? {};
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
    if (name) return { name, arguments: args || {} };
  } catch { /* truncated/invalid → null, normal text path leta hai */ }
  return null;
}

export async function askOpenAI({ apiKey, model, system, message, history = [], tools = null, timeoutMs = 12000, maxTokens = 2048, baseUrl, toolChoice = "auto" }) {
  // Groq (and any other OpenAI-compatible server) also lands here via baseUrl,
  // so error labels say which host actually failed instead of always "OpenAI".
  if (!apiKey) throw new Error("API key missing for OpenAI-compatible provider");
  const url = (baseUrl || "https://api.openai.com/v1") + "/chat/completions";
  const host = url.includes("groq") ? "Groq" : "OpenAI";

  const messages = [
    { role: "system", content: system || "You are a helpful timesheet assistant." },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message || "" },
  ];
  const body = { model, messages, max_tokens: maxTokens, temperature: 0.1 };
  if (tools && tools.length) {
    body.tools = toOpenAITools(tools);
    // "required" = anti-fabrication retry (brainRouter): model ko tool call
    // karna HI padega, khud "✅ saved" type ki kahani nahi likh sakta.
    body.tool_choice = toolChoice === "required" ? "required" : "auto";
  }

  // timeoutMs <= 0 → NO LIMIT (koi abort nahi). Slow local Ollama ko jitna time
  // lage lagne do — debugging ke liye. Warna timeoutMs pe abort.
  const ctrl = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`${host} ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const data = await resp.json();
  const msg = data?.choices?.[0]?.message;
  const tc = msg?.tool_calls?.[0];
  // usage = real token counts from Groq/OpenAI ({prompt_tokens, completion_tokens, total_tokens}).
  if (tc?.function) {
    let args = {};
    try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* leave {} */ }
    return { toolCall: { name: tc.function.name, arguments: args }, text: null, usage: data?.usage };
  }
  // FALLBACK: provider ne tool call ko text me `<tool_call>{...}</tool_call>` ki tarah
  // bheja (Qwen/Hermes style) → use structured toolCall me badlo.
  const textTC = parseTextToolCall(msg?.content);
  if (textTC) return { toolCall: textTC, text: null, usage: data?.usage };
  return { toolCall: null, text: (msg?.content || "").trim(), usage: data?.usage };
}
