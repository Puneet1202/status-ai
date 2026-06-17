// FILE: backend/src/ai/tools/getMyProjects.tool.js
// Read tool — the projects ASSIGNED to the logged-in user (count + list).
//
// SECURITY: hard-scoped to ctx.employeeId (from the verified JWT). The schema has
// NO parameters, so the model can never request someone else's assignments.

const name = "get_my_projects";

const schema = {
  name,
  description:
    "Return the projects ASSIGNED to the current logged-in user (and how many). Use for 'how many projects am I assigned', 'my projects', 'which projects do I work on', 'projects assigned to me'. NOT for timesheet hours (use analyze_timesheet).",
  parameters: { type: "object", properties: {} }, // no inputs — identity is from the token
};

// ctx = { db, employeeId, ... }
async function handler(ctx) {
  const { db, employeeId } = ctx;
  if (!employeeId) {
    return { success: false, action: "GET_MY_PROJECTS", reply: "Your account isn't linked to an employee record, so I can't list your projects." };
  }

  const { results } = await db
    .prepare(
      `SELECT p.name, p.status, c.name AS client_name
         FROM project_assignments pa
         JOIN projects p ON p.id = pa.project_id
         LEFT JOIN clients c ON c.id = p.client_id
        WHERE pa.employee_id = ?
        ORDER BY (p.status = 'active') DESC, p.name ASC`
    )
    .bind(employeeId)
    .all();

  if (!results || results.length === 0) {
    return { success: true, action: "GET_MY_PROJECTS", reply: "You're not assigned to any projects yet.", data: [] };
  }

  const lines = results.map((r) => {
    const tags = [r.status, r.client_name].filter(Boolean).join(" · ");
    return `• ${r.name}${tags ? `  (${tags})` : ""}`;
  });
  const n = results.length;
  const reply = `📁 You're assigned to ${n} ${n === 1 ? "project" : "projects"}:\n${lines.join("\n")}`;

  return { success: true, action: "GET_MY_PROJECTS", reply, data: results };
}

export default { name, schema, handler };
