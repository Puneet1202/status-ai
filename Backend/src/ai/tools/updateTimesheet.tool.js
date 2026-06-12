// FILE: backend/src/ai/tools/updateTimesheet.tool.js
// Update tool — ZERO-FRICTION edit of an existing entry.
//
// Philosophy: if the model can confidently pin down ONE target row and supplies
// at least one new value, we update in place immediately (proper row id kept,
// audit trail preserved via updated_at). We ONLY fall back to a confirm step
// when the locate is highly ambiguous (more than one plausible match).

import {
  resolveProjectId,
  calcMinutesFromTimes,
  isValidTime,
  isValidEntryDate,
} from "./_helpers.js";

const name = "update_timesheet";

const schema = {
  name,
  description:
    "Update / correct an existing timesheet entry the user logged earlier (e.g. wrong time, wrong task, wrong project). Locate the target by id, or by project / task / date / start-time, then apply the new values. Use this when the user says something was logged incorrectly and wants it changed.",
  parameters: {
    type: "object",
    properties: {
      timesheet_id: {
        type: "integer",
        description:
          "Optional. Exact entry id when the user names one or it is clear from chat history.",
      },
      match_project_name: {
        type: "string",
        description: "Optional. Project of the entry to locate.",
      },
      match_task_description: {
        type: "string",
        description: "Optional. Task text of the entry to locate.",
      },
      match_date: {
        type: "string",
        description: "Optional. Date (YYYY-MM-DD) of the entry to locate.",
      },
      match_start_time: {
        type: "string",
        description:
          "Optional. The OLD start time (HH:MM) of the entry to locate. Useful to disambiguate same-day blocks.",
      },
      new_start_time: {
        type: "string",
        description: "Optional new start time as strict 24-hour HH:MM.",
      },
      new_end_time: {
        type: "string",
        description: "Optional new end time as strict 24-hour HH:MM.",
      },
      new_task_description: {
        type: "string",
        description:
          "Optional new clean, professional English task summary. If the user insists on exact wording, store it verbatim.",
      },
      new_module_name: {
        type: "string",
        description: "Optional new work category in UPPERCASE_SNAKE_CASE.",
      },
      new_project_name: {
        type: "string",
        description: "Optional new project name to move the entry under.",
      },
      new_entry_date: {
        type: "string",
        description: "Optional new date in YYYY-MM-DD.",
      },
    },
  },
};

const SELECT_COLS = `d.id, d.project_id, d.entry_date, d.start_time, d.end_time,
  d.duration_minutes, d.module_name, d.task_description, p.name AS project_name`;

const ROW_FROM = `FROM daily_status_entries d JOIN projects p ON d.project_id = p.id`;

// Pull the set of new field values out of the tool args (only those present).
function extractNewFields(data) {
  const f = {};
  if (typeof data.new_start_time === "string") f.start_time = data.new_start_time.trim();
  if (typeof data.new_end_time === "string") f.end_time = data.new_end_time.trim();
  if (typeof data.new_task_description === "string")
    f.task_description = data.new_task_description.trim();
  if (typeof data.new_module_name === "string")
    f.module_name = data.new_module_name.toUpperCase().trim();
  if (typeof data.new_project_name === "string")
    f.project_name = data.new_project_name.trim();
  if (typeof data.new_entry_date === "string") f.entry_date = data.new_entry_date.trim();
  return f;
}

// A start-time locator like "4 to 5" is am/pm-AMBIGUOUS: it may have been LOGGED
// as 04:00 but the model can read a later "update 4 to 5 …" as 16:00 (or the
// reverse). So when locating by start time we also try the 12-hour counterpart —
// the real entry is found regardless of how the hour was interpreted. Also
// normalizes "4:00" → "04:00". Multiple hits → the handler's confirm step asks.
function startTimeVariants(raw) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || "").trim());
  if (!m) return [String(raw || "").trim()];
  const h = +m[1];
  const norm = `${String(h).padStart(2, "0")}:${m[2]}`;
  const altH = h >= 12 ? h - 12 : h + 12;
  const alt = `${String(altH).padStart(2, "0")}:${m[2]}`;
  return alt === norm ? [norm] : [norm, alt];
}

