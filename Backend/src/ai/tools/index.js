// FILE: backend/src/ai/tools/index.js
// SINGLE SOURCE OF TRUTH for tools. The model's function schemas, the prompt's
// routing directory, and the runtime dispatcher all DERIVE from MODULES below.
//
// 👉 To add a new tool (Leave Request, Invoice Generation, ...):
//    1. Create  ./leaveRequest.tool.js  exporting { name, schema, handler }.
//    2. Import it and add it to MODULES.
//    That's it. No edits to chat.js, the controller, or the prompt.

import addTimesheet from "./addTimesheet.tool.js";
import getTimesheet from "./getTimesheet.tool.js";
import updateTimesheet from "./updateTimesheet.tool.js";
import deleteTimesheet from "./deleteTimesheet.tool.js";
import getMyProfile from "./getMyProfile.tool.js";
import analyzeTimesheet from "./analyzeTimesheet.tool.js";
import queryTimesheet from "./queryTimesheet.tool.js";
import listEmployees from "./listEmployees.tool.js";
import getEmployeeInfo from "./getEmployeeInfo.tool.js";

const MODULES = [addTimesheet, getTimesheet, updateTimesheet, deleteTimesheet, getMyProfile, analyzeTimesheet, queryTimesheet, listEmployees, getEmployeeInfo];

// name -> module
export const REGISTRY = Object.fromEntries(MODULES.map((m) => [m.name, m]));

// Llama / OpenAI function-calling schema array (passed to env.AI.run).
export function getToolSchemas() {
  return MODULES.map((m) => ({ type: "function", function: m.schema }));
}

// Human-readable routing block injected into the system prompt so the model
// always knows the current toolset without hand-maintained prose.
export function getToolDirectory() {
  return MODULES.map((m) => `- ${m.name}: ${m.schema.description}`).join("\n");
}

// Read tools jo employee ke hisaab se scope hote hai — org-viewer inke liye kisi
// AUR employee ka data dekh sakta hai (sirf VIEW; add/update/delete nahi).
const READ_SCOPED_TOOLS = new Set([
  "get_timesheet_logs",
  "query_timesheet",
  "analyze_timesheet",
  "get_employee_info",
]);

// Employee dhoondo NAAM ya EMAIL se (partial, case-insensitive). SIRF ACTIVE
// (users.is_active = 1) — inactive/disabled accounts list me nahi aate.
// Returns [{ id, name, email }].
async function findEmployeesByName(db, q) {
  const term = String(q || "").trim();
  if (!term) return [];
  const like = `%${term}%`;
  const rows = await db
    .prepare(
      `SELECT e.id, e.name, u.email
         FROM employee e
         JOIN users u ON u.employee_id = e.id
        WHERE u.is_active = 1
          AND (e.name LIKE ? OR u.email LIKE ?)
        ORDER BY e.name
        LIMIT 10`
    )
    .bind(like, like)
    .all();
  return rows.results || [];
}

// Single dispatch entry-point. ctx = { db, user, employeeId, env, selectedProject, today }.
export async function dispatchTool(toolName, args, ctx) {
  const tool = REGISTRY[toolName];
  if (!tool) {
    return { reply: "I can't perform that action yet." };
  }
  args = args || {};

  // ── HR/Admin → kisi aur employee ka data VIEW kar sakte hai ────────────────
  // Brain `employee_name` sirf org-viewer ke read tools me deta hai, par yahan
  // role DOBARA check karte hai (defense in depth): normal employee ka scope
  // KABHI override nahi hota — wo hamesha sirf apna data dekhta hai.
  if (args.employee_name && READ_SCOPED_TOOLS.has(toolName)) {
    const q = String(args.employee_name).trim();
    delete args.employee_name; // tools ye param nahi samajhte

    if (ctx.isOrgViewer && q) {
      const matches = await findEmployeesByName(ctx.db, q);
      if (matches.length === 0) {
        return { reply: `Mujhe "${q}" naam/email ka koi ACTIVE employee nahi mila. Sahi naam ya email batayein.` };
      }
      if (matches.length > 1) {
        // Ek jaise naam waale kai log → list me NAAM + EMAIL do, taaki user email
        // se sahi waale ko chun sake. Plus clickable chips (DB se bane → no model,
        // koi galat naam aa hi nahi sakta): click karte hi email auto-send hota hai.
        const list = matches
          .map((m, i) => `${i + 1}. ${m.name} — ${m.email || "email N/A"}`)
          .join("\n");
        return {
          reply: `"${q}" se ek se zyada active employee mile:\n${list}\n\nKiska data chahiye? Niche se chunein ya email batayein.`,
          options: matches
            .filter((m) => m.email)
            .map((m) => ({ label: m.name, value: m.email, hint: m.email })),
          optionsTitle: "Konsa wala?",
        };
      }
      // Is request ko target employee pe scope karo (ctx clone — caller ka ctx
      // kabhi mutate nahi karte).
      const picked = matches[0];
      ctx = { ...ctx, employeeId: picked.id, targetEmployeeName: picked.name, targetEmployeeEmail: picked.email };
    }
    // org-viewer nahi → chup-chaap apna hi scope rakho (security)
  }

  const out = await tool.handler(ctx, args);

  // Kisi aur ka data dikha rahe hai to reply ke upar uska naam + email laga do
  // (same-naam waalo me saaf rahe ki ye kiski info hai).
  if (ctx.targetEmployeeName && out && typeof out.reply === "string") {
    const label = ctx.targetEmployeeEmail
      ? `${ctx.targetEmployeeName} (${ctx.targetEmployeeEmail})`
      : ctx.targetEmployeeName;
    out.reply = `👤 ${label}:\n${out.reply}`;
    // STICKY VIEW: jis employee pe scope hua, use frontend ko bhej do taaki "Viewing:
    // <naam>" pill set rahe aur agle reads bina dobara naam diye usi pe chalein.
    if (out && typeof out === "object" && out.viewTarget === undefined) {
      out.viewTarget = { name: ctx.targetEmployeeName, email: ctx.targetEmployeeEmail || null };
    }
  }
  return out;
}
