// FILE: backend/src/ai/tools/getPendingStatus.tool.js
// "Aaj kisne status/timesheet nahi bhara?" — PENDING report (HR/Admin only).
//
// Pending = koi ACTIVE staff (employee/hr/admin) jiska us DIN `daily_status_entries`
// me KOI row nahi hai. Do mode:
//   1. Single day  → `date` (default = today). "aaj/kal/9 June ko kaun pending".
//   2. Date range  → `from`+`to`. Har pending banda + kitne din miss kiye (missed_days).
//
// SECURITY: org-viewer (all_employee_attendance) only — same boundary as the other
// org-wide tools. Normal employee ye kabhi nahi dekh sakta.

import { isValidEntryDate, todayISO } from "./_helpers.js";

const name = "get_pending_status";

const schema = {
  name,
  description:
    "HR/Admin ONLY. WHO has NOT filled their status/timesheet. Use for 'who is pending today' / 'aaj kisne status nahi bhara' / 'kal kaun pending tha' / 'pending this week' / 'who didn't fill between 1 and 5 June'. Returns the list of ACTIVE staff with no entry. Resolve relative dates (today/kal/this week) to YYYY-MM-DD before passing.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description:
          "Single day YYYY-MM-DD to check (default = today if nothing given). Use for 'aaj/kal/<date> kaun pending'.",
      },
      from: {
        type: "string",
        description:
          "Start of a date RANGE YYYY-MM-DD (use with `to` for 'this week' / '1-5 June'). When set, missed-days count is shown per person.",
      },
      to: {
        type: "string",
        description: "End of the date range YYYY-MM-DD (use with `from`).",
      },
    },
  },
};

// All calendar dates from..to inclusive (capped). Weekends/holidays included —
// HR ko poora picture milta hai; chahein to specific din poochh sakte hai.
function datesInRange(from, to, cap = 62) {
  const out = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < cap) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// ctx = { db, isOrgViewer, today, ... }
async function handler(ctx, data) {
  const { db, isOrgViewer } = ctx;

  // Hard gate: pending report is HR/Admin only.
  if (!isOrgViewer) {
    return {
      reply:
        "The pending-status report is available to HR/Admin only. I can help you with your own timesheet. 🙂",
    };
  }

  const today = ctx.today || todayISO();

  // ── Active staff (employee/hr/admin), linked + active accounts only ──────────
  const staff = (
    await db
      .prepare(
        `SELECT e.id, e.name, u.email
           FROM employee e
           JOIN users u ON u.employee_id = e.id
           JOIN roles r ON r.id = u.role_id
          WHERE u.is_active = 1
            AND r.name IN ('employee', 'hr', 'admin')
          ORDER BY e.name COLLATE NOCASE ASC`
      )
      .all()
  ).results || [];

  // ── RANGE MODE: from + to → per-person missed-days count ─────────────────────
  if (data.from && isValidEntryDate(data.from) && data.to && isValidEntryDate(data.to)) {
    let from = data.from, to = data.to;
    if (from > to) [from, to] = [to, from]; // tolerant of swapped bounds
    const days = datesInRange(from, to);
    if (days.length === 0) return { reply: "Date range samajh nahi aaya. Sahi from/to (YYYY-MM-DD) batayein." };

    // Each employee's distinct filled-dates within the range.
    const filledRows =
      (
        await db
          .prepare(
            `SELECT employee_id, COUNT(DISTINCT entry_date) AS filled
               FROM daily_status_entries
              WHERE entry_date >= ? AND entry_date <= ?
              GROUP BY employee_id`
          )
          .bind(from, to)
          .all()
      ).results || [];
    const filledBy = new Map(filledRows.map((r) => [r.employee_id, r.filled]));

    const totalDays = days.length;
    const pending = staff
      .map((s) => ({ ...s, missed: totalDays - (filledBy.get(s.id) || 0) }))
      .filter((s) => s.missed > 0)
      .sort((a, b) => b.missed - a.missed);

    if (pending.length === 0) {
      return {
        success: true,
        action: "GET_PENDING_STATUS",
        reply: `✅ ${from} → ${to} (${totalDays} days): everyone submitted their status every day. Nothing pending.`,
        data: [],
      };
    }
    const lines = pending
      .map((p, i) => `${i + 1}. ${p.name || p.email} — missed ${p.missed}/${totalDays} days${p.email ? ` · ${p.email}` : ""}`)
      .join("\n");
    return {
      success: true,
      action: "GET_PENDING_STATUS",
      reply: `📋 Pending ${from} → ${to} (${totalDays} days) — ${pending.length} people:\n${lines}`,
      data: pending,
    };
  }

  // ── SINGLE-DAY MODE: date (default today) ────────────────────────────────────
  const date = data.date && isValidEntryDate(data.date) ? data.date : today;

  const filled = new Set(
    (
      (await db.prepare(`SELECT DISTINCT employee_id FROM daily_status_entries WHERE entry_date = ?`).bind(date).all())
        .results || []
    ).map((r) => r.employee_id)
  );
  const pending = staff.filter((s) => !filled.has(s.id));
  const when = date === today ? "today" : date;

  if (pending.length === 0) {
    return {
      success: true,
      action: "GET_PENDING_STATUS",
      reply: `✅ Everyone has submitted their status ${when} — nothing pending! (${staff.length} active staff)`,
      data: [],
    };
  }

  const lines = pending.map((p, i) => `${i + 1}. ${p.name || p.email}${p.email ? ` — ${p.email}` : ""}`).join("\n");
  return {
    success: true,
    action: "GET_PENDING_STATUS",
    reply: `📋 Pending ${when} (${date}) — ${pending.length}/${staff.length} haven't submitted their status yet:\n${lines}`,
    data: pending,
    // Click chips: HR can jump straight to that person's data (email → their logs).
    options: pending.filter((p) => p.email).map((p) => ({ label: p.name || p.email, value: p.email, hint: p.email })),
    optionsTitle: "View someone? Tap their email:",
  };
}

export default { name, schema, handler };
