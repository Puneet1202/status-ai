// FILE: backend/src/ai/tools/applyLeave.tool.js
// WRITE tool — the logged-in user applies for their OWN leave (status: pending).
//
// SECURITY: hard-scoped to ctx.employeeId (verified JWT). No parameter targets
// anyone else — self-only by construction (jaise add_timesheet self ke liye).
//
// Validation (DB-driven, category rules se):
//   • category resolve (naam → id); na mile to saaf list.
//   • balance: remaining (allotted - taken) >= maange din, warna block.
//   • max_consecutive_days_allowed: category limit se zyada din → block.
//   • min_notice_period_days: kam notice → soft WARNING (phir bhi pending submit).
//   • overlap: usi date pe pehle se pending/approved application → block.
//   • reason missing → APPLY mat karo; professional reason ke SUGGESTION chips do.

const name = "apply_leave";

const schema = {
  name,
  description:
    "Apply for the logged-in user's OWN leave (creates a PENDING leave application). Use for 'apply leave', 'mujhe chhutti chahiye', 'I want to take leave on <date>', 'request 2 days earned leave'. Always pass a clean, PROFESSIONAL one-line reason in `reason` (rewrite the user's casual wording professionally). If the user gave no reason, omit `reason` — the tool returns reason suggestions to pick from. Self-only; cannot apply for anyone else.",
  parameters: {
    type: "object",
    required: ["category", "from_date"],
    properties: {
      category: { type: "string", description: "Leave category name: 'Casual', 'Earned', or 'Medical'. Match the user's intent (sick/medical → Medical; planned/personal → Casual or Earned)." },
      from_date: { type: "string", description: "Leave START date, strict YYYY-MM-DD. Resolve relative words (today/tomorrow/kal/25 June) against today's date before passing." },
      to_date: { type: "string", description: "Leave END date YYYY-MM-DD. Omit for a single-day leave (defaults to from_date)." },
      reason: { type: "string", description: "A clean, professional one-line reason for the leave (rewrite the user's casual input). Omit ONLY if the user gave no reason at all." },
      contact_details: { type: "string", description: "Optional phone/contact reachable during leave." },
    },
  },
};

// Inclusive whole-day count between two YYYY-MM-DD dates.
function dayCount(from, to) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86400000) + 1;
}
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());

// Professional reason suggestions (chips) when the user gave none.
function reasonSuggestions(categoryName) {
  const generic = [
    "Attending to personal matters that require my presence.",
    "A family commitment that needs my attention.",
    "Taking time off to rest and recharge.",
  ];
  const medical = [
    "Not keeping well and need to rest and recover.",
    "A medical appointment that cannot be rescheduled.",
    "Recovering from illness on doctor's advice.",
  ];
  const list = /medical/i.test(categoryName || "") ? medical : generic;
  return list.map((r) => ({ label: r.length > 42 ? r.slice(0, 40) + "…" : r, value: r }));
}

