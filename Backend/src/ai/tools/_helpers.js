// FILE: backend/src/ai/tools/_helpers.js
// Shared, side-effect-free utilities reused by every tool handler.
// Single home — previously duplicated inside the controller.

// =========================================================================
// Resolve an EXISTING project id by name (case-insensitive). Returns null when
// no such project exists.
//
// We deliberately do NOT auto-create projects: in prod.db `projects.client_id`
// is NOT NULL (every project belongs to a client), so the AI cannot invent a
// valid project out of a free-text name. Callers must handle null by asking the
// user to pick a real, existing project.
// =========================================================================
export async function resolveProjectId(db, projectName) {
  const cleanName = String(projectName || "").trim();
  if (!cleanName) return null;

  const existing = await db
    .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)")
    .bind(cleanName)
    .first();
  return existing ? existing.id : null;
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

// Default business timezone — used ONLY as a fallback when the caller passes
// no zone. Real requests carry the browser's IANA zone (see AIChatbot.jsx), so
// this default only affects direct API calls / tests. Change to suit your team.
export const DEFAULT_TZ = "Asia/Kolkata";

// "Today" as YYYY-MM-DD IN THE USER'S TIMEZONE — NOT UTC.
// The old UTC version made a night-shift Indian user (e.g. 01:00 IST) log the
// PREVIOUS day, because 01:00 IST is still the prior calendar date in UTC.
// 'en-CA' is the locale that formats as YYYY-MM-DD; Workers' V8 ships full ICU
// so timeZone formatting is reliable. Falls back to UTC if the zone is invalid.
// `now` is injectable purely so the timezone behaviour can be unit-tested with a
// fixed instant; production always uses the real current time.
export function todayISO(timeZone = DEFAULT_TZ, now = new Date()) {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: timeZone || DEFAULT_TZ });
  } catch {
    return now.toISOString().split("T")[0];
  }
}

// =========================================================================
// Deterministic overlap detection (overnight-aware).
// Sorts work blocks by start minute-of-day and returns the first pair whose
// ranges intersect. Returns null when everything is clean.
// A block that rolls past midnight (end <= start) is treated as ending at
// start + its real duration so night shifts are compared on a single axis.
// =========================================================================
export function detectOverlap(entries) {
  const toRange = (e) => {
    const [sh, sm] = e.start_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const dur = calcMinutesFromTimes(e.start_time, e.end_time); // overnight-aware
    return { start, end: start + dur, raw: e };
  };

  const ranges = entries
    .filter((e) => isValidTime(e.start_time) && isValidTime(e.end_time))
    .map(toRange)
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const cur = ranges[i];
    if (cur.start < prev.end) {
      return [prev.raw, cur.raw]; // first overlapping pair
    }
  }
  return null;
}

// =========================================================================
// Match a block's free-text description to the closest PREDEFINED project task.
// Keyword-overlap based (no fuzzy/AI) — returns a task only on a confident match
// (≥ half the task's significant words present), else null. This lets a per-slot
// description ("9-10 fixed the state bug") map to a known task ("State Bug Fixes")
// reliably, without ambiguous free-form parsing.
// =========================================================================
const TASK_STOP = new Set([
  "the", "and", "for", "with", "was", "were", "this", "that", "some", "work",
  "worked", "working", "did", "done", "on", "in", "to", "of", "a", "an", "my", "is",
]);
const sigWords = (s) =>
  String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !TASK_STOP.has(w));

export function matchProjectTask(description, tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const descWords = new Set(sigWords(description));
  if (descWords.size === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const t of tasks) {
    const tw = sigWords(t);
    if (!tw.length) continue;
    const overlap = tw.filter((w) => descWords.has(w)).length;
    const score = overlap / tw.length; // fraction of the task's keywords present
    if (overlap > 0 && score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 0.5 ? best : null;
}
