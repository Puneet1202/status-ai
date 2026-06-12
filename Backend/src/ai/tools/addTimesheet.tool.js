// FILE: backend/src/ai/tools/addTimesheet.tool.js
// Plug-and-play tool module: schema + handler in one place.

import {
  resolveProjectId,
  calcEndTime,
  calcMinutesFromTimes,
  isValidTime,
  isValidEntryDate,
  detectOverlap,
  matchProjectTask,
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
  const { db, employeeId, selectedProject, selectedTasks, today } = ctx;
  try {
  if (!employeeId) {
    return { reply: "Your account isn't linked to an employee record, so I can't log time for you. Please contact your admin." };
  }
  const targetProjectName = selectedProject || data.project_name;
  if (!targetProjectName) {
    // Project chips = is user ke ASSIGNED projects (DB se → no model, koi galat
    // project nahi). kind:"project" → frontend click pe project PILL set karta hai
    // (text send nahi), phir user time bata kar log karta hai.
    let projectOptions = [];
    try {
      const pr = await db
        .prepare(
          `SELECT DISTINCT p.id, p.name
             FROM projects p
             JOIN project_assignments pa ON pa.project_id = p.id
            WHERE pa.employee_id = ?
            ORDER BY p.name ASC`
        )
        .bind(employeeId)
        .all();
      projectOptions = (pr.results || []).map((p) => ({
        label: p.name,
        value: p.name,
        kind: "project",
        projectId: p.id,
      }));
    } catch (e) {
      console.warn("[addTimesheet project-options failed]", e?.message || e);
    }
    return {
      reply: "Please select a project first — pick one below or type '@'.",
      ...(projectOptions.length ? { options: projectOptions, optionsTitle: "Choose your project:" } : {}),
    };
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
  // Key = "start|end". Blocks with the SAME time get MERGED, not duplicated —
  // because a single block whose description has "and"/"&" (e.g. "11-12 ai testing
  // and solve bug issue") sometimes comes back from the model as TWO 11–12 rows.
  // That's not a real overlap; it's one block with a two-part description. Merging
  // here kills the bogus "11:00–12:00 overlaps 11:00–12:00" error at the source.
  const byTime = new Map();

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

    const key = `${startTime}|${endTime}`;
    const desc = (e.task_description || "").trim();
    const existing = byTime.get(key);
    if (existing) {
      // Same time block again → merge its description (skip exact-dup text).
      const low = desc.toLowerCase();
      if (desc && !existing._descs.has(low)) {
        existing._descs.add(low);
        existing.task_description = existing.task_description
          ? `${existing.task_description}, ${desc}`
          : desc;
      }
      continue;
    }
    byTime.set(key, {
      ...e,
      start_time: startTime,
      end_time: endTime,
      _mins: mins,
      task_description: desc,
      _descs: new Set(desc ? [desc.toLowerCase()] : []),
    });
  }

  const valid = [...byTime.values()];

  // Overlap is relational — if the would-be-saved blocks clash we can't pick a
  // winner, so block the write and ask the user to adjust (nothing saved here).
  const overlap = detectOverlap(valid);
  if (overlap) {
    const [a, b] = overlap;
    return {
      reply: `These blocks overlap: ${a.start_time}–${a.end_time} and ${b.start_time}–${b.end_time}. Please adjust so they don't clash.`,
    };
  }

  // ── DB-OVERLAP: naye block DB me pehle se logged entries se clash to nahi? ────
  // Upar wala detectOverlap sirf ISI message ke blocks check karta hai. Ye check
  // EXISTING entries se bachata hai — jaise alag-alag message me pehle 9-9:30,
  // phir 9-10 (jo overlap karta hai). Clash waale block flag hote hai, clean save.
  try {
    const ex = await db
      .prepare("SELECT start_time, end_time FROM daily_status_entries WHERE employee_id = ? AND entry_date = ?")
      .bind(employeeId, entryDate)
      .all();
    const existing = (ex.results || [])
      .map((r) => ({
        start_time: String(r.start_time || "").slice(0, 5),
        end_time: String(r.end_time || "").slice(0, 5),
      }))
      .filter((r) => isValidTime(r.start_time) && isValidTime(r.end_time));

    if (existing.length) {
      const clean = [];
      for (const v of valid) {
        const clashes = existing.some((e) =>
          detectOverlap([e, { start_time: v.start_time, end_time: v.end_time }])
        );
        if (clashes) {
          problems.push(
            `• ${v.start_time}–${v.end_time} ("${v.task_description || "work"}") — overlaps an entry already logged for this day; please adjust the time.`
          );
        } else {
          clean.push(v);
        }
      }
      valid.length = 0;
      valid.push(...clean);
    }
  } catch (e) {
    console.warn("[addTimesheet DB-overlap check failed]", e?.message || e);
  }

  // Nothing valid to save → report only the problems.
  if (valid.length === 0) {
    return { reply: `I couldn't save those entries:\n${problems.join("\n")}` };
  }

  const projectId = await resolveProjectId(db, targetProjectName);
  if (!projectId) {
    return {
      reply: `I couldn't find a project named "${targetProjectName}". Please pick an existing project (type '@' to choose).`,
    };
  }

  // Real tasks for this project (prod `tasks` table). Used two ways:
  // 1) UI-ticked task → resolve ITS row id so the FK `task_id` is saved too.
  // 2) No tick → auto-link each block to a matching task by its description.
  let projectTaskRows = [];
  try {
    const res = await db
      .prepare("SELECT id, title FROM tasks WHERE project_id = ?")
      .bind(projectId)
      .all();
    projectTaskRows = res.results || [];
  } catch {
    projectTaskRows = [];
  }
  const taskTitles = projectTaskRows.map((r) => r.title);
  const titleToId = new Map(projectTaskRows.map((r) => [r.title, r.id]));

  // UI-ticked task ka FK: exactly EK task tick ho to uska id har block pe lagta
  // hai (multiple ticks → FK ek hi ho sakta hai, isliye null hi rehta hai).
  let tickedTaskId = null;
  if (taskModule && Array.isArray(selectedTasks) && selectedTasks.length === 1) {
    const want = String(selectedTasks[0]).trim().toLowerCase();
    const row = projectTaskRows.find((r) => String(r.title).trim().toLowerCase() === want);
    tickedTaskId = row?.id ?? null;
  }

  // Parameterized batch insert — atomic over the VALID blocks only.
  const statements = valid.map((entry) => {
    // module_name: UI-ticked tasks (apply to all blocks) override the AI-derived
    // category; otherwise use the per-block auto-derived module.
    const moduleName = taskModule || (entry.module_name || "GENERAL").toUpperCase().trim();
    // task_id: UI-ticked task ka id; warna description se best-effort match.
    const matchedTitle = taskModule ? null : matchProjectTask(entry.task_description, taskTitles);
    const taskId = taskModule ? tickedTaskId : (matchedTitle ? (titleToId.get(matchedTitle) ?? null) : null);
    return db
      .prepare(
        `INSERT INTO daily_status_entries
         (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description, task_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        employeeId,
        projectId,
        entryDate,
        entry.start_time,
        entry.end_time,
        entry._mins,
        moduleName,
        entry.task_description?.trim() || "Work update",
        taskId
      );
  });

  await db.batch(statements);

  // Just-saved rows ki IDs nikaalo (frontend ke EDIT window ke liye → exact update,
  // taaki "09:00" jaisे same start-time wali PURANI entries se confuse na ho). Same
  // din + same start-time UNIQUE hota hai (overlap check do entries ek hi time pe
  // banne nahi deta), to start_time → id reliable map hai.
  let idByStart = new Map();
  try {
    const ph = valid.map(() => "?").join(", ");
    const idRows = await db
      .prepare(`SELECT id, start_time FROM daily_status_entries WHERE employee_id = ? AND entry_date = ? AND start_time IN (${ph})`)
      .bind(employeeId, entryDate, ...valid.map((v) => v.start_time))
      .all();
    idByStart = new Map((idRows.results || []).map((r) => [String(r.start_time).slice(0, 5), r.id]));
  } catch (e) {
    console.warn("[addTimesheet id-fetch failed]", e?.message || e);
  }

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
    // For the frontend's post-save EDIT window: the just-saved blocks (time + text)
    // so an "Edit" chip can pre-fill an update command. Only the cleanly-saved ones.
    savedEntries: valid.map((e) => ({
      id: idByStart.get(e.start_time) ?? null,
      start_time: e.start_time,
      end_time: e.end_time,
      task_description: e.task_description?.trim() || "Work update",
    })),
    project: targetProjectName,
    projectId,
    tasks: Array.isArray(selectedTasks) ? selectedTasks : [],
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
