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
      offset: { type: "number", description: "Pagination: rows to skip in a grouped breakdown (e.g. 10 for the next page). Default 0." },
    },
  },
};

const hrs = (mins) => (Number(mins || 0) / 60).toFixed(1);

// Duration in minutes — duration_minutes NULL ho (sir ke form se bani entries) to
// start/end times se compute (overnight-aware). Isse SUM/totals hamesha sahi.
const DUR_SQL =
  "COALESCE(d.duration_minutes, ((CAST(substr(d.end_time,1,2) AS INTEGER)*60 + CAST(substr(d.end_time,4,2) AS INTEGER)) - (CAST(substr(d.start_time,1,2) AS INTEGER)*60 + CAST(substr(d.start_time,4,2) AS INTEGER)) + 1440) % 1440)";

// Pretty label for the analysed window.
function rangeLabel(from, to) {
  if (from && to) return `${from} → ${to}`;
  if (from) return `since ${from}`;
  if (to) return `up to ${to}`;
  return "all time";
}

// One-tap breakdown chips for a total. The value is a plain phrase the brain
// routes back to analyze_timesheet (group_by) — and it carries the SAME date
// window so tapping a chip keeps the period the user was looking at.
function followUpChips(from, to, exclude) {
  const range = from && to ? ` from ${from} to ${to}` : from ? ` since ${from}` : to ? ` up to ${to}` : "";
  // NOTE: values START with "show" so the chatbot's client-side guard treats them
  // as READ queries (not work-logs) — otherwise a value containing dates + "to"
  // (e.g. "...from 2026-03-01 to 2026-03-31") trips the "select a project" toast.
  // `exclude` drops the chip for the view you're already on (no redundant chip).
  // `action` = STRUCTURED route (bypasses NLP). `value` stays as a text fallback.
  const dateData = from && to ? { from_date: from, to_date: to } : from ? { from_date: from } : to ? { to_date: to } : {};
  const all = [
    { key: "project", label: "📊 By project", value: `show hours per project${range}`, group_by: "project" },
    { key: "month", label: "🗓️ By month", value: `show hours by month${range}`, group_by: "month" },
    { key: "day", label: "📅 By day", value: `show hours by day${range}`, group_by: "day" },
  ];
  return {
    options: all
      .filter((c) => c.key !== exclude)
      .map(({ label, value, group_by }) => ({
        label,
        value,
        action: { name: "analyze_timesheet", data: { group_by, ...dateData } },
      })),
    optionsTitle: "Break it down:",
  };
}

// Drill-down chips for a "by month" breakdown: one chip per month that has data.
// Tapping a month re-runs analyze for THAT month's days (from its 1st to last day).
function monthDrillChips(rows) {
  const opts = rows
    .map((r) => String(r.grp))
    .filter((g) => /^\d{4}-\d{2}$/.test(g))
    .slice(0, 12)
    .map((g) => {
      const [y, m] = g.split("-").map(Number);
      const last = new Date(y, m, 0).getDate(); // day 0 of next month = last day
      const me = `${g}-${String(last).padStart(2, "0")}`;
      const nm = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
      // "show" prefix → client guard treats it as a read query, not a work-log.
      // action = structured route (NLP bypass); value stays as fallback.
      return {
        label: `${nm} ${y}`,
        value: `show hours by day from ${g}-01 to ${me}`,
        action: { name: "analyze_timesheet", data: { group_by: "day", from_date: `${g}-01`, to_date: me } },
      };
    });
  return opts.length ? { options: opts, optionsTitle: "See a month's days:" } : {};
}

