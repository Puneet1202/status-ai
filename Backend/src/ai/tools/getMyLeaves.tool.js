// FILE: backend/src/ai/tools/getMyLeaves.tool.js
// Read tool — the logged-in user's OWN leave balance + recent applications.
//
// SECURITY: hard-scoped to ctx.employeeId (from the verified JWT). No parameter
// lets the model request anyone else's leaves — self-only by construction.

const name = "get_my_leaves";

const schema = {
  name,
  description:
    "Return the current logged-in user's OWN leave summary: balance per category (allotted / taken / remaining) for the year, plus recent leave applications and their status. Use for 'my leaves', 'how many leaves do I have left', 'leave balance', 'kitni chhutti bachi', 'my leave applications'.",
  parameters: {
    type: "object",
    properties: {
      year: { type: "number", description: "Optional year (e.g. 2026). Defaults to the current year." },
      status: { type: "string", description: "Optional: only applications with this status — 'pending', 'approved', or 'rejected'. Set for 'how many leaves pending'." },
      from_date: { type: "string", description: "Optional YYYY-MM-DD: was I on leave in this period? Set with to_date for 'leave last month / on 2026-05-12'." },
      to_date: { type: "string", description: "Optional YYYY-MM-DD end of the period (default same as from_date)." },
      all_time: { type: "boolean", description: "Set true for 'total leaves taken since joining / so far / ab tak kitni leave li' — sums ALL approved leave across every year." },
    },
  },
};

