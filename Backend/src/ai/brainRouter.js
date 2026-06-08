// FILE: backend/src/ai/brainRouter.js
// THE "BRAIN" LAYER (provider-agnostic). Instead of hand-written regex deciding
// intent (brittle — a new phrasing = a new bug), a reliable LLM reads the message,
// picks the right tool, and extracts its arguments via native tool-calling. The
// deterministic tool handlers still validate + execute (employee scoping, 2h cap,
// overlap, SQL) — model decides WHAT, tested code decides HOW.
//
// The model PROVIDER (Anthropic / OpenAI / Gemini) is chosen by AI_PROVIDER in
// .env — switching is a config change, no code edit. All three adapters share the
// same { toolCall, text } interface, so the routing logic below is identical.
//
// Returns { action: {name, data} } when routed to a tool, { reply } for a plain
// conversational answer, or null to defer to the deterministic engine.

import { getToolSchemas } from "./tools/index.js";
import { todayISO } from "./tools/_helpers.js";
import { getProvider, getProviderKey, getBrainModel, BRAIN_TIMEOUT_MS } from "./ai-config.js";
import { askAnthropic } from "./providers/anthropic.js";
import { askOpenAI } from "./providers/openai.js";
import { askGemini } from "./providers/gemini.js";

// One adapter per provider — all take { apiKey, model, system, message, history,
// tools, timeoutMs } and return { toolCall, text }.
const ADAPTERS = { anthropic: askAnthropic, openai: askOpenAI, gemini: askGemini };

// Tools the brain may route to. update/delete are included (Step 3): they return a
// confirm prompt + pendingAction, and the controller intercepts the user's
// "confirm" BEFORE the brain — so the destructive step stays deterministic.
const BRAIN_TOOLS = new Set([
  "add_timesheet_entries",
  "get_timesheet_logs",
  "query_timesheet",
  "analyze_timesheet",
  "get_my_profile",
  "update_timesheet",
  "delete_timesheet",
]);

function brainToolSchemas() {
  return getToolSchemas().filter((s) => BRAIN_TOOLS.has((s.function || s).name));
}

// All providers want messages to start with a user turn. Drop any leading
// assistant turns from the sliding window so a bot-first history is valid.
function sanitizeHistory(history) {
  const h = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  let i = 0;
  while (i < h.length && h[i].role === "assistant") i++;
  return h.slice(i);
}

function buildSystemPrompt(today, selectedProject) {
  const proj = selectedProject
    ? `The user's currently selected project is "${selectedProject}". When they log work, it goes under this project — you do NOT need to ask for or include the project.`
    : `No project is selected yet.`;
  return [
    "You are KEYSS, a timesheet assistant. The user logs and reviews their OWN work hours in natural language (English, Hindi, or Hinglish, any format).",
    `Today's date is ${today}. Resolve relative dates ("today", "kal/yesterday", "is hafte/this week") against it.`,
    proj,
    "",
    "Pick exactly ONE tool when the user wants to log, view, filter, or analyze their hours:",
    "- add_timesheet_entries: they are LOGGING work with explicit time(s) — e.g. '9-11 fixed login bug', '9 se 11 testing'. Convert every time to strict 24-hour HH:MM. Split around breaks; mark breaks/lunch with is_lunch:true. If NO date is given, use TODAY — never ask the user for the date. NEVER invent a time.",
    "- get_timesheet_logs: a list of entries. For a NAMED date/range (today, yesterday, this week, a specific date) pass from_date/to_date. For \"most recent / latest / last entry/log\" WITHOUT a specific date, pass recent:true and do NOT pass any date (the latest entry may be from an earlier day); add limit:N for \"last N entries\".",
    "- query_timesheet: a FILTERED view — by keyword, time-of-day, duration, or first/last N within a day.",
    "- analyze_timesheet: totals / breakdowns / comparisons (per project, per month, busiest, average, this year).",
    "- update_timesheet: the user wants to CHANGE/correct an entry they already logged — e.g. 'actually it was X', 'change the project/task/time', 'X ki jagah Y', 'galat hai ... kar do', 'time wrong hai'. Pass whatever locates it (match_task_description / match_project_name / match_date / match_start_time, or timesheet_id) PLUS the new_* value(s). Infer partial criteria from the message; do NOT just list entries — route here.",
    "- delete_timesheet: the user wants to REMOVE an entry — 'delete', 'remove', 'hata do', 'ek hata do', 'mita do'. Pass what identifies it (timesheet_id / project_name / task_description) if known; it's fine to leave them empty (it targets the most recent and ALWAYS confirms first). Do NOT just list entries — route here.",
    "- get_my_profile: who am I / my name / email / role.",
    "",
    "BIAS TO ACT: when the user wants to view, change, or delete an entry, CALL the matching tool with your best-inferred arguments rather than replying with a question. update_timesheet and delete_timesheet locate the row themselves and confirm when unsure — so route to them even if some details are missing (e.g. 'delete my last entry' → delete_timesheet with no args; 'aaj ki 9-11 ko 10-12 kar do' → update_timesheet with match_date=today, match_start_time=09:00, new_start_time=10:00, new_end_time=12:00). Only ask a question if you truly cannot tell which action they want.",
    "CRITICAL: If the user clearly wants to LOG (add new) work but gives NO time, do NOT call a tool — reply in one short sentence asking for the time. Never guess a time.",
    "If the message is just chit-chat or a question about what you can do, reply briefly in 1-2 sentences — do not call a tool.",
    "Match the user's language and keep replies short and friendly.",
  ].join("\n");
}

export async function routeWithBrain(env, message, window, selectedProject, timeZone) {
  const provider = getProvider(env);
  const ask = ADAPTERS[provider] || askAnthropic;
  const today = todayISO(timeZone);
  const system = buildSystemPrompt(today, selectedProject);
  const history = sanitizeHistory(window);

  const { toolCall, text } = await ask({
    apiKey: getProviderKey(env, provider),
    model: getBrainModel(env),
    system,
    message,
    history,
    tools: brainToolSchemas(),
    timeoutMs: BRAIN_TIMEOUT_MS,
  });

  if (toolCall && BRAIN_TOOLS.has(toolCall.name)) {
    console.log(`[brain routed · ${provider}]`, JSON.stringify({ tool: toolCall.name, args: toolCall.arguments }));
    return { action: { name: toolCall.name, data: toolCall.arguments || {} } };
  }
  if (text) return { reply: text };
  return null; // nothing usable → deterministic engine takes over
}