async function handler(ctx, data = {}) {
  const { db, employeeId, today } = ctx;
  if (!employeeId) {
    return { success: false, action: "APPLY_LEAVE", reply: "Your account isn't linked to an employee record, so I can't apply leave." };
  }

  const from = String(data.from_date || "").trim();
  const to = String(data.to_date || data.from_date || "").trim();
  if (!isDate(from) || !isDate(to)) {
    return { success: false, action: "APPLY_LEAVE", reply: "I need valid dates (YYYY-MM-DD). Tell me the leave date(s), e.g. 'leave on 2026-06-25' or '25 to 26 June'." };
  }
  if (to < from) {
    return { success: false, action: "APPLY_LEAVE", reply: "The end date is before the start date — please re-check the dates." };
  }

  // Resolve category by name (partial, case-insensitive).
  const catTerm = String(data.category || "").trim();
  if (!catTerm) {
    const cats = await db.prepare("SELECT name FROM leave_categories WHERE status = 1 ORDER BY name").all();
    return {
      success: false, action: "APPLY_LEAVE",
      reply: "Which type of leave? Pick one below.",
      options: (cats.results || []).map((c) => ({ label: c.name, value: `apply ${c.name} leave from ${from}${to !== from ? ` to ${to}` : ""}` })),
      optionsTitle: "Leave category:",
    };
  }
  const cat = await db
    .prepare("SELECT id, name, max_consecutive_days_allowed, min_notice_period_days, is_document_required FROM leave_categories WHERE status = 1 AND LOWER(name) LIKE LOWER(?) LIMIT 1")
    .bind(`%${catTerm}%`).first();
  if (!cat) {
    const cats = await db.prepare("SELECT name FROM leave_categories WHERE status = 1 ORDER BY name").all();
    return {
      success: false, action: "APPLY_LEAVE",
      reply: `I couldn't find a "${catTerm}" leave category. Available: ${(cats.results || []).map((c) => c.name).join(", ")}.`,
      options: (cats.results || []).map((c) => ({ label: c.name, value: `apply ${c.name} leave from ${from}${to !== from ? ` to ${to}` : ""}` })),
      optionsTitle: "Leave category:",
    };
  }

  const days = dayCount(from, to);

  // Category rule: max consecutive days (0 = no limit).
  const maxDays = Number(cat.max_consecutive_days_allowed || 0);
  if (maxDays > 0 && days > maxDays) {
    return { success: false, action: "APPLY_LEAVE", reply: `${cat.name} leave allows at most ${maxDays} consecutive day${maxDays === 1 ? "" : "s"} at a time — you requested ${days}. Please split it or pick a shorter span.` };
  }

  // Reason missing → suggest professional reasons (don't apply yet).
  const reason = String(data.reason || "").trim();
  if (!reason) {
    return {
      success: false, action: "APPLY_LEAVE",
      reply: `Almost there — ${days} day(s) of ${cat.name} leave (${from === to ? from : `${from} → ${to}`}). What's the reason? Pick a suggestion or tell me in your own words.`,
      options: reasonSuggestions(cat.name).map((s) => ({ label: s.label, value: `apply ${cat.name} leave from ${from}${to !== from ? ` to ${to}` : ""}, reason: ${s.value}` })),
      optionsTitle: "Reason (tap or type your own):",
    };
  }

  // Balance check for the start year.
  const year = parseInt(from.slice(0, 4), 10);
  const bal = await db
    .prepare("SELECT allotted_days, taken_days FROM employee_leave_balances WHERE employee_id = ? AND leave_category_id = ? AND year = ?")
    .bind(employeeId, cat.id, year).first();
  const remaining = bal ? Number(bal.allotted_days || 0) - Number(bal.taken_days || 0) : 0;
  if (!bal) {
    return { success: false, action: "APPLY_LEAVE", reply: `You have no ${cat.name} leave balance set for ${year}, so I can't apply it. Please check with HR.` };
  }
  if (days > remaining) {
    return { success: false, action: "APPLY_LEAVE", reply: `Not enough ${cat.name} balance: you need ${days} day(s) but only ${remaining} left for ${year}.` };
  }

  // Overlap with an existing pending/approved application?
  const clash = await db
    .prepare("SELECT start_date, end_date, status FROM leave_applications WHERE employee_id = ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ? LIMIT 1")
    .bind(employeeId, to, from).first();
  if (clash) {
    const span = clash.start_date === clash.end_date ? clash.start_date : `${clash.start_date} → ${clash.end_date}`;
    return { success: false, action: "APPLY_LEAVE", reply: `You already have a ${clash.status} leave for ${span} that overlaps these dates. Cancel or change that first.` };
  }

  // Insert the application (PENDING). Admin reviews/approves later.
  await db
    .prepare("INSERT INTO leave_applications (employee_id, leave_category_id, start_date, end_date, total_days, reason, contact_details, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')")
    .bind(employeeId, cat.id, from, to, days, reason, data.contact_details ? String(data.contact_details).trim() : null)
    .run();

  // Soft notices (don't block — admin still reviews).
  const notes = [];
  const notice = Number(cat.min_notice_period_days || 0);
  if (notice > 0 && isDate(today)) {
    const minStart = new Date(`${today}T00:00:00Z`); minStart.setUTCDate(minStart.getUTCDate() + notice);
    if (from < minStart.toISOString().slice(0, 10)) notes.push(`ℹ️ ${cat.name} leave usually needs ${notice} days' notice — approval is at HR's discretion.`);
  }
  if (Number(cat.is_document_required) === 1) notes.push("ℹ️ This leave type may require a supporting document.");

  const span = from === to ? from : `${from} → ${to}`;
  return {
    success: true,
    action: "APPLY_LEAVE",
    reply: `✅ Leave application submitted (pending approval).\n\n• Type: ${cat.name}\n• Dates: ${span} (${days} day${days === 1 ? "" : "s"})\n• Reason: ${reason}\n• Balance after approval: ${remaining - days} of ${Number(bal.allotted_days || 0)} left${notes.length ? `\n\n${notes.join("\n")}` : ""}`,
    data: { category: cat.name, start_date: from, end_date: to, total_days: days, status: "pending" },
  };
}

export default { name, schema, handler };
