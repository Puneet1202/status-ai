// FILE: backend/src/ai/tools/_helpers.js
// Shared, side-effect-free utilities reused by every tool handler.
// Single home — previously duplicated inside the controller.

// =========================================================================
// Resolve or create a project id (idempotent, case-insensitive)
// =========================================================================
export async function getOrCreateProjectId(db, projectName) {
  const cleanName = projectName.trim();

  const existing = await db
    .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)")
    .bind(cleanName)
    .first();
  if (existing) return existing.id;

  try {
    const insertResult = await db
      .prepare("INSERT INTO projects (name) VALUES (?)")
      .bind(cleanName)
      .run();
    if (insertResult.meta.changes === 0) {
      throw new Error(`Project creation failed: ${cleanName}`);
    }
    return insertResult.meta.last_row_id;
  } catch (err) {
    // Lost a race on the UNIQUE(name) constraint — re-read the winner's row.
    const raced = await db
      .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)")
      .bind(cleanName)
      .first();
    if (raced) return raced.id;
    throw err;
  }
}

// =========================================================================
// Time math (overnight-aware)
// =========================================================================
export function calcEndTime(startTime, durationMinutes) {
  const [sh, sm] = startTime.split(":").map(Number);
  const total = sh * 60 + sm + parseInt(durationMinutes, 10);
  const pad = (n) => String(n).padStart(2, "0");
  // 23:00 + 240min => 03:00 (next day)
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

export function calcMinutesFromTimes(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight: 23:00 -> 03:00 = 240
  return diff;
}

// =========================================================================
// Validators
// =========================================================================
export function isValidTime(t) {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

// Strict YYYY-MM-DD that is also a REAL calendar date.
// Replaces the year-locked `startsWith("2026-")` time bomb.
export function isValidEntryDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}
