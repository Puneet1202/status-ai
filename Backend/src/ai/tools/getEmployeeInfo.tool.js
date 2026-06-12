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

const name = "get_employee_info";

const schema = {
  name,
  description:
    "HR/Admin ONLY. WHO an employee is — their profile card: name, email, ROLE (superadmin/admin/hr/employee), designation, joining date. Use for 'who is <name>', 'ye kaun hai', '<name> ka role kya hai', 'is <name> an admin?'. NOT for hours/entries (use the timesheet tools for those).",
  parameters: {
    type: "object",
    properties: {
      employee_name: {
        type: "string",
        description:
          "The NAME or EMAIL of the employee to look up. Omit to describe the currently selected/viewed employee.",
      },
    },
  },
};

// ctx = { db, employeeId, isOrgViewer, ... } — employee_name aane par dispatchTool
// pehle hi ctx.employeeId ko TARGET employee par scope kar chuka hota hai.
async function handler(ctx, _data) {
  const { db, employeeId, isOrgViewer } = ctx;
  if (!isOrgViewer) {
    return { reply: "Only HR/Admin can view other employees' profiles. To see your own details, ask: 'who am I'. 🙂" };
  }
  if (!employeeId) {
    return { reply: "Which employee would you like to know about? Please give a name or email." };
  }

  const row = await db
    .prepare(
      `SELECT e.name, e.joining_date, u.email, u.is_active,
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

  const lines = [
    `• Role: ${row.role || "—"}`,
    `• Designation: ${row.designation || "—"}`,
    `• Email: ${row.email || "—"}`,
    `• Joined: ${row.joining_date || "—"}`,
  ];
  return {
    success: true,
    action: "GET_EMPLOYEE_INFO",
    reply: lines.join("\n"),
    // Quick actions = clickable chips (typing nahi). Saari values DETERMINISTIC
    // routes par jaati hai (0 tokens, har baar same result) aur sticky viewer ki
    // wajah se ISI employee par scope hoti hai.
    options: [
      { label: "📋 Recent entries", value: "show last 5 entries" },
      { label: "⏱️ Total hours", value: "total hours all time" },
      { label: "📅 Attendance", value: "attendance" },
      { label: "📊 Hours by project", value: "hours by project all time" },
    ],
    optionsTitle: "Ask about them:",
  };
}

export default { name, schema, handler };