// ctx = { db, employeeId, isOrgViewer, ... }
async function handler(ctx, data) {
  const { db, employeeId, isOrgViewer } = ctx;
  if (!employeeId) {
    return { reply: "Your account isn't linked to an employee record, so I can't analyse your hours." };
  }

  // ── Filters (date range optional; scope is ALWAYS the logged-in employee) ──
  const fromDate = isValidEntryDate(data.from_date) ? data.from_date : null;
  const toDate = isValidEntryDate(data.to_date) ? data.to_date : null;

  // ── ORG LEADERBOARD (admin/HR only) — totals PER EMPLOYEE over the period ──
  // "Sabse zyada kisne kaam kiya / compare employees" = EK SQL (GROUP BY
  // employee_id), 14 alag-alag tool calls nahi — isliye 100% accurate, instant,
  // aur model ke paas invent karne ki koi jagah nahi. Normal employee ke liye
  // ye flag chup-chaap ignore hota hai (neeche apna hi scope chalta hai).
  if (data.compare_employees === true && isOrgViewer) {
    const w = [];
    const b = [];
    if (fromDate) { w.push("d.entry_date >= ?"); b.push(fromDate); }
    if (toDate) { w.push("d.entry_date <= ?"); b.push(toDate); }
    if (data.project_name?.trim()) { w.push("LOWER(p.name) LIKE LOWER(?)"); b.push(`%${data.project_name.trim()}%`); }
    const label = rangeLabel(fromDate, toDate);

    // SCOPE: sirf ACTIVE employees (users.is_active = 1) — wahi 14-18 log jo
    // directory (list_employees) me dikhte hai. Warna purane/deleted seeded
    // employees (DB me ~195) leaderboard me aa jaate hai (jaise "Manoj Kumar
    // 37250 hrs") jo ab company me hai hi nahi. JOIN users isse rok deta hai.
    const { results } = await db
      .prepare(
        `SELECT e.name nm, COALESCE(SUM(${DUR_SQL}),0) mins, COUNT(*) cnt
           FROM daily_status_entries d
           JOIN projects p ON p.id = d.project_id
           JOIN users u ON u.employee_id = d.employee_id AND u.is_active = 1
           JOIN employee e ON e.id = d.employee_id
           ${w.length ? "WHERE " + w.join(" AND ") : ""}
          GROUP BY d.employee_id
          ORDER BY mins DESC`
      )
      .bind(...b)
      .all();

    if (!results || results.length === 0) {
      return { success: true, action: "ANALYZE_TIMESHEET", reply: `No logged hours found for ${label}.` };
    }

    const MAX = 15;
    const shown = results.slice(0, MAX);
    const lines = shown.map((r, i) => `${i + 1}. ${r.nm} — ${hrs(r.mins)} hrs (${r.cnt} ${r.cnt === 1 ? "entry" : "entries"})`);
    // Tie bhi sahi dikhe: top ke barabar waale SAB naam call-out me aate hai.
    const topMins = Number(results[0].mins);
    const tops = results.filter((r) => Number(r.mins) === topMins).map((r) => r.nm);

    let reply = `🏆 Hours by employee (${label}):\n${lines.join("\n")}`;
    if (results.length > MAX) reply += `\n…and ${results.length - MAX} more.`;
    reply += `\n\nTop: ${tops.join(", ")} (${hrs(topMins)} hrs).`;
    return { success: true, action: "ANALYZE_TIMESHEET", reply, data: shown };
  }

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
      .prepare(`SELECT COALESCE(SUM(${DUR_SQL}),0) mins, COUNT(*) cnt ${FROM}`)
      .bind(...binds)
      .first();
    if (!row || row.cnt === 0) {
      return { success: true, action: "ANALYZE_TIMESHEET", reply: `No logged hours found for ${label}.` };
    }
    // FOLLOW-UP CHIPS: after an overall total, offer one-tap breakdowns so the user
    // doesn't have to guess how to ask ("how long?"). Each chip RE-runs analyze with
    // a group_by, keeping the SAME date range so context isn't lost.
    return {
      success: true,
      action: "ANALYZE_TIMESHEET",
      reply: `📊 Total: ${hrs(row.mins)} hrs across ${row.cnt} ${row.cnt === 1 ? "entry" : "entries"} (${label}).`,
      ...followUpChips(fromDate, toDate),
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
    .prepare(`SELECT ${groupExpr} grp, COALESCE(SUM(${DUR_SQL}),0) mins, COUNT(*) cnt ${FROM} GROUP BY ${groupExpr} ORDER BY ${order}`)
    .bind(...binds)
    .all();

  if (!results || results.length === 0) {
    return { success: true, action: "ANALYZE_TIMESHEET", reply: `No logged hours found for ${label}.` };
  }

  const totalMins = results.reduce((s, r) => s + Number(r.mins || 0), 0);
  const heading = { day: "by day", month: "by month", year: "by year", project: "by project", module: "by module" }[group];

  // PAGINATION — show PAGE rows at a time; a "Show more" chip loads the next page.
  // Listing is pure SQL and analyze chip-clicks route deterministically, so every
  // page is free (no model / no tokens). The TOTAL line always reflects ALL rows.
  const PAGE = 10;
  const offset = Math.max(0, parseInt(data.offset, 10) || 0);
  const shown = results.slice(offset, offset + PAGE);
  const more = offset + PAGE < results.length;
  const lines = shown.map((r) => `• ${r.grp} — ${hrs(r.mins)} hrs (${r.cnt})`);

  const span = results.length > PAGE ? ` — ${offset + 1}–${offset + shown.length} of ${results.length}` : "";
  let reply = `📊 Hours ${heading} (${label})${span}:\n${lines.join("\n")}`;
  reply += `\n\nTotal: ${hrs(totalMins)} hrs across ${results.length} ${group}${results.length === 1 ? "" : "s"}.`;

  // For project/module, the first row is the biggest → call it out (only on page 1).
  if ((group === "project" || group === "module") && results.length > 1 && offset === 0) {
    reply += `\nTop: ${shown[0].grp} (${hrs(shown[0].mins)} hrs).`;
  }

  // Chips: a "Show more" page chip (if rows remain) PLUS pivot/drill chips so the
  // user can page through OR switch view — all without scrolling back up.
  const nav = group === "month" ? monthDrillChips(results) : followUpChips(fromDate, toDate, group);
  const opts = [];
  if (more) {
    const next = offset + PAGE;
    const phrase = { day: "by day", month: "by month", year: "by year", project: "per project", module: "by module" }[group];
    const rangeStr = fromDate && toDate ? ` from ${fromDate} to ${toDate}` : fromDate ? ` since ${fromDate}` : toDate ? ` up to ${toDate}` : "";
    opts.push({ label: `⤵️ Show next ${Math.min(PAGE, results.length - next)}`, value: `show hours ${phrase}${rangeStr} offset ${next}` });
  }
  if (nav.options) opts.push(...nav.options);
  const extra = opts.length ? { options: opts, optionsTitle: more ? "More — or break it down:" : nav.optionsTitle } : {};
  return { success: true, action: "ANALYZE_TIMESHEET", reply, data: results, ...extra };
}

export default { name, schema, handler };
