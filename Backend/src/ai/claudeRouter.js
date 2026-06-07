// FILE: backend/src/ai/claudeRouter.js
// THE "BRAIN" LAYER. Instead of hand-written regex deciding intent (brittle — a
// new phrasing = a new bug), a reliable LLM (Claude) reads the message, picks the
// right tool, and extracts its arguments via native tool-calling. The deterministic
// tool handlers still validate + execute (employee scoping, 2h cap, overlap, SQL),
// so the model decides WHAT, and tested code decides HOW and does it safely.
//
// Returns { action: {name, data} } when Claude routed to a tool, { reply } for a
// plain conversational answer, or null to defer to the deterministic engine.

import { getToolSchemas } from "./tools/index.js";
import { todayISO } from "./tools/_helpers.js";
import { getBrainModel, BRAIN_TIMEOUT_MS } from "./ai-config.js";
import { askAnthropic } from "./providers/anthropic.js";

// Tools the brain may route to (the read + add surface). update/delete keep their
// tested confirm-flow on the deterministic path, so they're intentionally excluded.
const BRAIN_TOOLS = new Set([
  "add_timesheet_entries",
  "get_timesheet_logs",
  "query_timesheet",
  "analyze_timesheet",
  "get_my_profile",
]);

function brainToolSchemas() {
  return getToolSchemas().filter((s) => BRAIN_TOOLS.has((s.function || s).name));
}

// Anthropic requires messages[0] to be a user turn. Drop any leading assistant
// turns from the sliding window so a history that starts with the bot is valid.
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
    "- add_timesheet_entries: they are LOGGING work with explicit time(s). Convert every time to strict 24-hour HH:MM. Split around breaks; mark breaks/lunch with is_lunch:true. NEVER invent a time.",
    "- get_timesheet_logs: a list of entries. For a NAMED date/range (today, yesterday, this week, a specific date) pass from_date/to_date. For \"most recent / latest / last entry/log\" WITHOUT a specific date, pass recent:true and do NOT pass any date (the latest entry may be from an earlier day); add limit:N for \"last N entries\".",
    "- query_timesheet: a FILTERED view — by keyword, time-of-day, duration, or first/last N within a day.",
    "- analyze_timesheet: totals / breakdowns / comparisons (per project, per month, busiest, average, this year).",
    "- get_my_profile: who am I / my name / email / role.",
    "",
    "CRITICAL: If the user clearly wants to LOG work but gives NO time, do NOT call a tool — reply in one short sentence asking for the time (e.g. 'What time did you work on that?'). Never guess a time.",
    "If the message is just chit-chat or a question about what you can do, reply briefly in 1-2 sentences — do not call a tool.",
    "Match the user's language and keep replies short and friendly.",
  ].join("\n");
}

export async function routeWithClaude(env, message, window, selectedProject, timeZone) {
  const today = todayISO(timeZone);
  const system = buildSystemPrompt(today, selectedProject);
  const history = sanitizeHistory(window);

  const { toolCall, text } = await askAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    model: getBrainModel(env),
    system,
    message,
    history,
    tools: brainToolSchemas(),
    timeoutMs: BRAIN_TIMEOUT_MS,
  });

  if (toolCall && BRAIN_TOOLS.has(toolCall.name)) {
    console.log("[claude-brain routed]", JSON.stringify({ tool: toolCall.name, args: toolCall.arguments }));
    return { action: { name: toolCall.name, data: toolCall.arguments || {} } };
  }
  if (text) return { reply: text };
  return null; // nothing usable → deterministic engine takes over
}
