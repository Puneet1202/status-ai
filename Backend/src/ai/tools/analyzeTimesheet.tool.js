// FILE: backend/src/ai/tools/analyzeTimesheet.tool.js
// Smart analytics over the user's OWN timesheet — totals, breakdowns, comparisons.
//
// Why a dedicated tool (not get_timesheet_logs): listing is for "show my entries";
// this is for AGGREGATE questions over large ranges ("total hours in 2023", "hours
// per project this year", "which project most", "monthly breakdown"). The SQL does
// the SUM/COUNT/GROUP BY, so answers are 100% accurate even over years of data.
//
// SECURITY: every query is hard-scoped to ctx.employeeId (the logged-in person).
// The model can pass filters, but it can NEVER widen the scope to someone else.

import { isValidEntryDate } from "./_helpers.js";

const name = "analyze_timesheet";

const GROUPS = ["none", "day", "month", "year", "project", "module"];

const schema = {
  name,
  description:
    "Summarize / analyze the user's OWN logged hours: totals and breakdowns. Use for aggregate questions — total hours over a period, hours per project / per month / per module / per year, which project or month had the most, comparisons across years. NOT for listing individual entries (use get_timesheet_logs for that).",
  parameters: {
    type: "object",
    properties: {
      from_date: { type: "string", description: "Start date YYYY-MM-DD. Omit for all-time." },
      to_date: { type: "string", description: "End date YYYY-MM-DD. Omit for all-time." },
      group_by: {
        type: "string",
        enum: GROUPS,
        description:
          "Break totals down by this dimension. 'project' = per project, 'month' = monthly, 'year' = per year, 'module' = per category, 'day' = daily, 'none' = one overall total.",
      },
      project_name: { type: "string", description: "Optional: restrict to this project (partial match)." },
      module_name: { type: "string", description: "Optional: restrict to this module/category." },
    },
  },
};

const hrs = (mins) => (Number(mins || 0) / 60).toFixed(1);

// Pretty label for the analysed window.
function rangeLabel(from, to) {
  if (from && to) return `${from} → ${to}`;
  if (from) return `since ${from}`;
  if (to) return `up to ${to}`;
  return "all time";
}

// ctx = { db, employeeId, ... }
async function handler(ctx, data) {
  const { db, employeeId } = ctx;
  if (!employeeId) {
    return { reply: "Your account isn't linked to an employee record, so I can't analyse your hours." };
  }

  // ── Filters (date range optional; scope is ALWAYS the logged-in employee) ──
  const fromDate = isValidEntryDate(data.from_date) ? data.from_date : null;
  const toDate = isValidEntryDate(data.to_date) ? data.to_date : null;

  const where = ["d.employee_id = ?"];
  const binds = [employeeId];
  if (fromDate) { where.push("d.entry_date >= ?"); binds.push(fromDate); }
  if (toDate) { where.push("d.entry_date <= ?"); binds.push(toDate); }
  if (data.project_name?.trim()) { where.push("LOWER(p.name) LIKE LOWER(?)"); binds.push(`%${data.project_name.trim()}%`); }
  if (data.module_name?.trim()) { where.push("UPPER(d.module_name) = UPPER(?)"); binds.push(data.module_name.trim()); }
  const FROM = `FROM daily_status_entries d JOIN projects p ON p.id = d.project_id WHERE ${where.join(" AND ")}`;

  const group = GROUPS.includes(data.group_by) ? data.group_by : "none";
  const label = rangeLabel(fromDate, toDate);

  // ── Single overall total ──
  if (group === "none") {
    const row = await db
      .prepare(`SELECT COALESCE(SUM(d.duration_minutes),0) mins, COUNT(*) cnt ${FROM}`)
      .bind(...binds)
      .first();
    if (!row || row.cnt === 0) {
      return { success: true, action: "ANALYZE_TIMESHEET", reply: `No logged hours found for ${label}.` };
    }
    return {
      success: true,
      action: "ANALYZE_TIMESHEET",
      reply: `📊 Total: ${hrs(row.mins)} hrs across ${row.cnt} ${row.cnt === 1 ? "entry" : "entries"} (${label}).`,
    };
  }

  // ── Grouped breakdown ──
  // Time dimensions read best chronologically; project/module best biggest-first.
  const groupExpr = {
    day: "d.entry_date",
    month: "substr(d.entry_date,1,7)",
    year: "substr(d.entry_date,1,4)",
    project: "p.name",
    module: "COALESCE(d.module_name,'(none)')",
  }[group];
  const order = group === "project" || group === "module" ? "mins DESC" : "grp ASC";

  const { results } = await db
    .prepare(`SELECT ${groupExpr} grp, COALESCE(SUM(d.duration_minutes),0) mins, COUNT(*) cnt ${FROM} GROUP BY ${groupExpr} ORDER BY ${order}`)
    .bind(...binds)
    .all();

  if (!results || results.length === 0) {
    return { success: true, action: "ANALYZE_TIMESHEET", reply: `No logged hours found for ${label}.` };
  }

  const totalMins = results.reduce((s, r) => s + Number(r.mins || 0), 0);
  const heading = { day: "by day", month: "by month", year: "by year", project: "by project", module: "by module" }[group];

  // Cap the printed list; summarise the rest so a 15-year monthly query stays readable.
  const MAX = 15;
  const shown = results.slice(0, MAX);
  const hidden = results.length - shown.length;
  const lines = shown.map((r) => `• ${r.grp} — ${hrs(r.mins)} hrs (${r.cnt})`);

  let reply = `📊 Hours ${heading} (${label}):\n${lines.join("\n")}`;
  if (hidden > 0) reply += `\n…and ${hidden} more.`;
  reply += `\n\nTotal: ${hrs(totalMins)} hrs across ${results.length} ${group}${results.length === 1 ? "" : "s"}.`;

  // For project/module, the first row is the biggest → call it out ("which X most").
  if ((group === "project" || group === "module") && results.length > 1) {
    reply += `\nTop: ${shown[0].grp} (${hrs(shown[0].mins)} hrs).`;
  }

  return { success: true, action: "ANALYZE_TIMESHEET", reply, data: results };
}

export default { name, schema, handler };
