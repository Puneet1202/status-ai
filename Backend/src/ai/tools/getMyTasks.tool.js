// FILE: backend/src/ai/tools/getMyTasks.tool.js
// Read tool — the tasks ASSIGNED to the logged-in user (count + list by status).
//
// SECURITY: hard-scoped to ctx.employeeId (assignee_id). No parameters → the model
// can never request another person's tasks.

const name = "get_my_tasks";

const schema = {
  name,
  description:
    "Return the tasks ASSIGNED to the current logged-in user (and how many), grouped by status. Use for 'how many tasks am I assigned', 'my tasks', 'what tasks do I have', 'my pending/open tasks', 'tasks due'. NOT for timesheet hours.",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional filter, e.g. 'To Do', 'In Progress', 'Done'. Omit for all." },
      project_name: { type: "string", description: "Optional: only tasks under this project (partial match). Set when the user names a project ('tasks in Mark Projects')." },
    },
  },
};

// ctx = { db, employeeId, ... }
async function handler(ctx, data = {}) {
  const { db, employeeId } = ctx;
  if (!employeeId) {
    return { success: false, action: "GET_MY_TASKS", reply: "Your account isn't linked to an employee record, so I can't list your tasks." };
  }

  const binds = [employeeId];
  let where = "t.assignee_id = ?";
  if (data.status && String(data.status).trim()) {
    where += " AND LOWER(t.status) = LOWER(?)";
    binds.push(String(data.status).trim());
  }
  const projFilter = data.project_name && String(data.project_name).trim();
  if (projFilter) {
    // Exact name preferred (chips pass the exact project name, and one name can be
    // a prefix of another e.g. "121meet.ai" vs "121meet.ai/bxn"); fall back to a
    // partial match only when no project matches exactly (free-form typing).
    const exact = await db.prepare("SELECT 1 FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1").bind(projFilter).first();
    if (exact) { where += " AND LOWER(p.name) = LOWER(?)"; binds.push(projFilter); }
    else { where += " AND LOWER(p.name) LIKE LOWER(?)"; binds.push(`%${projFilter}%`); }
  }

  const { results } = await db
    .prepare(
      `SELECT t.task_key, t.title, t.status, t.priority, t.due_date, p.name AS project_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
        WHERE ${where}
        ORDER BY (t.status = 'Done') ASC, t.due_date ASC, t.id ASC`
    )
    .bind(...binds)
    .all();

  if (!results || results.length === 0) {
    const what = projFilter ? ` in "${projFilter}"` : data.status ? ` '${data.status}'` : "";
    return { success: true, action: "GET_MY_TASKS", reply: `You have no${what} tasks.`, data: [] };
  }

  // MULTI-PROJECT picker: no project chosen yet AND tasks span >1 project → show a
  // per-project count + project chips so the user taps one to see its tasks.
  const projects = [...new Set(results.map((r) => r.project_name || "(no project)"))];
  if (!projFilter && projects.length > 1) {
    const counts = projects.map((p) => `   • ${p} — ${results.filter((r) => (r.project_name || "(no project)") === p).length}`);
    return {
      success: true,
      action: "GET_MY_TASKS",
      reply: `✅ You have ${results.length} tasks across ${projects.length} projects:\n${counts.join("\n")}\n\nTap a project to see its tasks:`,
      options: projects.map((p) => ({ label: `📁 ${p}`, value: `my tasks for ${p}` })),
      optionsTitle: "Pick a project:",
      data: results,
    };
  }

  // Single project (or filtered) → full list grouped by status.
  const groups = {};
  for (const r of results) {
    const s = r.status || "Other";
    (groups[s] = groups[s] || []).push(r);
  }
  const block = Object.entries(groups)
    .map(([status, rows]) => {
      const lines = rows
        .map((r) => `   • ${r.title}${r.due_date ? ` · due ${r.due_date}` : ""}${r.priority ? ` · ${r.priority}` : ""}`)
        .join("\n");
      return `🔸 ${status} (${rows.length})\n${lines}`;
    })
    .join("\n\n");

  const n = results.length;
  const head = projFilter ? `✅ ${n} ${n === 1 ? "task" : "tasks"} in "${projects[0]}":` : `✅ You have ${n} ${n === 1 ? "task" : "tasks"} assigned:`;
  return { success: true, action: "GET_MY_TASKS", reply: `${head}\n\n${block}`, data: results };
}

export default { name, schema, handler };
