// backend/src/ai/chat.js
// V6 ARCHITECT PRODUCTION ENGINE - TRANSPARENT DEBUGGING MATRIX

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
   - employee_id (integer) -> Must match user id strictly
   - entry_date (text) -> Format: 'YYYY-MM-DD'
   - start_time (text) -> Format: 'HH:MM'
   - end_time (text) -> Format: 'HH:MM'
   - duration_hours (real) -> Contains decimal hours worked
   - module_name (text)
   - task_description (text)
   - project_name (text)
`;

function formatTimesheetRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 'No matching timesheet history records were found.';

    return rows.map((row, index) => {
        // Dynamic Key Extractor: D1 ke ajeeb naamon ko bypass karne ke liye direct object keys check karo
        const rowKeys = Object.keys(row);
        
        // Agar query ne kisi bhi tarah ka SUM ya aggregate return kiya hai (e.g. SUM(duration_hours))
        const anySumKey = rowKeys.find(k => k.toLowerCase().includes('sum') || k.toLowerCase().includes('total'));
        if (anySumKey && typeof row[anySumKey] === 'number') {
            return `Total calculated workload volume: **${row[anySumKey]} hours** for the requested duration.`;
        }

        // Direct standard columns target with absolute dynamic fallbacks
        const project = row.project_name ?? row.project ?? row[rowKeys.find(k => k.includes('project'))] ?? 'Internal Tool';
        const hours = row.duration_hours ?? row.hours ?? row[rowKeys.find(k => k.includes('hours') || k.includes('duration'))] ?? 0;
        const summary = row.task_description ?? row.description ?? row[rowKeys.find(k => k.includes('task') || k.includes('desc'))] ?? 'Status Logged';
        const date = row.entry_date ?? row.date ?? '';

        const prefix = date ? `${date} | ` : '';
        return `${index + 1}. ${prefix}${project}: **${hours} hrs** — ${summary}`;
    }).join('\n');
}

export async function aiChat(env, userId, message, history = []){
    try {
        const cleanMessage = message.trim().toLowerCase();
        const safeHistory = Array.isArray(history) ? history.slice(-4) : [];

        const actionKeywords = ['log', 'submit', 'inserted'];
        let forcedDecision = null;
        if (cleanMessage.split(' ').some(word => actionKeywords.includes(word))) {
            forcedDecision = "ACTION";
        }

        // AI ko boundary mein rakhne ke liye strict system orders
        const finalDynamicSchema = `
${ENGINE_DB_SCHEMA}
CRITICAL SQLITE COMPLIANCE INSTRUCTIONS:
1. You MUST explicitly use aliases for calculations: 'SUM(duration_hours) AS duration_hours' or 'SUM(duration_hours) AS total_hours'.
2. Always select the specific columns 'project_name', 'duration_hours', 'task_description' when listing raw logs. Do NOT guess column names.
`;

        let decision;
        if (forcedDecision) {
            decision = forcedDecision;
        } else {
            const sqlPrompt = buildSQLPrompt(message, finalDynamicSchema, userId);
            const firstReply = await askCloudflareAI(sqlPrompt, message, [], env);
            decision = firstReply.trim();
        }

        if (decision === "ACTION") {
            const actionPrompt = buildActionPrompt(message, userId);
            const actionReply = await askCloudflareAI(actionPrompt, message, safeHistory, env);
            try {
                return { action: JSON.parse(actionReply) }; 
            } catch (jsonErr) {
                return { reply: "Failed to map structured automation action commands." };
            }
        }

        let sqlQuery = decision.trim();
        if (sqlQuery.endsWith(';')) sqlQuery = sqlQuery.slice(0, -1).trim();

        // 🛑 SENIOR ARCHITECT LIVE TELEMETRY: ISSE TERMINAL PAR SAALON KA EXPERIENCE DIKHEGA
        console.log("\n=========================================================");
        console.log("[🚨 AI ENGINE LIVE AUDIT] Generated SQL Query:", sqlQuery);
        console.log("=========================================================\n");

        if (!sqlQuery.toUpperCase().includes("SELECT")) {
            return { reply: "Security Guardrail Alert: Raw database data mutations blocked via chat portal." };
        }
        if (!sqlQuery.includes(String(userId))) {
            return { reply: "Security Guardrail Alert: Data cross-leakage attempt intercepted." };
        }

        let dbResult = [];
        try {
            const { results } = await env.DB.prepare(sqlQuery).all();
            dbResult = results || [];
            
            // 🛑 LIVE DATABASE RESPONSE TELEMETRY
            console.log("=========================================================");
            console.log("[🚨 D1 ENGINE RAW OUTPUT] First Data Row:", JSON.stringify(dbResult[0] || "EMPTY ARRAY"));
            console.log("=========================================================\n");

        } catch (dbErr) {
            console.error("[D1 Crash Log]:", dbErr);
            return { reply: "Server connection bottleneck encountered during live analytical execution." };
        }
// backend/src/ai/chat.js (Database hit ke thik niche ka section)
        
        const safeDbResult = Array.isArray(dbResult) ? dbResult.slice(0, 5) : [];

        // 🏛️ SENIOR ARCHITECT FIX: Hardcoded bypass poori tarah khatam!
        // Chahe list ho, show ho, ya total hours—data strictly AI Synthesis Engine ke paas jayega
        // Taaki response hamesha ekdam professional aur human-centered bane.

        // 🤖 TURN 2: SECOND LOGICAL TURN - RAW DATA CONVERSION TO PROFESSIONAL DIALOGUE
        const replyPrompt = buildReplyPrompt(message, safeDbResult);
        const finalHumanReply = await askCloudflareAI(replyPrompt, message, safeHistory, env);

        return { reply: finalHumanReply };

    } catch (globalErr) {
        return { reply: "An unhandled internal failure code popped inside the AI pipeline framework." };
    }
}