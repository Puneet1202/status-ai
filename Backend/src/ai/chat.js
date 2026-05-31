// FILE: backend/src/ai/chat.js
// V20 PRODUCTION — SINGLE ROUND-TRIP | SLIDING-WINDOW MEMORY | REGISTRY DISPATCH
//
// One LLM call decides intent + extracts args via native tool calling. There is
// NO raw-SQL path anymore (removed: data-exfiltration risk + 2 extra LLM hops).
// All reads/writes flow through parameterized tools in ./tools/*.

import { askCloudflareAI } from './providers/cloudflare.js';
import { getSystemPrompt } from './tools.js';
import { getToolSchemas } from './tools/index.js';
import { MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS, MAX_HISTORY_MESSAGES } from './ai-config.js';

// =========================================================================
// 🛡️ Stack-based deterministic JSON parser — defense-in-depth for the rare
// case where tool-call arguments come back truncated/with trailing noise.
// =========================================================================
function safeParseArgs(raw) {
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        const start = raw.indexOf('{');
        if (start === -1) throw new Error("Tool args: no JSON object boundary found.");
        let depth = 0, end = -1;
        for (let i = start; i < raw.length; i++) {
            if (raw[i] === '{') depth++;
            else if (raw[i] === '}' && --depth === 0) { end = i; break; }
        }
        if (end === -1) throw new Error("Tool args: malformed unclosed bracket structure.");
        return JSON.parse(raw.slice(start, end + 1));
    }
}

// =========================================================================
// 🧠 SHORT-TERM WORKING MEMORY — sliding window of the last N messages.
// Keeps the model context-aware without blowing the token budget.
// =========================================================================
function buildSlidingWindow(history) {
    let safe = (Array.isArray(history) ? history : [])
        // accept only well-formed {role, content} turns
        .filter(h => h && typeof h.content === 'string' && h.content.trim())
        .slice(-MAX_HISTORY_MESSAGES);

    // FIX (was always 0): measure .content length, evict OLDEST until in budget.
    let total = safe.reduce((s, h) => s + h.content.length, 0);
    while (total > MAX_TOTAL_CHARS && safe.length > 1) {
        total -= safe[0].content.length;
        safe = safe.slice(1);
    }
    return safe.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
    }));
}

export async function aiChat(env, userId, message, history = []) {
    try {
        const cleanMessage = (message || '').trim();

        // Guardrail: single-message length.
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        const window = buildSlidingWindow(history);

        // ── Single LLM round-trip: intent routing + argument extraction ──
        const toolResponse = await askCloudflareAI(
            getSystemPrompt(),
            cleanMessage,
            window,
            env,
            getToolSchemas()
        );

        const toolCall = toolResponse?.tool_calls?.[0];
        if (toolCall) {
            const args = safeParseArgs(toolCall.arguments);
            // Hand the tool name + parsed args to the controller's registry dispatcher.
            return { action: { name: toolCall.name, data: args } };
        }

        // No tool matched → conversational reply (already a trimmed string).
        const reply = typeof toolResponse === 'string'
            ? toolResponse
            : (toolResponse?.response || "Could you clarify your request? e.g. 'Log 9 to 11 on Project-X' or 'Show my hours this week'.");
        return { reply };

    } catch (err) {
        // Graceful degradation on Workers AI timeout / any pipeline fault.
        if (String(err?.message).includes('_TIMEOUT')) {
            console.warn("[AI Timeout]:", err.message);
            return { reply: "I'm taking too long to respond right now — please try again in a moment." };
        }
        console.error("[Fatal Pipeline Error]:", err);
        return { reply: "Internal error occurred. Please try again." };
    }
}
