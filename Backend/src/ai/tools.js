// FILE: backend/src/ai/tools.js
// V14.0 - MIDNIGHT SAFE & FUNCTION CALLING PARAMETERS OPTIMIZED

// ✅ Function ke andar rakha hai — Midnight Bug se safe rehne ke liye
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

EXAMPLES:
"8 hours Status App today"           → add, entry_date: "${today}"
"9-11 frontend, 11-1 backend"        → add, entry_date: "${today}"
"aaj ka dikhao"                      → get, from: "${today}", to: "${today}"
"is hafte kitna kaam kiya"           → get, from: [monday], to: "${today}"
"show all BUG_FIXING"                → get, from: "2026-01-01", to: "${today}", module: "BUG_FIXING"`;
}

// ✅ Fresh instance return karega har call par
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
              description: "Project name e.g. 'Status App', 'AI Project', 'Core Infra V2', 'Project-X'"
            },
            entry_date: {
              type: "string",
              description: `Date in YYYY-MM-DD format. Default context lock: ${today}`
            },
            entries: {
              type: "array",
              description: "Work slots array — one object per logged time block",
              items: {
                type: "object",
                // 🌟 FIX: required se start/end time hata diya taaki implicit hours mapping block na ho
                required: ["module_name", "task_description"], 
                properties: {
                  start_time: { type: "string", description: "HH:MM format if mentioned (e.g. 09:00)" },
                  end_time:   { type: "string", description: "HH:MM format if mentioned (e.g. 11:00)" },
                 module_name: { 
    type: "string", 
    description: "Convert work topic from user message to UPPERCASE_SNAKE_CASE. Extract directly from what user wrote." 
},
                  task_description: { type: "string", description: "Clean summary of what tasks were done" }
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
        description: "Fetch and filter daily status history records by date ranges, modules, or projects.",
        parameters: {
          type: "object",
          required: ["from_date", "to_date"],
          properties: {
            from_date: {
              type: "string",
              description: `Start date YYYY-MM-DD. Force lock: 2026 or later. Default: ${today}`
            },
            to_date: {
              type: "string",
              description: `End date YYYY-MM-DD. Force lock: 2026 or later. Default: ${today}`
            },
            module_name: {
              type: "string",
              description: "Optional: Filter status logs by module e.g. BUG_FIXING, FRONTEND"
            },
            project_name: {
              type: "string",
              description: "Optional: Filter status logs by project name container e.g. 'Status App'"
            }
          }
        }
      }
    }
  ];
}