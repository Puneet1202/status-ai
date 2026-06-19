// FILE: backend/src/ai/chat.js
// V20 PRODUCTION — SINGLE ROUND-TRIP | SLIDING-WINDOW MEMORY | REGISTRY DISPATCH
//
// One LLM call decides intent + extracts args via native tool calling. There is
// NO raw-SQL path anymore (removed: data-exfiltration risk + 2 extra LLM hops).
// All reads/writes flow through parameterized tools in ./tools/*.

import { askCloudflareAI } from './providers/cloudflare.js';
import { getSystemPrompt, getCasualPrompt } from './tools.js';
import { getToolSchemas } from './tools/index.js';
import { parseEntryDate, isMonthFirstTz, resolveNumericDate } from './timeParser.js';
import { extractWorkBlocks } from './blockExtractor.js';
import { todayISO } from './tools/_helpers.js';
import { MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS, MAX_HISTORY_MESSAGES, getFastModel, FAST_TIMEOUT_MS, isBrainEnabled, requireTask } from './ai-config.js';
import { routeWithBrain } from './brainRouter.js';
import { traceRoute } from './trace.js';

// =========================================================================
// 🎯 DETERMINISTIC INTENT HINTS
// Used to decide when we can settle a turn in code (reliable) vs. hand it to
// the flaky model. Add is the hot path → parsed deterministically below.
// =========================================================================
const DELETE_INTENT = /\b(delete|remove|erase|discard|hata do|mita do)\b/i;
// Conservative on purpose: only fire on phrases that clearly mean "edit an
// EXISTING logged entry" — NOT common work verbs like "fix"/"change" which
// appear in normal descriptions ("9-10 fix the ui bugs" is an ADD, not an edit).
const UPDATE_INTENT = /\b(?:update|edit|correct|modify)\s+(?:the |my |that |previous |last )?(?:entry|entries|time|timing|log|logs|record|timesheet|slot)\b|\bactually it was\b|\bmade a mistake\b|\bwrong (?:time|entry|slot)\b|\bgalti se (?:add|log|likh)|\bsahi kar ?do\b|\bsahi karo\b|\bchange (?:that|it|this) to\b|\bcorrect (?:it|that|this)\b|\bthat(?:'s| was| is)? wrong\b|\bbadal ?do\b|\bupdate kar ?do\b/i;
// Read-intent signals that keep an obvious history query from being parsed as an
// add. Split in two so a work NOUN never hijacks a time-log:
//  • HARD_GET — explicit query verbs that never appear inside a work description.
//  • SOFT_GET — words that DOUBLE as work nouns ("9 se 11 report banayi"). These
//    mean "show me" ONLY when there's no time block; with a time block present
//    they're part of the logged work. (They still gate the model via GET_INTENT.)
const HARD_GET = /\b(show|list|view|fetch|display|history|how many|how much|kitne|kitna|total hours|fetch my|my logs)\b/i;
const SOFT_GET = /\b(report|summary)\b/i;
// Broad signal — used only to gate the model's get_timesheet call (anti-hallucination).
const GET_INTENT = /\b(show|list|view|fetch|display|history|report|summary|total|how many|how much|kitne|kitna|logged|my hours|my entries|dikhao|dikhana|dikhaiye|batao|recent|latest|aakhri|this week|last week|this month|last month|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/i;

// Aggregate/breakdown signals (totals, per-X, monthly, busiest, a year). Module-
// scope so the deterministic analytics path can run BEFORE the brain (token-free
// breakdown chips) AND as the brain-disabled fallback below.
// NOTE: a BARE year is intentionally NOT an analytics signal — "march 2026" is a
// month READ, not a year total. A year only widens the range INSIDE an analytics
// query that already has a real signal (e.g. "hours per project 2026").
const ANALYTICS_INTENT = /\bbreak\s?downs?\b|\b(?:per|each|by|wise)\s*(?:projects?|month|module|categor\w+|year|day)\b|\b(?:projects?|month|module|year|day)\s*wise\b|\bmonthly\b|\byearly\b|\bwhich\s+(?:project|month|module|year|day)\b|\bmost\s+(?:hours|time|productive)\b|\bbusiest\b|\baverage\b|\bavg\b|\bcompare\b|\bversus\b|\bvs\b|\bthis year\b|\blast year\b|\bhar\s+(?:project|mahin[ae]|din|saal)\b|\bkis project\b|\bsabse\s+(?:zyada|kam)\b|\boverall\b|\ball[\s-]?time\b/i;
// Comparison/leaderboard signals need the brain (it sets compare_employees for
// org-viewers). Keep these OUT of the early deterministic short-circuit.
const COMPARE_SIGNAL = /\bcompare\b|\bversus\b|\bvs\b|\bsabse\s+(?:zyada|kam)\b|\bwho\s+worked\b|\bleaderboard\b|\bkisne\b/i;

// Deterministic "show my recent/last entries" read — reliable, no LLM. Fires only
// for a clear recent-history phrase that has NO time block (so it can never catch
// an ADD) and isn't a delete/update. Handles "last entry", "last log dikhao",
// "aakhri entries", "recent kaam", "last enter".
const RECENT_WORD = /\b(last|recent|latest|aakhri|akhri|pichl[ae]|previous)\b/i;
// Tolerant of misspellings (entrie/enterie/loggs) — real users mistype the noun.
const ENTRY_WORD = /\b(entr\w*|logs?|enter\w*|timesheet|status|kaam|work)\b/i;
// Read verbs/nouns + period words for the deterministic date-range read below.
const GET_VERB = /\b(show|list|view|display|fetch|give|gimme|get|dikhao|dikhana|dikhaiye|batao|de ?do|how many|how much|kitne|kitna)\b/i;
const GET_NOUN = /\b(logs?|entr(?:y|ies)|timesheet|tasks?|hours|ghante|kaam|work|total)\b/i;
const PERIOD = /\b(today|aaj|yesterday|kal|kl|parso|this week|last week|this month|last month|weekly|monthly|day before yesterday)\b|\bis haft|\bpichl[ae] haft|\bis mah|\bpichl[ae] mah|\d+\s*(?:days?|din)\s*(?:ago|pehle|pahle)|\d{4}-\d{2}-\d{2}/i;

// A specific time block ("9 se 11", "9-11", "9am") signals LOGGING, not a query.
// NOTE: pehle numeric DATEs hata do — "20-05-2026" ek DATE hai (4-digit year ke
// saath kabhi time-range nahi ho sakta), warna "20 - 05" ko 20:00→05:00 samajh
// kar date-search bhi work-log ban jata tha (project maangta, read skip hota).
const NUMERIC_DATE_RE = /\b\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*(?:20\d{2}|\d{2})\b/g;
// ISO dates too ("2026-05-01 to 2026-05-31") — a date RANGE is not a time block.
// Strip them first so "...01 to 2026..." isn't misread as a 01→2026 time range
// (this is what made the date-range breakdown/list chips skip the deterministic path).
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
function looksLikeTimeBlock(text) {
    const t = String(text || '').replace(ISO_DATE_RE, ' ').replace(NUMERIC_DATE_RE, ' ');
    // to/se/till are NOT \b-anchored: users glue them ("9to11", "9se11", "(9to11)").
    // The required leading \d and trailing \d keep this from matching inside words.
    return /\d{1,2}\s*(?::\d{2})?\s*(?:[-–—]|→|to|se|till)\s*\d/i.test(t)
        || /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)\b/i.test(t);
}

// ── AM/PM AMBIGUITY — ask (via chips) ONLY when genuinely unsure ─────────────
// A bare hour like "4 to 5" could mean 04:00 OR 16:00. When the message has
// EXACTLY ONE time range whose START hour is 1–7 written WITHOUT any am/pm (and no
// other clock hint), we can't know which is meant — so instead of guessing (and
// saving the wrong time) we offer two chips ("4 AM" / "4 PM") that RE-SEND the same
// message with an explicit meridiem. Clear inputs are NOT ambiguous → no question:
//   • 8–12 (morning) and 13–23 (already 24-hour)         → not asked
//   • "04 to 05" (leading zero = explicit 24-hour)        → not asked
//   • "6pm", "6 baje", "18:00"                            → not asked
//   • break-word messages (lunch/break follow-ups)        → not asked
// Returns { hour, amValue, pmValue } or null.
function ambiguousAmPm(message) {
    // Numeric/ISO DATES pehle hata do — "3-06-2026" ek date hai, time-range nahi.
    // Warna "3-06" ko "3 to 6" samajh kar AM/PM puchne lagta tha ("check status
    // 3-06-2026" pe). Stripping = wahi guard jo looksLikeTimeBlock me hai.
    const text = String(message || '').replace(ISO_DATE_RE, ' ').replace(NUMERIC_DATE_RE, ' ');
    if (/\b(lunch|break|rest|tea|khana|khaana|nashta|naashta)\b/i.test(text)) return null;
    if (/\d\s*(?:am|pm|a\.?m\.?|p\.?m\.?|baje|o.?clock|noon|midnight)\b/i.test(text)) return null;
    const RE = /(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|to|till|se)\s*(\d{1,2})(?::(\d{2}))?/gi;
    const matches = [...text.matchAll(RE)];
    if (matches.length !== 1) return null; // only the simple single-range case
    const mm = matches[0];
    if (mm[1].length === 2 && mm[1][0] === '0') return null; // "04" = explicit 24-hour
    const h1 = +mm[1];
    if (h1 < 1 || h1 > 7) return null; // 8–12 morning / 13–23 already 24h → not ambiguous
    const m1 = mm[2] ? `:${mm[2]}` : '';
    const m2 = mm[4] ? `:${mm[4]}` : '';
    const h2 = mm[3];
    const before = text.slice(0, mm.index);
    const tail = text.slice(mm.index + mm[0].length);
    return {
        hour: h1,
        amValue: `${before}${h1}${m1}am to ${h2}${m2}am${tail}`.replace(/\s+/g, ' ').trim(),
        pmValue: `${before}${h1}${m1}pm to ${h2}${m2}pm${tail}`.replace(/\s+/g, ' ').trim(),
    };
}

// =========================================================================
// 🔗 MULTI-TURN DESCRIPTION CARRY
// When a follow-up message is basically just a time ("9 to 11"), the parsed
// description is thin ("Work"). Borrow the real description from the user's
// previous intent message ("today I worked on the dashboard" → "9 to 11").
// =========================================================================
const THIN_DESC = /^(work|work update|task|stuff)$/i;
const isThinDesc = (d) => !d || THIN_DESC.test(d.trim()) || d.trim().split(/\s+/).length < 2;

function cleanPrevDesc(text) {
    const s = String(text || '')
        .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)?\s*(?:to|till|-|–|—|→|se)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ')
        .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)\b/gi, ' ')
        .replace(/\b(today|yesterday|aaj|kal|abhi|now)\b/gi, ' ')
        .replace(/^\s*(i have|i've|i|so|and|then|maine|me ne)\b/i, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return s.split(/\s+/).filter(Boolean).length >= 2 ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

// A prior message we must NEVER borrow a work-description from: read/query/command/
// meta turns ("show my entries for today", "delete that", "what can you do"). These
// are not descriptions of work — borrowing from them saved garbage like
// "Show my entries for" as the task. Only real prose descriptions are eligible.
const NON_DESC_PREV = /\b(show|list|view|fetch|display|history|delete|remove|erase|update|edit|correct|modify|how many|how much|kitne|kitna|total|report|summary|dikhao|dikhana|batao|entries|entry|logs?|timesheet|help|what can|recent|latest|aakhri|last\s+\d|my (?:hours|entries|logs|tasks|projects))\b/i;

function enrichThinDescriptions(entries, history) {
    if (!entries.length || !entries.every((e) => isThinDesc(e.task_description))) return;
    // Boss rule: jo user ne likha WAHI save ho (meaning ho ya na ho). So when the
    // time-only turn ("9 to 11") has no description, borrow the user's IMMEDIATELY
    // previous message verbatim — even 1 word / gibberish ("awedrfghjk" → that text).
    // Only skip it when that prior message is itself a time-log (starts with a digit),
    // a question, or a read/command/meta query — those aren't work descriptions.
    const prevUser = [...history].reverse().find(
        (h) => h && h.role === 'user' && typeof h.content === 'string' && h.content.trim()
    );
    if (!prevUser) return;
    const raw = prevUser.content.trim();
    // Skip when the prior message isn't a work description: a time-log (starts with a
    // digit), a question, a read/command/meta query, OR a bare GREETING / ack
    // ("hey", "hello", "thanks", "ok") — none should become the saved task text.
    const GREETING_ONLY = /^\s*(h+e+l+o+|h+e+l+l+o+|h+i+|h+e+y+|hlo+|hlw+|helo+|hii+|yo+|namaste|hola|thanks?|thank\s*you|thankyou|thx|ty|ok(?:ay)?|cool|nice|great|good|gm|gn|good\s*(?:morning|night|evening|afternoon))\s*[!.?]*$/i;
    if (/^\s*\d/.test(raw) || /\?\s*$/.test(raw) || NON_DESC_PREV.test(raw) || GREETING_ONLY.test(raw)) return;
    // Prefer the cleaned prose (strips stray time/date words); if cleaning leaves
    // nothing (e.g. a single gibberish token), keep the raw text as-is so the user's
    // literal input is what gets saved.
    const desc = cleanPrevDesc(raw) || (raw.length <= 80 ? raw.charAt(0).toUpperCase() + raw.slice(1) : null);
    if (desc) entries.forEach((e) => { if (isThinDesc(e.task_description)) e.task_description = desc; });
}

// =========================================================================
// 🛡️ Stack-based deterministic JSON parser — defense-in-depth for the rare
// case where tool-call arguments come back truncated/with trailing noise.
// =========================================================================
function safeParseArgs(raw) {
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        const start = raw.indexOf('{');
        if (start === -1) throw new Error("Tool args: no JSON object boundary found.");
        let depth = 0, end = -1;
        for (let i = start; i < raw.length; i++) {
            if (raw[i] === '{') depth++;
            else if (raw[i] === '}' && --depth === 0) { end = i; break; }
        }
        if (end === -1) throw new Error("Tool args: malformed unclosed bracket structure.");
        return JSON.parse(raw.slice(start, end + 1));
    }
}

// =========================================================================
// 🩹 SALVAGE a text tool-call dump. Some models DESCRIBE the call in plain text
// (raw `{"type":"function","name":"add_timesheet_entries",...}`) instead of
// emitting a real tool_call — that JSON would leak to the user AND nothing would
// be saved. Pull the add args out so we run them instead. Returns an
// { name, data } action, or null when there's nothing salvageable. Reused on BOTH
// the fast conversational path and the tool round-trip, so a leak on either is caught.
// =========================================================================
function salvageTextToolCall(textOut) {
    if (typeof textOut !== "string" || !/add_timesheet_entries|"type"\s*:\s*"function"/i.test(textOut)) return null;
    try {
        const parsed = safeParseArgs(textOut);
        const data = parsed?.parameters || parsed;
        if (data && Array.isArray(data.entries) && data.entries.length > 0) {
            return { name: "add_timesheet_entries", data };
        }
    } catch { /* not a salvageable dump → caller shows a clean hint */ }
    return null;
}

// =========================================================================
// 💬 SMALL-TALK GATE (lightweight heuristic, NOT business logic)
// The 70B model is unreliable at NOT firing a tool on greetings (it
// hallucinates a date range and calls get_timesheet on "hey"). This gate ONLY
// decides "is this a social turn?" — the actual reply is still written by the
// model (see aiChat), just with tools detached so it can't make a bad call.
// Conservative on purpose: ANY digit or work/CRUD keyword opts out, so real
// work never lands here; and if the gate ever misses, the model still answers.
// =========================================================================
const WORK_SIGNAL = /(\d|log|hour|hrs|worked|work on|kaam|task|project|delete|remove|update|change|edit|show|list|report|status|entry|entries|timesheet|break|lunch|shift|am\b|pm\b)/i;

// Typo-tolerant GREETING matcher. Real users mistype hi/hey/hello a LOT —
// "hlo", "hlw", "hloooo", "hlww", "hyy", "helo". Without this they fell through to
// the BRAIN (tokens + no quick-chips), so greetings behaved inconsistently. The
// hl+[ow]+ branch covers the whole hello/hlo/hlw family; h[iy]+ covers hi/hii/hy/hyy.
const GREETING_RE = /^(?:h+(?:i+|e+y+|ay+|ello+|elo+|lo+|lw+|llo+)|h[iy]+|hl+[ow]+|hey+|hii+|hello+|helo+|namaste|hola|yo+|hye|hy+|sup|wassup|whats? ?up)$/i;

function isSmallTalk(message) {
    const m = message.toLowerCase().trim().replace(/[!.,?]+$/g, '').trim();
    if (!m || m.length > 40) return false;
    if (WORK_SIGNAL.test(m)) return false; // any work signal → let the AI handle it

    return (
        GREETING_RE.test(m) ||
        /^good ?(morning|afternoon|evening|night|day)$/.test(m) ||
        /^(thanks|thank ?you|thank ?u|thx|tysm|ty|shukriya|dhanyavaad)$/.test(m) ||
        /^how ?(are|r) ?(you|u|ya|things)/.test(m) ||
        /^(kaise|kese) ?ho/.test(m) ||
        /^(ok+|okay|kk?|cool|nice|great|awesome|perfect|got it|fine|alright|acha)$/.test(m) ||
        /^(bye+|goodbye|see ?ya|cya|tata|gn|good ?night)$/.test(m)
    );
}

// A greeting / "what can you do" turn (vs thanks/ok/bye) — these get quick-action
// chips so a new user instantly sees what to tap, no typing needed.
function isGreeting(message) {
    const m = String(message || '').toLowerCase().trim().replace(/[!.,?]+$/g, '').trim();
    return (
        GREETING_RE.test(m) ||
        /^good ?(morning|afternoon|evening|day)$/.test(m) ||
        /^(kaise|kese) ?ho/.test(m) ||
        /\b(help|what can (you|u) do|kya kar sakte|options|menu)\b/.test(m)
    );
}

// One-tap starters shown with a greeting — the common things a user wants,
// including LOG (add) and FIND (filter) helpers.
function quickActionChips() {
    return {
        options: [
            { label: "📝 Add entry", value: "how do i add an entry" },
            { label: "🔎 Find entry", value: "how do i find an entry" },
            { label: "📊 Total hours", value: "show my total hours" },
            { label: "📅 Last month", value: "show last month entries" },
        ],
        optionsTitle: "Quick start — tap one:",
    };
}

// "How to add" help — just the format + the required steps (no time-slot chips:
// tapping a bare time logged a half-formed entry, so we keep it text-only).
function addHelpReply() {
    return {
        reply:
            "📝 To log work, type the time + what you did — e.g.\n" +
            "   \"9 to 11 fixed the login bug\"\n\n" +
            "1) Type @ to pick a project\n" +
            "2) Select at least one task — this is required, or it won't submit\n" +
            "3) Type the time + what you did, then press Enter\n\n" +
            "⏱️ Each entry can be at most 2 hours (2 hours or less). Split longer work into 2-hour blocks — e.g. \"9 to 11\" then \"11 to 1\".",
    };
}

// "How to find" help — shows filter examples as one-tap chips.
function findHelpReply() {
    return {
        reply:
            "🔎 You can filter your entries lots of ways:\n" +
            "   • by keyword — \"AI tasks\", \"testing work\"\n" +
            "   • by time — \"morning entries\", \"before 10am\"\n" +
            "   • by length — \"tasks over 2 hours\"\n" +
            "   • by date — \"last month\", \"June\", \"2026-05-26\"",
        options: [
            { label: "📅 This month", value: "show this month entries" },
            { label: "🌅 Morning entries", value: "morning entries this month" },
            { label: "⏱️ Over 2 hours", value: "tasks over 2 hours this month" },
            { label: "🕘 Recent entries", value: "show my last 5 entries" },
        ],
        optionsTitle: "Try one:",
    };
}

// Deterministic small-talk reply — NO model call, so greetings are instant and
// can NEVER hit WORKERS_AI_TIMEOUT. Picks a friendly line based on the category.
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function cannedSmallTalkReply(message) {
    const m = message.toLowerCase().trim().replace(/[!.,?]+$/g, '').trim();

    if (/^(thanks|thank ?you|thank ?u|thx|tysm|ty|shukriya|dhanyavaad)/.test(m))
        return pick(["You're welcome! 😊 Anything else to log?", "Anytime! 👍 Want to log more hours?"]);
    if (/^(bye+|goodbye|see ?ya|cya|tata|gn|good ?night)/.test(m))
        return pick(["See you! 👋 Have a great one.", "Bye! 👋 Come back anytime to log your hours."]);
    if (/^how ?(are|r) ?(you|u|ya|things)/.test(m) || /^(kaise|kese) ?ho/.test(m))
        return pick(["I'm good, thanks! 😊 Ready whenever you want to log some hours.", "Doing great! 😊 Tell me a time and task and I'll log it."]);
    if (/^(ok+|okay|kk?|cool|nice|great|awesome|perfect|got it|fine|alright|acha)/.test(m))
        return pick(["👍 Want me to log some hours? Just tell me the time and the task.", "Cool! 😊 Send a time + task whenever you're ready, e.g. \"9-11 fixed login bug\"."]);
    if (/^good ?(morning|afternoon|evening|night|day)/.test(m))
        return pick(["Good day! 👋 Want to log some hours?", "Hello! 😊 Tell me what you worked on and when."]);
    // default: greeting
    return pick([
        "Hey! 👋 Want to log some hours? Just tell me the time and what you worked on.",
        "Hi there! 😊 Send a time + task, e.g. \"9 to 11 fixed login bug\", and I'll log it.",
        "Hello! 👋 Ready when you are — just give me a time and the task.",
    ]);
}

// =========================================================================
// 🧠 SHORT-TERM WORKING MEMORY — sliding window of the last N messages.
// Keeps the model context-aware without blowing the token budget.
// =========================================================================
// Model ko badi entry-dumps yaad rakhne ki zaroorat nahi — usse sirf "kya karna
// hai" decide karna hai, 20 entries ki full detail nahi chahiye. Large assistant
// replies (> 400 chars) ko ek short summary se replace karo history mein taaki
// input tokens kam ho. User UI pe full dekh sakta hai, model ko sirf context mile.
const HISTORY_ASSISTANT_CAP = 400;
function trimForHistory(content, role) {
    if (role !== 'assistant') return content;
    const c = String(content || '').trim();
    if (c.length <= HISTORY_ASSISTANT_CAP) return c;
    // Keep first 300 chars (the key reply/action info) + a note that it was trimmed.
    return c.slice(0, 300).trimEnd() + ' … [response truncated for context]';
}

function buildSlidingWindow(history) {
    let safe = (Array.isArray(history) ? history : [])
        .filter(h => h && typeof h.content === 'string' && h.content.trim())
        .slice(-MAX_HISTORY_MESSAGES);

    let total = safe.reduce((s, h) => s + h.content.length, 0);
    while (total > MAX_TOTAL_CHARS && safe.length > 1) {
        total -= safe[0].content.length;
        safe = safe.slice(1);
    }
    return safe.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: trimForHistory(h.content, h.role === 'assistant' ? 'assistant' : 'user'),
    }));
}

