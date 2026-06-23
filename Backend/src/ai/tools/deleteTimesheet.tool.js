// FILE: backend/src/ai/tools/deleteTimesheet.tool.js
// Delete tool — two-phase: handler() locates + asks to confirm,
// executeDelete() performs the destructive write once the user confirms.

const name = "delete_timesheet";

const schema = {
  name,
  description:
    "Delete timesheet entries. Single: locate by id, or project/task, or the most recent entry. BULK: set delete_all=true to delete ALL of TODAY'S entries — e.g. 'delete all my entries today', 'saari entries hata do'. (Only today's entries can be bulk-deleted; older dates are refused.) Always confirms before deleting.",
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
      delete_all: {
        type: "boolean",
        description: "Set true to delete ALL of TODAY'S entries (bulk), not just one. Use for 'delete all today', 'delete all my entries', 'saari entries hata do'. Only today's entries are deletable.",
      },
      from_date: {
        type: "string",
        description: "Optional YYYY-MM-DD. Only today's date is accepted with delete_all; any other date is refused.",
      },
      to_date: {
        type: "string",
        description: "Optional YYYY-MM-DD. Only today's date is accepted with delete_all.",
      },
    },
  },
};

const SELECT_COLS = `d.id, p.name AS project_name, d.duration_minutes, d.task_description`;

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  const { db, employeeId } = ctx;

  // ── BULK DELETE — "delete all today / saari entries hata do" ──────────────
  // POLICY: user sirf AAJ ki entries delete kar sakta hai (purani / all-time NAHI).
  // Koi non-today date maange ya all-time → saaf mana. Bina date "delete all" → AAJ
  // hi maano. Confirm me COUNT + preview; ids pendingAction me capture (confirm-window
  // me nayi entry galti se delete na ho).
  if (data.delete_all === true) {
    const todayStr = ctx.today; // YYYY-MM-DD (user ke timezone se)
    const from = String(data.from_date || "").trim();
    const to = String(data.to_date || data.from_date || "").trim();
    const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(from);
    // Non-today date diya (past/future ya range) → allowed nahi.
    if (hasDate && (from !== todayStr || (to && to !== todayStr))) {
      return { reply: "You can only delete today's entries here. Older entries can't be removed from the assistant — please contact HR/Admin for that." };
    }
    // Scope HAMESHA aaj — bina date "delete all" bhi aaj hi.
    const scopeLabel = "all your entries for today";
    const { results } = await db
      .prepare(`SELECT d.id, p.name AS project_name, d.duration_minutes, d.entry_date
                  FROM daily_status_entries d JOIN projects p ON d.project_id = p.id
                 WHERE d.employee_id = ? AND d.entry_date = ?
                 ORDER BY d.created_at DESC`)
      .bind(employeeId, todayStr)
      .all();
    if (!results || results.length === 0) {
      return { reply: "You have no entries logged today to delete." };
    }
    const totalHrs = results.reduce((s, r) => s + Number(r.duration_minutes || 0), 0) / 60;
    const preview = results.slice(0, 5)
      .map((r) => `   • ${r.entry_date} · ${r.project_name} · ${(r.duration_minutes / 60).toFixed(1)}h`)
      .join("\n");
    const more = results.length > 5 ? `\n   …and ${results.length - 5} more` : "";
    return {
      requiresConfirmation: true,
      pendingAction: {
        action: "DELETE_TIMESHEET",
        ids: results.map((r) => r.id),
        scopeLabel,
      },
      reply: `This will delete ${results.length} entr${results.length === 1 ? "y" : "ies"} (${scopeLabel}, ${totalHrs.toFixed(1)} hrs total):\n${preview}${more}\n\nType "confirm" to delete ALL of them.`,
    };
  }

  let matchLog = null;

  const id = data.timesheet_id || data.entry_id;
  if (id) {
    matchLog = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.id = ? AND d.employee_id = ?`
      )
      .bind(id, employeeId)
      .first();
  }

  if (!matchLog && (data.project_name?.trim() || data.task_description?.trim())) {
    let q = `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ?`;
    const b = [employeeId];
    if (data.project_name?.trim()) {
      q += ` AND p.name LIKE ?`;
      b.push(`%${data.project_name.trim()}%`);
    }
    if (data.task_description?.trim()) {
      q += ` AND d.task_description LIKE ?`;
      b.push(`%${data.task_description.trim()}%`);
    }
    q += ` ORDER BY d.created_at DESC LIMIT 1`;
    matchLog = await db.prepare(q).bind(...b).first();
  }

  if (!matchLog) {
    matchLog = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`
      )
      .bind(employeeId)
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
  const { db, employeeId } = ctx;

  // BULK: ids array (delete_all flow) → sab ek saath delete (self-scoped).
  if (Array.isArray(pendingAction.ids) && pendingAction.ids.length > 0) {
    const ph = pendingAction.ids.map(() => "?").join(",");
    const result = await db
      .prepare(`DELETE FROM daily_status_entries WHERE employee_id = ? AND id IN (${ph})`)
      .bind(employeeId, ...pendingAction.ids)
      .run();
    const n = result.meta.changes || 0;
    if (n === 0) return { reply: "Those entries were already deleted." };
    return {
      success: true,
      action: "DELETE_TIMESHEET",
      reply: `Deleted ${n} entr${n === 1 ? "y" : "ies"} (${pendingAction.scopeLabel || "selected"}).`,
    };
  }

  const result = await db
    .prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?")
    .bind(pendingAction.matchId, employeeId)
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
