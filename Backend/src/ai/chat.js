// FILE: backend/src/ai/chat.js
// V13 PRODUCTION READY - FULL PROVIDER DECOUPLING + SQL FALLBACK MATRIX

import { askCloudflareAI } from './providers/cloudflare.js'; // Single source of truth provider
import { buildSQLPrompt, buildReplyPrompt, DB_SCHEMA } from './prompts.js';
import { CHAT_MODEL, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS } from './ai-config.js'; // Config imported cleanly
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
        // 🚀 PATH 1: STRUCTURED ACTION DETECTION VIA PROVIDER (With Tools)
        // ================================================================
        // ✅ Fixed: Calling the polymorphic provider wrapper instead of env.AI.run direct bypass
        const toolResponse = await askCloudflareAI(
            getSystemPrompt(), 
            cleanMessage, 
            safeHistory, 
            env, 
            TIMESHEET_TOOLS
        );

        // Llama Specific Tool Calling Extractor
        const toolCall = toolResponse?.tool_calls?.[0];

        if (toolCall) {
            // Safe parameter string parsing defense
            const inputArgs = typeof toolCall.arguments === "string"
                ? JSON.parse(toolCall.arguments)
                : toolCall.arguments;

            // Direct structured payload output to match the dispatch controller array keys
            return { action: { action: toolCall.name, data: inputArgs } };
        }

        // ================================================================
        // 🔍 PATH 2: FALLBACK PATH - CONVERSATIONAL OR MANUAL VIEWING LAYER
        // ================================================================
        // Agar Llama koi tool use nahi karta toh normal decision tree par jump karega
        const finalDynamicSchema = `
${DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE INSTRUCTIONS:
1. You MUST explicitly use aliases for calculations: 'SUM(duration_hours) AS total_hours'.
2. Always select specific columns 'project_name', 'duration_hours', 'task_description' when listing raw logs.
`;

        const sqlPrompt = buildSQLPrompt(cleanMessage, finalDynamicSchema, userId);
        
        // ✅ Fixed: Normal chat conversion block routed via provider wrapper (Passing null to systemPrompt)
        const firstReply = await askCloudflareAI(null, sqlPrompt, [], env);
        
        let decision = typeof firstReply === 'string' ? firstReply.trim() : (firstReply.response || "").trim();

        if (decision.toUpperCase() === "CLARIFY") {
            return {
                reply: "Could you please clarify your request? For example: 'Show my hours this week' or 'Log 4 hours for Project-X today'"
            };
        }

        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            const rawFallbackText = typeof toolResponse === 'string' ? toolResponse : (toolResponse.response || "I understood your request but couldn't structure it. Can you rephrase?");
            return { reply: rawFallbackText };
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
        const replyPrompt = buildReplyPrompt(cleanMessage, safeDbResult);
        
        // ✅ Fixed: Human response generation node cleanly decoupled via provider
        const finalHumanReply = await askCloudflareAI(null, replyPrompt, safeHistory, env);

        const textReply = typeof finalHumanReply === 'string' ? finalHumanReply : (finalHumanReply.response || finalHumanReply.text || "");
        return { reply: textReply };

    } catch (globalErr) {
        console.error("[Fatal Pipeline Error]:", globalErr);
        return { reply: "Internal error occurred. Please try again." };
    }
}