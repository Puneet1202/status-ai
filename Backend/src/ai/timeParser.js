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
  [/\btest|qa|scenario\b/i, "TESTING"],
  [/\bbug|fix|defect|issue\b/i, "BUG_FIXING"],
  [/\bmeet|sync|standup|stand-up|scrum|sprint|demo|retro|grooming|huddle|call|1:1|catch ?up\b/i, "MEETING"],
  [/\breview|pr\b/i, "CODE_REVIEW"],
  [/\bdeploy|release|ship\b/i, "DEPLOYMENT"],
  [/\bresearch|investigat|explore|spike\b/i, "RESEARCH"],
  [/\bdoc|documentation|write-?up\b/i, "DOCUMENTATION"],
  [/\bdesign|architect\b/i, "DESIGN"],
  [/\bapi|backend|server\b/i, "API_DEVELOPMENT"],
  [/\bui|ux|frontend|front-end\b/i, "UI_DEVELOPMENT"],
  [/\bdb|database|migration|sql\b/i, "DATABASE"],
  [/\bsupport|on-?call\b/i, "SUPPORT"],
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
  // Brackets/parens too — "(9to11)\nReviewed…" leaves a leading ")" before the
  // description; "[9 to 11] testing" leaves "]". Strip them so the saved text is clean.
  s = s.replace(/^[\s:;,.()\[\]{}\-–—]+/, "");
  // Drop leading connectors/fillers (whole words only — never cut mid-word).
  // Includes Hinglish pronouns (maine/main/ne/humne/hum) so "maine interview liye"
  // → "interview liye" (then the trailing-filler pass below → "interview").
  s = s.replace(/^(?:and|then|also|so|now|next|ok|okay|to|followed by|shifted to|moved to|spent|did|i|worked on|work on|working on|on|for|the|a|an|main|mai|maine|mai ne|mene|ne|humne|hamne|hum|,|-|–|—)\b[\s,]*/i, "");
  // Strip Hinglish clock filler tokens that aren't part of the task.
  s = s.replace(/\b(?:baje|bje|tak)\b/gi, " ").replace(/\s+/g, " ").trim();
  // Drop dangling trailing prepositions/connectors AND Hinglish verb-fillers,
  // repeatedly (e.g. "code review kiya tha fr" → "code review kiya tha" → "…kiya"
  // → "code review"; "interview liye or" → "interview"). Loop until stable so a
  // chain of trailing fillers all peel off, not just the last one.
  let prev;
  do {
    prev = s;
    s = s.replace(/\b(?:from|at|for|to|on|in|and|then|or|aur|fr|phir|tha|thi|the|kiya|kia|kiye|ki|kar|kara|karaa|raha|rahi|rahe|liya|lia|liye|le|leke)\s*$/i, "").trim();
    s = s.replace(/[,;:.()\[\]{}\-]+$/g, "").trim();
  } while (s !== prev);
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BREAK_LABEL_RE = /^(?:took |had |take |take a |i took |we took )?(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\b(?!-)/i;
// PURE break: the label is ONLY a break phrase (e.g. "lunch", "lunch break",
// "tea break") with nothing else. Distinct from BREAK_LABEL_RE so that a work
// block describing a separate break event ("Took a 15 min break at 10:30") is
// NOT mistaken for a break block.
const PURE_BREAK_RE = /^(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\s*$/i;

// HINGLISH break detector. PURE_BREAK_RE only catches English-shaped labels
// ("lunch", "lunch break"); it MISSES Hinglish like "maine lunch kiya tha" /
// "khana khaya" because of the surrounding pronouns/verbs. Here we strip those
// filler words and, if ONLY a break keyword remains, call it a break. This is
// safe: "fixed lunch menu bug" keeps non-filler words (fixed/menu/bug) → NOT a
// break. Break words cover lunch/break/rest/tea/coffee + Hindi khana/bhojan/nashta.
const BREAK_WORDS = new Set(["lunch", "break", "rest", "tea", "coffee", "khana", "khaana", "khaya", "khaaya", "bhojan", "nashta", "naashta", "breakfast"]);
const BREAK_FILLERS = new Set([
  "maine", "main", "mai", "mein", "ne", "mene", "humne", "hamne", "hum",
  "kiya", "kia", "kiye", "ki", "kar", "kara", "karaa", "karne", "karna",
  "raha", "rahi", "rahe", "liya", "lia", "liye", "le", "leke",
  "tha", "thi", "the", "ka", "ke", "ko", "a", "an", "the",
  "i", "did", "was", "were", "had", "have", "took", "take", "taken", "my", "for", "on", "at",
]);
export function isHinglishBreakLabel(text) {
  const words = String(text || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const meaningful = words.filter((w) => !BREAK_FILLERS.has(w));
  // Must contain a break word AND have NO non-break meaningful words left.
  return meaningful.length > 0 && meaningful.every((w) => BREAK_WORDS.has(w));
}

// Exposed so the hybrid extractor can re-flag a break the LLM mislabeled as
// work (defense-in-depth using the SAME tested logic).
export function isBreakLabel(text) {
  const t = String(text || "").trim();
  return PURE_BREAK_RE.test(t) || isHinglishBreakLabel(t);
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
  let prevStart = null;
  const work = [];
  for (const r of workRanges) {
    let start = resolveTime(r.sh, r.sm, r.sMer, pointer);
    // OVERLAP-PRESERVE: a bare (no am/pm) start whose natural MORNING reading
    // lands INSIDE the previous block means the user gave overlapping times
    // (e.g. "9-11, 10-12"). Don't silently shove it to PM (10 → 22:00) — keep it
    // literal so the handler's overlap check flags it with a clear message,
    // instead of saving a wrong 22:00 block. A start that merely sits AFTER the
    // previous block (e.g. "2-5" after "11-1") is still bumped to PM as before.
    if (!r.sMer && prevStart != null) {
      const amStart = resolveTime(r.sh, r.sm, r.sMer, 0);
      if (amStart >= prevStart && amStart < pointer) start = amStart;
    }
    let end = resolveTime(r.eh, r.em, r.eMer, start);
    if (end <= start) end += 1440; // overnight shift (e.g. 23:00 → 02:00 next day)
    prevStart = start;
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
  // A block's description runs to the NEXT time range (already bounded by
  // nextStart), so it may span several LINES and sentences — common when users put
  // the time on one line and the description on the lines below it. We therefore
  // join newlines into spaces and split ONLY at an explicit "new activity"
  // connector (then / followed by / moved to), NOT at '.' or newline (which used
  // to truncate multi-line descriptions to empty → wrong text from history).
  const ACTIVITY_CONN = / then | followed by | shifted to | moved to | after that |\bthen\b/i;
  const MAX_DESC = 400;
  const flat = (s) => String(s || "").replace(/\s*\n\s*/g, " ");

  function labelFor(piece) {
    // AFTER: text until the next time range ("TIME\n description..." or "TIME desc").
    const after = flat(text.slice(piece.endIdx, Math.min(nextStart(piece.index), piece.endIdx + MAX_DESC))).split(ACTIVITY_CONN)[0];
    const lblA = cleanLabel(after);
    // This block's OWN label is purely a break ("1 to 2 lunch") → drop it; do
    // NOT let the previous block's text rescue it as work.
    if (lblA && PURE_BREAK_RE.test(lblA)) return lblA;
    if (lblA && !BREAK_LABEL_RE.test(lblA)) return lblA;

    // BEFORE: prose "description from TIME" — text since the previous range.
    const before = flat(text.slice(prevEnd(piece.index), piece.index)).split(ACTIVITY_CONN).pop();
    const lblB = cleanLabel(before);
    if (lblB && !BREAK_LABEL_RE.test(lblB)) return lblB;

    if (lblA && BREAK_LABEL_RE.test(lblA)) return lblA;
    if (lblB && BREAK_LABEL_RE.test(lblB)) return lblB;
    return "Work";
  }

  const entries = pieces
    .map((p) => {
      const label = labelFor(p);
      // is_lunch: English ("lunch") OR Hinglish ("maine lunch kiya tha") break →
      // flagged here, dropped by the add handler. Reliable lunch-skip in both langs.
      const isBreak = BREAK_LABEL_RE.test(label) || isHinglishBreakLabel(label);
      return {
        start_time: toHHMM(p.start),
        end_time: toHHMM(p.end),
        module_name: deriveModule(label),
        task_description: label,
        is_lunch: isBreak,
      };
    })
    // Drop any block whose only description is a break phrase (English or Hinglish).
    .filter((e) => !(BREAK_LABEL_RE.test(e.task_description) || isHinglishBreakLabel(e.task_description)) || e.task_description === "Work");

  return { entries };
}

// Lightweight intent hints so chat.js can route deterministically.
export function hasWorkTime(message) {
  RANGE_RE.lastIndex = 0;
  return RANGE_RE.test(String(message || ""));
}

// Best-effort entry-date extraction for the deterministic add path. Returns an
// ISO date string, or undefined (caller then defaults to today). Relative words
// are resolved against `now` (UTC), matching the backend's todayISO().
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// GLOBAL date-format: company India + US dono me hai. US ke users numeric dates
// MONTH-FIRST likhte hai (05-20-2026); India/Europe/baaki sab DAY-FIRST
// (20-05-2026). Frontend har request me user ka IANA timezone bhejta hai — usi
// se PER-USER decide hota hai, koi country hardcode nahi. (US tz = America/* ya
// Pacific/Honolulu; company ke context me yahi kaafi hai.)
export function isMonthFirstTz(timeZone) {
  return /^(America\/|Pacific\/Honolulu|US\/)/.test(String(timeZone || ""));
}

// Numeric date "A-B-YYYY" ko resolve karo: jo number 12 se bada hai wo PAKKA din
// hai (ambiguity hi nahi); dono ≤12 ho tab user ke locale (monthFirst) se decide.
export function resolveNumericDate(a, b, year, monthFirst = false) {
  let dd, mo;
  if (a > 12 && b <= 12) { dd = a; mo = b; }        // 20-05 → 20 May (har jagah)
  else if (b > 12 && a <= 12) { mo = a; dd = b; }   // 05-20 → 20 May (har jagah)
  else { dd = monthFirst ? b : a; mo = monthFirst ? a : b; } // 05-06 → locale se
  if (dd < 1 || dd > 31 || mo < 1 || mo > 12) return null;
  return `${year}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseEntryDate(message, now = new Date(), monthFirst = false) {
  const m = String(message || "").toLowerCase();
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const shift = (days) => { const x = new Date(now); x.setUTCDate(x.getUTCDate() + days); return iso(x); };

  const explicit = m.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];

  // Numeric date: "20-05-2026" / "05/20/2026" / "20 - 05 - 2026" — locale-aware.
  const dmy = m.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(20\d{2})\b/);
  if (dmy) {
    const d = resolveNumericDate(+dmy[1], +dmy[2], dmy[3], monthFirst);
    if (d) return d;
  }
  if (/\b(day before yesterday|parso)\b/.test(m)) return shift(-2);
  if (/\b(yesterday|kal|kl)\b/.test(m)) return shift(-1);
  if (/\b(today|aaj|abhi)\b/.test(m)) return iso(now);

  // "15 may" / "15th may" / "may 15"
  let dm = m.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  let day, mon;
  if (dm) { day = +dm[1]; mon = MONTHS[dm[2]]; }
  else {
    dm = m.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dm) { mon = MONTHS[dm[1]]; day = +dm[2]; }
  }
  if (day != null && mon != null && day >= 1 && day <= 31) {
    const y = now.getUTCFullYear();
    const cand = new Date(Date.UTC(y, mon, day));
    // If that date is in the future, assume last year (logged work is past).
    if (cand > now) cand.setUTCFullYear(y - 1);
    return iso(cand);
  }
  return undefined;
}
