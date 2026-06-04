// FILE: backend/src/ai/chat.js
// V20 PRODUCTION — SINGLE ROUND-TRIP | SLIDING-WINDOW MEMORY | REGISTRY DISPATCH
//
// One LLM call decides intent + extracts args via native tool calling. There is
// NO raw-SQL path anymore (removed: data-exfiltration risk + 2 extra LLM hops).
// All reads/writes flow through parameterized tools in ./tools/*.

import { askCloudflareAI } from './providers/cloudflare.js';
import { getSystemPrompt, getCasualPrompt } from './tools.js';
import { getToolSchemas } from './tools/index.js';
import { parseEntryDate } from './timeParser.js';
import { extractWorkBlocks } from './blockExtractor.js';
import { todayISO } from './tools/_helpers.js';
import { MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS, MAX_HISTORY_MESSAGES, CHAT_MODEL_FAST, FAST_TIMEOUT_MS } from './ai-config.js';

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

// Deterministic "show my recent/last entries" read — reliable, no LLM. Fires only
// for a clear recent-history phrase that has NO time block (so it can never catch
// an ADD) and isn't a delete/update. Handles "last entry", "last log dikhao",
// "aakhri entries", "recent kaam", "last enter".
const RECENT_WORD = /\b(last|recent|latest|aakhri|akhri|pichl[ae]|previous)\b/i;
const ENTRY_WORD = /\b(entr(?:y|ies)|logs?|enter(?:ed)?|timesheet|status|kaam|work)\b/i;
// Read verbs/nouns + period words for the deterministic date-range read below.
const GET_VERB = /\b(show|list|view|display|fetch|give|gimme|get|dikhao|dikhana|dikhaiye|batao|de ?do|how many|how much|kitne|kitna)\b/i;
const GET_NOUN = /\b(logs?|entr(?:y|ies)|timesheet|tasks?|hours|ghante|kaam|work|total)\b/i;
const PERIOD = /\b(today|aaj|yesterday|kal|kl|parso|this week|last week|this month|last month|weekly|monthly|day before yesterday)\b|\bis haft|\bpichl[ae] haft|\bis mah|\bpichl[ae] mah|\d+\s*(?:days?|din)\s*(?:ago|pehle|pahle)|\d{4}-\d{2}-\d{2}/i;

// A specific time block ("9 se 11", "9-11", "9am") signals LOGGING, not a query.
function looksLikeTimeBlock(text) {
    return /\d{1,2}\s*(?::\d{2})?\s*(?:[-–—]|→|\bto\b|\bse\b|\btill\b)\s*\d/i.test(text)
        || /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)\b/i.test(text);
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

function enrichThinDescriptions(entries, history) {
    if (!entries.length || !entries.every((e) => isThinDesc(e.task_description))) return;
    // most recent prior USER message that's a description (no leading time, ≥3 words, not a question)
    const prev = [...history].reverse().find(
        (h) => h && h.role === 'user' && typeof h.content === 'string'
            && !/^\s*\d/.test(h.content.trim())
            && h.content.trim().split(/\s+/).length >= 3
            && !/\?\s*$/.test(h.content.trim())
    );
    if (!prev) return;
    const desc = cleanPrevDesc(prev.content);
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
// 💬 SMALL-TALK GATE (lightweight heuristic, NOT business logic)
// The 70B model is unreliable at NOT firing a tool on greetings (it
// hallucinates a date range and calls get_timesheet on "hey"). This gate ONLY
// decides "is this a social turn?" — the actual reply is still written by the
// model (see aiChat), just with tools detached so it can't make a bad call.
// Conservative on purpose: ANY digit or work/CRUD keyword opts out, so real
// work never lands here; and if the gate ever misses, the model still answers.
// =========================================================================
const WORK_SIGNAL = /(\d|log|hour|hrs|worked|work on|kaam|task|project|delete|remove|update|change|edit|show|list|report|status|entry|entries|timesheet|break|lunch|shift|am\b|pm\b)/i;

function isSmallTalk(message) {
    const m = message.toLowerCase().trim().replace(/[!.,?]+$/g, '').trim();
    if (!m || m.length > 40) return false;
    if (WORK_SIGNAL.test(m)) return false; // any work signal → let the AI handle it

    return (
        /^(hi+|hey+|hello+|helo+|hii+|yo|hola|namaste|hye|sup|wassup|whats? ?up)$/.test(m) ||
        /^good ?(morning|afternoon|evening|night|day)$/.test(m) ||
        /^(thanks|thank ?you|thank ?u|thx|tysm|ty|shukriya|dhanyavaad)$/.test(m) ||
        /^how ?(are|r) ?(you|u|ya|things)/.test(m) ||
        /^(kaise|kese) ?ho/.test(m) ||
        /^(ok+|okay|kk?|cool|nice|great|awesome|perfect|got it|fine|alright|acha)$/.test(m) ||
        /^(bye+|goodbye|see ?ya|cya|tata|gn|good ?night)$/.test(m)
    );
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
function buildSlidingWindow(history) {
    let safe = (Array.isArray(history) ? history : [])
        // accept only well-formed {role, content} turns
        .filter(h => h && typeof h.content === 'string' && h.content.trim())
        .slice(-MAX_HISTORY_MESSAGES);

    // FIX (was always 0): measure .content length, evict OLDEST until in budget.
    let total = safe.reduce((s, h) => s + h.content.length, 0);
    while (total > MAX_TOTAL_CHARS && safe.length > 1) {
        total -= safe[0].content.length;
        safe = safe.slice(1);
    }
    return safe.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
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

function parseGetRange(message, base) {
    const m = String(message || '').toLowerCase();
    const today = isoDate(base);

    const isoHit = m.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoHit) return { from_date: isoHit[1], to_date: isoHit[1] };

    // "N days ago" / "N din pehle" → that exact past day.
    const ago = m.match(/\b(\d+)\s*(?:days?|din)\s*(?:ago|pehle|pahle|purane?)\b/);
    if (ago) { const d = isoDate(addDays(base, -Math.abs(parseInt(ago[1], 10)))); return { from_date: d, to_date: d }; }
    // day before yesterday / parso → 2 days back.
    if (/\bday before yesterday\b|\bparso\b/.test(m)) { const d = isoDate(addDays(base, -2)); return { from_date: d, to_date: d }; }

    if (/\byesterday\b|\bkal\b|\bkl\b/.test(m)) { const y = isoDate(addDays(base, -1)); return { from_date: y, to_date: y }; }
    if (/\btoday\b|\baaj\b|\babhi\b/.test(m)) return { from_date: today, to_date: today };

    const monThisWeek = addDays(base, -((base.getUTCDay() + 6) % 7)); // Monday of this week
    if (/\blast week\b|\bpichl[ae] haft/.test(m)) {
        return { from_date: isoDate(addDays(monThisWeek, -7)), to_date: isoDate(addDays(monThisWeek, -1)) };
    }
    if (/\bthis week\b|\bis haft|\bweekly\b/.test(m)) {
        return { from_date: isoDate(monThisWeek), to_date: today };
    }

    const firstThisMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12));
    if (/\blast month\b|\bpichl[ae] mah/.test(m)) {
        const end = addDays(firstThisMonth, -1);
        const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 12));
        return { from_date: isoDate(start), to_date: isoDate(end) };
    }
    if (/\bthis month\b|\bis mah|\bmonthly\b/.test(m)) {
        return { from_date: isoDate(firstThisMonth), to_date: today };
    }

    return { recent: true };
}