// A Date anchored to NOON UTC of the user's LOCAL date. Anchoring at noon (not
// midnight) keeps ±1-day relative math (yesterday/parso) free of any rollover,
// and iso(thisDate) still equals the user's real local date. This is what makes
// "kal"/"yesterday" resolve correctly for a night-shift user in any timezone.
function nowInTz(timeZone) {
    return new Date(`${todayISO(timeZone)}T12:00:00Z`);
}

// Resolve a natural-language period ("today"/"aaj", "this week"/"is hafte",
// "last month", an ISO date) into a {from_date, to_date} range. No period found →
// {recent:true} so the caller shows the most recent entries. `base` is noon-UTC of
// the user's LOCAL date (see nowInTz) so ±day/week/month math never rolls across a
// timezone edge. This is what makes the common GET queries as reliable as ADD.
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

const MONTHS_MAP = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

function parseGetRange(message, base, monthFirst = false) {
    const m = String(message || '').toLowerCase();
    const today = isoDate(base);

    // TWO ISO dates = an explicit range ("from 2026-03-01 to 2026-03-31", the
    // month-drill chips). ONE ISO date = that single day.
    const isoAll = m.match(/\b\d{4}-\d{2}-\d{2}\b/g);
    if (isoAll && isoAll.length >= 2) return { from_date: isoAll[0], to_date: isoAll[1] };
    if (isoAll && isoAll.length === 1) return { from_date: isoAll[0], to_date: isoAll[0] };

    // Numeric date: "20-05-2026" (India, day-first) / "05/20/2026" (US, month-first)
    // — user ke TIMEZONE se decide hota hai (global company: India + US dono).
    // Explicit date period-words ("last month") ko BEAT karta hai — user ne exact
    // din diya hai to wahi chahiye.
    const dmy = m.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(20\d{2})\b/);
    if (dmy) {
        const d = resolveNumericDate(parseInt(dmy[1], 10), parseInt(dmy[2], 10), dmy[3], monthFirst);
        if (d) return { from_date: d, to_date: d };
    }

    // "N days ago" / "N din pehle" → that exact past day.
    const ago = m.match(/\b(\d+)\s*(?:days?|din)\s*(?:ago|pehle|pahle|purane?)\b/);
    if (ago) { const d = isoDate(addDays(base, -Math.abs(parseInt(ago[1], 10)))); return { from_date: d, to_date: d }; }
    // day before yesterday / parso → 2 days back.
    if (/\bday before yesterday\b|\bparso\b/.test(m)) { const d = isoDate(addDays(base, -2)); return { from_date: d, to_date: d }; }

    // Period words are typo-tolerant on purpose — real users mistype ("yeaterday",
    // "lasst wek"). We accept common misspellings so a date query never silently
    // falls back to "recent" just because of a slip.
    if (/\b(?:yesterday|yeaterday|yestrday|yesterdy|yesteday|ysterday|yestarday|yestreday)\b|\bkal\b|\bkl\b/.test(m)) { const y = isoDate(addDays(base, -1)); return { from_date: y, to_date: y }; }
    if (/\b(?:today|todai|tody|tday|todey)\b|\baaj\b|\babhi\b/.test(m)) return { from_date: today, to_date: today };

    const monThisWeek = addDays(base, -((base.getUTCDay() + 6) % 7)); // Monday of this week
    if (/\b(?:last|lasst|laast|lst)\s+(?:week|wek|weak|weeek|wek)\b|\bpichl[ae] haft/.test(m)) {
        return { from_date: isoDate(addDays(monThisWeek, -7)), to_date: isoDate(addDays(monThisWeek, -1)) };
    }
    if (/\b(?:this|dis)\s+(?:week|wek|weak|weeek)\b|\bis haft|\bweekly\b/.test(m)) {
        return { from_date: isoDate(monThisWeek), to_date: today };
    }

    const firstThisMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12));
    if (/\b(?:last|lasst|laast|lst)\s+(?:month|munth|montth|mnth)\b|\bpichl[ae] mah/.test(m)) {
        const end = addDays(firstThisMonth, -1);
        const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 12));
        return { from_date: isoDate(start), to_date: isoDate(end) };
    }
    if (/\b(?:this|dis)\s+(?:month|munth|montth|mnth)\b|\bis mah|\bmonthly\b/.test(m)) {
        return { from_date: isoDate(firstThisMonth), to_date: today };
    }

    // SPECIFIC DAY with a month NAME — "4 june 2026", "4 jun", "june 4",
    // "june 4th, 2026". This is ONE date, so it MUST beat the whole-month block
    // below (which wrongly returned all of June for "from 4 june 2026"). If the
    // phrase is OPEN-ENDED ("from/since/after <date>" with no closing to/till/
    // before), return [date → today]; otherwise the single day.
    {
        // Collect EVERY "DD month [YYYY]" and "month DD[, YYYY]" occurrence (in order)
        // so a named-date RANGE ("4 june to 10 june 2026") resolves to both ends, not
        // just the first. A trailing year applies to any date that didn't carry one.
        const hits = [];
        let mm;
        const dmRe = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b(?:\\s*,?\\s*(20\\d{2}))?`, 'gi');
        while ((mm = dmRe.exec(m))) hits.push({ pos: mm.index, dd: parseInt(mm[1], 10), mo: MONTHS_MAP[mm[2].toLowerCase()], yy: mm[3] });
        const mdRe = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(20\\d{2}))?`, 'gi');
        while ((mm = mdRe.exec(m))) hits.push({ pos: mm.index, dd: parseInt(mm[2], 10), mo: MONTHS_MAP[mm[1].toLowerCase()], yy: mm[3] });

        const valid = hits.filter((h) => h.dd >= 1 && h.dd <= 31 && h.mo != null)
            .sort((a, b) => a.pos - b.pos)
            .filter((h, i, arr) => i === 0 || h.pos !== arr[i - 1].pos); // de-dup same span
        if (valid.length) {
            const trailingYr = valid.map((h) => h.yy).filter(Boolean).pop();
            const toIso = (h) => isoDate(new Date(Date.UTC(h.yy ? +h.yy : (trailingYr ? +trailingYr : base.getUTCFullYear()), h.mo, h.dd, 12)));
            if (valid.length >= 2) return { from_date: toIso(valid[0]), to_date: toIso(valid[1]) };
            const date = toIso(valid[0]);
            const openFrom = /\b(from|since|after|onwards?|baad|se)\b/.test(m) && !/\b(to|till|until|before|tak)\b/.test(m);
            return openFrom ? { from_date: date, to_date: today } : { from_date: date, to_date: date };
        }
    }

    // MONTH NAME ("June", "March 2026", "june ka data", "in feb"). Year = the one
    // given, else the current year. ("may" is skipped when it's "may I/maybe/may be"
    // so a polite phrasing isn't read as the month of May.)
    const monthHit = m.match(new RegExp(`\\b(${MONTH_RE})\\b`));
    if (monthHit && !(monthHit[1] === 'may' && /\bmaybe\b|\bmay\s+(?:i|be)\b/.test(m))) {
        const mo = MONTHS_MAP[monthHit[1]];
        const yrM = m.match(/\b(20\d{2})\b/);
        const yr = yrM ? parseInt(yrM[1], 10) : base.getUTCFullYear();
        const start = new Date(Date.UTC(yr, mo, 1, 12));
        const end = new Date(Date.UTC(yr, mo + 1, 0, 12)); // 0th of next month = last day
        return { from_date: isoDate(start), to_date: isoDate(end) };
    }

    return { recent: true };
}

