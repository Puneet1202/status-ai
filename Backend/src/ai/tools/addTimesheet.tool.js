// FILE: backend/src/ai/tools/addTimesheet.tool.js
// Plug-and-play tool module: schema + handler in one place.

import {
  getOrCreateProjectId,
  calcEndTime,
  calcMinutesFromTimes,
  isValidTime,
  isValidEntryDate,
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

// ctx = { db, user, env, selectedProject, today }
async function handler(ctx, data) {
  const { db, user, selectedProject, today } = ctx;

  const targetProjectName = selectedProject || data.project_name;
  if (!targetProjectName) {
    return { reply: "Please select a project first! Type '@' to choose." };
  }

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

  // Guardrail: max 2 hours (120 min) per single block.
  const exceeding = entriesToBatch.find((e) => {
    const mins =
      e.duration_minutes ||
      (isValidTime(e.start_time) && isValidTime(e.end_time)
        ? calcMinutesFromTimes(e.start_time, e.end_time)
        : 0);
    return mins > 120;
  });
  if (exceeding) {
    return {
      reply: `Entry from ${exceeding.start_time} to ${exceeding.end_time} exceeds 2 hours. Please split into separate slots of max 2 hours each.`,
    };
  }

  const projectId = await getOrCreateProjectId(db, targetProjectName);

  // Parameterized batch insert — no slot snapping, no raw SQL.
  const statements = entriesToBatch.map((entry) => {
    const startTime = entry.start_time;
    const endTime =
      entry.end_time ||
      (entry.duration_minutes ? calcEndTime(startTime, entry.duration_minutes) : null);

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      throw new Error(`Invalid time format for entry: ${JSON.stringify(entry)}`);
    }

    const minutes = entry.duration_minutes || calcMinutesFromTimes(startTime, endTime);
    const modName = (entry.module_name || "GENERAL").toUpperCase().trim();

    return db
      .prepare(
        `INSERT INTO daily_status_entries
         (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        projectId,
        entryDate,
        startTime,
        endTime,
        minutes,
        modName,
        entry.task_description?.trim() || "Work update"
      );
  });

  await db.batch(statements);

  // Deterministic receipt — no extra LLM call.
  const summaryLines = entriesToBatch
    .map((e) => {
      const mins = e.duration_minutes || calcMinutesFromTimes(e.start_time, e.end_time);
      return `• ${e.start_time} → ${e.end_time} (${(mins / 60).toFixed(1)} hrs) — ${e.task_description}`;
    })
    .join("\n");

  const totalMins = entriesToBatch.reduce(
    (sum, e) => sum + (e.duration_minutes || calcMinutesFromTimes(e.start_time, e.end_time)),
    0
  );

  return {
    success: true,
    action: "ADD_MULTIPLE_TIMESHEETS",
    reply: `✅ ${entriesToBatch.length} ${
      entriesToBatch.length === 1 ? "entry" : "entries"
    } saved under "${targetProjectName}" for ${entryDate}.\n\n${summaryLines}\n\nTotal: ${(
      totalMins / 60
    ).toFixed(1)} hrs`,
  };
}

export default { name, schema, handler };
