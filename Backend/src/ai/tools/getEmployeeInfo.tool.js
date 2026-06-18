// FILE: backend/src/ai/tools/getEmployeeInfo.tool.js
// "Ye KAUN hai?" — kisi employee ki PROFILE info (naam, email, ROLE, designation,
// joining date) — sab LIVE DB se (users.role_id → roles, designation table).
//
// Do kaam karta hai:
//  1. HR/Admin employee-chip par CLICK kare (ya bare email type kare) → SIRF select
//     + ye intro card. Entries TABHI jab user khud maange (user feedback: click par
//     entries dump mat karo).
//  2. "who is madhulika" / "ye kaun hai" / "X ka role kya hai" → yahi card.
//
// SECURITY: org-viewer (all_employee_attendance) only — normal employee kisi aur
// ki profile nahi dekh sakta (apne liye get_my_profile hai).

import { buildProfileReply } from "./getMyProfile.tool.js";

const name = "get_employee_info";

const schema = {
  name,
  description:
    "HR/Admin ONLY. WHO an employee is — their profile: name, email, ROLE, designation, joining date, and (on request) mobile/contact, address, or date of birth. Use for 'who is <name>', '<name> ka role/email/mobile/address', 'is <name> an admin?'. NOT for hours/entries (use the timesheet tools for those).",
  parameters: {
    type: "object",
    properties: {
      employee_name: {
        type: "string",
        description:
          "The NAME or EMAIL of the employee to look up. Omit to describe the currently selected/viewed employee.",
      },
      field: {
        type: "string",
        description:
          "Optional focus: 'email' | 'mobile' | 'address' | 'dob' | 'full' (everything saved). Omit for the standard card.",
      },
    },
  },
};

// ctx = { db, employeeId, isOrgViewer, ... } — employee_name aane par dispatchTool
// pehle hi ctx.employeeId ko TARGET employee par scope kar chuka hota hai.
async function handler(ctx, data = {}) {
  const { db, employeeId, isOrgViewer, today } = ctx;
  if (!isOrgViewer) {
    return { reply: "Only HR/Admin can view other employees' profiles. To see your own details, ask: 'who am I'. 🙂" };
  }
  if (!employeeId) {
    return { reply: "Which employee would you like to know about? Please give a name or email." };
  }

  const row = await db
    .prepare(
      `SELECT e.name, e.joining_date, e.dob, u.email, u.is_active,
              e.C_Contact_num, e.P_Contact_num, e.C_Address, e.P_Address,
              e.city, e.state, e.country,
              r.name AS role, d.designation AS designation
         FROM employee e
         JOIN users u ON u.employee_id = e.id
         LEFT JOIN roles r ON r.id = u.role_id
         LEFT JOIN designation d ON d.id = e.designation_id
        WHERE e.id = ?`
    )
    .bind(employeeId)
    .first();

  if (!row) {
    return { reply: "I couldn't find that employee's record. Please try again with a name or email." };
  }

  // This-month start (YYYY-MM-01) for the Attendance chip's date range.
  const monthStart = /^\d{4}-\d{2}-\d{2}$/.test(String(today || "")) ? `${today.slice(0, 7)}-01` : null;

  // Same formatter as get_my_profile (name omitted — dispatchTool prepends the
  // "👤 <Name> (<email>):" header for the viewed employee).
  const reply = buildProfileReply({
    name: null,
    employeeId,
    role: row.role,
    designation: row.designation,
    email: row.email,
    joining_date: row.joining_date,
    dob: row.dob,
    C_Contact_num: row.C_Contact_num,
    P_Contact_num: row.P_Contact_num,
    C_Address: row.C_Address,
    P_Address: row.P_Address,
    city: row.city,
    state: row.state,
    country: row.country,
    field: data?.field,
  });

  return {
    success: true,
    action: "GET_EMPLOYEE_INFO",
    reply,
    // Quick actions = clickable chips (typing nahi). Saari values DETERMINISTIC
    // routes par jaati hai (0 tokens, har baar same result) aur sticky viewer ki
    // wajah se ISI employee par scope hoti hai.
    // Each chip carries BOTH a structured `action` (NLP-router bypass → 100%
    // reliable, scoped to the viewed employee by the controller) and a `value`
    // text fallback. Attendance = this-month day-wise (matches the website's
    // calendar mental model); month range derived from ctx.today.
    options: [
      { label: "📋 Recent entries", value: "show last 5 entries",
        action: { name: "get_timesheet_logs", data: { recent: true, limit: 5 } } },
      { label: "⏱️ Total hours", value: "total hours all time",
        action: { name: "analyze_timesheet", data: { group_by: "none" } } },
      { label: "📅 Attendance", value: "attendance",
        action: { name: "analyze_timesheet", data: { group_by: "day", ...(monthStart ? { from_date: monthStart, to_date: today } : {}) } } },
      { label: "📊 Hours by project", value: "hours by project all time",
        action: { name: "analyze_timesheet", data: { group_by: "project" } } },
    ],
    optionsTitle: "Ask about them:",
    // Ye chips us VIEWED employee ke liye hain → frontend inhe SIRF tab dikhaye
    // jab "Viewing: X" pill active ho. Employee deselect (cross) → chips hide,
    // taaki scroll-up karke galti se apne (account-owner) ka data na khul jaye.
    optionsScope: "viewedEmployee",
  };
}

export default { name, schema, handler };
