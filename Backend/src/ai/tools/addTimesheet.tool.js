// FILE: backend/src/ai/tools/addTimesheet.tool.js
// Plug-and-play tool module: schema + handler in one place.

import {
  getOrCreateProjectId,
  calcEndTime,
  calcMinutesFromTimes,
  isValidTime,
  isValidEntryDate,
  detectOverlap,
  matchProjectTask,
  todayISO,
} from "./_helpers.js";

const name = "add_timesheet_entries";

const schema = {
  name,
  description:
    "Add work time entries to a timesheet. Handles any time format, any schedule, any number of entries. Supports breaks, night shifts, split shifts, and multilingual input.",
  parameters: {
    type: "object",
    required: ["entry_date", "entries"],
    properties: {
      project_name: {
        type: "string",
        description:
          "Project name exactly as mentioned by user. Never assume or invent. If not mentioned, the active selected project context is used.",
      },
      entry_date: {
        type: "string",
        description:
          "Date in YYYY-MM-DD format. Parse from user input. Default: today when none given.",
      },
      entries: {
        type: "array",
        description:
          "Array of work blocks. One object per continuous time block. Split around breaks. No overlaps allowed.",
        minItems: 1,
        items: {
          type: "object",
          required: ["module_name", "task_description", "start_time", "end_time"],
          properties: {
            start_time: {
              type: "string",
              description:
                "Start time as strict 24-hour HH:MM. Convert any expression (any language/format) into HH:MM. NEVER output anything other than HH:MM.",
            },
            end_time: {
              type: "string",
              description:
                "End time as strict 24-hour HH:MM. Can roll to next day for night shifts. NEVER output anything other than HH:MM.",
            },
            module_name: {
              type: "string",
              description:
                "Work category in UPPERCASE_SNAKE_CASE, derived from the task. Examples: BUG_FIXING, CLIENT_MEETING, CODE_REVIEW, DEPLOYMENT, RESEARCH, DOCUMENTATION.",
            },
            task_description: {
              type: "string",
              description:
                "Clean, professional English summary of the work done in this block.",
            },
            is_lunch: {
              type: "boolean",
              description:
                "True if this block is any kind of break (lunch/tea/rest). Excluded from the DB.",
            },
          },
        },
      },
    },
  },
};

