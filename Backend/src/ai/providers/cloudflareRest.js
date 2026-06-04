// FILE: backend/src/ai/providers/cloudflareRest.js
// KAAM: Node par Workers AI ko REST API se chalata hai. App ka code
// `env.AI.run(model, payload)` call karta hai (Cloudflare binding jaisa) — yahan
// wahi shape REST se de dete hai, taaki chat.js / providers/cloudflare.js bilkul
// bina change chale.
//
// Asli AI ke liye .env me chahiye:  CF_ACCOUNT_ID, CF_API_TOKEN
// (Cloudflare dashboard → AI → Workers AI; ya My Profile → API Tokens)

export function makeWorkersAI({ accountId, apiToken }) {
  return {
    run: async (model, payload) => {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      let json;
      try {
        json = await resp.json();
      } catch {
        throw new Error(`Workers AI REST: non-JSON response (HTTP ${resp.status})`);
      }
      if (!resp.ok || json.success === false) {
        throw new Error(`Workers AI REST error ${resp.status}: ${JSON.stringify(json.errors || json.messages || json)}`);
      }
      // Binding `env.AI.run` seedha result object deta hai — REST {result} ko unwrap karo.
      return json.result;
    },
  };
}

// Jab tak asli CF key set na ho — graceful stub. App kabhi 500/crash na ho:
//  • small talk (no tools)  → friendly canned greeting
//  • tool routing (tools[]) → koi tool_call nahi → chat.js clarify maang leta hai
// (add/get deterministic hai, inhe LLM ki zaroorat hi nahi — ye sirf
//  greetings aur update/delete jaise LLM-paths ke liye safety net hai.)
export function makeStubAI() {
  return {
    run: async (_model, payload) => {
      const hasTools = Array.isArray(payload?.tools) && payload.tools.length > 0;
      if (!hasTools) {
        return { response: "Hey! 👋 Want me to log some hours? Just tell me the time and the task." };
      }
      return { response: '' };
    },
  };
}
