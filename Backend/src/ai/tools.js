// FILE: backend/src/ai/tools.js
// V12.1 - CODE VALIDATION 10021 RESOLVED VIA GLOBAL SCOPE HYDRATION

// 🔥 FIX: Declaring the dynamic date variables globally so both the prompt function AND the tools array can use it safely
const todayDateStr = new Date().toISOString().split('T')[0];
const currentSystemYear = new Date().getFullYear();

export function getSystemPrompt() {
  return `You are an elite enterprise backend router for a timesheet application.

TODAY'S DATE IS STRICTLY: ${todayDateStr}
CURRENT YEAR: ${currentSystemYear}

DATE VALIDATION RULES:
- Every date MUST be between "2026-01-01" and "${todayDateStr}"
- Future dates are NOT allowed
- Any date before 2026 is STRICTLY INVALID
- If no date mentioned → use "${todayDateStr}"

TOOL SELECTION RULES:
- Log/add/submit/worked → call 'add_timesheet_entries', entry_date: "${todayDateStr}"
- Show/view/check/summary → call 'get_timesheet_logs', from_date: "${todayDateStr}", to_date: "${todayDateStr}"

EXAMPLES:
"8 hours Project-X today"        → add_timesheet_entries, entry_date: "${todayDateStr}"
"Show today's timesheet"         → get_timesheet_logs, from_date: "${todayDateStr}", to_date: "${todayDateStr}"
"9-11 frontend, 11-1 backend"    → add_timesheet_entries, entry_date: "${todayDateStr}"
"Show this week logs"            → get_timesheet_logs, from_date: [monday], to_date: "${todayDateStr}"`;
}

export const TIMESHEET_TOOLS = [
  {
    type: "function",
    function: {
      name: "add_timesheet_entries",
      description: "Logs work status into D1. Automatically processes full 8-hour total day distributions, lists of multiple task blocks, or single specific custom slots.",
      parameters: {
        type: "object",
        required: ["project_name", "entry_date", "entries"],
        properties: {
          project_name: {
            type: "string",
            description: "Main project container name like 'Project-X' or 'Expense Tracker'."
          },
          entry_date: {
            type: "string",
            description: `Work date in YYYY-MM-DD format. MUST be between 2026-01-01 and ${todayDateStr}. If not mentioned, use ${todayDateStr}.`
          },
          entries: {
            type: "array",
            description: "Extracted chronological time slots array.",
            items: {
              type: "object",
              required: ["start_time", "end_time", "duration_hours", "module_name", "task_description"],
              properties: {
                start_time: { type: "string", description: "HH:MM format" },
                end_time: { type: "string", description: "HH:MM format" },
                duration_hours: { type: "number", description: "Total numeric hours decimal value" },
                module_name: { type: "string", description: "UPPERCASE module name (e.g., MIDDLEWARE, FRONTEND, BUG_FIXING)" },
                task_description: { type: "string", description: "Summary text of tasks completed" }
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
      description: "Fetches user logged records from D1 for custom date ranges or dashboard filters.",
      parameters: {
        type: "object",
        required: ["from_date", "to_date"],
        properties: {
          from_date: {
            type: "string",
            description: `Start date YYYY-MM-DD. MUST be 2026 or later. Default: ${todayDateStr}`
          },
          to_date: {
            type: "string",
            description: `End date YYYY-MM-DD. MUST be 2026 or later. Default: ${todayDateStr}`
          }
        }
      }
    }
  }
];