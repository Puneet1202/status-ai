// FILE: backend/src/ai/blockExtractor.js
// =========================================================================
// HYBRID WORK-BLOCK EXTRACTION  (the exit from the regex "treadmill")
// =========================================================================
// The LLM UNDERSTANDS any format/language/typo — that's its strength. The
// deterministic regex parser is RELIABLE for known formats — that's its
// strength. We combine them, and the tool handler VALIDATES the result
// (HH:MM, overlap, 2-hour cap, lunch filter, dedup) so a flaky model can NEVER
// write bad data: it either parses correctly, or we fall back, or we drop it.
//
//   llm-first  : LLM extracts → regex fallback if empty/slow/garbled
//   regex-first: regex extracts → LLM rescue only if regex finds nothing
//
// Output shape matches what add_timesheet_entries expects:
//   { start_time, end_time, task_description, module_name, is_lunch }

import { parseWorkBlocks, deriveModule, isBreakLabel } from "./timeParser.js";
import { CHAT_MODEL, EXTRACTION_MODE, EXTRACT_TIMEOUT_MS } from "./ai-config.js";

const EXTRACT_PROMPT = `You convert a worker's free-text status update into a STRICT JSON array of work blocks.

OUTPUT RULES (critical):
- Output ONLY a JSON array. No prose, no markdown fences, no explanation.
- Each element: {"start_time":"HH:MM","end_time":"HH:MM","task":"short clean English summary","is_lunch":false}
- Times in 24-hour HH:MM. Convert ANY format: "9am", "9-11", "9 to 11", "9 → 11", "9 baje", "9:30 PM".
- One element per continuous time block. Split around breaks.
- Use the day's context so times read left-to-right (e.g. "11 to 1" after a 9-11 block = 11:00 to 13:00).
- is_lunch = true ONLY for lunch/tea/rest breaks. These are removed later, but still include them.
- task = the work described for THAT block, in clean professional English (fix obvious typos).
- If the message contains no work time at all, output exactly: []

EXAMPLE 1
User: "10-11 made some ui, 12-1 lunch break, 1-2 worked on jira"
Output: [{"start_time":"10:00","end_time":"11:00","task":"Made some UI","is_lunch":false},{"start_time":"12:00","end_time":"13:00","task":"Lunch break","is_lunch":true},{"start_time":"13:00","end_time":"14:00","task":"Worked on Jira","is_lunch":false}]

EXAMPLE 2
User: "9 → 11 fix the api bugs then 11 → 12:30 deployment"
Output: [{"start_time":"09:00","end_time":"11:00","task":"Fix the API bugs","is_lunch":false},{"start_time":"11:00","end_time":"12:30","task":"Deployment","is_lunch":false}]`;

// Hard timeout so a stalled model falls back to regex quickly.
function withTimeout(promise, ms, label = "EXTRACT") {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

// Normalize a clock token to strict HH:MM, or null if not a valid time.
function toHHMM(s) {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// Pull the first JSON array out of the model's text (robust to stray prose).
function extractJsonArray(raw) {
  if (typeof raw !== "string") return null;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Ask the model to extract blocks. Returns [] on any failure (caller falls back).
export async function llmExtractBlocks(message, env) {
  if (!env?.AI?.run) return [];
  let response;
  try {
    response = await withTimeout(
      env.AI.run(CHAT_MODEL, {
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0,
        max_tokens: 800,
      }),
      EXTRACT_TIMEOUT_MS
    );
  } catch (err) {
    console.warn("[llmExtractBlocks] failed → regex fallback:", err?.message || err);
    return [];
  }

  const text =
    typeof response === "string"
      ? response
      : response?.response ?? response?.result?.response ?? "";
  const arr = extractJsonArray(text);
  if (!arr) return [];

  const out = [];
  for (const it of arr) {
    const start = toHHMM(it?.start_time);
    const end = toHHMM(it?.end_time);
    if (!start || !end) continue; // validation: malformed time → drop
    const task = typeof it?.task === "string" && it.task.trim() ? it.task.trim() : "Work";
    out.push({
      start_time: start,
      end_time: end,
      task_description: task,
      module_name: deriveModule(task),
      // Trust the model's flag, but re-flag a break it mislabeled as work
      // using our tested break detector (defense-in-depth).
      is_lunch: !!it?.is_lunch || isBreakLabel(task),
    });
  }
  return out;
}

// Orchestrator. Returns { entries, source } where source is 'llm' | 'regex'.
// The tool handler validates entries before anything is saved.
export async function extractWorkBlocks(message, env) {
  const runLLM = async () => {
    const llm = await llmExtractBlocks(message, env);
    // Need at least one real (non-break) work block to trust the LLM result.
    return llm.some((e) => !e.is_lunch) ? llm : null;
  };
  const runRegex = () => {
    const r = parseWorkBlocks(message).entries;
    return r.length > 0 ? r : null;
  };

  if (EXTRACTION_MODE === "regex-first") {
    const regex = runRegex();
    if (regex) return { entries: regex, source: "regex" };
    const llm = await runLLM();
    if (llm) return { entries: llm, source: "llm" };
    return { entries: [], source: "none" };
  }

  // default: llm-first
  const llm = await runLLM();
  if (llm) return { entries: llm, source: "llm" };
  const regex = runRegex();
  if (regex) return { entries: regex, source: "regex" };
  return { entries: [], source: "none" };
}
