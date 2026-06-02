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
import { MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS, MAX_HISTORY_MESSAGES } from './ai-config.js';

// =========================================================================
// 🎯 DETERMINISTIC INTENT HINTS
// Used to decide when we can settle a turn in code (reliable) vs. hand it to
// the flaky model. Add is the hot path → parsed deterministically below.
// =========================================================================
const DELETE_INTENT = /\b(delete|remove|erase|discard|hata do|mita do)\b/i;
// Conservative on purpose: only fire on phrases that clearly mean "edit an
// EXISTING logged entry" — NOT common work verbs like "fix"/"change" which
// appear in normal descriptions ("9-10 fix the ui bugs" is an ADD, not an edit).
const UPDATE_INTENT = /\b(?:update|edit|correct|modify)\s+(?:the |my |that |previous |last )?(?:entry|entries|time|timing|log|logs|record|timesheet|slot)\b|\bactually it was\b|\bmade a mistake\b|\bwrong (?:time|entry|slot)\b|\bgalti se (?:add|log|likh)/i;
// STRONG_GET = read verbs only (NOT date words) — used to keep an obvious
// history query from being parsed as an add. "log yesterday 9-11" has a date
// word but no read verb, so it stays an ADD.
const STRONG_GET = /\b(show|list|view|fetch|display|history|report|summary|how many|how much|kitne|kitna|total hours|fetch my|my logs)\b/i;
// Broad signal — used only to gate the model's get_timesheet call (anti-hallucination).
const GET_INTENT = /\b(show|list|view|fetch|display|history|report|summary|total|how many|how much|kitne|kitna|logged|my hours|my entries|this week|last week|this month|last month|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/i;

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

export async function aiChat(env, userId, message, history = [], selectedProject = null) {
    try {
        const cleanMessage = (message || '').trim();

        // Guardrail: single-message length.
        if (cleanMessage.length > MAX_MESSAGE_CHARS) {
            return { reply: "Message too long. Please keep your request under 4000 characters." };
        }

        const window = buildSlidingWindow(history);

        // ── Social turn: the model writes a natural reply, but with NO tools
        // attached so it physically cannot hallucinate a get/add/delete call. ──
        if (isSmallTalk(cleanMessage)) {
            const casual = await askCloudflareAI(getCasualPrompt(), cleanMessage, window, env, null);
            const reply =
                typeof casual === 'string' && casual.trim()
                    ? casual.trim()
                    : "Hey! 👋 Want me to log some hours? Just tell me the time and the task.";
            return { reply };
        }

        // ── DETERMINISTIC ADD (the hot path) — parse work blocks in code. ──
        // The model was flaky at emitting the entries[] array; parsing is
        // mechanical, so we do it ourselves: 100% repeatable, fast, no timeout.
        // Skip only when the user clearly wants delete/update or an explicit read.
        const wantsOther =
            DELETE_INTENT.test(cleanMessage) ||
            UPDATE_INTENT.test(cleanMessage) ||
            STRONG_GET.test(cleanMessage);

        if (!wantsOther) {
            // HYBRID: LLM understands any format → regex fallback → handler validates.
            const { entries, source } = await extractWorkBlocks(cleanMessage, env);
            if (entries.length > 0) {
                // Multi-turn: borrow a real description from the previous message
                // when this one was basically just a time.
                enrichThinDescriptions(entries, history);
                const entry_date = parseEntryDate(cleanMessage);
                console.log(`[hybrid add: ${source}]`, JSON.stringify({ entry_date, entries }));
                return {
                    action: {
                        name: 'add_timesheet_entries',
                        data: { entries, ...(entry_date ? { entry_date } : {}) },
                    },
                };
            }

            // Extraction found nothing. If the message LOOKED like a time-log
            // (has a digit), the regex couldn't parse it AND the LLM rescue
            // failed/timed-out. Fail FAST with an actionable message instead of
            // burning a second LLM round-trip — the user just re-sends in a
            // clearer format (which the instant regex then handles). The user's
            // text is never lost; nothing bad is saved.
            if (/\d/.test(cleanMessage)) {
                console.warn('[hybrid add] no blocks extracted (regex + LLM) for:', cleanMessage);
                return {
                    reply:
                        "I couldn't read the time blocks in that one. Could you re-send in a clearer format? e.g. \"9-11 API work\" or \"9 to 11 fixed login bug; 2 to 4 testing\".",
                };
            }

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

        // ── Otherwise: LLM round-trip for get/update/delete or ambiguous text ──
        const toolResponse = await askCloudflareAI(
            getSystemPrompt(),
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