// Find candidate rows for the requested edit. Returns an array (0..N rows).
async function findCandidates(db, employeeId, data) {
  const id = data.timesheet_id || data.entry_id;
  if (id) {
    const row = await db
      .prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.id = ? AND d.employee_id = ?`)
      .bind(id, employeeId)
      .first();
    return row ? [row] : [];
  }

  const hasCriteria =
    data.match_project_name?.trim() ||
    data.match_task_description?.trim() ||
    data.match_date?.trim() ||
    data.match_start_time?.trim();

  if (hasCriteria) {
    let q = `SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.employee_id = ?`;
    const b = [employeeId];
    if (data.match_project_name?.trim()) {
      q += ` AND p.name LIKE ?`;
      b.push(`%${data.match_project_name.trim()}%`);
    }
    if (data.match_task_description?.trim()) {
      q += ` AND d.task_description LIKE ?`;
      b.push(`%${data.match_task_description.trim()}%`);
    }
    if (data.match_date?.trim()) {
      q += ` AND d.entry_date = ?`;
      b.push(data.match_date.trim());
    }
    if (data.match_start_time?.trim()) {
      const variants = startTimeVariants(data.match_start_time.trim());
      q += ` AND d.start_time IN (${variants.map(() => "?").join(", ")})`;
      b.push(...variants);
    }
    q += ` ORDER BY d.created_at DESC LIMIT 5`;
    const { results } = await db.prepare(q).bind(...b).all();
    return results || [];
  }

  // No criteria at all → the user's most recent entry ("fix my last entry").
  const row = await db
    .prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`)
    .bind(employeeId)
    .first();
  return row ? [row] : [];
}

// Merge new values over the existing row, validate, and write. Shared by the
// direct (zero-friction) path and the confirm path.
async function performUpdate(ctx, row, newFields) {
  const { db, employeeId } = ctx;

  const startTime = newFields.start_time ?? row.start_time;
  const endTime = newFields.end_time ?? row.end_time;
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { reply: `I couldn't apply that time change — please give a clear start and end (e.g. "9 to 11").` };
  }

  const minutes = calcMinutesFromTimes(startTime, endTime);
  if (minutes > 120) {
    return {
      reply: `That change makes the block ${(minutes / 60).toFixed(1)} hrs, which exceeds the 2-hour limit. Please keep it under 2 hours.`,
    };
  }

  let entryDate = newFields.entry_date ?? row.entry_date;
  if (!isValidEntryDate(entryDate)) entryDate = row.entry_date;

  let projectId = row.project_id;
  let projectName = row.project_name;
  if (newFields.project_name) {
    const resolved = await resolveProjectId(db, newFields.project_name);
    if (!resolved) {
      return { reply: `I couldn't find a project named "${newFields.project_name}". Please use an existing project name.` };
    }
    projectId = resolved;
    projectName = newFields.project_name;
  }

  const taskDescription = newFields.task_description ?? row.task_description;
  const moduleName = newFields.module_name ?? row.module_name;

  const result = await db
    .prepare(
      `UPDATE daily_status_entries
       SET project_id = ?, entry_date = ?, start_time = ?, end_time = ?,
           duration_minutes = ?, module_name = ?, task_description = ?,
           updated_at = datetime('now')
       WHERE id = ? AND employee_id = ?`
    )
    .bind(
      projectId,
      entryDate,
      startTime,
      endTime,
      minutes,
      moduleName,
      taskDescription,
      row.id,
      employeeId
    )
    .run();

  if (result.meta.changes === 0) {
    return { reply: "That entry no longer exists or could not be updated." };
  }

  return {
    success: true,
    action: "UPDATE_TIMESHEET",
    reply: `✅ Updated: "${projectName}" on ${entryDate} — ${startTime} → ${endTime} (${(
      minutes / 60
    ).toFixed(1)} hrs) — "${taskDescription}".`,
  };
}

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  try {
    const { db, employeeId } = ctx;
    const newFields = extractNewFields(data);

    if (Object.keys(newFields).length === 0) {
      return {
        reply:
          "Sure — what should I change on that entry? (e.g. new time, task, or project.)",
      };
    }

    const candidates = await findCandidates(db, employeeId, data);

    if (candidates.length === 0) {
      return { reply: "I couldn't find a matching entry to update. Which one did you mean?" };
    }

    // Highly ambiguous → confirm against the most recent match instead of guessing.
    if (candidates.length > 1) {
      const top = candidates[0];
      return {
        requiresConfirmation: true,
        pendingAction: {
          action: "UPDATE_TIMESHEET",
          matchId: top.id,
          newFields,
        },
        reply: `I found ${candidates.length} possible entries. The most recent is "${top.project_name}" on ${top.entry_date} (${top.start_time}–${top.end_time}) — "${top.task_description}". Type "confirm" to update that one, or tell me which entry you mean.`,
      };
    }

    // Confident single target → zero-friction direct update.
    return performUpdate(ctx, candidates[0], newFields);
  } catch (err) {
    console.error("[update_timesheet] handler error:", err?.message || err);
    return {
      reply:
        "I couldn't update that entry — please tell me which entry and what to change.",
    };
  }
}

// Called by the controller when a pending UPDATE is confirmed by the user.
export async function executeUpdate(ctx, pendingAction) {
  const { db, employeeId } = ctx;
  const row = await db
    .prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.id = ? AND d.employee_id = ?`)
    .bind(pendingAction.matchId, employeeId)
    .first();
  if (!row) return { reply: "That entry no longer exists." };
  return performUpdate(ctx, row, pendingAction.newFields || {});
}

export default { name, schema, handler };
