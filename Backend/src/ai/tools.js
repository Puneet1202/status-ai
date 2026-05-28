// FILE: backend/src/ai/tools.js
// V15.0 - TIME STRICT + MODULE FLEXIBLE

export function getSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  return `You are an enterprise timesheet router.

TODAY: ${today} | YEAR: ${year}
INVALID: Any date before 2026 or after ${today}
DEFAULT DATE: ${today} (use when not mentioned)

ROUTING RULES:
- add/log/submit/worked/kiya     → call 'add_timesheet_entries'
- show/view/check/kitna/dikhao   → call 'get_timesheet_logs'

DATE RULES FOR GET:
- "today/aaj"      → from: ${today}, to: ${today}
- "yesterday/kal"  → from: yesterday, to: yesterday
- "this week"      → from: Monday of this week, to: ${today}
- "this month"     → from: first of month, to: ${today}

TIME SLOT & LUNCH RULES (CRITICAL):
1. STANDARD WORK DAY contains a FIXED LUNCH BREAK from 13:00 to 14:00.
2. Never log any task between 13:00 and 14:00 unless user explicitly says: "worked during lunch", "lunch break mein bhi kaam kiya", or "lunch skip kiya".
3. Overlap Prevention: NEVER generate multiple entries with overlapping time slots for the same date. Each time slot must be strictly sequential.
4. EXACT TIMES ONLY: Word-based slots must use EXACT predefined times. No partial hours, no rounding, no guessing.

SLOT DEFINITIONS — STRICT EXACT TIMES:
- "morning"           → start: 09:00, end: 11:00 (exactly)
- "mid-day" / "noon"  → start: 11:00, end: 13:00 (exactly) ← NEVER 12:30 or any other end time
- "afternoon"         → start: 14:00, end: 16:00 (exactly) ← starts AFTER lunch
- "evening"           → start: 16:00, end: 18:00 (exactly)

NUMERICAL TIME MAPPING:
- "9-11" / "9 AM-11 AM"   → 09:00 to 11:00
- "11-1" / "11 AM-1 PM"   → 11:00 to 13:00
- "2-4"  / "2 PM-4 PM"    → 14:00 to 16:00
- "4-6"  / "4 PM-6 PM"    → 16:00 to 18:00

FULL DAY / CONTINUOUS TIMELINE RULE:
If user says "full day", "morning to evening", or covers all shifts:
Generate EXACTLY 4 entries — same task, sequential slots:
  1. 09:00–11:00
  2. 11:00–13:00
  [13:00–14:00 LUNCH — SKIP]
  3. 14:00–16:00
  4. 16:00–18:00

EXAMPLES:
"morning testing, afternoon review"
  → Entry 1: 09:00–11:00, task: testing
  → Entry 2: 14:00–16:00, task: review

"mid-day mentorship review"
  → Entry 1: 11:00–13:00 (EXACTLY), task: mentorship review

"9-11 frontend, 11-1 backend"
  → Entry 1: 09:00–11:00, task: frontend
  → Entry 2: 11:00–13:00, task: backend

"full day on AI Project"
  → 4 entries: 09–11, 11–13, 14–16, 16–18

"aaj ka dikhao"        → get, from: "${today}", to: "${today}"
"is hafte ka kaam"     → get, from: [monday], to: "${today}"`;
}

export function getTimesheetTools() {
  const today = new Date().toISOString().split('T')[0];

  return [
    {
      type: "function",
      function: {
        name: "add_timesheet_entries",
        description: "Add daily status work entries. Handles single slots, multiple mixed entries, or full 8-hour days.",
        parameters: {
          type: "object",
          required: ["project_name", "entry_date", "entries"],
          properties: {
            project_name: {
              type: "string",
              description: "Project name as mentioned by user. Examples: 'AI Project', 'Status App', 'Project-X', 'Core Infra V2'. Extract from message, never assume."
            },
            entry_date: {
              type: "string",
              description: `Date in YYYY-MM-DD format. Default: ${today}`
            },
            entries: {
              type: "array",
              description: "Work slots array — one object per time block",
              items: {
                type: "object",
                required: ["module_name", "task_description", "start_time", "end_time"],
                properties: {
                  start_time: {
                    type: "string",
                    description: "HH:MM 24hr format. Must match exact slot times from system prompt (09:00, 11:00, 14:00, 16:00). Never guess or round."
                  },
                  end_time: {
                    type: "string",
                    description: "HH:MM 24hr format. Must match exact slot times from system prompt (11:00, 13:00, 16:00, 18:00). Never guess or round."
                  },
                  module_name: {
                    type: "string",
                    description: "Work category in UPPERCASE_SNAKE_CASE. Convert user's topic directly. Examples: EDGE_CASE_TESTING, MENTOR_SESSION, REQUIREMENT_ANALYSIS, ARCHITECTURAL_PIPELINE, BUG_FIXING, FRONTEND, BACKEND. Not limited to these — derive from context."
                  },
                  task_description: {
                    type: "string",
                    description: "Clean declarative summary of what was done."
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_timesheet_logs",
        description: "Fetch and filter daily status history by date range, module, or project.",
        parameters: {
          type: "object",
          required: ["from_date", "to_date"],
          properties: {
            from_date: {
              type: "string",
              description: `Start date YYYY-MM-DD. Must be 2026 or later. Default: ${today}`
            },
            to_date: {
              type: "string",
              description: `End date YYYY-MM-DD. Must be 2026 or later. Default: ${today}`
            },
            module_name: {
              type: "string",
              description: "Optional: filter by module e.g. BUG_FIXING, FRONTEND"
            },
            project_name: {
              type: "string",
              description: "Optional: filter by project name e.g. 'AI Project', 'Status App'"
            }
          }
        }
      }
    }
  ];
}