// FILE: backend/src/ai/tools/listEmployees.tool.js
// Employee DIRECTORY tool — HR/Admin (org-viewer) only.
// Answers "how many employees do I have", "list employees", and
// "who joined on <date>" / "joined between X and Y".
//
// SECURITY: only ACTIVE accounts (users.is_active = 1) are ever returned, and a
// normal employee can NEVER use it (handler hard-gates on ctx.isOrgViewer — same
// boundary as the read tools' employee_name view). Inactive / login-pending /
// unlinked employee rows are deliberately invisible here, by design.

import { isValidEntryDate } from "./_helpers.js";

const name = "list_employees";

const schema = {
  name,
  description:
    "HR/Admin ONLY. List or COUNT the organization's ACTIVE employees. Use for: 'how many employees do I have' / 'kitne employee hain' (count + list), 'list employees', or joining-date queries like 'who joined on 2024-06-09' / 'is date ko kaun join hua' / 'employees who joined this month'. Returns ACTIVE employees only — never inactive/login-pending accounts.",
  parameters: {
    type: "object",
    properties: {
      joining_date: {
        type: "string",
        description:
          "Exact joining date YYYY-MM-DD. Set this for 'who joined on <date>'. Resolve relative dates (today/yesterday) against today's date before passing.",
      },
      joined_from: {
        type: "string",
        description:
          "Start of a joining-date range YYYY-MM-DD (use with joined_to for 'joined between X and Y' / 'joined this month').",
      },
      joined_to: {
        type: "string",
        description: "End of a joining-date range YYYY-MM-DD (use with joined_from).",
      },
      name: {
        type: "string",
        description:
          "Optional. Filter the directory by a name (partial, case-insensitive), e.g. 'vijay'.",
      },
      count_only: {
        type: "boolean",
        description:
          "Set true when the user only wants the NUMBER of employees, not the full list.",
      },
    },
  },
};

// ctx = { db, user, employeeId, isOrgViewer, ... }
async function handler(ctx, data) {
  const { db, isOrgViewer } = ctx;

  // Hard gate: directory is HR/Admin only. A normal employee never lists others.
  if (!isOrgViewer) {
    return {
      reply:
        "The employee directory is available to HR/Admin only. I can help you with your own timesheet. 🙂",
    };
  }

  // ACTIVE + linked accounts only — inactive/login-pending/unlinked are hidden.
  let query = `
    SELECT e.id, e.name, e.joining_date, u.email
      FROM employee e
      JOIN users u ON u.employee_id = e.id
     WHERE u.is_active = 1`;
  const binds = [];
  const filterLabels = [];

  // Exact joining date.
  if (data.joining_date && isValidEntryDate(data.joining_date)) {
    query += ` AND e.joining_date = ?`;
    binds.push(data.joining_date);
    filterLabels.push(`joined on ${data.joining_date}`);
  } else {
    // Joining-date range (either bound is optional).
    if (data.joined_from && isValidEntryDate(data.joined_from)) {
      query += ` AND e.joining_date >= ?`;
      binds.push(data.joined_from);
    }
    if (data.joined_to && isValidEntryDate(data.joined_to)) {
      query += ` AND e.joining_date <= ?`;
      binds.push(data.joined_to);
    }
    if (data.joined_from || data.joined_to) {
      filterLabels.push(
        `joined ${data.joined_from || "…"} → ${data.joined_to || "…"}`
      );
    }
  }

  // Optional name filter.
  if (data.name && String(data.name).trim()) {
    query += ` AND e.name LIKE ?`;
    binds.push(`%${String(data.name).trim()}%`);
    filterLabels.push(`name ~ "${String(data.name).trim()}"`);
  }

  query += ` ORDER BY e.name COLLATE NOCASE ASC`;

  const rows = await db.prepare(query).bind(...binds).all();
  const results = rows.results || [];
  const suffix = filterLabels.length ? ` (${filterLabels.join(", ")})` : "";

  if (results.length === 0) {
    return {
      success: true,
      action: "LIST_EMPLOYEES",
      reply: `No active employees found${suffix}.`,
      data: [],
    };
  }

  // Clickable select-chips (frontend renders these; click auto-sends `value`).
  // Built ONLY from DB rows → no model, so a wrong/hallucinated name is impossible.
  // Clicking a name sends that person's EMAIL → backend's bare-email path shows
  // THEIR recent logs. First chip = the viewer's own data ("mine vs other").
  const employeeOptions = [
    { label: "📊 My own hours", value: "my recent logs" },
    ...results
      .filter((r) => r.email)
      .map((r) => ({ label: r.name || r.email, value: r.email, hint: r.email })),
  ];

  // Count-only mode.
  if (data.count_only === true || data.count_only === "true") {
    return {
      success: true,
      action: "LIST_EMPLOYEES",
      reply: `You have ${results.length} active employees${suffix}.`,
      data: results,
      options: employeeOptions,
      optionsTitle: "Pick someone (or 'My own hours'):",
    };
  }

  // List mode — cap the printed list so a big org doesn't flood the chat.
  const MAX_LIST = 40;
  const shown = results.slice(0, MAX_LIST);
  const lines = shown
    .map((r, i) => {
      const jd = r.joining_date ? ` · joined ${r.joining_date}` : "";
      const em = r.email ? ` — ${r.email}` : "";
      return `${i + 1}. ${r.name || "(no name)"}${em}${jd}`;
    })
    .join("\n");

  let reply = `${results.length} active employee${suffix}:\n${lines}`;
  if (results.length > MAX_LIST) {
    reply += `\n…and ${results.length - MAX_LIST} more.`;
  }

  return {
    success: true,
    action: "LIST_EMPLOYEES",
    reply,
    data: results,
    options: employeeOptions,
    optionsTitle: "Pick someone (or 'My own hours'):",
  };
}

export default { name, schema, handler };
