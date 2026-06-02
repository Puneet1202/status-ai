// FILE: backend/src/ai/timeParser.js
// =========================================================================
// DETERMINISTIC WORK-BLOCK EXTRACTION
// =========================================================================
// The 70B model was unreliable at emitting a structured entries[] array
// (sometimes perfect, sometimes empty for the same kind of input). Time
// parsing is mechanical, so we do it in code — 100% repeatable, unit-tested.
// This is PARSING, not business policy: no fixed hours/lunch/timezone here.
//
// Handles:
//   • bare ranges with day-ascending AM/PM inference  ("9-11, 11-1, 2-5")
//   • 24h ranges                                       ("09:00 to 11:00")
//   • explicit AM/PM                                   ("8 AM to 7 PM")
//   • break/lunch subtraction (splits the work block)  ("lunch 1 to 2")
//   • point breaks                                     ("15 min break at 10:30")
// Returns { entries: [{ start_time, end_time, module_name, task_description }] }.

const pad = (n) => String(n).padStart(2, "0");
const toHHMM = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

// A clock token: 1-2 digit hour, optional :mm, optional "baje"/"o'clock",
// optional am/pm. The baje/o'clock group is NON-capturing so group indices
// (hour, minute, meridiem) stay stable for every regex built from TIME.
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(?:baje|bje|o'?clock)?\s*(a\.?m\.?|p\.?m\.?)?`;
const CONN = String.raw`(?:-|–|—|to|till|until|through|thru|upto|up to|se)`;
const RANGE_RE = new RegExp(`${TIME}\\s*${CONN}\\s*${TIME}`, "gi");

// Point break: "15 min break at 10:30"  OR  "break at 4:30 for 20 minutes".
const BREAK_PT_A = new RegExp(String.raw`(\d{1,3})\s*min(?:ute)?s?\s*(?:break|rest)\s*(?:at|@|from)?\s*${TIME}`, "gi");
const BREAK_PT_B = new RegExp(String.raw`(?:break|rest)\s*(?:at|@)\s*${TIME}\s*for\s*(\d{1,3})\s*min`, "gi");

const mer = (s) => (!s ? null : /p/i.test(s) ? "pm" : "am");

// Resolve (hour, minute, meridiem) to minutes-of-day. For bare numbers, pick
// the smallest interpretation that is >= minBound so a day reads left-to-right.
function resolveTime(hour, minute, meridiem, minBound) {
  const min = minute || 0;
  if (meridiem === "am") return (hour % 12) * 60 + min;
  if (meridiem === "pm") return ((hour % 12) + 12) * 60 + min;
  if (hour >= 13 && hour <= 23) return hour * 60 + min; // explicit 24h
  if (hour === 0) return min;
  if (hour === 12) {
    // bare "12" = noon by default (work logs almost never mean midnight); roll
    // to midnight next day only if the day has already moved past noon.
    const noon = 720 + min;
    return noon >= minBound ? noon : 1440 + min;
  }
  const am = (hour % 12) * 60 + min;
  const pm = ((hour % 12) + 12) * 60 + min;
  const cands = [am, pm].sort((a, b) => a - b);
  for (const c of cands) if (c >= minBound) return c;
  return cands[0];
}

// Resolve a break time to land inside the work-day window [dayStart, dayEnd].
function resolveWithin(hour, minute, meridiem, dayStart, dayEnd) {
  const min = minute || 0;
  if (meridiem) return resolveTime(hour, min, meridiem, 0);
  if (hour >= 13 && hour <= 23) return hour * 60 + min;
  const am = (hour % 12) * 60 + min;
  const pm = ((hour % 12) + 12) * 60 + min;
  const inWin = [am, pm].filter((c) => c >= dayStart && c <= dayEnd);
  if (inWin.length) return Math.min(...inWin);
  return am >= dayStart ? am : pm;
}

const MODULE_RULES = [
  // Testing & QA
  [/\btest(?:ing|s|ed)?|qa|quality\s+assurance|scenario|e2e|regression|unit\s+test\b/i, "TESTING"],
  // Bug work
  [/\bbug|fix(?:ing|ed)?|defect|issue|hotfix|patch\b/i, "BUG_FIXING"],
  // Meetings — subdivided for richer data
  [/\bstandup|stand-?up|daily\s+sync|scrum\s+call\b/i, "STANDUP_MEETING"],
  [/\bretro(?:spective)?\b/i, "RETROSPECTIVE"],
  [/\bsprint\s+(?:planning|review|grooming|kickoff)\b/i, "SPRINT_PLANNING"],
  [/\b1:1|one.on.one|1-on-1|manager\s+(?:call|sync|meeting)\b/i, "MANAGER_MEETING"],
  [/\bclient\s+(?:call|meeting|demo|presentation|sync)\b/i, "CLIENT_MEETING"],
  [/\bdemo\b|\bpresent(?:ation|ing)?\b/i, "DEMO"],
  [/\bmeet(?:ing|ings)?|sync|call\b/i, "MEETING"],
  [/\bcatch\s*up\b/i, "MEETING"],
  // Code work
  [/\breview|pr\b|pull\s+request\b/i, "CODE_REVIEW"],
  // DevOps — BEFORE deployment: 'kubernetes deployment' should be DEVOPS not DEPLOYMENT
  [/\bci\b|\bcd\b|pipeline|docker|kubernetes|k8s|infra\b/i, "DEVOPS"],
  [/\bdeploy|release|ship(?:ping|ped)?\b/i, "DEPLOYMENT"],
  [/\brefactor(?:ing)?\b/i, "REFACTORING"],
  [/\bintegrat(?:ion|ing|e)\b/i, "INTEGRATION"],
  // Research & Learning
  [/\bresearch|investigat|explore|spike|poc\b/i, "RESEARCH"],
  [/\blearn(?:ing)?|training|onboard(?:ing)?\b/i, "LEARNING"],
  // Documentation
  [/\bdoc(?:ument(?:ation|ing|ed)?)?|write-?up|readme\b/i, "DOCUMENTATION"],
  // Design
  [/\bdesign|architect(?:ure)?|wireframe|figma|mockup\b/i, "DESIGN"],
  // Backend / API
  [/\bapi|backend|server|endpoint|microservice\b/i, "API_DEVELOPMENT"],
  // Frontend / UI
  [/\bui|ux|frontend|front-end|component|css|html|react\b/i, "UI_DEVELOPMENT"],
  // Database
  [/\bdb|database|migration|sql|query\b/i, "DATABASE"],
  // Support
  [/\bsupport|on-?call|helpdesk|ticket\b/i, "SUPPORT"],
];

export function deriveModule(label) {
  for (const [re, mod] of MODULE_RULES) if (re.test(label)) return mod;
  return "GENERAL";
}

// Clean a raw label fragment into a short, readable task description.
function cleanLabel(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  // Strip leading separators first — the structured "TIME: description" format
  // leaves a leading ":" (e.g. ": Lunch Break") that would otherwise defeat the
  // ^-anchored break detector and let breaks slip through as work.
  s = s.replace(/^[\s:;,.\-–—]+/, "");
  // Drop leading connectors/fillers (whole words only — never cut mid-word).
  s = s.replace(/^(?:and|then|also|so|now|next|ok|okay|to|followed by|shifted to|moved to|spent|did|i|worked on|work on|working on|on|for|the|a|an|,|-|–|—)\b[\s,]*/i, "");
  // Strip Hinglish clock filler tokens that aren't part of the task.
  s = s.replace(/\b(?:baje|bje|tak)\b/gi, " ").replace(/\s+/g, " ").trim();
  // Drop a dangling trailing preposition/connector (e.g. "... AI module from", "... and").
  s = s.replace(/\b(?:from|at|for|to|on|in|and|then)\s*$/i, "").trim();
  s = s.replace(/[,;:.\-]+$/g, "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BREAK_LABEL_RE = /^(?:took |had |take |take a |i took |we took )?(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\b(?!-)/i;
// PURE break: the label is ONLY a break phrase (e.g. "lunch", "lunch break",
// "tea break") with nothing else. Distinct from BREAK_LABEL_RE so that a work
// block describing a separate break event ("Took a 15 min break at 10:30") is
// NOT mistaken for a break block.
const PURE_BREAK_RE = /^(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\s*$/i;

// Exposed so the hybrid extractor can re-flag a break the LLM mislabeled as
// work (defense-in-depth using the SAME tested logic).
export function isBreakLabel(text) {
  return PURE_BREAK_RE.test(String(text || "").trim());
}

export function parseWorkBlocks(message) {
  let text = String(message || "");
  if (!text.trim()) return { entries: [] };

  // 0) Normalize arrow-style range separators to " to " (Postel's law: accept
  // any reasonable format the user types). Handles → ⟶ ⟹ ➜ ▶ as well as the
  // ASCII forms -> --> => ==> ─>. Plain dashes (- – —) are already valid CONNs.
  text = text.replace(/\s*(?:-{1,2}>|={1,2}>|─+>|→|⟶|⟹|➜|▶|▸|»)\s*/g, " to ");

  // 1) Collect every range with its position.
  const ranges = [];
  let m;
  RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(text))) {
    ranges.push({
      index: m.index,
      end: m.index + m[0].length,
      sh: +m[1], sm: +(m[2] || 0), sMer: mer(m[3]),
      eh: +m[4], em: +(m[5] || 0), eMer: mer(m[6]),
    });
  }
  if (ranges.length === 0) return { entries: [] };

  // 2) Classify break-ranges: a break keyword sits in THIS range's OWN leading
  // clause (e.g. "lunch from 1 to 2"). We cut the lookback at clause boundaries
  // (comma/semicolon/period/newline) so a PREVIOUS block's break word
  // ("...1 to 2 lunch break, 2 to 4 testing") can't taint the next range.
  const breaks = [];
  for (const r of ranges) {
    const pre = text.slice(Math.max(0, r.index - 40), r.index).toLowerCase().split(/[,;.\n]/).pop();
    // A break keyword in the pre-text only flags THIS range when it isn't
    // trailing an EARLIER time in the same clause. In "12-1 lunch break 1-2
    // worked" (no comma), "lunch break" is 12-1's label, not 1-2's prefix — so
    // if a time appears before the break word here, skip pre-detection and let
    // the after-label PURE_BREAK check classify the real break block.
    const hasTimeBefore = /\d{1,2}(?::\d{2})?\s*(?:-|–|—|to|till|baje)/i.test(pre);
    r.isBreak = !hasTimeBefore && /\b(lunch|break|rest|tea)\b(?!-)/.test(pre); // (?!-) skips "break-fix"
  }
  const workRanges = ranges.filter((r) => !r.isBreak);

  // 3) Resolve work ranges left-to-right (ascending pointer).
  let pointer = 0;
  const work = [];
  for (const r of workRanges) {
    const start = resolveTime(r.sh, r.sm, r.sMer, pointer);
    let end = resolveTime(r.eh, r.em, r.eMer, start);
    if (end <= start) end += 1440; // overnight shift (e.g. 23:00 → 02:00 next day)
    pointer = end;
    work.push({ start, end, index: r.index, endIdx: r.end });
  }
  if (work.length === 0) return { entries: [] };

  const dayStart = Math.min(...work.map((w) => w.start));
  const dayEnd = Math.max(...work.map((w) => w.end));

  // 4) Break intervals: break-ranges resolved within the day window.
  for (const r of ranges.filter((r) => r.isBreak)) {
    const bs = resolveWithin(r.sh, r.sm, r.sMer, dayStart, dayEnd);
    let be = resolveWithin(r.eh, r.em, r.eMer, dayStart, dayEnd);
    if (be <= bs) be += 60;
    breaks.push([bs, be]);
  }
  // point breaks
  let pm2;
  BREAK_PT_A.lastIndex = 0;
  while ((pm2 = BREAK_PT_A.exec(text))) {
    const dur = +pm2[1];
    const t = resolveWithin(+pm2[2], +(pm2[3] || 0), mer(pm2[4]), dayStart, dayEnd);
    breaks.push([t, t + dur]);
  }
  BREAK_PT_B.lastIndex = 0;
  while ((pm2 = BREAK_PT_B.exec(text))) {
    const t = resolveWithin(+pm2[1], +(pm2[2] || 0), mer(pm2[3]), dayStart, dayEnd);
    const dur = +pm2[4];
    breaks.push([t, t + dur]);
  }

  // 5) Subtract breaks from each work block (splitting as needed).
  let pieces = work.map((w) => ({ start: w.start, end: w.end, index: w.index, endIdx: w.endIdx }));
  for (const [bs, be] of breaks) {
    const next = [];
    for (const p of pieces) {
      if (be <= p.start || bs >= p.end) {
        next.push(p); // break outside this piece
      } else {
        if (bs > p.start) next.push({ ...p, end: bs });
        if (be < p.end) next.push({ ...p, start: be });
      }
    }
    pieces = next;
  }
  pieces = pieces.filter((p) => p.end > p.start);

  // 6) Labels: a block's description runs from the END of its range to the START
  // of the NEXT range (the real block edge — robust to spacing/punctuation), so
  // full multi-word descriptions are kept. We stop only at a sentence boundary
  // (. ; newline) or a strong connector — NEVER at a comma (commas are part of
  // the description). A capped window guards against runaway length.
  const nextStart = (idx) => {
    let best = text.length;
    for (const r of ranges) if (r.index > idx && r.index < best) best = r.index;
    return best;
  };
  const prevEnd = (idx) => {
    let e = 0;
    for (const r of ranges) if (r.end <= idx && r.end > e) e = r.end;
    return e;
  };
  const SENT = /[.;\n]| then | followed by | shifted to | moved to | after that |\bthen\b/i;
  const MAX_DESC = 400;

  function labelFor(piece) {
    // AFTER: text until the next time range ("TIME description" format).
    const after = text
      .slice(piece.endIdx, Math.min(nextStart(piece.index), piece.endIdx + MAX_DESC))
      .split(SENT)[0];
    const lblA = cleanLabel(after);
    // This block's OWN label is purely a break ("1 to 2 lunch") → drop it; do
    // NOT let the previous block's text rescue it as work.
    if (lblA && PURE_BREAK_RE.test(lblA)) return lblA;
    if (lblA && !BREAK_LABEL_RE.test(lblA)) return lblA;

    // BEFORE: prose "description from TIME" — text since the previous range.
    const before = text.slice(prevEnd(piece.index), piece.index).split(SENT).pop();
    const lblB = cleanLabel(before);
    if (lblB && !BREAK_LABEL_RE.test(lblB)) return lblB;

    if (lblA && BREAK_LABEL_RE.test(lblA)) return lblA;
    if (lblB && BREAK_LABEL_RE.test(lblB)) return lblB;
    return "Work";
  }

  const entries = pieces
    .map((p) => {
      const label = labelFor(p);
      return {
        start_time: toHHMM(p.start),
        end_time: toHHMM(p.end),
        module_name: deriveModule(label),
        task_description: label,
        is_lunch: false,
      };
    })
    // Drop any block whose only description is a break phrase (e.g. trailing "tea break").
    .filter((e) => !BREAK_LABEL_RE.test(e.task_description) || e.task_description === "Work");

  return { entries };
}

// Lightweight intent hints so chat.js can route deterministically.
export function hasWorkTime(message) {
  RANGE_RE.lastIndex = 0;
  return RANGE_RE.test(String(message || ""));
}

// Best-effort entry-date extraction for the deterministic add path. Returns an
// ISO date string, or undefined (caller then defaults to today). Relative words
// are resolved against the IST-local date (UTC+5:30) so Indian users logging
// work at 11:30 PM IST correctly get TODAY's date, not yesterday's UTC date.
//
// WHY IST: Cloudflare Workers run in UTC. At 11:30 PM IST, UTC is 6:00 PM the
// SAME day, so UTC gives the correct date in that case. But at 00:30 AM IST
// (just after midnight), UTC is 7:00 PM the PREVIOUS day — so "aaj" would map
// to yesterday's UTC date. IST-offset fixes this for the 00:00–05:29 IST window.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export function parseEntryDate(message, now = new Date()) {
  // Shift `now` to IST-local time for relative date resolution.
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  const m = String(message || "").toLowerCase();
  // iso() always outputs YYYY-MM-DD from a UTC-perspective Date object.
  const iso = (dt) => dt.toISOString().slice(0, 10);
  // shift() moves days relative to the IST date, not UTC.
  const shift = (days) => {
    const x = new Date(nowIST);
    x.setUTCDate(x.getUTCDate() + days);
    return iso(x);
  };

  const explicit = m.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];
  if (/\b(day before yesterday|parso)\b/.test(m)) return shift(-2);
  if (/\b(yesterday|kal|kl)\b/.test(m)) return shift(-1);
  if (/\b(today|aaj|abhi)\b/.test(m)) return iso(nowIST); // IST-local today

  // "15 may" / "15th may" / "may 15"
  let dm = m.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  let day, mon;
  if (dm) { day = +dm[1]; mon = MONTHS[dm[2]]; }
  else {
    dm = m.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dm) { mon = MONTHS[dm[1]]; day = +dm[2]; }
  }
  if (day != null && mon != null && day >= 1 && day <= 31) {
    const y = nowIST.getUTCFullYear(); // use IST-local year
    const cand = new Date(Date.UTC(y, mon, day));
    // If that date is in the future, assume last year (logged work is past).
    if (cand > nowIST) cand.setUTCFullYear(y - 1);
    return iso(cand);
  }
  return undefined;
}
