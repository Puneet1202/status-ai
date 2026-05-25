// backend/src/ai/tools.js

// ✅ Live Date Generator with Strict Banned Date Shield
export function getSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `You are an elite enterprise backend router for a timesheet application.
CURRENT YEAR IS STRICTLY: 2026
TODAY'S DATE IS STRICTLY: ${today}
BANNED DATE — NEVER OUTPUT THIS UNDER ANY CIRCUMSTANCE: "2024-07-26"
ALL entry_date values MUST start with "2026-"

Your absolute job is to look at the user's message and pick the correct tool call.
- If user wants to log work hours, submit updates, or add tasks (even 8 hours splits), call 'add_timesheet_entries'.
- If user wants to check, view, or summary logs/hours, call 'get_timesheet_logs'.
- If no date is mentioned in message, strictly default 'entry_date' to '${today}'.`;
}

// 🛠️ CLOUDFLARE WORKERS AI / OPENAI COMPLIANT TOOL DEFINITIONS
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
            description: "The targeted logging date in absolute YYYY-MM-DD format." 
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
          from_date: { type: "string", description: "Filter range start date (YYYY-MM-DD)." },
          to_date: { type: "string", description: "Filter range end date (YYYY-MM-DD)." }
        }
      }
    }
  }
];