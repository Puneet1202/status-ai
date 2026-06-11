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
import { isMonthFirstTz } from "./timeParser.js";
import { getProvider, getProviderKey, getProviderBaseUrl, getBrainModel, getBrainTimeout } from "./ai-config.js";
import { askAnthropic } from "./providers/anthropic.js";
import { askOpenAI } from "./providers/openai.js";
import { askGemini } from "./providers/gemini.js";

// One adapter per provider — all take { apiKey, model, system, message, history,
// tools, timeoutMs } and return { toolCall, text }. Groq is OpenAI-compatible,
// so it reuses the openai adapter (ai-config gives it the Groq base URL).
// ollama aur cloudflare dono OpenAI-format bolte hai → wahi openai adapter reuse.
const ADAPTERS = { anthropic: askAnthropic, openai: askOpenAI, gemini: askGemini, groq: askOpenAI, ollama: askOpenAI, cloudflare: askOpenAI };

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
  "list_employees",
  "get_employee_info",
  "get_pending_status",
]);

// HR/Admin-ONLY tools. Hidden from a normal employee's toolset entirely (the
// handler also hard-gates, but not exposing it keeps the brain from ever trying).
const ORG_ONLY_TOOLS = new Set(["list_employees", "get_employee_info", "get_pending_status"]);

// Read tools jinme org-viewer kisi aur employee ko target kar sakta hai.
const READ_TOOLS = new Set(["get_timesheet_logs", "query_timesheet", "analyze_timesheet"]);

// org-viewer ke liye read tools me `employee_name` param JOD dete hai. Normal
// employee ko ye param dikhta hi nahi → wo kisi aur ko target kar hi nahi sakta.
function brainToolSchemas(isOrgViewer) {
  const schemas = getToolSchemas().filter((s) => {
    const n = (s.function || s).name;
    if (!BRAIN_TOOLS.has(n)) return false;
    if (ORG_ONLY_TOOLS.has(n) && !isOrgViewer) return false; // hide directory from normal employees
    return true;
  });
  if (!isOrgViewer) return schemas;
  return schemas.map((s) => {
    const fn = s.function || s;
    if (!READ_TOOLS.has(fn.name)) return s;
    const extraProps = {
      employee_name: {
        type: "string",
        description:
          "OPTIONAL — admin/HR only. The NAME or EMAIL of ANOTHER employee whose timesheet to view. Set this when the user names someone else ('Vijay ka status', \"Rahul's hours\") OR gives an email to pick a specific person after a same-name list (e.g. 'vijay@keyss.in'). OMIT it when the user means their own data ('my', 'mera', 'apni').",
      },
    };
    if (fn.name === "analyze_timesheet") {
      // Org-viewer only: poori company ka per-employee leaderboard EK call me —
      // "sabse zyada kisne kaam kiya" ke liye model ko 14 calls nahi karni padti.
      extraProps.compare_employees = {
        type: "boolean",
        description:
          "Set true to compare ALL employees: total hours PER EMPLOYEE over the period ('who worked the most', 'sabse zyada kisne kaam kiya', leaderboard, employee comparison). Use from_date/to_date for the period (omit for all-time). Do NOT also set employee_name.",
      };
    }
    return {
      ...s,
      function: {
        ...fn,
        parameters: {
          ...fn.parameters,
          properties: {
            ...fn.parameters.properties,
            ...extraProps,
          },
        },
      },
    };
  });
}