// ctx = { db, employeeId, today, ... }
async function handler(ctx, data = {}) {
  const { db, employeeId, today } = ctx;
  if (!employeeId) {
    return { success: false, action: "GET_MY_LEAVES", reply: "Your account isn't linked to an employee record, so I can't show your leaves." };
  }

  const year = Number.isFinite(data.year) ? Math.floor(data.year) : parseInt(String(today || "").slice(0, 4), 10) || new Date().getUTCFullYear();

  // ALL-TIME taken ("total leaves taken since joining / ab tak kitni leave li").
  if (data.all_time === true) {
    const { results } = await db
      .prepare(
        `SELECT lc.name, COUNT(*) cnt, SUM(la.total_days) days
           FROM leave_applications la JOIN leave_categories lc ON lc.id = la.leave_category_id
          WHERE la.employee_id = ? AND LOWER(la.status) = 'approved'
          GROUP BY lc.name ORDER BY days DESC`
      )
      .bind(employeeId)
      .all();
    const emp = await db.prepare("SELECT joining_date FROM employee WHERE id = ?").bind(employeeId).first();
    const joined = emp?.joining_date ? ` (joined ${emp.joining_date})` : "";
    if (!results || results.length === 0) {
      return { success: true, action: "GET_MY_LEAVES", reply: `🌴 You haven't taken any approved leave yet${joined}.`, data: [] };
    }
    const totalDays = results.reduce((s, r) => s + Number(r.days || 0), 0);
    const lines = results.map((r) => `   • ${r.name}: ${Number(r.days || 0)} days  (${r.cnt} application${r.cnt === 1 ? "" : "s"})`);
    return {
      success: true,
      action: "GET_MY_LEAVES",
      reply: `🌴 Total approved leave taken since joining${joined}: ${totalDays} days\n${lines.join("\n")}`,
      data: results,
    };
  }

  // PERIOD view — "was I on leave last month / on a date?" (overlapping applications).
  if (data.from_date) {
    const from = data.from_date;
    const to = data.to_date || data.from_date;
    const { results } = await db
      .prepare(
        `SELECT la.start_date, la.end_date, la.total_days, la.status, lc.name AS category
           FROM leave_applications la JOIN leave_categories lc ON lc.id = la.leave_category_id
          WHERE la.employee_id = ? AND la.start_date <= ? AND la.end_date >= ?
          ORDER BY la.start_date DESC`
      )
      .bind(employeeId, to, from)
      .all();
    const label = from === to ? from : `${from} → ${to}`;
    if (!results || results.length === 0) {
      return { success: true, action: "GET_MY_LEAVES", reply: `🌴 No leave found for ${label} — looks like you were present (no leave application in that period).`, data: [] };
    }
    const days = results.reduce((s, r) => s + Number(r.total_days || 0), 0);
    const lines = results.map((a) => {
      const span = a.start_date === a.end_date ? a.start_date : `${a.start_date} → ${a.end_date}`;
      return `   • ${span} · ${a.total_days}d · ${a.category} · ${a.status}`;
    });
    return { success: true, action: "GET_MY_LEAVES", reply: `🌴 Leave in ${label}: ${days} day${days === 1 ? "" : "s"}\n${lines.join("\n")}`, data: results };
  }

  // STATUS-FOCUSED view ("how many leaves pending / approved / rejected").
  const statusFilter = data.status && String(data.status).trim().toLowerCase();
  if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
    const { results } = await db
      .prepare(
        `SELECT la.start_date, la.end_date, la.total_days, lc.name AS category
           FROM leave_applications la
           JOIN leave_categories lc ON lc.id = la.leave_category_id
          WHERE la.employee_id = ? AND LOWER(la.status) = ?
          ORDER BY la.start_date DESC`
      )
      .bind(employeeId, statusFilter)
      .all();
    const n = (results || []).length;
    if (n === 0) {
      return { success: true, action: "GET_MY_LEAVES", reply: `🌴 You have no ${statusFilter} leave applications.`, data: [] };
    }
    const lines = results.map((a) => {
      const span = a.start_date === a.end_date ? a.start_date : `${a.start_date} → ${a.end_date}`;
      return `   • ${span} · ${a.total_days}d · ${a.category}`;
    });
    return {
      success: true,
      action: "GET_MY_LEAVES",
      reply: `🌴 You have ${n} ${statusFilter} leave application${n === 1 ? "" : "s"}:\n${lines.join("\n")}`,
      data: results,
    };
  }

  // Balance per category for the year.
  const { results: balances } = await db
    .prepare(
      `SELECT lc.name, b.allotted_days, b.taken_days
         FROM employee_leave_balances b
         JOIN leave_categories lc ON lc.id = b.leave_category_id
        WHERE b.employee_id = ? AND b.year = ?
        ORDER BY lc.name ASC`
    )
    .bind(employeeId, year)
    .all();

  // Recent applications (any year) with status.
  const { results: apps } = await db
    .prepare(
      `SELECT la.start_date, la.end_date, la.total_days, la.status, lc.name AS category
         FROM leave_applications la
         JOIN leave_categories lc ON lc.id = la.leave_category_id
        WHERE la.employee_id = ?
        ORDER BY la.start_date DESC
        LIMIT 5`
    )
    .bind(employeeId)
    .all();

  // Nothing at all — clearer than a bare "no balance" line.
  const hasBalance = balances && balances.length;
  const hasApps = apps && apps.length;
  if (!hasBalance && !hasApps) {
    return {
      success: true,
      action: "GET_MY_LEAVES",
      reply: `🌴 No leave records found for your account (${year}) — no balance set and no leave applications in the system.\n\nIf you took leave, make sure it was submitted on the Leave Application page.`,
      data: { balances: [], apps: [] },
    };
  }

  const lines = [`🌴 Your leaves (${year}):`];

  if (balances && balances.length) {
    lines.push("");
    let totA = 0, totT = 0;
    for (const b of balances) {
      const allotted = Number(b.allotted_days || 0);
      const taken = Number(b.taken_days || 0);
      totA += allotted; totT += taken;
      lines.push(`   • ${b.name}: ${allotted - taken} left  (${taken} taken of ${allotted})`);
    }
    lines.push(`   ── Total: ${totA - totT} left of ${totA}`);
  } else {
    lines.push("   No leave balance set for this year.");
  }

  if (apps && apps.length) {
    lines.push("", "Recent applications:");
    for (const a of apps) {
      const span = a.start_date === a.end_date ? a.start_date : `${a.start_date} → ${a.end_date}`;
      lines.push(`   • ${span} · ${a.total_days}d · ${a.category} · ${a.status}`);
    }
  }

  return { success: true, action: "GET_MY_LEAVES", reply: lines.join("\n"), data: { balances, apps } };
}

export default { name, schema, handler };
