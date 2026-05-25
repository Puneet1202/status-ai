// backend/src/ai/chat.js
// V10 PRODUCTION READY - ALL INTERNAL PIPELINES EXTENDED & FIXED

import { askCloudflareAI } from './providers/cloudflare.js';
import { buildSQLPrompt, buildReplyPrompt, buildActionPrompt, DB_SCHEMA } from './prompts.js';
import { CHAT_MODEL, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS } from './ai-config.js'; // Config Imported Cleanly

export async function aiChat(env, userId, message, history = [], pendingAction = null) {
    try {
        const cleanMessage = message.trim();

        // 🚨 CONFIG SHIELD 1: Single Message Length Guardrail
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        // 🚨 CONFIG SHIELD 2: Rolling History Character Volatility Protection
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
        // 🛡️ STATLESS CONFIRMATION INTERCEPTION (Bypass AI entirely if true)
        // ================================================================
        if (pendingAction && isConfirming) {
            return { action: "PENDING_CONFIRMATION_FLOW_TRIGGERED" };
        }

        // Fast-track exact write intent
        let forcedDecision = null;
        const exactWriteIntent =
            cleanMessageLower.includes('log hours') ||
            cleanMessageLower.includes('add entry') ||
            cleanMessageLower.includes('submit status') ||
            cleanMessageLower.includes('delete my') ||
            (cleanMessageLower.startsWith('log ') && /\b(hours|hrs|minutes|min)\b/i.test(cleanMessageLower));

        if (exactWriteIntent) {
            forcedDecision = "ACTION";
        }

        const finalDynamicSchema = `
${DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE INSTRUCTIONS:
1. You MUST explicitly use aliases for calculations: 'SUM(duration_hours) AS total_hours'.
2. Always select specific columns 'project_name', 'duration_hours', 'task_description' when listing raw logs.
`;

        let decision;
        if (forcedDecision) {
            decision = forcedDecision;
        } else {
            const sqlPrompt = buildSQLPrompt(message, finalDynamicSchema, userId);
            // Passed CHAT_MODEL variable configuration explicitly
            const firstReply = await askCloudflareAI(sqlPrompt, message, [], env, CHAT_MODEL);
            decision = firstReply.trim();
        }

        if (decision.toUpperCase() === "CLARIFY") {
            return {
                reply: "Could you please clarify your request? For example: 'Show my hours this week' or 'Log 4 hours for Project-X today'"
            };
        }

        // ================================================================
        // 🛠️ PATH A: ACTION
        // ================================================================
        if (decision.toUpperCase() === "ACTION") {
            const actionPrompt = buildActionPrompt(message, userId);
            const actionReply = await askCloudflareAI(actionPrompt, message, safeHistory, env, CHAT_MODEL);
            try {
                return { action: JSON.parse(actionReply) };
            } catch (jsonErr) {
                return { reply: "I understood you want to log data, but could you please specify the project name or duration hours clearly?" };
            }
        }

        // ================================================================
        // 🔍 PATH B: SQL READ
        // ================================================================
        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        console.log("\n=========================================================");
        console.log("[AI ENGINE] Generated SQL:", sqlQuery);
        console.log("=========================================================\n");

        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: "I could not generate a valid query for that. Could you rephrase your request?" };
        }

        const userIdRegex = new RegExp(`employee_id\\s*=\\s*['"]?${userId}['"]?`, 'i');
        if (!userIdRegex.test(sqlQuery)) {
            return { reply: "Security guardrail: Query must be scoped to your own data." };
        }

        // DB execute
        let dbResult = [];
        try {
            const { results } = await env.DB.prepare(sqlQuery).all();
            dbResult = results || [];

            console.log("=========================================================");
            console.log("[D1 OUTPUT] First row:", JSON.stringify(dbResult[0] || "EMPTY"));
            console.log("=========================================================\n");
        } catch (dbErr) {
            console.error("[D1 Query Failed]:", dbErr);
            return { reply: "I encountered an error fetching your data. Please try rephrasing your query." };
        }

        // Safety Net Slice mapping
        const safeDbResult = Array.isArray(dbResult) ? dbResult.slice(0, 50) : [];

        // Natural language reply
        const replyPrompt = buildReplyPrompt(message, safeDbResult);
        const finalHumanReply = await askCloudflareAI(replyPrompt, message, safeHistory, env, CHAT_MODEL);

        return { reply: finalHumanReply };

    } catch (globalErr) {
        console.error("[Fatal Pipeline Error]:", globalErr);
        return { reply: "Internal error occurred. Please try again." };
    }
}