// "what is my name", "who am I", "mera naam", "my email/role" → answer from the
// logged-in token (get_my_profile), NOT the flaky model which guesses a "name"
// out of the words ("ky hai" → "Kyhai"). Deterministic + exact + safe.
const PROFILE_INTENT = /\bwho am i\b|\b(what'?s|what is|whats|tell me)\s+my\s+(name|email|role)\b|\bmy (name|email|role)\b|\bmera naam\b|\bmera email\b|\bmera role\b|\bmain kaun\b/i;

export async function aiChat(env, userId, message, history = [], selectedProject = null, timeZone = null) {
    try {
        const cleanMessage = (message || '').trim();

        // Guardrail: single-message length.
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        // Profile question → reply from the verified login. Skip if there's a time
        // block (that's a work log, e.g. "9-11 my role permissions feature").
        if (PROFILE_INTENT.test(cleanMessage) && !looksLikeTimeBlock(cleanMessage)) {
            return { action: { name: 'get_my_profile', data: {} } };
        }

        const window = buildSlidingWindow(history);

        // ── Social turn: the model writes a natural reply, but with NO tools
        // attached so it physically cannot hallucinate a get/add/delete call. ──
        if (isSmallTalk(cleanMessage)) {
            // DYNAMIC + FAST: a small 8B model replies naturally in ~0.5-1s (the 70B
            // was too slow → WORKERS_AI_TIMEOUT on "hey"). If even the fast model
            // stalls/errors, fall back to a friendly canned line so the user NEVER
            // sees a timeout. Best of both: natural conversation that can't break.
            try {
                const casual = await askCloudflareAI(
                    getCasualPrompt(), cleanMessage, window, env, null,
                    { model: CHAT_MODEL_FAST, timeoutMs: FAST_TIMEOUT_MS }
                );
                return { reply: (typeof casual === 'string' && casual.trim()) ? casual.trim() : cannedSmallTalkReply(cleanMessage) };
            } catch (e) {
                console.warn('[small-talk fast-model failed → canned fallback]', e?.message || e);
                return { reply: cannedSmallTalkReply(cleanMessage) };
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

        if (
            isReadIntent &&
            !DELETE_INTENT.test(cleanMessage) &&
            !UPDATE_INTENT.test(cleanMessage) &&
            !looksLikeTimeBlock(cleanMessage)
        ) {
            return { action: { name: 'get_timesheet_logs', data: parseGetRange(cleanMessage, nowInTz(timeZone)) } };
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
                    const entry_date = parseEntryDate(cleanMessage, nowInTz(timeZone));
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
            try {
                const casual = await askCloudflareAI(
                    getCasualPrompt(), cleanMessage, window, env, null,
                    { model: CHAT_MODEL_FAST, timeoutMs: FAST_TIMEOUT_MS }
                );
                return { reply: (typeof casual === 'string' && casual.trim()) ? casual.trim() : cannedSmallTalkReply(cleanMessage) };
            } catch (e) {
                console.warn('[conversational fast-model failed → canned]', e?.message || e);
                return { reply: cannedSmallTalkReply(cleanMessage) };
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

        if (/add_timesheet_entries|"type"\s*:\s*"function"/i.test(textOut)) {
            try {
                const parsed = safeParseArgs(textOut);
                const data = parsed?.parameters || parsed;
                if (data && Array.isArray(data.entries) && data.entries.length > 0) {
                    console.log('[salvaged text tool-call]', JSON.stringify(data.entries));
                    return { action: { name: 'add_timesheet_entries', data } };
                }
            } catch { /* fall through to a clean hint */ }
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
