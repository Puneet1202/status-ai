// FILE: backend/src/ai/tools/getTimesheet.tool.js
// Read tool — fully parameterized. Replaces the old raw-LLM-SQL path.

import { isValidEntryDate, todayISO, calcMinutesFromTimes } from "./_helpers.js";

// Duration ALWAYS start/end times se nikaalo — kuch entries (sir ke "Enter Status"
// form se bani) me duration_minutes NULL hota hai, to us column pe bharosa nahi.
const durMins = (r) =>
  Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : calcMinutesFromTimes(r.start_time, r.end_time);

const name = "get_timesheet_logs";

const schema = {
  name,
  description:
    "List the user's logged timesheet entries. Two modes: (1) a date range via from_date/to_date for a named day/period (today, yesterday, this week, a specific date); or (2) their MOST RECENT entries via recent:true (with optional limit:N) when no specific date is named — use this for 'last entry', 'recent logs', 'last 3 entries', etc.",
  parameters: {
    type: "object",
    properties: {
      recent: {
        type: "boolean",
        description:
          "Set true for 'most recent / latest / last' entries with NO specific date. Returns the newest entries across ALL dates. When true, do NOT pass from_date/to_date.",
      },
      limit: {
        type: "number",
        description:
          "Used with recent:true — how many of the most recent entries to return (e.g. 'last 3 entries' → 3). Omit for the default of 5.",
      },
      from_date: {
        type: "string",
        description:
          "Start date YYYY-MM-DD for a named day/range. Leave unset when recent:true.",
      },
      to_date: {
        type: "string",
        description:
          "End date YYYY-MM-DD for a named day/range. Leave unset when recent:true.",
      },
      module_name: {
        type: "string",
        description:
          "Optional. Filter by module name in UPPERCASE_SNAKE_CASE. Example: BUG_FIXING.",
      },
      project_name: {
        type: "string",
        description: "Optional. Filter by project name (partial match). Example: AI Project.",
      },
      offset: {
        type: "number",
        description: "Pagination: entries to skip in a date-range list (e.g. 8 for the next page). Default 0.",
      },
    },
  },
};

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  const { db, employeeId, today } = ctx;

  // RECENT mode ("show my last entry / last log dikhao") — the most recently
  // logged entries regardless of date. Otherwise the classic date-range query.
  const recent = data.recent === true || data.recent === "true";

  let query, binds, rangeLabel;
  if (recent) {
    const limit = Math.min(Math.max(parseInt(data.limit, 10) || 5, 1), 20);
    query = `
      SELECT d.id, d.entry_date, d.start_time, d.end_time,
             d.duration_minutes, d.module_name, d.task_description, p.name AS project_name
      FROM daily_status_entries d
      JOIN projects p ON d.project_id = p.id
      WHERE d.employee_id = ?
      ORDER BY d.entry_date DESC, d.start_time DESC, d.id DESC
      LIMIT ?`;
    binds = [employeeId, limit];
  } else {
    // Validate as real dates; clamp future to today. No year hardcode.
    let fromDate = data.from_date || data.date || today;
    let toDate = data.to_date || fromDate || today;
    if (!isValidEntryDate(fromDate)) fromDate = today;
    if (!isValidEntryDate(toDate) || toDate > today) toDate = today;
    if (fromDate > toDate) fromDate = toDate;
    rangeLabel = `${fromDate} to ${toDate}`;

    query = `
      SELECT d.id, d.entry_date, d.start_time, d.end_time,
             d.duration_minutes, d.module_name, d.task_description, p.name AS project_name
      FROM daily_status_entries d
      JOIN projects p ON d.project_id = p.id
      WHERE d.employee_id = ? AND d.entry_date BETWEEN ? AND ?`;
    binds = [employeeId, fromDate, toDate];
    if (data.module_name) { query += ` AND UPPER(d.module_name) = UPPER(?)`; binds.push(data.module_name); }
    if (data.project_name) { query += ` AND LOWER(p.name) LIKE LOWER(?)`; binds.push(`%${data.project_name.trim()}%`); }
    query += ` ORDER BY d.entry_date ASC, d.start_time ASC`;
  }

  const rows = await db.prepare(query).bind(...binds).all();
  const results = rows.results || [];

  if (results.length === 0) {
    return {
      success: true,
      action: "GET_TIMESHEET",
      reply: recent ? "No entries logged yet." : `No records found for ${rangeLabel}.`,
      data: [],
    };
  }

  const totalMinutes = results.reduce((sum, r) => sum + durMins(r), 0);
  const hhmm = (s) => String(s || "").slice(0, 5);              // "09:00:00" → "09:00"
  const clip = (s) => { const x = String(s || "").replace(/\s+/g, " ").trim(); return x.length > 70 ? x.slice(0, 70).trimEnd() + "…" : x; };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const niceDate = (iso) => { const [y, mo, d] = iso.split("-"); return `${parseInt(d, 10)} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`; };

  // PAGINATION — a page at a time; a "Show more" chip loads the next (routed
  // deterministically → free). Date-range lists stay CHRONOLOGICAL (month start
  // first, as the SQL returns); "recent" stays newest-first. No reversing.
  const ordered = results;
  const PAGE = 10;
  const offset = recent ? 0 : Math.max(0, parseInt(data.offset, 10) || 0);
  const shown = recent ? ordered : ordered.slice(offset, offset + PAGE);
  const more = !recent && offset + PAGE < ordered.length;

  // GROUP BY DAY — a date heading once, then that day's time-ranges under it.
  const days = [];
  for (const r of shown) {
    let g = days[days.length - 1];
    if (!g || g.date !== r.entry_date) { g = { date: r.entry_date, rows: [] }; days.push(g); }
    g.rows.push(r);
  }
  const block = days
    .map((g) => {
      const lines = g.rows
        .map((r) => `   • ${hhmm(r.start_time)}–${hhmm(r.end_time)} · ${(durMins(r) / 60).toFixed(1)}h · ${r.project_name} — ${clip(r.task_description)}`)
        .join("\n");
      return `📅 ${niceDate(g.date)}\n${lines}`;
    })
    .join("\n\n");

  const span = !recent && ordered.length > PAGE ? ` · ${offset + 1}–${offset + shown.length} of ${ordered.length}` : "";
  const header = recent
    ? `Your last ${results.length} ${results.length === 1 ? "entry" : "entries"}:`
    : `🗓️ ${rangeLabel}${span}`;

  let reply = `${header}\n\n${block}\n\n— Total: ${(totalMinutes / 60).toFixed(1)} hrs across ${results.length} ${results.length === 1 ? "entry" : "entries"}.`;

  let extra = {};
  if (more) {
    const next = offset + PAGE;
    const [f, to] = rangeLabel.split(" to ");
    extra = {
      options: [{ label: `⤵️ Show next ${Math.min(PAGE, ordered.length - next)}`, value: `show entries from ${f} to ${to} offset ${next}` }],
      optionsTitle: "More:",
    };
  }
  return { success: true, action: "GET_TIMESHEET", reply, data: results, ...extra };
}

export default { name, schema, handler };
