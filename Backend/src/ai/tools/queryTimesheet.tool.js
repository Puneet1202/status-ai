// FILE: backend/src/ai/tools/queryTimesheet.tool.js
// Advanced, FILTERED view of the user's OWN entries — keyword, time-of-day,
// duration, first/last-N, and point-in-time. The plain get_timesheet_logs lists
// by date; this adds the precise filters real users ask for ("AI-related tasks",
// "tasks over 1 hour", "what was I doing at 1:30", "first 3 tasks", "before lunch").
//
// SECURITY: every query is hard-scoped to ctx.employeeId. SQL does the filtering
// → 100% accurate. Times are compared on HH:MM (substr) so old "HH:MM:SS" rows and
// new "HH:MM" rows match alike.

import { isValidEntryDate, calcMinutesFromTimes } from "./_helpers.js";

// SQL expression: duration in minutes. Kuch entries (sir ke form se) me
// duration_minutes NULL hota hai → tab start/end times se compute karo (overnight-aware).
const DUR_SQL =
  "COALESCE(d.duration_minutes, ((CAST(substr(d.end_time,1,2) AS INTEGER)*60 + CAST(substr(d.end_time,4,2) AS INTEGER)) - (CAST(substr(d.start_time,1,2) AS INTEGER)*60 + CAST(substr(d.start_time,4,2) AS INTEGER)) + 1440) % 1440)";

// JS version (display ke liye) — same fallback.
const durMins = (r) =>
  Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : calcMinutesFromTimes(r.start_time, r.end_time);

const name = "query_timesheet";

const schema = {
  name,
  description:
    "Filtered/sorted view of the user's OWN logged entries. Use for: keyword filters (AI / testing / chatbot work), time-of-day (before/after a time, morning/afternoon, between two times, what was I doing at HH:MM), duration filters (more/less than N minutes/hours), and first/last N tasks. NOT for plain totals (use analyze_timesheet) or a simple date list (use get_timesheet_logs).",
  parameters: {
    type: "object",
    properties: {
      from_date: { type: "string", description: "Start date YYYY-MM-DD. Default: today." },
      to_date: { type: "string", description: "End date YYYY-MM-DD. Default: same as from_date." },
      keyword: { type: "string", description: "Only entries whose task/module contains this text (e.g. 'AI', 'testing', 'chatbot')." },
      start_after: { type: "string", description: "Only entries starting at/after this HH:MM (24h)." },
      start_before: { type: "string", description: "Only entries starting before this HH:MM (24h)." },
      end_after: { type: "string", description: "Only entries ending after this HH:MM (24h)." },
      end_before: { type: "string", description: "Only entries ending at/before this HH:MM (24h)." },
      at_time: { type: "string", description: "Point-in-time HH:MM: the entry being worked on at that moment." },
      min_minutes: { type: "number", description: "Only entries longer than this many minutes." },
      max_minutes: { type: "number", description: "Only entries shorter than this many minutes." },
      exact_minutes: { type: "number", description: "Only entries of exactly this many minutes." },
      order: { type: "string", enum: ["asc", "desc"], description: "Sort by start time. 'asc' = chronological (first→last), 'desc' = latest first." },
      limit: { type: "number", description: "Return only the first N (with order) entries — e.g. 'first 3 tasks' → order asc, limit 3." },
    },
  },
};

const HHMM = (t) => String(t || "").trim().slice(0, 5); // normalise "9:0"→? keep simple HH:MM
const isHHMM = (t) => /^\d{2}:\d{2}$/.test(HHMM(t));
const fmtH = (mins) => (Number(mins || 0) / 60).toFixed(1);

