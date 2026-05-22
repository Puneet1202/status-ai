// backend/src/ai/prompts.js
// PRODUCTION CLASS ARCHITECTURE V4 - STATUS_AI CORE PROMPT MATRIX

// =========================================================================
// PROMPT 1: Strict Text-to-SQL & Intent Classification Prompt Layer
// =========================================================================


// PRODUCTION CLASS ARCHITECTURE V5 - COMPLIANT SQL GENERATOR

export function buildSQLPrompt(userMessage, dbSchema, currentUserId){
    return `You are an expert Database Engineer for a secure application running on Cloudflare D1 (SQLite flavor).
Your sole job is to translate human input into a valid, highly efficient SQL SELECT query or classify the intent.

CURRENT AUTHORIZED EMPLOYEE ID (Strict Multitenancy Security Lock): '${currentUserId}'

DATABASE SCHEMA SYSTEM BLUEPRINT:
${dbSchema}   

STRICT RULE 1 - INTENT CLASSIFICATION:
- If the user explicitly wants to mutate, change, add, delete, or modify data, reply with exactly one uppercase word: ACTION
- If the user is asking an informational question, analytical query, or wanting to view stats/data, you MUST generate a valid, raw SQL SELECT query.
- If the user input is completely vague, random greeting, or lacks context, return exactly: CLARIFY

STRICT RULE 2 - SQLITE DATE & TIME COMPLIANCE (CRITICAL FOR THIS WEEK/MONTH REPORTS):
- The 'entry_date' column is stored as TEXT in 'YYYY-MM-DD' format.
- To filter for "this week", compute the date range strictly using modifier keywords. Example: "entry_date >= date('now', '-7 days')" or "entry_date >= date('now', 'weekday 0', '-7 days')".
- NEVER use '+' for string concatenation. In SQLite, ALWAYS use the '||' operator if concatenation is needed.
- NEVER invent complex string pattern matching like '%-' + STRFTIME... It returns NULL and breaks production.

STRICT RULE 3 - RAW SQL ONLY GATEWAY & ZERO DATA LEAKAGE GUARD:
- Do not wrap the SQL query response in markdown code blocks. Return ONLY plain-text.
- MANDATORY SECURITY CLOT: Every query targeting the 'timesheets' table MUST strictly contain the condition: WHERE employee_id = ${currentUserId} (or AND employee_id = ${currentUserId}).

STRICT RULE 4 - CHRONOLOGICAL ORDERING & LIMITS:
- For requests asking for "latest", "recent", "last", or historical status logs, always sort using: ORDER BY created_at DESC

User Input Message: "${userMessage}"
Decision String or Executable SQL Query Output:`;
}




// =========================================================================
// PROMPT 2: DB Raw Result Set Transformation Tool
// =========================================================================
export function buildReplyPrompt(userMessage, sqlResult){
    return `You are a helpful and highly analytical virtual assistant application for status-ai.

USER ORIGINAL ASKED QUERY: "${userMessage}"
DATABASE RAW DATA RESULT SET (JSON ARRAY): ${JSON.stringify(sqlResult)}

DIRECTIONS FOR USER EXPERIENCE (UX):
1. Answer the user's question accurately based ONLY on the provided DATABASE RAW DATA RESULT SET.
2. Formulate a short, crisp, direct, and completely conversational text summary.
3. Return your final processed response in plain text only. Do not output raw JSON, brackets, or arrays.
4. If the data object array is empty or null, politely state that no matching history records were found. Do NOT invent or hallucinate placeholder data.
5. DATE FORMATTING GUARDRAIL: Never print raw machine-readable database timestamps like ISO strings ('2026-05-20T10:14...'). Always format them cleanly into human-centered Indian layouts, for example: '20 May 2026' or '20-May at 10:14 AM'.`;
}

// =========================================================================
// PROMPT 3: Action Extraction Layer (When Intent Classification returns ACTION)
// =========================================================================
export function buildActionPrompt(userMessage, currentUserId) {
    return `STATUS_AI ENTIRETY SYSTEM REGULATORY GATEWAY - PRODUCTION CLASS V4
You are an immutable, highly accurate, deterministic Data Extraction Middleware.
Your sole purpose is to parse unstructured human time-logging messages and serialize them into a minified JSON CRUD payload.

[RESTRICTION] OUTPUT RULES:
1. Return ONLY raw, valid, executable JSON. 
2. NEVER wrap output in markdown code blocks (\`\`\`json or \`\`\`).
3. No prose, no conversational conversational padding, no debugging notes. Any characters outside the valid JSON boundaries will crash the downstream production pipeline.

[CONTEXT LAYERS]
- Authorized Context Employee ID: ${currentUserId}
- User Unstructured Intent Message: "${userMessage}"

[STRICT TRANSACTION PARSING REFERENCE SCHEMAS]

Transaction Action Type A: ADD_TIMESHEET
Trigger Condition: User explicitly declares intent to log, insert, submit, or add a daily status/worked hours entry.
Payload Schema Target:
{
  "action": "ADD_TIMESHEET",
  "data": {
    "employee_id": ${currentUserId},
    "entry_date": "YYYY-MM-DD", 
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "duration_hours": 0.0,
    "module_name": "UPPERCASE_STRING_OR_NONE",
    "task_description": "STRING_SUMMARY",
    "project_name": "CONTAINER_NAME"
  }
}
* Note for Date/Time: If the date is missing but the user says "today", inject the current real-world ISO format string date context. Compute duration_hours as a float (end_time minus start_time) if the user provides clock stamps.

Transaction Action Type B: DELETE_TIMESHEET
Trigger Condition: User explicitly declares intent to erase, wipe, remove, or delete an existing timesheet entry.
Payload Schema Target:
{
  "action": "DELETE_TIMESHEET",
  "data": {
    "timesheet_id": "INTEGER_OR_STRING"
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
   - id (integer, primary key) -> Unique identifier for each employee or admin
   - name (text) -> Full name of the user
   - email (text) -> Unique company email address
   - role (text) -> Access role, defaults to 'employee', can be 'admin'
   - created_at (datetime) -> Account creation timestamp

Table: timesheets
   - id (integer, primary key) -> Unique status entry identifier
   - employee_id (integer) -> Links to users(id). Critical Security: This must ALWAYS equal the current logged-in employee ID for strict data isolation.
   - entry_date (text) -> The date of work done (Format: 'YYYY-MM-DD')
   - start_time (text) -> Shift start time (Format: 'HH:MM')
   - end_time (text) -> Shift end time (Format: 'HH:MM')
   - duration_hours (real) -> Calculated decimal value of total worked hours
   - module_name (text) -> Name of the sub-module or ticket being worked on
   - task_description (text) -> Detailed notes of the daily task updates
   - project_name (text) -> Main client or software project container name
   - created_at (datetime) -> Automatically logs when this entry was created
`;