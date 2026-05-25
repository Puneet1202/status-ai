// backend/src/ai/chat.js
// V11 PRODUCTION READY - NATIVE LLAMA-3.3 TOOL INJECTION LAYER

import { buildSQLPrompt, buildReplyPrompt, DB_SCHEMA } from './prompts.js';
import { CHAT_MODEL, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS } from './ai-config.js'; // Config used smoothly
import { getSystemPrompt, TIMESHEET_TOOLS } from './tools.js';

export async function aiChat(env, userId, message, history = [], pendingAction = null) {
    try {
        const cleanMessage = message.trim();

        // 🚨 CONFIG SHIELD 1: Single Message Length Guardrail (100% Intact)
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        // 🚨 CONFIG SHIELD 2: Rolling History Character Volatility Protection (100% Intact)
        let safeHistory = Array.isArray(history) ? history : [];
        const totalHistoryChars = safeHistory.reduce((sum, h) => sum + (h?.length || 0), 0);
        
        if (totalHistoryChars > MAX_TOTAL_CHARS) {
            console.log(`[⚠️ CONTEXT LIMIT BREACH] History total chars: ${totalHistoryChars}. Truncating array state.`);
            safeHistory = safeHistory.slice(-2);
        } else {
            safeHistory = safeHistory.slice(-4);
        }

        const cleanMessageLower = cleanMessage.toLowerCase();
        const isConfirming = /^(confirm|yes|haan|ha|ok|okay|confirm delete)\b/i.test(cleanMessageLower);

        // ================================================================
        // 🛡️ STATELESS CONFIRMATION INTERCEPTION (Bypass AI entirely if true)
        // ================================================================
        if (pendingAction && isConfirming) {
            return { action: { action: "PENDING_CONFIRMATION_FLOW_TRIGGERED", data: {} } };
        }

        // ================================================================
        // 🚀 NEW PIPELINE: CLOUDFLARE NATIVE LLAMA TOOL RUNNER
        // ================================================================
        // Yahan humne hardcoded string hata kar direct config waala CHAT_MODEL inject kar diya!
        const response = await env.AI.run(CHAT_MODEL, {
            messages: [
                { role: "system", content: getSystemPrompt() },
                ...safeHistory,
                { role: "user", content: cleanMessage }
            ],
            tools: TIMESHEET_TOOLS // Connecting tools.js definitions here
        });

        // Llama Specific Tool Calling Extractor
        const toolCall = response.tool_calls?.[0];

        if (toolCall) {
            // Safe parameter string parsing defense
            const inputArgs = typeof toolCall.arguments === "string"
                ? JSON.parse(toolCall.arguments)
                : toolCall.arguments;

            // Direct structured payload output to match the dispatch controller array keys
            return { action: { action: toolCall.name, data: inputArgs } };
        }

        // ================================================================
        // 🔍 FALLBACK PATH: CONVERSATIONAL OR MANUAL VIEWING LAYER
        // ================================================================
        // Agar Llama koi tool use nahi karta toh normal decision tree par jump karega
        const finalDynamicSchema = `
${DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE INSTRUCTIONS:
1. You MUST explicitly use aliases for calculations: 'SUM(duration_hours) AS total_hours'.
2. Always select specific columns 'project_name', 'duration_hours', 'task_description' when listing raw logs.
`;

        const sqlPrompt = buildSQLPrompt(message, finalDynamicSchema, userId);
        const firstReply = await env.AI.run(CHAT_MODEL, {
            messages: [{ role: "user", content: sqlPrompt }]
        });
        
        let decision = firstReply.response || firstReply.text || firstReply;
        decision = decision.trim();

        if (decision.toUpperCase() === "CLARIFY") {
            return {
                reply: "Could you please clarify your request? For example: 'Show my hours this week' or 'Log 4 hours for Project-X today'"
            };
        }

        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: response.response || "I understood your request but couldn't structure it. Can you rephrase?" };
        }

        // Security scope check
        const userIdRegex = new RegExp(`employee_id\\s*=\\s*['"]?${userId}['"]?`, 'i');
        if (!userIdRegex.test(sqlQuery)) {
            return { reply: "Security guardrail: Query must be scoped to your own data." };
        }

        // DB Fetch Execution Loop
        let dbResult = [];
        try {
            const { results } = await env.DB.prepare(sqlQuery).all();
            dbResult = results || [];
        } catch (dbErr) {
            console.error("[D1 Query Failed]:", dbErr);
            return { reply: "I encountered an error fetching your data. Please try rephrasing." };
        }

        const safeDbResult = Array.isArray(dbResult) ? dbResult.slice(0, 50) : [];
        const replyPrompt = buildReplyPrompt(message, safeDbResult);
        
        const finalHumanReply = await env.AI.run(CHAT_MODEL, {
            messages: [{ role: "user", content: replyPrompt }]
        });

        return { reply: finalHumanReply.response || finalHumanReply.text || finalHumanReply };

    } catch (globalErr) {
        console.error("[Fatal Pipeline Error]:", globalErr);
        return { reply: "Internal error occurred. Please try again." };
    }
}