// ctx = { db, user, env, selectedProject, selectedTasks, today }
async function handler(ctx, data) {
  const { db, user, selectedProject, selectedTasks, today } = ctx;
  try {
  const targetProjectName = selectedProject || data.project_name;
  if (!targetProjectName) {
    return { reply: "Please select a project first! Type '@' to choose." };
  }

  // If the user ticked predefined project tasks in the UI, those become the
  // module_name for every saved block (joined when multiple). Otherwise fall
  // back to the auto-derived module from the block's description.
  const taskModule =
    Array.isArray(selectedTasks) && selectedTasks.length > 0
      ? selectedTasks.map((t) => String(t).trim()).filter(Boolean).join(" | ")
      : null;

  const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
  if (!hasEntries && !data.task_description) {
    return { reply: "Please describe what you worked on." };
  }

  // Date: validate as a real calendar date, default to today (no year hardcode).
  let entryDate = data.entry_date || today;
  if (!isValidEntryDate(entryDate)) entryDate = today;

  // Normalize into a batch of work blocks.
  let entriesToBatch = hasEntries
    ? data.entries
    : [
        {
          start_time: data.start_time,
          end_time:
            data.end_time ||
            (data.duration_minutes
              ? calcEndTime(data.start_time, data.duration_minutes)
              : null),
          duration_minutes: data.duration_minutes,
          module_name: data.module_name || "GENERAL",
          task_description: data.task_description,
        },
      ];

  // Drop break/lunch blocks — they never hit the DB.
  entriesToBatch = entriesToBatch.filter((e) => !e.is_lunch);
  if (entriesToBatch.length === 0) {
    return {
      reply:
        "No workable time entries found. Either no time was mentioned, or only a break was logged.",
    };
  }

  // ── Partition blocks: parseable & within cap (valid) vs. problematic ──
  // Product decision: SAVE the valid blocks and only FLAG the bad ones, so a
  // single bad block never forces the user to re-enter the whole day.
  const problems = [];
  const seen = new Set();
  const valid = [];

  for (const e of entriesToBatch) {
    // Derive an end time from duration if the legacy single-entry path supplied one.
    const startTime = e.start_time;
    const endTime =
      e.end_time ||
      (e.duration_minutes ? calcEndTime(startTime, e.duration_minutes) : null);

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      problems.push(
        `• "${e.task_description || "one block"}" — couldn't read the time (give a clear start & end, e.g. "9 to 11").`
      );
      continue;
    }

    const mins = calcMinutesFromTimes(startTime, endTime);
    if (mins > 120) {
      problems.push(
        `• ${startTime}–${endTime} ("${e.task_description || "work"}") — ${(mins / 60).toFixed(
          1
        )} hrs exceeds the 2-hour limit; please split it into blocks of max 2 hours.`
      );
      continue;
    }

    // Drop exact duplicates within this single message.
    const key = `${startTime}|${endTime}|${(e.task_description || "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push({ ...e, start_time: startTime, end_time: endTime, _mins: mins });
  }

  // Overlap is relational — if the would-be-saved blocks clash we can't pick a
  // winner, so block the write and ask the user to adjust (nothing saved here).
  const overlap = detectOverlap(valid);
  if (overlap) {
    const [a, b] = overlap;
    return {
      reply: `These blocks overlap: ${a.start_time}–${a.end_time} and ${b.start_time}–${b.end_time}. Please adjust so they don't clash.`,
    };
  }

  // Nothing valid to save → report only the problems.
  if (valid.length === 0) {
    return { reply: `I couldn't save those entries:\n${problems.join("\n")}` };
  }

  const projectId = await getOrCreateProjectId(db, targetProjectName);

  // Predefined tasks for this project — used to auto-assign a PER-BLOCK task from
  // each slot's description when the user didn't explicitly tick tasks in the UI.
  // (Boss's ask: "9-10 ye task, 11-12 wo task" — different task per time slot.)
  let projectTasks = [];
  if (!taskModule) {
    try {
      const res = await db
        .prepare("SELECT task_name FROM project_tasks WHERE project_id = ?")
        .bind(projectId)
        .all();
      projectTasks = (res.results || []).map((r) => r.task_name);
    } catch {
      projectTasks = [];
    }
  }

  // Parameterized batch insert — atomic over the VALID blocks only.
  const statements = valid.map((entry) => {
    // task_name priority: UI-ticked tasks (apply to all blocks) → per-block match
    // from this slot's description → null.
    const taskName = taskModule || matchProjectTask(entry.task_description, projectTasks) || null;
    return db
      .prepare(
        `INSERT INTO daily_status_entries
         (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description, task_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        projectId,
        entryDate,
        entry.start_time,
        entry.end_time,
        entry._mins,
        (entry.module_name || "GENERAL").toUpperCase().trim(), // module = AI auto-derived (unchanged)
        entry.task_description?.trim() || "Work update",
        taskName
      );
  });

  await db.batch(statements);

  // Deterministic receipt — no extra LLM call.
  const summaryLines = valid
    .map(
      (e) => `• ${e.start_time} → ${e.end_time} (${(e._mins / 60).toFixed(1)} hrs) — ${e.task_description}`
    )
    .join("\n");

  const totalMins = valid.reduce((sum, e) => sum + e._mins, 0);

  let reply = `✅ ${valid.length} ${
    valid.length === 1 ? "entry" : "entries"
  } saved under "${targetProjectName}"${
    taskModule ? ` · 🏷️ ${taskModule}` : ""
  } for ${entryDate}.\n\n${summaryLines}\n\nTotal: ${(totalMins / 60).toFixed(1)} hrs`;

  if (problems.length > 0) {
    reply += `\n\n⚠️ Not saved — please fix and resend just these:\n${problems.join("\n")}`;
  }

  return {
    success: true,
    action: "ADD_MULTIPLE_TIMESHEETS",
    reply,
  };
  } catch (err) {
    // A single malformed block (e.g. unparseable time deep in the batch)
    // must never 500 the whole request — degrade to a friendly reply.
    console.error("[add_timesheet_entries] handler error:", err?.message || err);
    return {
      reply:
        "I couldn't save those entries — one of the time blocks looked off. Please re-send with clear start and end times for each block.",
    };
  }
}

export default { name, schema, handler };