// ctx = { db, employeeId, today }
async function handler(ctx, data) {
  const { db, employeeId, today } = ctx;
  if (!employeeId) {
    return { reply: "Your account isn't linked to an employee record, so I can't pull your entries." };
  }

  // Date window — when the user NAMED a date/period, scope to it; when they did
  // NOT (e.g. "AI tasks", "chatbot work"), search ALL-TIME so the filter actually
  // finds their matching work instead of only today (today is often empty).
  let fromDate = isValidEntryDate(data.from_date) ? data.from_date : null;
  let toDate = isValidEntryDate(data.to_date) ? data.to_date : (fromDate || null);
  if (fromDate && toDate && fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];

  const where = ["d.employee_id = ?"];
  const binds = [employeeId];
  if (fromDate && toDate) { where.push("d.entry_date BETWEEN ? AND ?"); binds.push(fromDate, toDate); }

  if (data.keyword?.trim()) {
    where.push("(LOWER(d.task_description) LIKE ? OR LOWER(COALESCE(d.module_name,'')) LIKE ?)");
    const kw = `%${data.keyword.trim().toLowerCase()}%`;
    binds.push(kw, kw);
  }
  if (isHHMM(data.start_after)) { where.push("substr(d.start_time,1,5) >= ?"); binds.push(HHMM(data.start_after)); }
  if (isHHMM(data.start_before)) { where.push("substr(d.start_time,1,5) < ?"); binds.push(HHMM(data.start_before)); }
  if (isHHMM(data.end_after)) { where.push("substr(d.end_time,1,5) > ?"); binds.push(HHMM(data.end_after)); }
  if (isHHMM(data.end_before)) { where.push("substr(d.end_time,1,5) <= ?"); binds.push(HHMM(data.end_before)); }
  if (isHHMM(data.at_time)) {
    where.push("substr(d.start_time,1,5) <= ? AND substr(d.end_time,1,5) > ?");
    binds.push(HHMM(data.at_time), HHMM(data.at_time));
  }
  if (Number.isFinite(data.min_minutes)) { where.push(`${DUR_SQL} > ?`); binds.push(Math.round(data.min_minutes)); }
  if (Number.isFinite(data.max_minutes)) { where.push(`${DUR_SQL} < ?`); binds.push(Math.round(data.max_minutes)); }
  if (Number.isFinite(data.exact_minutes)) { where.push(`${DUR_SQL} = ?`); binds.push(Math.round(data.exact_minutes)); }

  const order = data.order === "desc" ? "DESC" : "ASC";
  let sql = `
    SELECT d.id, d.entry_date, d.start_time, d.end_time, d.duration_minutes,
           d.module_name, d.task_description, p.name AS project_name
      FROM daily_status_entries d
      JOIN projects p ON p.id = d.project_id
     WHERE ${where.join(" AND ")}
     ORDER BY d.entry_date ${order}, d.start_time ${order}, d.id ${order}`;
  const limit = Number.isFinite(data.limit) && data.limit > 0 ? Math.min(Math.floor(data.limit), 50) : null;
  if (limit) { sql += ` LIMIT ?`; binds.push(limit); }

  const { results } = await db.prepare(sql).bind(...binds).all();

  const rangeLabel = !fromDate ? "all time" : (fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`);
  if (!results || results.length === 0) {
    return {
      success: true,
      action: "QUERY_TIMESHEET",
      reply: `No matching entries found${rangeLabel === "all time" ? "" : ` for ${rangeLabel}`}.\n\n💡 Try a wider date range — or to LOG work, just type the time + task, e.g. "9 to 11 testing".`,
      options: [
        { label: "📅 This month", value: "show this month entries" },
        { label: "🗓️ Last month", value: "show last month entries" },
        { label: "🕘 Recent entries", value: "show my last 5 entries" },
      ],
      optionsTitle: "Try one:",
      data: [],
    };
  }

  const totalMins = results.reduce((s, r) => s + durMins(r), 0);
  // FULL description — user wants the complete task text (jaisa DB me hai), not a
  // 70-char "…" cut. Only collapse stray whitespace/newlines for clean one-line render.
  const clip = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const niceDate = (iso) => { const [y, mo, d] = iso.split("-"); return `${parseInt(d, 10)} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`; };

  const MAX = 25;
  const shown = results.slice(0, MAX);
  // GROUP BY DAY — clean, scannable: one date heading, then that day's matches.
  const days = [];
  for (const r of shown) {
    let g = days[days.length - 1];
    if (!g || g.date !== r.entry_date) { g = { date: r.entry_date, rows: [] }; days.push(g); }
    g.rows.push(r);
  }
  const block = days
    .map((g) => {
      const lines = g.rows
        .map((r) => `   • ${HHMM(r.start_time)}–${HHMM(r.end_time)} · ${fmtH(durMins(r))}h · ${r.project_name} — ${clip(r.task_description)}`)
        .join("\n");
      return `📅 ${niceDate(g.date)}\n${lines}`;
    })
    .join("\n\n");

  let reply = `🔎 ${results.length} matching ${results.length === 1 ? "entry" : "entries"} (${rangeLabel}):\n\n${block}`;
  if (results.length > shown.length) reply += `\n\n…and ${results.length - shown.length} more — narrow the dates to see them.`;
  reply += `\n\n— Total: ${fmtH(totalMins)} hrs across ${results.length} ${results.length === 1 ? "entry" : "entries"}.`;

  // Follow-up suggestion chips — common next steps after a filtered view.
  return {
    success: true,
    action: "QUERY_TIMESHEET",
    reply,
    data: results,
    options: [
      { label: "📊 Total hours", value: "show my total hours" },
      { label: "📈 By project", value: "show hours per project" },
      { label: "🕘 Recent entries", value: "show my last 5 entries" },
    ],
    optionsTitle: "Next:",
  };
}

export default { name, schema, handler };
