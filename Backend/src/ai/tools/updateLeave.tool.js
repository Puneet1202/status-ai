// FILE: backend/src/ai/tools/updateLeave.tool.js
// WRITE tool — fix or cancel the user's OWN most-recent PENDING leave application.
// (Jaise add-status ke baad edit: galti se galat date/reason ho to theek karo.)
//
// SECURITY: self-scoped (ctx.employeeId). Sirf 'pending' edit ho sakti — approved/
// rejected ko employee chhu nahi sakta. Date badle to wahi validation dobara chalti
// (balance, max consecutive days, overlap) jaise apply_leave me.

const name = "update_leave";

const schema = {
  name,
  description:
    "Edit or CANCEL the user's OWN most-recent PENDING leave application. Use for 'change my leave date to 27 June', 'fix my leave reason', 'cancel my leave', 'galti se galat date daal di'. Only pending applications can be changed. Self-only.",
  parameters: {
    type: "object",
    properties: {
      cancel: { type: "boolean", description: "Set true to CANCEL/withdraw the pending leave application." },
      from_date: { type: "string", description: "New START date YYYY-MM-DD (resolve relative words first)." },
      to_date: { type: "string", description: "New END date YYYY-MM-DD. Omit when single-day; defaults to from_date if start changes." },
      reason: { type: "string", description: "New professional one-line reason." },
    },
  },
};

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
function dayCount(from, to) {
  return Math.floor((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
}

async function handler(ctx, data = {}) {
  const { db, employeeId } = ctx;
  if (!employeeId) {
    return { success: false, action: "UPDATE_LEAVE", reply: "Your account isn't linked to an employee record." };
  }

  // Target = latest PENDING application (the one just created / awaiting review).
  const app = await db
    .prepare(
      `SELECT la.id, la.leave_category_id, la.start_date, la.end_date, la.total_days, la.reason,
              lc.name AS category, lc.max_consecutive_days_allowed
         FROM leave_applications la JOIN leave_categories lc ON lc.id = la.leave_category_id
        WHERE la.employee_id = ? AND la.status = 'pending'
        ORDER BY la.id DESC LIMIT 1`
    )
    .bind(employeeId).first();
  if (!app) {
    return { success: false, action: "UPDATE_LEAVE", reply: "You have no pending leave application to edit. (Approved/rejected ones can't be changed — apply a new one.)" };
  }

  // CANCEL.
  if (data.cancel === true) {
    await db.prepare("UPDATE leave_applications SET status = 'cancelled' WHERE id = ? AND employee_id = ? AND status = 'pending'").bind(app.id, employeeId).run();
    const span = app.start_date === app.end_date ? app.start_date : `${app.start_date} → ${app.end_date}`;
    return { success: true, action: "UPDATE_LEAVE", reply: `🗑️ Cancelled your pending ${app.category} leave (${span}).`, data: { id: app.id, status: "cancelled" } };
  }

  // Build the new values (only what's provided changes).
  const newFrom = data.from_date != null ? String(data.from_date).trim() : app.start_date;
  const newTo = data.to_date != null ? String(data.to_date).trim()
    : (data.from_date != null ? newFrom : app.end_date);
  const newReason = data.reason != null ? String(data.reason).trim() : app.reason;

  if (data.from_date == null && data.to_date == null && data.reason == null) {
    return { success: false, action: "UPDATE_LEAVE", reply: "What should I change? Tell me a new date or a new reason — or say 'cancel my leave' to withdraw it." };
  }
  if (!isDate(newFrom) || !isDate(newTo)) {
    return { success: false, action: "UPDATE_LEAVE", reply: "I need valid dates (YYYY-MM-DD)." };
  }
  if (newTo < newFrom) {
    return { success: false, action: "UPDATE_LEAVE", reply: "End date is before the start date — please re-check." };
  }

  const days = dayCount(newFrom, newTo);

  // Re-validate when dates changed.
  if (data.from_date != null || data.to_date != null) {
    const maxDays = Number(app.max_consecutive_days_allowed || 0);
    if (maxDays > 0 && days > maxDays) {
      return { success: false, action: "UPDATE_LEAVE", reply: `${app.category} leave allows at most ${maxDays} consecutive day(s) — you set ${days}.` };
    }
    // Balance for the (new) start year — exclude THIS application's own days.
    const year = parseInt(newFrom.slice(0, 4), 10);
    const bal = await db.prepare("SELECT allotted_days, taken_days FROM employee_leave_balances WHERE employee_id = ? AND leave_category_id = ? AND year = ?").bind(employeeId, app.leave_category_id, year).first();
    if (!bal) {
      return { success: false, action: "UPDATE_LEAVE", reply: `No ${app.category} balance set for ${year}, so I can't move the leave there.` };
    }
    const remaining = Number(bal.allotted_days || 0) - Number(bal.taken_days || 0);
    if (days > remaining) {
      return { success: false, action: "UPDATE_LEAVE", reply: `Not enough ${app.category} balance: need ${days}, only ${remaining} left for ${year}.` };
    }
    // Overlap with a DIFFERENT pending/approved application.
    const clash = await db.prepare("SELECT start_date, end_date, status FROM leave_applications WHERE employee_id = ? AND id != ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ? LIMIT 1").bind(employeeId, app.id, newTo, newFrom).first();
    if (clash) {
      const span = clash.start_date === clash.end_date ? clash.start_date : `${clash.start_date} → ${clash.end_date}`;
      return { success: false, action: "UPDATE_LEAVE", reply: `That overlaps another ${clash.status} leave (${span}).` };
    }
  }

  await db.prepare("UPDATE leave_applications SET start_date = ?, end_date = ?, total_days = ?, reason = ? WHERE id = ? AND employee_id = ? AND status = 'pending'")
    .bind(newFrom, newTo, days, newReason, app.id, employeeId).run();

  const span = newFrom === newTo ? newFrom : `${newFrom} → ${newTo}`;
  return {
    success: true,
    action: "UPDATE_LEAVE",
    reply: `✅ Updated your pending ${app.category} leave.\n\n• Dates: ${span} (${days} day${days === 1 ? "" : "s"})\n• Reason: ${newReason}\n• Status: pending (awaiting approval)`,
    data: { id: app.id, start_date: newFrom, end_date: newTo, total_days: days, status: "pending" },
  };
}

export default { name, schema, handler };
