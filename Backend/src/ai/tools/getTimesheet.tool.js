// FILE: backend/src/ai/tools/getTimesheet.tool.js
// Read tool — fully parameterized. Replaces the old raw-LLM-SQL path.

import { isValidEntryDate, todayISO } from "./_helpers.js";

const name = "get_timesheet_logs";

const schema = {
  name,
  description:
    "Fetch timesheet history by date range. Supports filtering by module, project, or specific dates. Handles natural language date queries.",
  parameters: {
    type: "object",
    required: ["from_date", "to_date"],
    properties: {
      from_date: {
        type: "string",
        description:
          "Start date in YYYY-MM-DD. Parse from user input. Default: today when none given.",
      },
      to_date: {
        type: "string",
        description:
          "End date in YYYY-MM-DD. Parse from user input. Default: today when none given.",
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
    },
  },
};

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  const { db, user, today } = ctx;

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
    binds = [user.id, limit];
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
    binds = [user.id, fromDate, toDate];
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
      reply: recent ? "No records found — you haven't logged any entries yet." : `No records found for ${rangeLabel}.`,
      data: [],
    };
  }

  const totalMinutes = results.reduce((sum, r) => sum + parseInt(r.duration_minutes || 0, 10), 0);
  const fmt = (r) =>
    `• ${r.entry_date} ${r.start_time}–${r.end_time} (${(parseInt(r.duration_minutes || 0, 10) / 60).toFixed(1)}h) · ${r.project_name} — ${r.task_description}`;

  // List the actual entries (not just a total). Recent rows are already newest-
  // first and capped; for a wide date range show the most recent few + a count.
  const MAX_LIST = 8;
  const shown = recent ? results : results.slice(-MAX_LIST);
  const hidden = recent ? 0 : results.length - shown.length;
  const header = recent
    ? `Your last ${results.length} ${results.length === 1 ? "entry" : "entries"}:`
    : `${rangeLabel}:`;

  let reply = `${header}\n${shown.map(fmt).join("\n")}`;
  if (hidden > 0) reply += `\n…and ${hidden} earlier ${hidden === 1 ? "entry" : "entries"}.`;
  reply += `\n\nTotal: ${(totalMinutes / 60).toFixed(1)} hrs (${totalMinutes} mins) across ${results.length} ${results.length === 1 ? "entry" : "entries"}.`;

  return { success: true, action: "GET_TIMESHEET", reply, data: results };
}

export default { name, schema, handler };
