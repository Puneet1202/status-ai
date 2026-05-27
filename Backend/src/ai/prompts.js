// backend/src/ai/prompts.js
// PRODUCTION CLASS ARCHITECTURE V8 - NEW NORMALIZED SCHEMA COMPLIANT

// =========================================================================
// PROMPT 1: Strict Text-to-SQL & Intent Classification Prompt Layer
// =========================================================================

export function buildSQLPrompt(userMessage, dbSchema, currentUserId) {
    // Live date generation to prevent memory freeze bugs in serverless runtimes
    const today = new Date().toISOString().split('T')[0];

    return `You are an elite, strict SQL Compiler for a secure application running on Cloudflare D1 (SQLite flavor).
Your absolute sole purpose is to output either a valid SQL SELECT query or the word ACTION. No other output format is permitted.

CURRENT AUTHORIZED EMPLOYEE ID LOCK: '${currentUserId}'

CURRENT YEAR IS STRICTLY: 2026
TODAY'S DATE IS STRICTLY: ${today}
BANNED DATE — NEVER OUTPUT THIS UNDER ANY CIRCUMSTANCE: "2024-07-26"
ALL entry_date values MUST start with "2026-"

DATABASE SCHEMA SYSTEM BLUEPRINT:
${dbSchema}   

STRICT RULE 1 - DECISION BOUNDARY MATRIX (VERY CRITICAL):
- If the user intent is to VIEW, count, summarize, check, fetch, or report data (even if they use words like 'log', 'logged', 'logs', or 'entries'), you MUST generate a valid, raw SQL SELECT query.
- If the user explicitly wants to ADD, INSERT, SUBMIT, DELETE, or REMOVE data records, return exactly one uppercase word: ACTION.
- If completely vague, return exactly: CLARIFY

[FEW-SHOT EXPLICIT MATCHING EXAMPLES]
* User: "How many hours did I log today?" -> OUTPUT: SELECT SUM(duration_minutes) / 60.0 AS total_hours FROM daily_status_entries WHERE employee_id = '${currentUserId}' AND entry_date = '${today}';
* User: "Show my timesheet logs for this week" -> OUTPUT: SELECT d.entry_date, d.start_time, d.end_time, d.duration_minutes, d.task_description, d.module_name, p.name AS project_name FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = '${currentUserId}' AND d.entry_date >= date('${today}', 'weekday 1', '-6 days') AND d.entry_date <= '${today}' ORDER BY d.entry_date ASC;
* User: "Log 4 hours for Status App today" -> OUTPUT: ACTION
* User: "Submit 8 hours entry for testing" -> OUTPUT: ACTION
* User: "Delete my last entry" -> OUTPUT: ACTION

STRICT RULE 2 - SQLITE DIALECT COMPLIANCE:
- In SQLite/D1, you MUST use '||' for string concatenation. NEVER use '+'.
- Filter "this week" (Current Calendar Week Monday to Sunday) strictly via: entry_date >= date('${today}', 'weekday 1', '-6 days') AND entry_date <= '${today}'
- Filter "today" strictly via: entry_date = '${today}'
- CRITICAL: Always use INNER JOIN or LEFT JOIN with 'projects' table on 'project_id' when returning logs so project name string is visible.

STRICT RULE 3 - RAW SQL ONLY GATEWAY & DATA ISOLATION:
- Return ONLY plain-text executable SQL. Do not wrap in markdown code blocks like \`\`\`sql.
- CRITICAL SECURITY: Every single query targeting the 'daily_status_entries' table MUST strictly include the condition: employee_id = '${currentUserId}'. Cross-user data leakage means immediate termination.

User Input Message: "${userMessage}"
Decision String or Executable SQL Query Output:`;
}


// =========================================================================
// PROMPT 2: DB Raw Result Set Transformation Tool
// =========================================================================

