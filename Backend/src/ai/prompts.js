// FILE: backend/src/ai/prompts.js
// V9.0 - FULLY DYNAMIC | NO HARDCODED TIMES | GLOBAL READY

// =========================================================================
// PROMPT 1: SQL Intent Classification
// =========================================================================
export function buildSQLPrompt(userMessage, dbSchema, currentUserId) {
  const today = new Date().toISOString().split('T')[0];

  return `You are an elite SQL Compiler for Cloudflare D1 (SQLite).
Output ONLY a valid SQL SELECT query or the single word ACTION or CLARIFY.

AUTHORIZED EMPLOYEE ID: '${currentUserId}'
TODAY: ${today}
ALL dates MUST be 2026 or later.

DATABASE SCHEMA:
${dbSchema}

ROUTING RULES:
- VIEW / show / check / fetch / report / kitna / dikhao → SQL SELECT query
- ADD / log / submit / insert / kiya / worked → ACTION
- DELETE / remove / hata do → ACTION
- Completely vague → CLARIFY

SQL RULES (SQLite/D1):
- Use '||' for string concat, never '+'
- ALWAYS filter: employee_id = '${currentUserId}'
- ALWAYS JOIN projects table: JOIN projects p ON d.project_id = p.id
- Use alias 'd' for daily_status_entries
- "today" → entry_date = '${today}'
- "this week" → entry_date >= date('${today}', 'weekday 1', '-6 days') AND entry_date <= '${today}'
- "yesterday" → entry_date = date('${today}', '-1 day')
- "this month" → entry_date >= date('${today}', 'start of month') AND entry_date <= '${today}'
- Return raw SQL only — no markdown, no backticks

EXAMPLES:
"How many hours today?" → SELECT SUM(duration_minutes)/60.0 AS total_hours FROM daily_status_entries WHERE employee_id = '${currentUserId}' AND entry_date = '${today}'
"Show this week" → SELECT d.entry_date, d.start_time, d.end_time, d.duration_minutes, d.task_description, d.module_name, p.name AS project_name FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = '${currentUserId}' AND d.entry_date >= date('${today}', 'weekday 1', '-6 days') AND d.entry_date <= '${today}' ORDER BY d.entry_date ASC
"Log 4 hours" → ACTION
"Delete my entry" → ACTION

User: "${userMessage}"
Output:`;
}

// =========================================================================
// PROMPT 2: DB Result to Human Language
// =========================================================================
export function buildReplyPrompt(userMessage, sqlResult) {
  return `You are a professional timesheet reporting assistant.
Convert the raw database result below into a clear, natural human response.

RULES:
1. Use EXACT numbers from the data — never alter, round, or hallucinate values
2. If result is empty or null → say no records found, do not invent data
3. Format dates as: "29 May 2026" (never raw ISO strings)
4. Format times as: "9:00 AM to 11:00 AM" (human readable)
5. Be concise and professional
6. Calculate total hours from duration_minutes if showing summary (divide by 60)

RAW DATABASE RESULT:
${JSON.stringify(sqlResult)}

User asked: "${userMessage}"
Response:`;
}

// =========================================================================
// PROMPT 3: Action Extraction (Fully Dynamic — No Hardcoded Times)
// =========================================================================
export function buildActionPrompt(userMessage, currentUserId) {
  const today = new Date().toISOString().split('T')[0];

  return `You are a precise data extraction engine for a timesheet application.
Output ONLY valid raw JSON. No markdown. No explanation. No backticks.

CONTEXT:
- Employee ID: ${currentUserId}
- Today: ${today}
- All dates must start with "2026-"

═══════════════════════════════════════
SCHEMA: ADD_TIMESHEET (single entry)
═══════════════════════════════════════
{
  "action": "ADD_TIMESHEET",
  "data": {
    "entry_date": "YYYY-MM-DD",
    "entries": [
      {
        "start_time": "HH:MM",
        "end_time": "HH:MM",
        "duration_minutes": <INTEGER>,
        "module_name": "UPPERCASE_SNAKE_CASE",
        "task_description": "Clean professional summary",
        "project_name": "As mentioned by user"
      }
    ]
  }
}
DURATION RULES (CRITICAL):
- ALWAYS calculate duration_minutes = end_time minus start_time in minutes
- Example: 09:00 to 11:30 = 150 minutes
- Overnight: 23:00 to 03:00 = 240 minutes
- NEVER output 120 as default — always compute from actual times
- If entry duration exceeds 120 minutes — do NOT create one entry. Set error: "MAX_DURATION_EXCEEDED" in that entry object instead
- If user mentions lunch at a specific time (e.g. "lunch 1-2") — mark that entry as is_lunch: true. It will be skipped from DB.

═══════════════════════════════════════
SCHEMA: DELETE_TIMESHEET
═══════════════════════════════════════
{
  "action": "DELETE_TIMESHEET",
  "data": {
    "timesheet_id": <INTEGER or null>,
    "project_name": "STRING or null",
    "task_description": "STRING or null"
  }
}

FALLBACK (unclear intent):
{"action": "UNKNOWN"}

User message: "${userMessage}"
JSON Output:`;
}

// =========================================================================
// DATABASE SCHEMA
// =========================================================================
export const DB_SCHEMA = `
Table: users
   - id (integer, primary key)
   - name (text)
   - email (text, unique)
   - role (text: 'employee' or 'admin')

Table: projects
   - id (integer, primary key)
   - name (text, unique)

Table: daily_status_entries
   - id (integer, primary key)
   - employee_id (integer) → filter always by current user id
   - project_id (integer) → links to projects(id)
   - entry_date (text, YYYY-MM-DD)
   - start_time (text, HH:MM)
   - end_time (text, HH:MM)
   - duration_minutes (integer) → exact minutes between start and end
   - module_name (text, UPPERCASE)
   - task_description (text)
   - is_email_sent (text: 'true' or 'false')
   - created_at (text)
`;