// Which dimension to break totals down by (deterministic — keyword based).
function parseGroupBy(message) {
    const m = String(message || '').toLowerCase();
    if (/\b(?:per|each|by|wise)\s*projects?\b|\bprojects?\s*wise\b|\bwhich project\b|\bhar project\b|\bkis project\b/.test(m)) return 'project';
    if (/\b(?:per|each|by)\s*month\b|\bmonth\s*wise\b|\bmonthly\b|\bhar mahin[ae]\b|\bwhich month\b|\bbusiest month\b/.test(m)) return 'month';
    if (/\b(?:per|each|by)\s*(?:module|categor)\w*\b|\bmodule\s*wise\b|\bwhich module\b/.test(m)) return 'module';
    if (/\b(?:per|each|by)\s*year\b|\byear\s*wise\b|\byearly\b|\bhar saal\b|\bwhich year\b/.test(m)) return 'year';
    if (/\b(?:per|each|by)\s*day\b|\bday\s*wise\b|\bdaily\b/.test(m)) return 'day';
    return 'none';
}

// Date window for analytics. Adds year support ("this year", "last year", a bare
// "2023") and defaults to ALL-TIME (not "recent") when no period is named —
// because an analytics question without a period usually means "overall".
function parseAnalyticsRange(message, base, monthFirst = false) {
    const m = String(message || '').toLowerCase();
    const hasFullDate = /\d{4}-\d{2}-\d{2}/.test(m);
    if (/\bthis year\b|\bis saal\b|\bcurrent year\b/.test(m)) {
        const y = base.getUTCFullYear();
        return { from_date: `${y}-01-01`, to_date: isoDate(base) };
    }
    if (/\blast year\b|\bpichl[ae] saal\b|\bprevious year\b/.test(m)) {
        const y = base.getUTCFullYear() - 1;
        return { from_date: `${y}-01-01`, to_date: `${y}-12-31` };
    }
    // Concrete date / period / MONTH NAME first — so "march 2026" resolves to MARCH,
    // not the whole year. A bare year only applies when no month/period was named.
    const r = parseGetRange(message, base, monthFirst); // week/month/yesterday/today/ISO/month-name
    if (!r.recent) return r;
    const yr = !hasFullDate && m.match(/\b(20[0-2]\d)\b(?!-)/);
    if (yr) return { from_date: `${yr[1]}-01-01`, to_date: `${yr[1]}-12-31` };
    return {}; // no period named → all-time
}