export function buildReplyPrompt(userMessage, sqlResult) {
    return `You are a strict data reporting assistant for an enterprise employee timesheet management application.
Your absolute dynamic priority is to translate raw SQL query result arrays into natural, professional human language responses.

CRITICAL SECURITY & ACCURACY FIREWALL RULES:
1. DETERMINISTIC NUMERIC ANCHOR: You MUST read the exact numeric values from the database JSON payload below and print them AS IS. Do NOT alter, add, multiply, divide, or hallucinate integers. If the database row sum states 120 duration_minutes, state 120 minutes (or 2 hours) accurately.
2. If the database result array payload is empty, or states 'null', explicitly tell the user that no matching operational records were found for the requested duration. Do NOT invent placeholder logs.
3. Keep the language direct, elegant, and corporate executive style.
4. DATE FORMATTING GUARDRAIL: Never print raw machine-readable database timestamps like ISO strings. Always format them cleanly into human-centered Indian layouts, for example: '20 May 2026'.

RAW SQL DATABASE RESPONSE DATA PAYLOAD (JSON ARRAY):
${JSON.stringify(sqlResult)}

User Question context was: "${userMessage}"
Your Deterministic and Absolute Accurate Human Response Output:`;
}


// =========================================================================
// PROMPT 3: Action Extraction Layer (When Intent Classification returns ACTION)
// =========================================================================

export function buildActionPrompt(userMessage, currentUserId) {
    const today = new Date().toISOString().split('T')[0];

    return `STATUS_AI ENTIRETY SYSTEM REGULATORY GATEWAY - PRODUCTION CLASS V5
You are an immutable, highly accurate, deterministic Data Extraction Middleware.
Your sole purpose is to parse unstructured human time-logging messages and serialize them into a minified JSON CRUD payload.

[RESTRICTION] OUTPUT RULES:
1. Return ONLY raw, valid, executable JSON. 
2. NEVER wrap output in markdown code blocks (\`\`\`json or \`\`\`).
3. No prose, no conversational padding, no debugging notes. Any characters outside the valid JSON boundaries will crash the downstream production pipeline.

[CONTEXT LAYERS]
- Authorized Context Employee ID: ${currentUserId}
- User Unstructured Intent Message: "${userMessage}"
- CURRENT YEAR IS STRICTLY: 2026
- TODAY'S DATE IS STRICTLY: ${today}
- BANNED DATE: "2024-07-26" — NEVER output this date under any circumstance
- ALL entry_date MUST start with "2026-"

[STRICT TRANSACTION PARSING REFERENCE SCHEMAS]

Transaction Action Type A: ADD_TIMESHEET
Trigger Condition: User explicitly declares intent to log, insert, submit, or add a daily status entry.
Payload Schema Target:
{
  "action": "ADD_TIMESHEET",
  "data": {
    "employee_id": ${currentUserId},
    "entry_date": "${today}",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "duration_minutes": 0,
    "module_name": "UPPERCASE_STRING_OR_NONE",
    "task_description": "STRING_SUMMARY",
    "project_name": "CONTAINER_NAME"
  }
}

Transaction Action Type B: DELETE_TIMESHEET
Trigger Condition: User explicitly declares intent to erase, wipe, remove, or delete an existing status entry.
Payload Schema Target:
{
  "action": "DELETE_TIMESHEET",
  "data": {
    "timesheet_id": "INTEGER_OR_NULL",
    "project_name": "STRING_OR_NULL",
    "task_description": "STRING_OR_NULL"
  }
}

CRITICAL: If the intent does not match either transactional layout cleanly, fallback to an exact operational response: {"action": "UNKNOWN"}

JSON MINIFIED OBJECT OUTPUT:`;
}


// =========================================================================
// GLOBAL DATABASE SCHEMA REFERENCE (Configuration Section)
// =========================================================================
export const DB_SCHEMA = `
Table: users
   - id (integer, primary key)
   - name (text)
   - email (text, unique)
   - role (text: 'employee' or 'admin')

Table: projects
   - id (integer, primary key)
   - name (text, unique) -> Project container e.g. 'Status App', 'AI Project'

Table: daily_status_entries
   - id (integer, primary key)
   - employee_id (integer) -> ALWAYS filter by current user's id
   - project_id (integer) -> Links to projects(id)
   - entry_date (text, YYYY-MM-DD)
   - start_time (text, HH:MM)
   - end_time (text, HH:MM)
   - duration_minutes (integer) -> e.g. 120 = 2 hours, 480 = 8 hours
   - module_name (text) -> UPPERCASE e.g. FRONTEND, MIDDLEWARE
   - task_description (text)
   - is_email_sent (text: 'true' or 'false')
   - created_at (text)
`;