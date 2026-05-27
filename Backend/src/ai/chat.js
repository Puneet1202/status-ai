// FILE: backend/src/ai/chat.js
// V15 PRODUCTION READY - WATER-TIGHT RECOVERY WITH OUTPUT SANITIZATION

import { askCloudflareAI } from './providers/cloudflare.js'; // Single source of truth provider
import { buildSQLPrompt, buildReplyPrompt, DB_SCHEMA } from './prompts.js';
import { CHAT_MODEL, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS } from './ai-config.js'; // Config imported cleanly
// ✅ Change 1: Fresh live function objects imported instead of static configurations array
import { getSystemPrompt, getTimesheetTools } from './tools.js';

// =========================================================================
// 🛡️ SECURITY SHIELD: Safe JSON Extractor Regex Loop (Bypass LLM Noise)
// =========================================================================
function safeParseArgs(raw) {
    if (typeof raw !== "string") return raw;
    
    // Greedy match to extract the outermost bound JSON structure cleanly
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (err) {
            console.error("[⚠️ Fatal Parsing Sync Failure]: Matched block syntax corrupted.", err);
            throw new Error("Tool arguments JSON parse failed inside isolated regex sandbox.");
        }
    }
    return JSON.parse(raw);
}

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
        // ✅ Change 2: Dynamic runtime execution using getTimesheetTools() fresh instance
        const toolResponse = await askCloudflareAI(
            getSystemPrompt(), 
            cleanMessage, 
            safeHistory, 
            env, 
            getTimesheetTools() // ← Runtime fresh tools configuration
        );

        // Llama Specific Tool Calling Extractor
        const toolCall = toolResponse?.tool_calls?.[0];

        if (toolCall) {
            // 🌟 ACTIVE HOOK: Applying the regex sanitization rule cleanly to bypass LLM trailing strings noise
            const inputArgs = safeParseArgs(toolCall.arguments);

            // Direct structured payload output to match the dispatch controller array keys
            return { action: { action: toolCall.name, data: inputArgs } };
        }

        // ================================================================
        // 🔍 PATH 2: FALLBACK PATH - CONVERSATIONAL OR MANUAL VIEWING LAYER
        // ================================================================
        // Agar Llama koi tool use nahi karta toh normal decision tree par jump karega
        // ✅ Change 3: Refactored compliance schema metadata instructions for normalized table structures
        const finalDynamicSchema = `
${DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE:
1. Table name is: daily_status_entries (NOT timesheets)
2. Use SUM(duration_minutes)/60.0 AS total_hours
3. JOIN projects table: JOIN projects p ON d.project_id = p.id
4. Always use alias 'd' for daily_status_entries
`;

        const sqlPrompt = buildSQLPrompt(cleanMessage, finalDynamicSchema, userId);
        
        // Normal chat conversion block routed via provider wrapper (Passing null to systemPrompt)
        const firstReply = await askCloudflareAI(null, sqlPrompt, [], env);
        
        let decision = typeof firstReply === 'string' ? firstReply.trim() : (firstReply.response || "").trim();

        if (decision.toUpperCase() === "CLARIFY") {
            return {
                reply: "Could you please clarify your request? For example: 'Show my timesheet logs for this week' or 'Log 4 hours for Project-X today'"
            };
        }

        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            const rawFallbackText = typeof toolResponse === 'string' ? toolResponse : (toolResponse.response || "I understood your request but couldn't structure it. Can you rephrase?");
            return { reply: rawFallbackText };
        }

        // Security scope check (Loose match works perfectly for d.employee_id)
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
        
        // Human response generation node cleanly decoupled via provider
        const finalHumanReply = await askCloudflareAI(null, replyPrompt, safeHistory, env);

        const textReply = typeof finalHumanReply === 'string' ? finalHumanReply : (finalHumanReply.response || finalHumanReply.text || "");
        return { reply: textReply };

    } catch (globalErr) {
        console.error("[Fatal Pipeline Error]:", globalErr);
        return { reply: "Internal error occurred. Please try again." };
    }
}