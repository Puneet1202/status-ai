// FILE: backend/src/ai/tools/deleteTimesheet.tool.js
// Delete tool — two-phase: handler() locates + asks to confirm,
// executeDelete() performs the destructive write once the user confirms.

const name = "delete_timesheet";

const schema = {
  name,
  description:
    "Delete a timesheet entry. Locates the target by id, or by project/task/date, or falls back to the user's most recent entry. Always confirms before deleting.",
  parameters: {
    type: "object",
    properties: {
      timesheet_id: {
        type: "integer",
        description: "Optional. Exact entry id to delete, when the user names one.",
      },
      project_name: {
        type: "string",
        description: "Optional. Project name to match the entry to delete.",
      },
      task_description: {
        type: "string",
        description: "Optional. Task text to match the entry to delete.",
      },
      match_date: {
        type: "string",
        description: "Optional. Date (YYYY-MM-DD) of the entry to delete. Use this when user mentions a specific date like 'yesterday', 'Monday', etc.",
      },
    },
  },
};

const SELECT_COLS = `d.id, p.name AS project_name, d.duration_minutes, d.task_description`;

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  const { db, user } = ctx;
  let matchLog = null;

  const id = data.timesheet_id || data.entry_id;
  if (id) {
    matchLog = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.id = ? AND d.employee_id = ?`
      )
      .bind(id, user.id)
      .first();
  }

  if (!matchLog && (data.project_name?.trim() || data.task_description?.trim() || data.match_date?.trim())) {
    let q = `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ?`;
    const b = [user.id];
    if (data.project_name?.trim()) {
      q += ` AND p.name LIKE ?`;
      b.push(`%${data.project_name.trim()}%`);
    }
    if (data.task_description?.trim()) {
      q += ` AND d.task_description LIKE ?`;
      b.push(`%${data.task_description.trim()}%`);
    }
    if (data.match_date?.trim()) {
      q += ` AND d.entry_date = ?`;
      b.push(data.match_date.trim());
    }
    q += ` ORDER BY d.created_at DESC LIMIT 1`;
    matchLog = await db.prepare(q).bind(...b).first();
  }

  if (!matchLog) {
    matchLog = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`
      )
      .bind(user.id)
      .first();
  }

  if (!matchLog) return { reply: "No timesheet entries found to delete." };

  return {
    requiresConfirmation: true,
    pendingAction: {
      action: "DELETE_TIMESHEET",
      matchId: matchLog.id,
      projectName: matchLog.project_name,
    },
    reply: `Found: "${matchLog.project_name}" — ${(matchLog.duration_minutes / 60).toFixed(
      1
    )} hrs — "${matchLog.task_description}". Type "confirm" to delete.`,
  };
}

// Called by the controller when a pending DELETE is confirmed by the user.
export async function executeDelete(ctx, pendingAction) {
  const { db, user } = ctx;
  const result = await db
    .prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?")
    .bind(pendingAction.matchId, user.id)
    .run();

  if (result.meta.changes === 0) {
    return { reply: "Entry not found or already deleted." };
  }
  return {
    success: true,
    action: "DELETE_TIMESHEET",
    reply: `Entry from "${pendingAction.projectName}" permanently deleted.`,
  };
}

export default { name, schema, handler };