// Per-message TOKEN COUNTER. Har provider alag naam deta hai — yahan normalize
// karke terminal me chhaap dete hai, taaki har message ka input/output/total
// token saaf dikhe (real API counts, koi guess nahi). Cumulative total bhi rakhte
// hai taaki session me ab tak kitne tokens lage wo bhi pata chale.
let _tokenTotals = { input: 0, output: 0, total: 0 };
function logTokens(provider, model, usage, tag = "", ms = 0) {
  const t = ms ? `${(ms / 1000).toFixed(2)}s` : "?";
  if (!usage) { console.log(`\n  AI call · ${provider} · ${model}${tag}  time=${t}  (no usage returned)\n`); return; }
  const input = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? 0;
  const output = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? 0;
  const total = usage.total_tokens ?? usage.totalTokenCount ?? (input + output);
  _tokenTotals.input += input; _tokenTotals.output += output; _tokenTotals.total += total;
  // tok/sec = output tokens generate hone ki speed (standard "speed" metric).
  const speed = ms ? `${(output / (ms / 1000)).toFixed(1)} tok/s` : "?";
  const rss = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MB`;
  const pad = (v) => String(v).padStart(8);
  // Terminal me ek saaf table — har AI call pe input/output/time/speed/RAM ek nazar me.
  console.log(
    `\n  ┌─ AI call · ${provider} · ${model}${tag}\n` +
    `  │  input ${pad(input)} tok      output ${pad(output)} tok     total ${pad(total)} tok\n` +
    `  │  time  ${pad(t)}          speed  ${pad(speed.replace(' tok/s',''))} t/s   ram   ${pad(rss)}\n` +
    `  │  session →  input ${pad(_tokenTotals.input)}   output ${pad(_tokenTotals.output)}   total ${pad(_tokenTotals.total)}\n` +
    `  └─`
  );
}

// All providers want messages to start with a user turn. Drop any leading
// assistant turns from the sliding window so a bot-first history is valid.
//
// TOKEN DIET: assistant ki lambi receipts (entry-lists/reports, code se bani)
// history me poori bhejne ki zaroorat nahi — routing ke liye gist kaafi hai.
// 400 chars (~100 tokens) par kaat dete hai; USER ke messages kabhi nahi kat'te
// (multi-turn stitching unke text par depend karta hai). Groq free tier sirf
// 8000 tokens/min deta hai — har bacha token = zyada messages/minute.
const MAX_ASSIST_HIST_CHARS = 400;
function sanitizeHistory(history) {
  const h = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.content.length > MAX_ASSIST_HIST_CHARS
          ? m.content.slice(0, MAX_ASSIST_HIST_CHARS) + " …[list truncated]"
          : m.content,
    }));
  let i = 0;
  while (i < h.length && h[i].role === "assistant") i++;
  return h.slice(i);
}

function buildSystemPrompt(today, selectedProject, isOrgViewer, monthFirst = false, viewAs = null) {
  const proj = selectedProject
    ? `The user's currently selected project is "${selectedProject}". When they log work, it goes under this project — you do NOT need to ask for or include the project.`
    : `No project is selected yet.`;
  const orgBlock = isOrgViewer
    ? [
        "",
        "IMPORTANT — this user is an HR/Admin who can VIEW any employee's timesheet:",
        "- If they name a specific person (e.g. 'Vijay ka status', \"Rahul's hours this week\", 'analyze Priya'), call the read tool (get_timesheet_logs / query_timesheet / analyze_timesheet) and put that person's name in `employee_name`.",
        "- If you previously listed same-name people with their emails and the user replies with an EMAIL (e.g. 'vijay@keyss.in'), call the read tool again with that email in `employee_name`.",
        "- If they ask to view/analyze status WITHOUT saying whose, and they do NOT say 'my/mera/apni', do NOT assume — reply with ONE short question: 'Aapko apni chahiye ya kisi aur employee ki? Naam batayein.' (do not call a tool yet).",
        "- If they clearly mean THEIR OWN data ('my', 'mera', 'apni'), OMIT employee_name — it defaults to them, exactly like a normal employee.",
        "- employee_name is ONLY for viewing/analyzing. Logging, editing, and deleting ALWAYS apply to the admin's own entries — never set employee_name for those.",
        "- To show ANY employee's entries you MUST call a read tool with employee_name and use ITS result verbatim. NEVER type out entries, projects, hours, or emails yourself — if you didn't call the tool, reply that you need to look it up.",
        "- EMPLOYEE DIRECTORY: for 'how many employees / kitne employee hain', 'list employees', or joining-date questions ('who joined on <date>', 'is date ko kaun join hua', 'joined this/last month'), CALL list_employees. Set joining_date for an exact day, joined_from/joined_to for a range (resolve relative dates against today), count_only:true when they only want the number, and name to filter by a name. You have NO directory knowledge of your own — NEVER list or count employees without calling this tool, and NEVER say you 'don't have directory access' (you do — it's this tool).",
        "- WHO WORKED MOST / EMPLOYEE COMPARISON ('sabse zyada kisne kaam kiya', 'which employee worked the most/least', 'compare employees', leaderboard): call analyze_timesheet ONCE with compare_employees:true and from_date/to_date for the period (omit dates for all-time). It returns every employee's total in one shot. NEVER answer this by checking employees one at a time, NEVER ask permission to 'check them all', and NEVER write per-employee totals yourself.",
        "- WHO IS someone ('who is madhulika', 'ye kaun hai', 'X ka role kya hai', 'is X an admin?'): call get_employee_info with employee_name — it returns their role/designation/email/joining date from the DB. Do NOT list their entries for a who-is question, and NEVER state someone's role from memory.",
      ]
    : [];
  // STABLE block — identical across turns (rules + tool guidance + org block). It
  // carries the prompt-cache breakpoint (see anthropic.js) so this big prefix is
  // REUSED at ~0.1× cost on every follow-up call. Nothing here changes per message.
  const stable = [
    "You are KEYSS, a timesheet assistant. The user logs and reviews their OWN work hours in natural language (English, Hindi, or Hinglish, any format).",
    "🚫 ABSOLUTE RULE — NEVER fabricate data. You have NO timesheet knowledge of your own. Entries, projects, hours, employee names, and emails come ONLY from a tool call's result. If you did not just call a tool, you have NO data — so NEVER write out a list of entries, a project name, hours, or an email from memory or by guessing. Do not copy the format of earlier answers to invent a new one. If you can't get the data via a tool, say you couldn't — do not make something up.",
    "🚫 ABSOLUTE RULE — you CANNOT save, update, or delete anything yourself; ONLY a tool call does that. NEVER write a success message ('saved', 'deleted', 'updated', '✅', 'kar diya', 'ho gaya') on your own — if the user wants to log, change, or remove entries, CALL the matching tool instead of replying. A receipt comes ONLY from the tool's result, never from you.",
    "",
    "Pick exactly ONE tool when the user wants to log, view, filter, or analyze their hours:",
    "- add_timesheet_entries: they are LOGGING work with explicit time(s) — e.g. '9-11 fixed login bug', '9 se 11 testing'. Convert every time to strict 24-hour HH:MM. Split around breaks; mark breaks/lunch with is_lunch:true. If NO date is given, use TODAY — never ask the user for the date. NEVER invent a time.",
    "- get_timesheet_logs: a list of entries. For a NAMED date/range (today, yesterday, this week, a specific date) pass from_date/to_date. For \"most recent / latest / last entry/log\" WITHOUT a specific date, pass recent:true and do NOT pass any date (the latest entry may be from an earlier day); add limit:N for \"last N entries\".",
    "- query_timesheet: a FILTERED view — by keyword, time-of-day, duration, or first/last N within a day.",
    "- analyze_timesheet: totals / breakdowns / comparisons (per project, per month, busiest, average, this year).",
    "- ATTENDANCE questions ('total attendance', 'X ka attendance', 'haziri', 'kitne din kaam kiya') → analyze_timesheet: group_by 'day' for a day-wise view, 'none' for an overall total. NEVER answer an attendance question by listing raw entries — entries are only for when they ask for entries/logs.",
    "- update_timesheet: the user wants to CHANGE/correct an entry they already logged — e.g. 'actually it was X', 'change the project/task/time', 'X ki jagah Y', 'galat hai ... kar do', 'time wrong hai'. Pass whatever locates it (match_task_description / match_project_name / match_date / match_start_time, or timesheet_id) PLUS the new_* value(s). Infer partial criteria from the message; do NOT just list entries — route here.",
    "- delete_timesheet: the user wants to REMOVE an entry — 'delete', 'remove', 'hata do', 'ek hata do', 'mita do'. Pass what identifies it (timesheet_id / project_name / task_description) if known; it's fine to leave them empty (it targets the most recent and ALWAYS confirms first). Do NOT just list entries — route here.",
    "- get_my_profile: who am I / my name / email / role.",
    "",
    "BIAS TO ACT: when the user wants to view, change, or delete an entry, CALL the matching tool with your best-inferred arguments rather than replying with a question. update_timesheet and delete_timesheet locate the row themselves and confirm when unsure — so route to them even if some details are missing (e.g. 'delete my last entry' → delete_timesheet with no args; 'aaj ki 9-11 ko 10-12 kar do' → update_timesheet with match_date=today, match_start_time=09:00, new_start_time=10:00, new_end_time=12:00). Only ask a question if you truly cannot tell which action they want.",
    "CRITICAL: If the user clearly wants to LOG (add new) work but gives NO time, do NOT call a tool — reply in one short sentence asking for the time. Never guess a time.",
    "If the message is just chit-chat or a question about what you can do, reply briefly in 1-2 sentences — do not call a tool.",
    "DISPLAY LIMITS — if asked HOW MANY entries you can show (a capability question, do NOT fetch data): answer with the REAL limits, never 'unlimited' or 'all of them'. A 'recent / last N' list shows up to 20 entries. A specific date or month/range lists up to 20 most recent in that range, and ALWAYS reports the correct TOTAL hours and entry count for the whole range (so even if a month has more, you still give the full total). To see a fuller list, tell them to narrow to a shorter period. Never claim there is no limit.",
    "Match the user's language and keep replies short and friendly.",
    ...orgBlock,
  ].join("\n");

  // DYNAMIC block — the ONLY per-turn bits (today's date + selected project). Kept
  // OUT of the cached prefix so changing project/day never busts the big cache.
  // A teammate is currently SELECTED (sticky "Viewing: X" pill). OVERRIDE the
  // org-block's "ask whose?" rule: for an unnamed view/analyze (no 'my'), proceed
  // for THIS teammate — never ask. (Controller scopes employee_name; brain may omit it.)
  const viewingLine = (isOrgViewer && viewAs)
    ? `OVERRIDE: A teammate is currently SELECTED for viewing (${viewAs}). For ANY request to view/analyze entries WITHOUT naming a different person and WITHOUT saying 'my/mera/apni', CALL the read tool for this selected teammate — do NOT ask whose it is. You may omit employee_name; it will be scoped to them.`
    : null;
  const dynamic = [
    `Today's date is ${today}. Resolve relative dates ("today", "kal/yesterday", "is hafte/this week") against it.`,
    // Global company (India + US): numeric dates user ke locale ke hisaab se —
    // jiska number 12 se bada ho wo din hai; dono ≤12 ho to is rule se resolve.
    `Numeric dates like "05-06-2026" are ${monthFirst ? "MM-DD-YYYY (month first — US style)" : "DD-MM-YYYY (day first)"} in this user's locale; convert to YYYY-MM-DD accordingly.`,
    proj,
    ...(viewingLine ? [viewingLine] : []),
  ].join("\n");

  return { stable, dynamic };
}

