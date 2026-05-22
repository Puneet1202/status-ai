// backend/src/ai/chat.js
// V7 ENTERPRISE ROBUST PRODUCTION COMPLIANT ENGINE - ARCHITECT LOCKED

import { askCloudflareAI } from './providers/cloudflare.js';
import { buildSQLPrompt, buildReplyPrompt, buildActionPrompt } from './prompts.js';

const ENGINE_DB_SCHEMA = `
Table: users
   - id (integer, primary key)
   - name (text)
   - email (text)
   - role (text)

Table: timesheets
   - id (integer, primary key)
   - employee_id (integer) -> Strict Multi-tenancy Isolation Key
   - entry_date (text) -> Format: 'YYYY-MM-DD'
   - start_time (text) -> Format: 'HH:MM'
   - end_time (text) -> Format: 'HH:MM'
   - duration_hours (real)
   - module_name (text)
   - task_description (text)
   - project_name (text)
`;

export async function aiChat(env, userId, message, history = []){
    try {
        const cleanMessage = message.trim().toLowerCase();
        const safeHistory = Array.isArray(history) ? history.slice(-4) : [];

        // 🏛️ ENTERPRISE INTENT BYPASS: Fast-track only when it's 100% a structural insertion command
        let forcedDecision = null;
        const exactWriteIntent = 
            cleanMessage.includes('log hours') || 
            cleanMessage.includes('add entry') || 
            cleanMessage.includes('submit status') || 
            (cleanMessage.startsWith('log ') && /\b(hours|hrs|minutes|min)\b/i.test(cleanMessage));

        if (exactWriteIntent) {
            forcedDecision = "ACTION";
        }

        const finalDynamicSchema = `
${ENGINE_DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE INSTRUCTIONS:
1. You MUST explicitly use aliases for calculations: 'SUM(duration_hours) AS total_hours'.
2. Always select specific columns 'project_name', 'duration_hours', 'task_description' when listing raw logs.
`;

        let decision;
        if (forcedDecision) {
            decision = forcedDecision;
        } else {
            // Let the V6 prompt do the intelligent semantic classification!
            const sqlPrompt = buildSQLPrompt(message, finalDynamicSchema, userId);
            const firstReply = await askCloudflareAI(sqlPrompt, message, [], env);
            decision = firstReply.trim();
        }

        // =========================================================================
        // 🛠️ PATH A: MUTATION ACTION PIPELINE (Data Logging/Automation Form)
        // =========================================================================
        if (decision === "ACTION") {
            const actionPrompt = buildActionPrompt(message, userId);
            const actionReply = await askCloudflareAI(actionPrompt, message, safeHistory, env);
            try {
                return { action: JSON.parse(actionReply) }; 
            } catch (jsonErr) {
                return { reply: "I understood you want to log data, but could you please specify the project name or duration hours clearly?" };
            }
        }

        // =========================================================================
        // 📊 PATH B: ANALYTICAL READ PIPELINE (Secure Text-to-SQL Dynamic Layer)
        // =========================================================================
        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        console.log("\n=========================================================");
        console.log("[🚨 AI ENGINE LIVE AUDIT] Generated SQL Query:", sqlQuery);
        console.log("=========================================================\n");

        // 🛡️ SECURITY AUDIT GATEWAY: Hardcoded RegEx Isolation Rule
        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: "Security Security Guardrail Alert: Operation restricted via chat portal." };
        }
        
        // 💥 MNC COMPLIANCE REGEX: SQL ke andar employee_id sahi format mein lock hai ya nahi
        const userIdRegex = new RegExp(`\\bemployee_id\\s*=\\s*['"]?${userId}['"]?\\b`, 'i');
        if (!userIdRegex.test(sqlQuery)) {
            return { reply: "Security Guardrail Alert: Multi-tenancy ownership validation failed." };
        }

        // Live D1 Database Driver Execution Loop
        let dbResult = [];
        try {
            const { results } = await env.DB.prepare(sqlQuery).all();
            dbResult = results || [];
            
            console.log("=========================================================");
            console.log("[🚨 D1 ENGINE RAW OUTPUT] First Data Row:", JSON.stringify(dbResult[0] || "EMPTY ARRAY"));
            console.log("=========================================================\n");
        } catch (dbErr) {
            console.error("[D1 Query Failure Logs]:", dbErr);
            return { reply: "I encountered a minor data processing lag. Could you please try asking the query again?" };
        }

        // Strict UI Layer Payload Slicing
        const safeDbResult = Array.isArray(dbResult) ? dbResult.slice(0, 5) : [];

        // 🤖 TURN 2: CONVERSATIONAL NATURAL LANGUAGE PROCESSOR (No hardcoded if blocks!)
        const replyPrompt = buildReplyPrompt(message, safeDbResult);
        const finalHumanReply = await askCloudflareAI(replyPrompt, message, safeHistory, env);

        return { reply: finalHumanReply };

    } catch (globalErr) {
        console.error("[Fatal Pipeline Log]:", globalErr);
        return { reply: "Internal pipeline exception triggered. Please contact system admin." };
    }
}