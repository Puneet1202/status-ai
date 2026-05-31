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

  // Validate as real dates; clamp future to today. No year hardcode.
  let fromDate = data.from_date || data.date || today;
  let toDate = data.to_date || fromDate || today;

  if (!isValidEntryDate(fromDate)) fromDate = today;
  if (!isValidEntryDate(toDate) || toDate > today) toDate = today;
  if (fromDate > toDate) fromDate = toDate;

  let query = `
    SELECT d.id, d.entry_date, d.start_time, d.end_time,
           d.duration_minutes, d.module_name, d.task_description, p.name AS project_name
    FROM daily_status_entries d
    JOIN projects p ON d.project_id = p.id
    WHERE d.employee_id = ? AND d.entry_date BETWEEN ? AND ?
  `;
  const binds = [user.id, fromDate, toDate];

  if (data.module_name) {
    query += ` AND UPPER(d.module_name) = UPPER(?)`;
    binds.push(data.module_name);
  }
  if (data.project_name) {
    query += ` AND LOWER(p.name) LIKE LOWER(?)`;
    binds.push(`%${data.project_name.trim()}%`);
  }

  query += ` ORDER BY d.entry_date ASC, d.start_time ASC`;

  const rows = await db.prepare(query).bind(...binds).all();
  const results = rows.results || [];
  const totalMinutes = results.reduce(
    (sum, r) => sum + parseInt(r.duration_minutes || 0, 10),
    0
  );

  return {
    success: true,
    action: "GET_TIMESHEET",
    reply:
      results.length === 0
        ? `No records found between ${fromDate} and ${toDate}.`
        : `${fromDate} to ${toDate} — Total: ${(totalMinutes / 60).toFixed(
            1
          )} hrs (${totalMinutes} mins) across ${results.length} ${
            results.length === 1 ? "entry" : "entries"
          }.`,
    data: results,
  };
}

export default { name, schema, handler };