// isOrgViewer DB-driven hai (controller me user ki real permissions se nikla) — yahan
// sirf boolean aata hai, koi role-naam hardcode nahi.
export async function routeWithBrain(env, message, window, selectedProject, timeZone, isOrgViewer = false, viewAs = null) {
  const provider = getProvider(env);
  const ask = ADAPTERS[provider] || askAnthropic;
  const today = todayISO(timeZone);
  const { stable, dynamic } = buildSystemPrompt(today, selectedProject, isOrgViewer, isMonthFirstTz(timeZone), viewAs);
  // `system` = full prompt (used by openai/gemini adapters as-is). The anthropic
  // adapter ALSO gets the stable/dynamic split so it can cache the stable prefix.
  const system = `${stable}\n${dynamic}`;
  const history = sanitizeHistory(window);

  const req = {
    apiKey: getProviderKey(env, provider),
    baseUrl: getProviderBaseUrl(env, provider) || undefined,
    model: getBrainModel(env),
    system,
    systemStable: stable,
    systemDynamic: dynamic,
    message,
    history,
    tools: brainToolSchemas(isOrgViewer),
    timeoutMs: getBrainTimeout(env),
  };
  const _t0 = Date.now();
  let { toolCall, text, usage } = await ask(req);
  logTokens(provider, getBrainModel(env), usage, "", Date.now() - _t0);

  // ── ANTI-FABRICATION GUARD ─────────────────────────────────────────────────
  // Chhota/free model kabhi-kabhi tool call karne ke BAJAY khud (a) "✅ saved /
  // deleted / kar diya" type ka success-text, ya (b) "📊 Total: X hrs" type ki
  // NAQLI data-receipt likh deta hai (numbers/naam pure invented — DB me kuch
  // nahi hota). Asli receipts hamesha TOOL se aati hai, brain ki text se kabhi
  // nahi — to in patterns waali text reply user tak KABHI nahi jaati: ek baar
  // tool-call FORCE karke retry hota hai (toolChoice: "required"); retry bhi
  // fail ho to null → deterministic engine sambhalta hai.
  const FAKE_DONE = /✅|🗑️|📊|👤|🏆|\bentr(?:y|ies)\s+(?:saved|added|logged|deleted|updated|removed)\b|\bsaved under\b|\bhave been (?:saved|deleted|updated|logged)\b|\b(?:save|delete|update|add|remove|log)\w*\s+(?:kar diya|kar di|ho gaya|ho gayi|ho gaye)\b|\bhata diya\b|\bTotal:\s*\d+(?:\.\d+)?\s*hrs\b|\bhrs across\b|\b\d+(?:\.\d+)?\s*hrs?\b[\s\S]{0,80}?\(\s*\d+\s*entr/i;
  if (!toolCall && text && FAKE_DONE.test(text)) {
    console.warn(`[brain fabrication blocked · ${provider}]`, JSON.stringify(text.slice(0, 140)));
    try {
      let retryUsage;
      const _r0 = Date.now();
      ({ toolCall, text, usage: retryUsage } = await ask({ ...req, toolChoice: "required" }));
      logTokens(provider, getBrainModel(env), retryUsage, " [retry]", Date.now() - _r0);
    } catch (e) {
      console.warn(`[brain forced-tool retry failed · ${provider}]`, e?.message || e);
      return null; // deterministic engine takes over — honest, never a fake receipt
    }
    if (!toolCall) return null; // still text? drop it — fabrication never reaches the user
  }

  if (toolCall && BRAIN_TOOLS.has(toolCall.name)) {
    console.log(`[brain routed · ${provider}]`, JSON.stringify({ tool: toolCall.name, args: toolCall.arguments }));
    return { action: { name: toolCall.name, data: toolCall.arguments || {} } };
  }
  if (text) return { reply: text };
  return null; // nothing usable → deterministic engine takes over
}