// Normalise a clock token ("1:30 pm", "3pm", "11:00", "3") → "HH:MM" 24h, or null.
// Bare hours 1–7 are read as afternoon (work context: "at 3" = 15:00).
function to24h(raw) {
    const m = String(raw || '').toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3];
    if (h > 23 || min > 59) return null;
    if (ap === 'pm' && h < 12) h += 12;
    else if (ap === 'am' && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12; // bare 1-7 → PM
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

// Extract advanced filters (keyword / time-of-day / duration / first-last / at-time)
// for query_timesheet. Returns null when the message has NO real filter signal
// (so plain "show today" stays a normal get). Date defaults to today in the tool.
const NUM_WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function parseFilters(message, base, monthFirst = false) {
    const m = String(message || '').toLowerCase().replace(/\b(one|two|three|four|five|six)\b/g, (w) => NUM_WORD[w]);
    const f = {};
    // Did a time-of-day come from an EXPLICIT clock ("before 10am") vs a vague word
    // ("morning")? Explicit clock = a strong read signal; vague words are weak (they
    // also show up in logs, e.g. "add my morning work").
    let explicitTOD = false;

    // date range (year/week/month/yesterday/today/ISO); else tool defaults to today
    const range = parseAnalyticsRange(message, base, monthFirst);
    if (range.from_date) { f.from_date = range.from_date; f.to_date = range.to_date; }

    // keyword (first match wins) — maps phrasings to a searchable stem
    const KW = [['chatbot', 'chatbot'], ['testing', 'test'], ['\\btest\\b', 'test'], ['debug', 'debug'],
        ['documentation', 'document'], ['\\bdocs?\\b', 'document'], ['meeting', 'meeting'], ['discussion', 'meeting'],
        ['frontend', 'frontend'], ['backend', 'backend'], ['\\bbug\\b', 'bug'], ['development', 'develop'],
        ['dev work', 'develop'], ['machine learning', 'ai'], ['\\bml\\b', 'ai'], ['ai-related', 'ai'],
        ['ai development', 'ai'], ['\\bai\\b', 'ai']];
    for (const [pat, kw] of KW) { if (new RegExp(pat).test(m)) { f.keyword = kw; break; } }

    // ── DYNAMIC keyword (0 tokens) ────────────────────────────────────────────
    // Descriptions are FREE-TEXT — any task/person/project name ("onboarding",
    // "priyanka", "telephonic interview"). A hardcoded KW list can't cover them, so
    // when nothing canned matched, pull the search term from an EXPLICIT search
    // structure. query_timesheet does LIKE %keyword% (substring), so we return the
    // single MOST DISTINCTIVE word — one salient word beats a brittle multi-word
    // phrase (word order in the DB may differ). Conservative patterns only → a plain
    // date read ("last month") yields NOTHING, so existing routing stays intact.
    if (!f.keyword) {
        const STOP = /^(show|list|view|display|fetch|give|get|find|search|filter|all|my|me|the|entries|entry|task|tasks|work|kaam|logs?|log|hours?|total|today|yesterday|tomorrow|aaj|kal|this|last|next|week|month|year|recent|latest|morning|afternoon|evening|night|before|after|between|status|timesheet|data|please|about|regarding|related|with|for|on|of|and|wala|wale|wali|mera|meri|mere|apna|apni|apne|mujhe|mujhko|dikhao|dikha|dikhana|dikhaiye|batao|bata|de|do)$/i;
        const pick = (phrase) => {
            const words = String(phrase || '')
                .toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
                .filter((w) => w.length >= 3 && !STOP.test(w));
            return words.length ? words.sort((a, b) => b.length - a.length)[0] : null; // longest = most distinctive
        };
        let km;
        if ((km = m.match(/\b(?:about|regarding|related to|related|containing|contains|mentioning|matching|having|on the topic of)\s+([a-z0-9][a-z0-9\s-]{2,40})/i))) {
            const kw = pick(km[1]); if (kw) f.keyword = kw;
        } else if ((km = m.match(/\b([a-z0-9][a-z0-9\s-]{2,40}?)\s+(?:related|wala|wale|wali)\b/i))) {
            const kw = pick(km[1]); if (kw) f.keyword = kw;
        } else if ((km = m.match(/\b(?:search|find|filter|look ?up|dhund\w*|khoj\w*)\s+(?:for\s+|me\s+|the\s+)?([a-z0-9][a-z0-9\s-]{2,40})/i))) {
            const kw = pick(km[1]); if (kw) f.keyword = kw;
        } else if ((km = m.match(/\b([a-z][a-z0-9-]{2,}(?:\s+[a-z][a-z0-9-]{2,})?)\s+(?:tasks?|entr\w*|logs?|work|kaam)\b/i))) {
            const kw = pick(km[1]); if (kw) f.keyword = kw; // "<X> tasks/entries" (X = content word)
        }
    }

    // duration: more/less/exactly N hour|min
    const dur = m.match(/(more than|over|longer than|greater than|at least|less than|under|shorter than|at most|exactly|exact)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/);
    if (dur) {
        const val = parseFloat(dur[2]);
        const mins = /^h/.test(dur[3]) ? Math.round(val * 60) : Math.round(val);
        if (/more|over|longer|greater|at least/.test(dur[1])) f.min_minutes = mins;
        else if (/less|under|shorter|at most/.test(dur[1])) f.max_minutes = mins;
        else f.exact_minutes = mins;
    }

    // time-of-day windows
    if (/before lunch/.test(m)) f.start_before = '13:00';
    if (/after lunch/.test(m)) f.start_after = '13:00';
    if (/\bmorning\b/.test(m)) f.start_before = '12:00';
    if (/\bafternoon\b/.test(m)) f.start_after = '12:00';
    let mm;
    if ((mm = m.match(/start(?:ed|ing)?\s+before\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.start_before = t; explicitTOD = true; } }
    if ((mm = m.match(/start(?:ed|ing)?\s+after\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.start_after = t; explicitTOD = true; } }
    if ((mm = m.match(/end(?:ed|ing)?\s+after\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.end_after = t; explicitTOD = true; } }
    if ((mm = m.match(/end(?:ed|ing)?\s+before\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.end_before = t; explicitTOD = true; } }
    if ((mm = m.match(/between\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+and\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) {
        const a = to24h(mm[1]); const b = to24h(mm[2]); if (a) { f.start_after = a; explicitTOD = true; } if (b) { f.start_before = b; explicitTOD = true; }
    }
    // "at/from/during/in 9 to 11" → entries INSIDE that clock window (start ≥ a,
    // end ≤ b). This is a READ filter ("show ... at 9 to 11"), distinct from a LOG
    // ("9 to 11 bug fix") by the leading at/from/during/in word. Only when no other
    // window already set.
    if (f.start_after === undefined && f.start_before === undefined && f.end_before === undefined) {
        if ((mm = m.match(/\b(?:at|from|during|in)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|till|until|and|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) {
            const a = to24h(mm[1]); const b = to24h(mm[2]);
            if (a && b) { f.start_after = a; f.end_before = b; explicitTOD = true; }
        }
    }
    if (f.start_before === undefined && f.start_after === undefined && !/lunch|morning|afternoon/.test(m)) {
        if ((mm = m.match(/\bbefore\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.start_before = t; explicitTOD = true; } }
        else if ((mm = m.match(/\bafter\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/))) { const t = to24h(mm[1]); if (t) { f.start_after = t; explicitTOD = true; } }
    }

    // point-in-time: "what was I doing at 1:30", "in progress at 3:00"
    if ((mm = m.match(/\b(?:at|@)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/)) && /(doing|working|in progress|progress|happening|task)/.test(m)) {
        const t = to24h(mm[1]); if (t) f.at_time = t;
    }

    // FIRST N (the EARLIEST of the day → a real same-day filter) stays here.
    // "last N" is deliberately NOT here: it means "the N most recent across ALL
    // dates", which the recent-GET below handles. query_timesheet defaults its
    // window to TODAY, so routing "last 3 entries" here wrongly hid older days
    // (today often has 0-1 rows) — that was the "last two/three" bug.
    if ((mm = m.match(/\bfirst\s+(\d+)\s+(?:tasks?|entr\w*|activit\w*|logs?|things?)/))) { f.order = 'asc'; f.limit = parseInt(mm[1], 10); }
    else if (/\bfirst\s+(?:task|entry|activity|log|thing)\b/.test(m)) { f.order = 'asc'; f.limit = 1; }
    else if (/chronological|in order/.test(m)) { f.order = 'asc'; }

    const nonDate = Object.keys(f).filter((k) => k !== 'from_date' && k !== 'to_date');
    if (!nonDate.length) return null;
    // "_strong" = the filter is UNMISTAKABLY a read (duration / point-in-time /
    // first-last N / explicit clock time-of-day). A bare keyword or a vague word
    // ("morning", "before lunch") is WEAK — it also appears in logs, so the caller
    // routes it to query_timesheet only with a read signal AND no time block.
    f._strong =
        f.min_minutes != null || f.max_minutes != null || f.exact_minutes != null ||
        f.at_time != null || f.limit != null || explicitTOD;
    return f;
}

// How many recent entries to list for a "last N" read: "last 3 entries" → 3,
// singular "last entry" → 1, bare "last entries" → null (tool default = 5).
// It keys off the NUMBER, not the (often misspelled) noun, so "last 2 enterie"
// still returns 2. Clamped 1-20 to match the get_timesheet_logs recent cap.
function recentLimit(message) {
    const m = String(message || '').toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (w) => NUM_WORD[w]);
    const numHit = m.match(/\b(?:last|recent|latest|previous|first|pichl[ae]|aakhri|akhri)\s+(\d{1,2})\b/);
    if (numHit) { const n = parseInt(numHit[1], 10); if (n >= 1 && n <= 20) return n; }
    if (/\b(?:last|recent|latest|previous|aakhri|akhri|pichl[ae])\s+(?:entry|log|task|record|activity)\b/.test(m)) return 1;
    return null;
}

// ── FUZZY TYPO-CORRECTION for command words (0 tokens) ──────────────────────
// Users mistype a LOT ("staatus", "shwo", "yeaterday", "attendence", "entres").
// Instead of hand-patching every regex word-by-word, we typo-correct the handful of
// CORE command words up-front (edit-distance 1) so EVERY downstream router sees the
// right word. Applied ONLY to non-log messages (a time block = a real log → never
// touch its description). Conservative: only words ≥4 chars, exactly 1 edit away from
// a known command word, and not already a valid command word.
const CMD_VOCAB = ['status','show','list','view','display','fetch','entries','entry','timesheet','attendance','total','hours','today','yesterday','tomorrow','week','month','year','recent','latest','last','first','next','previous','leave','leaves','project','projects','task','tasks','profile','current','employee','employees','delete','remove','update','edit','morning','afternoon','evening','before','after','between','analyze','breakdown','connect','filter','search','permission','permissions'];
const CMD_SET = new Set(CMD_VOCAB);
// Common, VALID English words that happen to sit 1 edit away from a vocab word —
// they must NEVER be "corrected" (e.g. "yours"→hours, "mouth"→month). The 5-char
// minimum below already shields 4-letter words (last/list/week/year/view/show…);
// this guards the few 5+ collisions. (Root-caused from "last"→"list" breaking
// "last month" date parsing.)
const FUZZY_KEEP = new Set(['yours', 'mouth', 'first', 'these', 'those', 'their', 'there', 'tests', 'meets', 'hosts', 'posts', 'parts', 'tasks']);

// ── Conservative employee-NAME detection ─────────────────────────────────────
// ROOT-CAUSE FIX (recurring bug): the connect/​bare-name matchers used to treat
// almost any leftover text as an employee name ("show email" → look up employee
// "email"; "any pending status" → employee "any pending status"). A reactive
// blocklist kept missing new words. Instead, REJECT a candidate name if ANY of
// its words is a known command/field/common word — only genuine names (no
// reserved word) pass. New phrases can never silently become a name lookup.
const FIELD_INFO_WORDS = [
    'email', 'emails', 'mobile', 'phone', 'number', 'numbers', 'contact', 'contacts',
    'address', 'addresses', 'dob', 'birthday', 'detail', 'details', 'info', 'information',
    'designation', 'role', 'joined', 'joining', 'pending', 'any', 'full', 'complete',
    'give', 'me', 'my', 'mera', 'meri', 'mere', 'apni', 'apna', 'his', 'her', 'their',
    'the', 'all', 'name', 'about', 'data', 'and', 'with', 'for', 'of',
];
const RESERVED_NAME_WORDS = new Set([...CMD_VOCAB, ...FIELD_INFO_WORDS]);
function nameLooksReserved(text) {
    return String(text || '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean)
        .some((w) => RESERVED_NAME_WORDS.has(w));
}
function lev1(a, b) {
    // returns true if edit distance between a,b is exactly 1 (else false). Cheap:
    // lengths must differ by ≤1; bail as soon as a 2nd difference appears.
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 1) return false;
    if (a === b) return false;
    let i = 0, j = 0, edits = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (m > n) i++;          // deletion from a
        else if (m < n) j++;     // insertion into a
        else { i++; j++; }       // substitution
    }
    if (i < m || j < n) edits++; // trailing extra char
    return edits === 1;
}
function fuzzyFixCommandWords(text) {
    // ≥5 chars only: 4-letter words have too many valid English collisions on a
    // single edit (last↔list, week↔weak, year↔…) — correcting them corrupts real
    // queries. The real typos this targets are all longer (staatus, yeaterday,
    // attendence, entres). FUZZY_KEEP shields the few 5+ valid collisions.
    return String(text || '').replace(/[A-Za-z]{5,}/g, (w) => {
        const lw = w.toLowerCase();
        if (CMD_SET.has(lw) || FUZZY_KEEP.has(lw)) return w; // valid word — leave it
        for (const v of CMD_VOCAB) {
            if (lev1(lw, v)) {
                return w[0] === w[0].toUpperCase() ? v.charAt(0).toUpperCase() + v.slice(1) : v;
            }
        }
        return w;
    });
}

// "what is my name", "who am I", "mera naam", "my email/role" → answer from the
// logged-in token (get_my_profile), NOT the flaky model which guesses a "name"
// out of the words ("ky hai" → "Kyhai"). Deterministic + exact + safe.
const PROFILE_INTENT = /\bwho\s+(?:am\s+i|i\s+am)\b|\bwho\s+am?\s+i+\b|\bwho\s+i\s+am+\b|\b(what'?s|what is|whats|tell me)\s+my\s+(name|role)\b|\bmy (name|role)\b|\bmera naam\b|\bmera role\b|\bmain kaun\b|\bkaun h(?:u|oon|un)\b/i;

// Which PROFILE FIELD is being asked for (email / mobile / address / dob / full)?
// Routes to get_my_profile (self) or get_employee_info (viewed employee). Returns
// null when no personal-info field is mentioned. Lets "show email", "mobile number",
// "meri full detail" answer with the saved DB value instead of the name matcher
// mistaking "email" for an employee.
function parsePersonalField(message) {
    const m = String(message || '').toLowerCase();
    // detail-ish word, typo-tolerant: details / deatils / detials / detals + info/jankari.
    const DETAILY = /\b(deta?i?ls?|deatils?|detials?|detals?|info\w*|information|jankari|profile|record)\b/;
    if ((/\b(full|complete|whole|entire|saari|sari|saare|puri|poori|sabhi)\b/.test(m) && DETAILY.test(m))
        || /\beverything about\b/.test(m)) return 'full';
    // Employee ID (typo-tolerant "emplooye"): "employee id", "emp id/code", "my id".
    if (/\bempl\w*\s*(id|code|number|no)\b|\b(emp|staff)\s*(id|code|no|number)\b|\bmy\s+id\b|\bemployee\s*id\b/.test(m)) return 'empid';
    if (/\b(d\.?o\.?b|date of birth|birth\s*date|birthday|janm\s*tithi)\b/.test(m)) return 'dob';
    // EMAIL before ADDRESS so "email address" → email (not the physical address).
    if (/\b(e-?mail|gmail)\b/.test(m)) return 'email';
    if (/\b(mobile|phone|contact|whats?app)\b/.test(m)) return 'mobile';
    if (/\b(address|pata|location|city|state|country)\b/.test(m)) return 'address';
    return null;
}

// From a field query, pull out an EMPLOYEE NAME if one is present ("vijay mobile
// number", "puneet ka email"). Strips field/command/common words; whatever 1-2
// alpha words remain are treated as the name. null = no name (→ self or sticky).
function extractNameFromFieldQuery(message) {
    const words = String(message || '')
        .toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
        .filter((w) => w.length >= 2 && !RESERVED_NAME_WORDS.has(w) && w !== 'ka' && w !== 'ki' && w !== 'ke');
    return words.length >= 1 && words.length <= 2 ? words.join(' ') : null;
}

// Capability / "what can you do" / "how much access" → a FIXED, accurate answer.
// The flaky free model otherwise greets or dumps entries on these. Deterministic =
// reliable + 0 tokens. Skip if there's a time block (that's a log: "help me 9-11…").
const CAPABILITY_INTENT = /\bwhat (can|do) (you|u) do\b|\bwhat can i (do|ask)\b|\bhow (much|many) (access|permission|permissions)\b|\bwhat (are|is) my (access|permission|permissions)\b|\b(your|ur) (capabilit|feature)|\bwhat are you\b|\bkya kar sakt[ae]\b|\b(tum|aap|tu) kya kar\b|^\s*help\s*$/i;

function getCapabilityReply(isOrgViewer) {
    const lines = [
        "I'm your timesheet assistant. Here's what I can do:",
        "• Log hours — e.g. \"9 to 11 fixed login bug\"",
        "• Show entries (today / this week / a specific date) and filter them",
        "• Analyze — totals, per-project/month breakdown, busiest, average",
        "• Edit / delete entries (with confirmation)",
        "• Tell you your profile (name / email / role)",
    ];
    if (isOrgViewer) {
        lines.push("• HR/Admin: view or analyze any employee's timesheet + employee list/count");
    }
    lines.push("");
    lines.push("I don't handle leave, payroll, or HR settings — those are on the website. 🙂");
    return lines.join("\n");
}

// Employee DIRECTORY count/list → list_employees (handler khud gate karta hai:
// org-viewer ko list, normal employee ko "HR/Admin only"). Deterministic taaki
// "total employee" galti se analyze_timesheet (apne hours) me na chala jaye.
const DIRECTORY_INTENT = /\b(how many|number of|count of|total(?: number)? of)\s+(active\s+)?employees?\b|\btotal\s+employees?\b|\bkitne\s+employees?\b|\b(list|show)\s+(all\s+|active\s+)?employees?\s*$|\bemployees?\s+(list|count|directory)\b/i;

// Out-of-scope HR requests (leave/payroll/holiday) → say clearly we don't do it,
// instead of a confusing greeting. Needs an ACTION verb + the noun (narrow, so a
// work-log like "fixed the leave module" won't trigger). Time-block also skips it.
const OUT_OF_SCOPE_INTENT = /\b(apply|applied|applying|book|request|take|cancel|approve|lagao|laga do|chahiye)\b[\s\w]*\b(leave|leaves|holiday|vacation|time ?off|chutti|chhutti)\b|\b(leave|chutti|chhutti|holiday)\b[\s\w]*\b(apply|lagao|laga do|book|chahiye|approve)\b|\b(payroll|payslip|salary slip)\b/i;

export async function aiChat(env, userId, message, history = [], selectedProject = null, timeZone = null, isOrgViewer = false, viewAs = null, selectedTasks = []) {
    try {
        let cleanMessage = (message || '').trim();
        // Numeric-date format user ke timezone se: US → month-first (05-20-2026),
        // India/baaki → day-first (20-05-2026). Global company, per-user sahi.
        const monthFirst = isMonthFirstTz(timeZone);

        // Guardrail: single-message length.
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        // Typo-correct CORE command words on NON-LOG messages so misspellings route
        // correctly ("staatus"→"status", "yeaterday"→"yesterday", "attendence"→
        // "attendance"). Logs (a time block) are LEFT UNTOUCHED — never corrupt a work
        // description. 0 tokens, runs before every deterministic router below.
        if (!looksLikeTimeBlock(cleanMessage)) {
            cleanMessage = fuzzyFixCommandWords(cleanMessage);
        }

        // PERSONAL-INFO FIELD (email / mobile / address / dob / full detail). Org-viewer
        // with a teammate selected (and NOT saying "my") → that teammate's info;
        // otherwise the logged-in user's own. Runs BEFORE the profile/name routes so
        // a focused field answer wins (and "show email" never becomes a name lookup).
        if (!DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) && !looksLikeTimeBlock(cleanMessage)) {
            const pField = parsePersonalField(cleanMessage);
            if (pField) {
                const selfIntent = /\b(my|mera|meri|mere|apni|apna|apne|khud|mine|self|mujhe|mujhko)\b/i.test(cleanMessage);
                if (isOrgViewer && !selfIntent) {
                    // Named in the message ("vijay mobile number") → that employee.
                    const nameInMsg = extractNameFromFieldQuery(cleanMessage);
                    if (nameInMsg) {
                        traceRoute('personal-field (named employee) → DETERMINISTIC (no brain, 0 tokens)');
                        return { action: { name: 'get_employee_info', data: { employee_name: nameInMsg, field: pField } } };
                    }
                    // No name but a teammate is selected (sticky) → that teammate.
                    if (viewAs) {
                        traceRoute('personal-field (viewed employee) → DETERMINISTIC (no brain, 0 tokens)');
                        return { action: { name: 'get_employee_info', data: { field: pField } } };
                    }
                }
                traceRoute('personal-field (self) → DETERMINISTIC (no brain, 0 tokens)');
                return { action: { name: 'get_my_profile', data: { field: pField } } };
            }
        }

        // Org-viewer "who is pending / any pending status / kisne status nahi bhara"
        // → pending report (deterministic). Guarded so it never catches a log.
        if (isOrgViewer && /\bpending\b/i.test(cleanMessage)
            && /\b(status|statuses|timesheet|fill\w*|employees?|kaun|who|nahi bhara|nhi bhara)\b/i.test(cleanMessage)
            && !looksLikeTimeBlock(cleanMessage) && !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
            traceRoute('pending-status → DETERMINISTIC (no brain, 0 tokens)');
            return { action: { name: 'get_pending_status', data: {} } };
        }

        // Profile question → reply from the verified login. Skip if there's a time
        // block (that's a work log, e.g. "9-11 my role permissions feature").
        if (PROFILE_INTENT.test(cleanMessage) && !looksLikeTimeBlock(cleanMessage)) {
            return { action: { name: 'get_my_profile', data: {} } };
        }

        // ── PERMISSIONS menu (deterministic — sensitive, model NEVER touches it) ──
        // Chip click "perm:<name>" → us permission ka action sub-menu khulta hai.
        const permChip = cleanMessage.match(/^\s*perm:([a-z_]+)\s*$/i);
        if (permChip) {
            return { action: { name: 'get_my_permissions', data: { area: permChip[1] } } };
        }
        // "my permissions" / "kitni permission hai" / "mere paas kya access" → list + chips.
        // Typo-tolerant: permission|permisison|permision|permisson|permissions sab
        // pakad'ta hai (users aksar galat spell karte hai). Time-block guard:
        // "9-11 permissions feature" ek work log hai, menu nahi.
        // ACCESS-based phrasing bhi (English + Hinglish): "my access", "mere paas kya
        // access hai", "konsi permission hai". NARROW — possessive (my/mere/mujhe/apni)
        // YA query-word (kya/kaun/konsi/kitni) ke saath hi, taaki "access the dashboard"
        // / "give me access" jaisा false-positive route na ho (no regression).
        const ACCESS_PERM = /\b(?:my|mere|meri|mujhe|mujhko|apni|apne)\b[^.?!]*\b(?:access|adhikaar|adhikar)\b|\b(?:kya|kaun|kaunsi|konsi|kitni|kitne)\b[^.?!]*\b(?:access|adhikaar|adhikar)\b/i;
        if ((/\bpermi[si]*ons?\b/i.test(cleanMessage) || ACCESS_PERM.test(cleanMessage)) && !looksLikeTimeBlock(cleanMessage)) {
            return { action: { name: 'get_my_permissions', data: {} } };
        }

        // ── EDIT-CHIP command → deterministic UPDATE (no model) ──────────────────
        // The post-save "Edit" chip pre-fills exactly "update entry HH:MM to HH:MM
        // <new text>". Route it straight to update_timesheet so the flaky model can't
        // misread it as an ADD (which would wrongly ask for a project). Locate by the
        // start time; the entry's existing project/task stay — only end-time and/or
        // description change. This is the reliable path for the edit window.
        const EDIT_CMD = cleanMessage.match(/^\s*(?:update|edit)\s+entry\s+(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})\s*(.*)$/i);
        if (EDIT_CMD) {
            const upd = { match_start_time: EDIT_CMD[1], new_end_time: EDIT_CMD[2] };
            const newDesc = EDIT_CMD[3].trim();
            if (newDesc) upd.new_task_description = newDesc;
            return { action: { name: 'update_timesheet', data: upd } };
        }

        // ── "Log my hours" / self-log intent with NO time → deterministic ask ────
        // The "Log my hours" chip sends "log my hours" (koi time nahi). Model ke
        // bharose chhoda to wo EXAMPLE khud banata hai jo 2-ghante/block rule TODTA
        // hai (e.g. "10:00-13:00" = 3 hrs — invalid). Isliye yahan code se jawab
        // dete hai: sahi prompt jo 2-hour cap bhi bataye aur sirf VALID (≤2h)
        // example de. Fires only when there's NO time signal and not delete/update.
        const LOG_NO_TIME =
            /\b(log|add|enter|fill|record|likho?|bharo?)\b[\w\s'"-]*\b(hours?|status|time|ghante|kaam|work)\b/i.test(cleanMessage) ||
            /^\s*(log|add|enter|fill)\s+(my\s+)?(hours?|status|time)\s*$/i.test(cleanMessage);
        const hasAnyTimeSignal =
            looksLikeTimeBlock(cleanMessage) ||
            /(?:^|[^a-z0-9])\d{1,2}\b/i.test(cleanMessage) ||
            /\bo.?clock\b|\bbaje\b|:\d{2}\b|\d\s*[ap]\.?m\b/i.test(cleanMessage);
        if (LOG_NO_TIME && !hasAnyTimeSignal && !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
            return {
                reply:
                    `Sure — let's log your hours. Here's how:\n\n` +
                    `1️⃣ Type @ and pick your project (e.g. "@121M").\n` +
                    `2️⃣ Select at least one task from the list that opens.\n` +
                    `3️⃣ Send the time and what you did — e.g. "9 to 11 fixed the login bug".\n\n` +
                    `⏱️ Each time block can be at most 2 hours (less is fine). For a longer day, split it:\n` +
                    `"9-11 API work, 11-1 testing, 2-4 bug fixes"\n\n` +
                    `A project and at least one task are required — without them the entry won't be saved.`,
            };
        }

        // Capability / out-of-scope / directory — deterministic (reliable + 0 tokens),
        // so the flaky free model never greets or mis-tools these. All skip when the
        // message has a time block (that's a work log, not a meta question).
        if (!looksLikeTimeBlock(cleanMessage)) {
            if (CAPABILITY_INTENT.test(cleanMessage)) {
                return { reply: getCapabilityReply(isOrgViewer) };
            }
            if (OUT_OF_SCOPE_INTENT.test(cleanMessage)) {
                return { reply: "I only handle timesheets (log/view/analyze hours). I don't manage leave, holidays, or payroll — please use the website for those. 🙂" };
            }
            if (DIRECTORY_INTENT.test(cleanMessage)) {
                return { action: { name: 'list_employees', data: {} } };
            }
            // ATTENDANCE — deterministic day-wise view (model isko kabhi greeting,
            // kabhi entries deta tha — ab decision code ka hai). Typo-tolerant
            // (attendance/attendence/sttendance) + Hindi (haziri). Period diya ho
            // to wahi, warna THIS MONTH (website ke calendar jaisa mental model).
            // Sticky viewer controller me lagta hai → selected employee ka hi aayega.
            // [ae]nd tolerates the common "attAndance" misspelling (a instead of e),
            // plus attendence/atendance — so a typo never falls through to the brain.
            const ATTENDANCE_INTENT = /\b\w{0,2}t+[ae]nd[ae]n[cs]e\w*\b|\bhaziri\b|\bhajiri\b|\bupasthiti\b/i;
            if (ATTENDANCE_INTENT.test(cleanMessage) && !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
                const base = nowInTz(timeZone);
                const r = parseAnalyticsRange(cleanMessage, base, monthFirst);
                const range = r.from_date
                    ? { from_date: r.from_date, to_date: r.to_date }
                    : { from_date: isoDate(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12))), to_date: isoDate(base) };
                return { action: { name: 'analyze_timesheet', data: { ...range, group_by: 'day' } } };
            }
            // Profile-card ki quick-action CHIPS ke exact texts → seedha deterministic
            // analyze (brain skip = 0 token + kabhi misroute nahi). Anchored (^...$)
            // hai taaki normal sentences par kabhi na lage.
            if (/^\s*total hours(?:\s*\(?\s*all[\s-]?time\s*\)?)?\s*$/i.test(cleanMessage)) {
                return { action: { name: 'analyze_timesheet', data: { group_by: 'none' } } }; // no dates = all-time
            }
            if (/^\s*hours by project(?:\s*\(?\s*all[\s-]?time\s*\)?)?\s*$/i.test(cleanMessage)) {
                return { action: { name: 'analyze_timesheet', data: { group_by: 'project' } } };
            }
            // "total hours" / "how much/many hours" / "kitne ghante" anywhere in the
            // message → analyze TOTAL (not a recent-entries dump). Broad on purpose so
            // "how much total hours", "total hours this month" all work — not just the
            // exact chip text. Period named → that range, else all-time. group_by picks
            // up "per project/month" if present. (Inside !looksLikeTimeBlock → a log is
            // never hijacked.)
            if (/\b(hours?|hrs|ghant[ae])\b/i.test(cleanMessage) &&
                /\b(total|kitne|kitna|how many|how much|sum|overall)\b/i.test(cleanMessage) &&
                !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
                traceRoute('total-hours → DETERMINISTIC (no brain, 0 tokens)');
                const r = parseAnalyticsRange(cleanMessage, nowInTz(timeZone), monthFirst);
                return { action: { name: 'analyze_timesheet', data: { ...(r.from_date ? { from_date: r.from_date, to_date: r.to_date } : {}), group_by: parseGroupBy(cleanMessage) } } };
            }
            // "(my/current/today's) STATUS" → is app me ek "status" = ek timesheet
            // entry (status_app / daily_status_entries), to "current/today's status" ka
            // matlab AAJ kya logged hai. AI ko khud samajhna chahiye — ab deterministic
            // (0 tokens). Period diya ho (yesterday/last week) to wahi, warna TODAY.
            // Org-viewer ke liye controller sticky viewAs scope laga deta hai.
            if (
                !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) &&
                // st+a+tus tolerates typos: status / staatus / sttatus / staaatus.
                (/\b(?:current|today'?s?|aaj\s*k[ae]?|abhi\s*k[ae]?|mera|meri|my)\s+st+a+tus\b/i.test(cleanMessage) ||
                 /\bst+a+tus\s+(?:today|abhi|now|aaj)\b/i.test(cleanMessage) ||
                 /^\s*(?:current\s+|my\s+)?st+a+tus\s*\??\s*$/i.test(cleanMessage))
            ) {
                traceRoute('status → DETERMINISTIC today entries (no brain, 0 tokens)');
                const r = parseGetRange(cleanMessage, nowInTz(timeZone), monthFirst);
                const today = isoDate(nowInTz(timeZone));
                const range = r.from_date ? { from_date: r.from_date, to_date: r.to_date } : { from_date: today, to_date: today };
                return { action: { name: 'get_timesheet_logs', data: range } };
            }
        }

        // ── ORG-VIEWER EMAIL-PICK (deterministic, no LLM) ─────────────────────
        // After a same-name list ("1. Vijay Kumar — vijay@… 2. Vijay — vijay12@…")
        // the HR/Admin replies with JUST an email to pick the person. Resolving
        // this is a flaky multi-step for ANY small model (it must remember the list
        // and re-issue the lookup), so we do it in code: a bare email from an
        // org-viewer → show THAT person's recent logs. dispatchTool turns
        // employee_name(email) → the employee (active-only) + labels the reply.
        // Recent is the sensible default; the user can then ask for a date range.
        const BARE_EMAIL = /^\s*([^\s@]+@[^\s@]+\.[A-Za-z]{2,})\s*$/;
        if (isOrgViewer && !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
            const em = cleanMessage.match(BARE_EMAIL);
            if (em) {
                // Chip-click / bare email = SELECT karo + profile card do (kaun hai,
                // role kya hai) — entries DUMP mat karo (user feedback: entries tabhi
                // jab khud maange). Sticky viewer pill isi se set hota hai.
                return { action: { name: 'get_employee_info', data: { employee_name: em[1] } } };
            }
            // ── CONNECT WITH <name> (org-viewer) ──────────────────────────────
            // "connect with Puneet" / "connect to Vijay Kumar" / "switch to Riya" /
            // "select employee Anil" → us employee se connect (profile + sticky
            // "Viewing:" pill). dispatchTool naam resolve karta hai: na mile to
            // professional "no such employee" reply, ek se zyada mile to pick-list.
            const connectM = cleanMessage.match(/^\s*(?:connect|switch|change|view|select|open|show)\s+(?:to|with|me)?\s*(?:the\s+)?(?:employee|emp|user|profile)?\s*[:\-]?\s*([A-Za-z][A-Za-z.\s]{1,40})\s*$/i);
            // Only a GENUINE name passes — if the captured text has any reserved
            // (command/field/common) word it is NOT a name ("show email", "show hours
            // by month" → fall through, never "no employee named …").
            if (connectM && connectM[1].trim().length >= 2 && !nameLooksReserved(connectM[1])) {
                const nm = connectM[1].trim().replace(/\s+(profile|info|details|data)\s*$/i, '').trim();
                if (nm.length >= 2) {
                    traceRoute('connect-with-employee → DETERMINISTIC (no brain, 0 tokens)');
                    return { action: { name: 'get_employee_info', data: { employee_name: nm } } };
                }
            }
            // ── BARE NAME (org-viewer) ────────────────────────────────────────
            // Sirf ek-do shabd ka pure-alpha message ("Puneet Kumar") → use bhi
            // employee-connect samjho. Na mile to dispatchTool professional "no such
            // employee" reply de deta hai. Guards: koi command/time/email/profile
            // keyword na ho (warna "show entries" jaisa read hijack ho jaye).
            const bareName = /^[A-Za-z][A-Za-z.\s]{1,40}$/.test(cleanMessage)
                && cleanMessage.trim().split(/\s+/).length <= 3
                && !nameLooksReserved(cleanMessage)
                && !/\b(help|hi|hello|hey|thanks|yes|no|ok|okay)\b/i.test(cleanMessage);
            if (bareName) {
                traceRoute('bare-name → employee-connect DETERMINISTIC (no brain, 0 tokens)');
                return { action: { name: 'get_employee_info', data: { employee_name: cleanMessage.trim() } } };
            }
        }

        // ── AM/PM DISAMBIGUATION (deterministic, no LLM) ─────────────────────────
        // The user is LOGGING with a bare, genuinely-ambiguous hour ("4 to 5"). Ask
        // AM or PM via two chips that re-send the SAME message with an explicit
        // meridiem — so we NEVER save a guessed (possibly wrong) time. Only for
        // logging turns: skip reads (HARD_GET) / edits / deletes. Runs BEFORE the
        // brain so the model can't save the guess first.
        if (!DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) && !HARD_GET.test(cleanMessage)) {
            const amb = ambiguousAmPm(cleanMessage);
            if (amb) {
                return {
                    reply: `Quick check — did you mean ${amb.hour} AM or ${amb.hour} PM?`,
                    options: [
                        { label: `🌅 ${amb.hour} AM`, value: amb.amValue },
                        { label: `🌆 ${amb.hour} PM`, value: amb.pmValue },
                    ],
                    optionsTitle: "Select AM or PM:",
                    optionsSingleUse: true, // one-shot → click ke baad chips hide
                };
            }
        }

        // ── ⚡ DETERMINISTIC ADD FAST-PATH (0 tokens) ────────────────────────
        // Project + task + time SAB set hain → ye PAKKA ADD hai. Description me kuch
        // bhi likha ho (chahe "leave", "filter", "show", "delete" jaise words ho —
        // wo kaam ka description hai, command nahi) → wo kabhi hijack na kare, isliye
        // ye check leave/filter/read/analytics detectors se PEHLE chalta hai. Sirf
        // asli edit/delete INTENT ("9-11 ko 10-12 kar do", "hata do") brain pe jaata
        // hai. timeParser battle-tested hai → LLM call hoti hi nahi (0 tokens).
        // Runs AFTER AM/PM disambiguation so a genuinely-ambiguous bare hour still asks.
        // Task gate: AI_REQUIRE_TASK=false → project + time is enough (no ticked task).
        const taskGateOk = !requireTask(env) || (Array.isArray(selectedTasks) && selectedTasks.length > 0);
        if (
            selectedProject &&
            taskGateOk &&
            looksLikeTimeBlock(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !HARD_GET.test(cleanMessage) // "show ... 9 to 11" is a READ, not a log
        ) {
            const { entries } = await extractWorkBlocks(cleanMessage, env);
            if (entries.length > 0) {
                traceRoute('add (project+task+time) → DETERMINISTIC fast-path (0 tokens)');
                enrichThinDescriptions(entries, history);
                const entry_date = parseEntryDate(cleanMessage, nowInTz(timeZone), monthFirst);
                return { action: { name: 'add_timesheet_entries', data: { entries, ...(entry_date ? { entry_date } : {}) } } };
            }
            // timeParser ne kuch nahi nikala (exotic format) → neeche brain handle karega
        }

        const window = buildSlidingWindow(history);

        // Guided-help chips ("📝 Add entry" / "🔎 Find entry") — deterministic, no
        // model. Add-help is skipped if the message already has a time block (that's
        // a real log, not a help request).
        if (/\bhow (?:do i |to )?add\b|\badd (?:an? )?entry\b|\bhow (?:do i |to )?log\b/i.test(cleanMessage) && !looksLikeTimeBlock(cleanMessage)) {
            traceRoute('add-help → DETERMINISTIC (no brain, 0 tokens)');
            return addHelpReply();
        }
        if (/\bhow (?:do i |to )?(?:find|filter|search)\b|\bfind (?:an? )?entry\b/i.test(cleanMessage)) {
            traceRoute('find-help → DETERMINISTIC (no brain, 0 tokens)');
            return findHelpReply();
        }

        // ── Social turn: the model writes a natural reply, but with NO tools
        // attached so it physically cannot hallucinate a get/add/delete call. ──
        if (isSmallTalk(cleanMessage)) {
            traceRoute('small-talk → FAST model (chat.js, no tools)');
            // Greetings get quick-action chips so the user sees what to tap.
            const chips = isGreeting(cleanMessage) ? quickActionChips() : {};
            // DYNAMIC + FAST: a small 8B model replies naturally in ~0.5-1s (the 70B
            // was too slow → WORKERS_AI_TIMEOUT on "hey"). If even the fast model
            // stalls/errors, fall back to a friendly canned line so the user NEVER
            // sees a timeout. Best of both: natural conversation that can't break.
            try {
                const casual = await askCloudflareAI(
                    getCasualPrompt(), cleanMessage, window, env, null,
                    { model: getFastModel(env), timeoutMs: FAST_TIMEOUT_MS }
                );
                return { reply: (typeof casual === 'string' && casual.trim()) ? casual.trim() : cannedSmallTalkReply(cleanMessage), ...chips };
            } catch (e) {
                console.warn('[small-talk fast-model failed → canned fallback]', e?.message || e);
                return { reply: cannedSmallTalkReply(cleanMessage), ...chips };
            }
        }

        // ── MY PROJECTS (assigned) — deterministic, before analytics so "which
        // projects do I work on" lists assignments, not an hours breakdown. Excludes
        // hours/time queries (those are analytics: "hours per project").
        if (
            !/\b(hours?|time|total|breakdown|per\s+project)\b/i.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) &&
            (/\b(?:my|mere|meri)\s+projects?\b/i.test(cleanMessage) ||
             /\bhow many projects?\b/i.test(cleanMessage) ||
             /\bkitne projects?\b/i.test(cleanMessage) ||
             /\bassigned (?:to me|projects?)\b/i.test(cleanMessage) ||
             /\bprojects? (?:assigned|am i (?:assigned|on)|do i (?:have|work)|i work on)\b/i.test(cleanMessage) ||
             /\bwhich projects? (?:do i|am i|i)\b/i.test(cleanMessage))
        ) {
            traceRoute('my-projects → DETERMINISTIC (no brain, 0 tokens)');
            return { action: { name: 'get_my_projects', data: {} } };
        }

        // ── MY TASKS (assigned) — deterministic. Excludes hours/time (analytics) and
        // the "project_tasks" UI chips. Optional status filter (todo / in progress / done).
        if (
            !/\b(hours?|time|total|breakdown)\b/i.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage) &&
            // `tas+ks?` tolerates common typos: task / tasks / tassk / tasssk.
            (/\b(?:my|mere|meri)\s+tas+ks?\b/i.test(cleanMessage) ||
             /\bhow many tas+ks?\b/i.test(cleanMessage) ||
             /\bkitne tas+ks?\b/i.test(cleanMessage) ||
             /\btas+ks? (?:assigned|am i (?:assigned|on)|do i have|i have)\b/i.test(cleanMessage) ||
             /\b(?:my )?(?:pending|open|todo|to-?do|in progress) tas+ks?\b/i.test(cleanMessage) ||
             /\bassigned tas+ks?\b/i.test(cleanMessage))
        ) {
            const sM = cleanMessage.match(/\b(to-?do|in progress|done|completed|pending)\b/i);
            const status = sM ? { todo: 'To Do', 'to-do': 'To Do', 'in progress': 'In Progress', done: 'Done', completed: 'Done' }[sM[1].toLowerCase()] : null;
            // Project picker chip → "my tasks for <Project>". Extract the project name.
            const projM = cleanMessage.match(/\btas+ks?\s+(?:for|of|under)\s+(.+?)\s*$/i);
            const data = {};
            if (status) data.status = status;
            if (projM && projM[1].trim()) data.project_name = projM[1].trim();
            traceRoute('my-tasks → DETERMINISTIC (no brain, 0 tokens)');
            return { action: { name: 'get_my_tasks', data } };
        }

        // ── MY LEAVES — deterministic. Leave balance + applications (self-only).
        // Time block ke saath "leave" word = work description (e.g. "leave module
        // implement kiya") — ye query nahi hai. Guard: time block ho to skip karo.
        if (
            !looksLikeTimeBlock(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage) &&
            !/\b(apply|application form|request leave|take leave)\b/i.test(cleanMessage) && // applying is a UI action
            (/\b(?:my )?leaves?\b/i.test(cleanMessage) ||
             /\bleave balance\b/i.test(cleanMessage) ||
             /\b(?:chhutti|chutti|chuttiyan|chutiya?n)\b/i.test(cleanMessage) ||
             /\bhow many leaves?\b/i.test(cleanMessage) ||
             /\bkitni (?:chhutti|chutti|leave)/i.test(cleanMessage) ||
             /\bleaves? (?:left|remaining|balance|taken)\b/i.test(cleanMessage))
        ) {
            const yM = cleanMessage.match(/\b(20[0-3]\d)\b/);
            const stM = cleanMessage.match(/\b(pending|approved|rejected)\b/i);
            const lvRange = parseAnalyticsRange(cleanMessage, nowInTz(timeZone), monthFirst); // last month / June / ISO / on a date
            const allTime = /\b(since joining|joined|all[\s-]?time|so far|ab\s*tak|abtak|till now|now till)\b/i.test(cleanMessage) ||
                /\bkitni (?:leave|chhutti|chutti)\s*(?:li|le li|li hai)?\b/i.test(cleanMessage);
            const ld = {};
            // Priority: status → period → all-time → plain summary.
            if (stM) ld.status = stM[1].toLowerCase();
            else if (lvRange.from_date) { ld.from_date = lvRange.from_date; ld.to_date = lvRange.to_date; }
            else if (allTime) ld.all_time = true;
            else if (yM) ld.year = parseInt(yM[1], 10);
            traceRoute('my-leaves → DETERMINISTIC (no brain, 0 tokens)');
            return { action: { name: 'get_my_leaves', data: ld } };
        }

        // ── EARLY DETERMINISTIC ANALYTICS (token-free) ────────────────────────
        // Clear breakdown/aggregate queries (the "By project/month/day" chips, "hours
        // per project", "monthly breakdown", "overall total") are settled HERE, BEFORE
        // the brain — so a chip tap costs 0 tokens and replies instantly (no 12s brain
        // wait). Comparison/leaderboard ("sabse zyada kisne") is excluded → it still
        // uses the brain (which sets compare_employees for org-viewers). Delete/update/
        // time-logs are excluded too. The same parse runs as a fallback further below.
        if (
            ANALYTICS_INTENT.test(cleanMessage) &&
            !COMPARE_SIGNAL.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage)
        ) {
            traceRoute('analytics → DETERMINISTIC (no brain, 0 tokens)');
            const base = nowInTz(timeZone);
            const offM = cleanMessage.match(/\boffset\s+(\d+)\b/i); // pagination "Show more" chips
            return { action: { name: 'analyze_timesheet', data: { ...parseAnalyticsRange(cleanMessage, base, monthFirst), group_by: parseGroupBy(cleanMessage), ...(offM ? { offset: parseInt(offM[1], 10) } : {}) } } };
        }

        // ── EARLY READ PAGINATION (token-free) ────────────────────────────────
        // The "Show more" ENTRY chips carry an explicit "offset N" (real users never
        // type that). Settle these in code BEFORE the brain so paging an entry list
        // is instant + free. Analytics-offset chips are handled just above, so this
        // only catches plain entry-list paging. Excludes delete/update/time-logs.
        const offReadM = cleanMessage.match(/\boffset\s+(\d+)\b/i);
        if (
            offReadM &&
            GET_VERB.test(cleanMessage) &&
            !ANALYTICS_INTENT.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage)
        ) {
            traceRoute('read pagination → DETERMINISTIC (no brain, 0 tokens)');
            const range = parseGetRange(cleanMessage, nowInTz(timeZone), monthFirst);
            range.offset = parseInt(offReadM[1], 10);
            return { action: { name: 'get_timesheet_logs', data: range } };
        }

        // ── EARLY DETERMINISTIC READ (token-free) ─────────────────────────────
        // Concrete date/period list queries — today, yesterday, this/last week,
        // this/last month, a month NAME ("June", "March 2026"), a specific date, or
        // a date RANGE — settle in code BEFORE the brain → instant + 0 tokens (no
        // 12s brain wait). Safety: only fires when the parser RESOLVED a concrete
        // range (or the user clearly wants recent/last entries). Ambiguous phrasings,
        // FILTERED queries (morning/duration), future dates, logs, edits and deletes
        // all fall through to the brain, which still understands anything.
        // ── EARLY DETERMINISTIC FILTER (token-free) ───────────────────────────
        // Keyword / time-of-day / duration / first-N / point-in-time queries (with
        // ANY date range — month name, week, ISO range, etc.) settle in code before
        // the brain. STRONG filters (duration / at-time / first-N / explicit clock)
        // route directly; WEAK ones (bare keyword, vague "morning") need a read
        // signal AND no time block, so a log ("9-11 ai work") is never hijacked.
        if (!DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
            const earlyFilters = parseFilters(cleanMessage, nowInTz(timeZone), monthFirst);
            if (earlyFilters) {
                const strong = earlyFilters._strong;
                delete earlyFilters._strong;
                const READ_SIG =
                    GET_VERB.test(cleanMessage) ||
                    /\?\s*$/.test(cleanMessage) ||
                    /\b(show|list|display|only|filter|find|which|what|first|last|between|chronological|doing|working|in progress|tasks?|activit\w*|entr\w*)\b/i.test(cleanMessage);
                // A WEAK filter (bare keyword / vague word) is only a SEARCH when the
                // message is SHORT or STARTS with a read verb. A long day-narrative
                // ("Started the day with dataset prep... chatbot... tested...") is a
                // LOG that happens to contain keywords — it must NOT become a filter.
                const startsReadVerb = /^\s*(show|list|view|display|find|filter|search|get|what|which|how\s+(many|much)|kitne|kitna|dikha\w*|batao|give|gimme)\b/i.test(cleanMessage);
                const isShortQuery = cleanMessage.trim().split(/\s+/).length <= 8;
                if (strong || (READ_SIG && !looksLikeTimeBlock(cleanMessage) && (startsReadVerb || isShortQuery))) {
                    traceRoute('filter → DETERMINISTIC (no brain, 0 tokens)');
                    return { action: { name: 'query_timesheet', data: earlyFilters } };
                }
            }
        }

        const FUTURE_GET_RE = /\btom+or+ow?\b|\btomoro\b|\btmrw?\b|\bday after tomorrow\b|\bnext (?:week|month|day|\d+\s*days?)\b|\baane ?wala kal\b/i;
        const earlyReadIntent =
            GET_VERB.test(cleanMessage) ||
            (PERIOD.test(cleanMessage) && GET_NOUN.test(cleanMessage)) ||
            (RECENT_WORD.test(cleanMessage) && ENTRY_WORD.test(cleanMessage));

        // FUTURE read ("tomorrow", "next week") — nothing logged ahead. Friendly
        // reply in code (no brain). Excludes logs (a time block) and edits/deletes,
        // so "log tomorrow 9-11" still routes to add, not here.
        if (
            FUTURE_GET_RE.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage) &&
            (earlyReadIntent || cleanMessage.trim().split(/\s+/).length <= 5)
        ) {
            traceRoute('future read → DETERMINISTIC (no brain, 0 tokens)');
            return { reply: "I can only show hours you've already logged — there's nothing for a future date yet. 🙂 Want today's or this week's logs instead?" };
        }
        if (
            !ANALYTICS_INTENT.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage) &&
            !FUTURE_GET_RE.test(cleanMessage) &&
            !parseFilters(cleanMessage, nowInTz(timeZone), monthFirst)
        ) {
            const range = parseGetRange(cleanMessage, nowInTz(timeZone), monthFirst);
            const wantsRecent = RECENT_WORD.test(cleanMessage) && ENTRY_WORD.test(cleanMessage);
            const concretePeriod = !!range.from_date; // resolved a real date / period / month
            const wordCount = cleanMessage.trim().split(/\s+/).length;
            // Fire when: an explicit read names a period, OR the message is a SHORT
            // bare-period query ("last month", "June", "yesterday") — ≤5 words so a
            // long work description that merely mentions a month is NOT hijacked.
            const fire =
                (earlyReadIntent && (concretePeriod || (range.recent && wantsRecent))) ||
                (concretePeriod && wordCount <= 5);
            if (fire) {
                if (range.recent) { const lim = recentLimit(cleanMessage); if (lim) range.limit = lim; }
                traceRoute('read → DETERMINISTIC (no brain, 0 tokens)');
                return { action: { name: 'get_timesheet_logs', data: range } };
            }
        }

        // ── 🧠 CLAUDE BRAIN (LLM-as-router) ───────────────────────────────────
        // When an Anthropic key is configured, a reliable model decides the intent
        // (add / get / query / analyze / update / delete / profile) and extracts the
        // args — so ANY phrasing works without brittle regex intent-routing. On any
        // error/miss we fall through to the deterministic engine below, so the app
        // NEVER hard-depends on the brain (graceful degradation).
        //
        // WHY the brain decides add-vs-edit (not a regex fast-path): regex cannot
        // reliably tell a fresh log from an edit across languages — e.g. Hindi
        // "9-11 ko 10-12 kar do" is an UPDATE, but has no English edit word and a
        // time block, so a regex "clear add" check misfiles it as a NEW entry
        // (duplicate, wrong data). Letting the model classify removes that whole
        // class of corruption. Greetings/profile are still settled for free above,
        // so only real work messages reach here.
        //
        // For a NEW log we still re-extract the times with the TESTED deterministic
        // parser (model decides intent; proven code does the time math), and fall
        // back to the model's own entries only if regex can't read the format.
        if (isBrainEnabled(env)) {
            traceRoute('work request → BRAIN (brainRouter.js → tools)');
            try {
                const routed = await routeWithBrain(env, cleanMessage, window, selectedProject, timeZone, isOrgViewer, viewAs);
                // Viewing a teammate? The model must NEVER answer a person-info
                // question with the HR's OWN profile. Redirect any self-profile call
                // to the VIEWED teammate (controller scopes employee_name=viewAs).
                // Skip only when the user explicitly said my/mera. Model-proof.
                if (routed?.action?.name === 'get_my_profile' && isOrgViewer && viewAs
                    && !/\b(my own|mine|my|mera|meri|mere|apni|apna|apne|khud|khudki|self)\b/i.test(cleanMessage)) {
                    routed.action = { name: 'get_employee_info', data: { ...(routed.action.data || {}) } };
                }
                if (routed?.action?.name === 'add_timesheet_entries') {
                    const { entries } = await extractWorkBlocks(cleanMessage, env);
                    const modelEntries = Array.isArray(routed.action.data?.entries) ? routed.action.data.entries : [];

                    // MULTI-TURN STITCH: when the user gives the time RANGE in one
                    // message ("9 se 4 …") and the BREAK in a later one ("1 se 2"), the
                    // current message alone is a fragment — regex on it sees ONLY the
                    // break and would log 01:00–02:00 as work (losing 9–4). The brain
                    // reads the WHOLE conversation and assembles the real split
                    // (09–13 + 14–16, lunch 13–14 → dropped by is_lunch). So when the
                    // brain produced MORE real work blocks than the current message
                    // yields, trust the brain's entries. Single-message logs are
                    // unaffected (equal counts → regex path below, as before).
                    // Handler still validates HH:MM / 2h cap / overlap / drops is_lunch.
                    const workCount = (arr) => arr.filter((e) => e && !e.is_lunch).length;
                    if (workCount(modelEntries) > workCount(entries)) {
                        return routed;
                    }

                    if (entries.length > 0) {
                        enrichThinDescriptions(entries, history);
                        const entry_date = parseEntryDate(cleanMessage, nowInTz(timeZone), monthFirst);
                        return { action: { name: 'add_timesheet_entries', data: { entries, ...(entry_date ? { entry_date } : {}) } } };
                    }
                    if (modelEntries.length > 0) return routed; // exotic format the regex missed — handler still validates
                    return { reply: "Got it — what time did you work on that? e.g. \"9 to 11\"." };
                }
                // Brain returned a non-action REPLY (a clarifying question). If the
                // message ALREADY has a time block AND a project is selected, it's a
                // valid log — e.g. "12 to 1" under the selected project/task. Don't
                // let the model ask "what did you work on?" (the selected task IS the
                // context). Fall through to the deterministic ADD below, which logs
                // it. Otherwise (no time / no project) the model's reply stands.
                if (routed && !routed.action && looksLikeTimeBlock(cleanMessage) && selectedProject) {
                    // fall through to deterministic engine ↓
                } else if (
                    // ── STICKY-VIEWER SAFETY NET (deterministic, model-proof) ──────
                    // A teammate is SELECTED ("Viewing: X") and the user asked to
                    // view/read WITHOUT naming someone else or saying 'my'. The small
                    // model sometimes ignores the viewing-override and returns a
                    // "whose timesheet?" question. Do NOT let that stand — fall through
                    // to the deterministic read below; the controller scopes it to the
                    // viewed teammate. This keeps the sticky-viewer reliable no matter
                    // how the model behaves (root cause of the recurring regression).
                    routed && !routed.action && isOrgViewer && viewAs &&
                    !looksLikeTimeBlock(cleanMessage) &&
                    !/\b(my|mera|meri|mere|apni|apna|apne|khud|self|mine)\b/i.test(cleanMessage) &&
                    (RECENT_WORD.test(cleanMessage) || GET_VERB.test(cleanMessage) ||
                     PERIOD.test(cleanMessage) ||
                     /st+a+tus|\w{0,2}t+[ae]nd[ae]n[cs]e|hours?|entr\w*|logs?|timesheet|kaam|work/i.test(cleanMessage))
                ) {
                    traceRoute('sticky-viewer read → brain "whose?" overridden (deterministic)');
                    // fall through to deterministic read ↓
                } else if (routed) {
                    return routed;
                }
            } catch (e) {
                console.warn('[claude-brain failed → deterministic fallback]', e?.message || e);
            }
        }

        // ── DETERMINISTIC READ (reliable, no LLM) — recent entries OR a date range.
        // Fires on a clear read signal (a get-verb; OR a period word + a log/entry
        // noun; OR "last/recent" + an entry word) with NO time block — so it can
        // NEVER catch an ADD — and never on a delete/update. parseGetRange turns the
        // phrase into {from_date,to_date} (or {recent:true}). This makes the common
        // GET queries as bulletproof as ADD — no flaky model on the hot path.
        const isReadIntent =
            GET_VERB.test(cleanMessage) ||
            (PERIOD.test(cleanMessage) && GET_NOUN.test(cleanMessage)) ||
            (RECENT_WORD.test(cleanMessage) && ENTRY_WORD.test(cleanMessage));

        // FUTURE date asked ("tomorrow", "next week") → logs can't exist in the
        // future. Say so clearly instead of silently falling back to recent rows.
        // Catches tomorrow + common misspellings (tommoro, tomorow, tmrw…) and other futures.
        const FUTURE_GET = /\btom+or+ow?\b|\btomoro\b|\btmrw?\b|\bday after tomorrow\b|\bnext (?:week|month|day|\d+\s*days?)\b|\baane ?wala kal\b/i;
        if (isReadIntent && FUTURE_GET.test(cleanMessage) && !DELETE_INTENT.test(cleanMessage) && !UPDATE_INTENT.test(cleanMessage)) {
            return { reply: "I can only show hours you've already logged — there's nothing for a future date yet. 🙂 Want today's or this week's logs instead?" };
        }

        // ── DETERMINISTIC ANALYTICS (reliable, no LLM) — totals / breakdowns /
        // comparisons over the user's OWN data. Fires on clear aggregate signals.
        // Also runs as the EARLY short-circuit above (before the brain) so breakdown
        // chips are token-free; this copy is the brain-disabled fallback. Code parses
        // the dimension + range; the analyze tool does the SUM/GROUP BY.
        if (
            ANALYTICS_INTENT.test(cleanMessage) &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage)
        ) {
            const base = nowInTz(timeZone);
            return { action: { name: 'analyze_timesheet', data: { ...parseAnalyticsRange(cleanMessage, base, monthFirst), group_by: parseGroupBy(cleanMessage) } } };
        }

        // ── DETERMINISTIC ADVANCED FILTER (reliable, no LLM) — keyword / time-of-day
        // / duration / first-last / point-in-time. Only when there's a clear READ
        // signal AND parseFilters finds a real filter (so a logging message like
        // "testing kiya" without a time is NOT hijacked into a list). Routes to
        // query_timesheet, which runs the exact filtered SQL scoped to the user.
        // NOTE: no !looksLikeTimeBlock guard here — point-in-time reads ("what was
        // I doing at 1:30 PM") contain a clock time. READ_SIGNAL + parseFilters
        // (which returns null unless a real filter is found) keep logging messages
        // out: a bare "9-11 fixed bug" has no read word, so it never reaches here.
        const READ_SIGNAL =
            GET_VERB.test(cleanMessage) ||
            /\?\s*$/.test(cleanMessage) ||
            /\b(show|list|display|only|filter|find|which|what|first|last|between|chronological|doing|working|in progress|tasks?|activit\w*|entr\w*)\b/i.test(cleanMessage);
        if (
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage)
        ) {
            const filters = parseFilters(cleanMessage, nowInTz(timeZone), monthFirst);
            if (filters) {
                const strong = filters._strong;
                delete filters._strong; // internal routing flag — never goes to the tool.
                // Strong filters (duration / point-in-time / first-last N / explicit
                // clock time) are unmistakably a READ → route directly. A WEAK filter
                // (a bare keyword or a vague "morning"/"before lunch") is ambiguous with
                // logging, so it routes ONLY with a read signal AND no time block — a
                // time block means the user is LOGGING ("9-11 ai work", "9 to 11 last
                // minute bug fixes"), not asking to filter.
                // Weak filter only counts as a SEARCH on a short query or one that
                // starts with a read verb — a long day-narrative log is not a filter.
                const startsReadVerb = /^\s*(show|list|view|display|find|filter|search|get|what|which|how\s+(many|much)|kitne|kitna|dikha\w*|batao|give|gimme)\b/i.test(cleanMessage);
                const isShortQuery = cleanMessage.trim().split(/\s+/).length <= 8;
                if (strong || (READ_SIGNAL && !looksLikeTimeBlock(cleanMessage) && (startsReadVerb || isShortQuery))) {
                    return { action: { name: 'query_timesheet', data: filters } };
                }
            }
        }

        if (
            isReadIntent &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage)
        ) {
            const range = parseGetRange(cleanMessage, nowInTz(timeZone), monthFirst);
            // "last N entries" → N most recent across ALL dates. Singular "last
            // entry" → 1. Bare "last entries" → the tool's default (5).
            if (range.recent) { const lim = recentLimit(cleanMessage); if (lim) range.limit = lim; }
            return { action: { name: 'get_timesheet_logs', data: range } };
        }

        // ── DETERMINISTIC ADD (the hot path) — parse work blocks in code. ──
        // The model was flaky at emitting the entries[] array; parsing is
        // mechanical, so we do it ourselves: 100% repeatable, fast, no timeout.
        // Skip only when the user clearly wants delete/update or an explicit read.
        // A specific time block ("9 se 11", "9-11", "9am") means LOGGING — history
        // queries say "today"/"this week", never a precise range. So SOFT_GET words
        // ("report"/"summary") next to a time block stay an ADD (fixes "9 se 11
        // report banayi", which used to misfire on the word "report").
        const wantsOther =
            DELETE_INTENT.test(cleanMessage) ||
            UPDATE_INTENT.test(cleanMessage) ||
            HARD_GET.test(cleanMessage) ||
            (SOFT_GET.test(cleanMessage) && !looksLikeTimeBlock(cleanMessage));

        if (!wantsOther) {
            // 🛡️ BULLETPROOF GATE — does the message contain ANY time signal?
            // Computed deterministically BEFORE touching the model. A time block,
            // a standalone hour number, or a clock word (am/pm/baje/o'clock/HH:MM)
            // all count. A digit glued to letters ("Core Infra V2") does NOT.
            const hasStandaloneNumber = /(?:^|[^a-z0-9])\d{1,2}\b/i.test(cleanMessage);
            const hasClockWord =
                /\bo.?clock\b|\bbaje\b|\bnoon\b|\bmidnight\b/i.test(cleanMessage) ||
                /\d\s*[ap]\.?m\b/i.test(cleanMessage) ||
                /:\d{2}\b/.test(cleanMessage);
            const hasTime = looksLikeTimeBlock(cleanMessage) || hasStandaloneNumber || hasClockWord;

            if (hasTime) {
                // There IS a time → parse it. Regex first; LLM only to read a format
                // regex can't. The model CANNOT invent a time here — one already
                // exists in the text, it just reads what's there.
                const { entries, source } = await extractWorkBlocks(cleanMessage, env);
                if (entries.length > 0) {
                    // Multi-turn: borrow a real description from the previous message
                    // when this one was basically just a time.
                    enrichThinDescriptions(entries, history);
                    const entry_date = parseEntryDate(cleanMessage, nowInTz(timeZone), monthFirst);
                    console.log(`[hybrid add: ${source}]`, JSON.stringify({ entry_date, entries }));
                    return {
                        action: {
                            name: 'add_timesheet_entries',
                            data: { entries, ...(entry_date ? { entry_date } : {}) },
                        },
                    };
                }
                // A time-ish token was present but unparseable → fast, clear hint.
                console.warn('[hybrid add] no blocks extracted (regex + LLM) for:', cleanMessage);
                return {
                    reply:
                        "I couldn't read the time blocks in that one. Could you re-send in a clearer format? e.g. \"9-11 API work\" or \"9 to 11 fixed login bug; 2 to 4 testing\".",
                };
            }

            // ⛔ NO time signal at all → the user listed work but gave NO time. We
            // must NEVER let the model invent one (that hallucination saved 5 bogus
            // entries with made-up times). So we DON'T call the model — this is
            // instant AND bulletproof — and just ask for the time below.

            // Work intent but NO time given AND a project is selected → ask for
            // the time conversationally (natural multi-turn flow) instead of
            // dead-ending with "no workable entries". The user just replies with
            // a time next, which the deterministic parser then logs.
            if (selectedProject) {
                // A comma-separated list of several tasks needs a time for EACH —
                // guide the user to the "time task, time task" format the parser
                // logs in one go. A single task just needs one time.
                const looksMultiTask = (cleanMessage.match(/,/g) || []).length >= 2;
                if (looksMultiTask) {
                    return {
                        reply:
                            `Got it — these will go under "${selectedProject}". I just need a time for each task. ` +
                            `Re-send them with times, e.g.:\n` +
                            `"8:30-10:30 dataset cleanup, 10:30-12 model training, 1-2 lunch, 2-4 chatbot work"\n` +
                            `(Each block max 2 hours; "lunch" is skipped automatically.)`,
                    };
                }
                return {
                    reply: `Got it — I'll log this under "${selectedProject}". What time did you work on it? e.g. "9 to 11" or "2pm to 4pm".`,
                };
            }
        }

        // ── CONVERSATIONAL FAST-PATH ──────────────────────────────────────────
        // If the message has NO CRUD intent (not delete/update/get), it's just
        // chat ("thanks bro", "what can you do", random talk). The 70B tool model
        // is overkill AND slow here (→ WORKERS_AI_TIMEOUT). Answer with the FAST
        // 8B model (no tools); canned fallback so it can never time out.
        const needsTools =
            DELETE_INTENT.test(cleanMessage) ||
            UPDATE_INTENT.test(cleanMessage) ||
            GET_INTENT.test(cleanMessage);
        if (!needsTools) {
            traceRoute('conversational (no CRUD) → FAST model (chat.js, no tools)');
            const chips = isGreeting(cleanMessage) ? quickActionChips() : {};
            try {
                const casual = await askCloudflareAI(
                    getCasualPrompt(), cleanMessage, window, env, null,
                    { model: getFastModel(env), timeoutMs: FAST_TIMEOUT_MS }
                );
                // Even the casual model can leak a tool-call dump → salvage it into a
                // real add instead of showing raw JSON.
                const salvaged = salvageTextToolCall(casual);
                if (salvaged) {
                    console.log('[salvaged text tool-call · casual path]', JSON.stringify(salvaged.data.entries));
                    return { action: salvaged };
                }
                return { reply: (typeof casual === 'string' && casual.trim()) ? casual.trim() : cannedSmallTalkReply(cleanMessage), ...chips };
            } catch (e) {
                console.warn('[conversational fast-model failed → canned]', e?.message || e);
                return { reply: cannedSmallTalkReply(cleanMessage), ...chips };
            }
        }

        // ── Otherwise: LLM round-trip for get/update/delete (needs the tool model) ──
        const toolResponse = await askCloudflareAI(
            getSystemPrompt(todayISO(timeZone)),
            cleanMessage,
            window,
            env,
            getToolSchemas()
        );

        const toolCall = toolResponse?.tool_calls?.[0];

        // 🔎 DIAGNOSTIC: surface exactly what the model decided.
        console.log('[AI raw]', JSON.stringify({
            userMessage: cleanMessage,
            toolName: toolCall?.name || null,
            toolArgs: toolCall ? toolCall.arguments : null,
        }));

        if (toolCall) {
            // 🛡️ GET hallucination guard: the model loves to fire get_timesheet
            // with invented dates on random words ("listen" → 2022-01-01). Only
            // allow a history read when the message actually asks for one.
            if (toolCall.name === 'get_timesheet_logs' && !GET_INTENT.test(cleanMessage)) {
                return {
                    reply:
                        "I'm here to help with your timesheet — want me to log some hours, or show your logged hours for a date range?",
                };
            }
            const args = safeParseArgs(toolCall.arguments);
            return { action: { name: toolCall.name, data: args } };
        }

        // No structured tool_call. Some models DESCRIBE the call in plain text
        // (it leaks as raw JSON to the user AND nothing gets saved). Detect that
        // and SALVAGE: pull the add args out and run them; otherwise show a clean
        // hint. The raw function JSON is NEVER surfaced to the user.
        const textOut = typeof toolResponse === 'string'
            ? toolResponse
            : (toolResponse?.response || '');

        const salvaged = salvageTextToolCall(textOut);
        if (salvaged) {
            console.log('[salvaged text tool-call]', JSON.stringify(salvaged.data.entries));
            return { action: salvaged };
        }
        if (/add_timesheet_entries|"type"\s*:\s*"function"/i.test(textOut)) {
            // Looked like a tool-call dump but had no usable entries → clean hint,
            // never the raw JSON.
            return { reply: "Got it — just tell me the time and what you worked on, e.g. \"9-11 fixed the login bug\"." };
        }

        const reply = textOut || "Could you clarify your request? e.g. 'Log 9 to 11 on Project-X' or 'Show my hours this week'.";
        return { reply };

    } catch (err) {
        // Graceful degradation on Workers AI timeout / any pipeline fault.
        if (String(err?.message).includes('_TIMEOUT')) {
            console.warn("[AI Timeout]:", err.message);
            return { reply: "I'm taking too long to respond right now — please try again in a moment." };
        }
        console.error("[Fatal Pipeline Error]:", err);
        return { reply: "Internal error occurred. Please try again." };
    }
}
