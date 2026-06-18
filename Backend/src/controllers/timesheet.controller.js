// FILE: backend/src/controllers/timesheet.controller.js
// V5.0 - REGISTRY DISPATCH | SHARED HELPERS | GLOBAL READY

import { aiChat } from '../ai/chat.js';
import { traceBegin, traceEnd } from '../ai/trace.js';
import { dispatchTool } from '../ai/tools/index.js';
import { executeDelete } from '../ai/tools/deleteTimesheet.tool.js';
import { executeUpdate } from '../ai/tools/updateTimesheet.tool.js';
import { executeOverwrite } from '../ai/tools/addTimesheet.tool.js';
import { sendReportNotification } from '../services/reportNotifier.js';
import {
    resolveProjectId,
    calcEndTime,
    calcMinutesFromTimes,
    todayISO,
    detectOverlap,
    isValidTime,
} from '../ai/tools/_helpers.js';
import { hasWorkTime } from '../ai/timeParser.js';
import { requireTask } from '../ai/ai-config.js';

// =========================================================================
// 1. ADD STATUS ENTRY (Direct REST endpoint)
// =========================================================================
export const addTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        // Timesheet rows key off employee.id — carried in the JWT as employee_id.
        const employeeId = currentUser.employee_id;
        if (!employeeId) {
            return c.json({ message: "Your account isn't linked to an employee record, so timesheet entries can't be saved.", success: false }, 403);
        }
        const body = await c.req.json();

        let { entry_date, start_time, end_time, module_name, task_description, project_name, duration_minutes, duration_hours } = body;

        // Duration normalization — no hardcoded fallback
        if (!duration_minutes && duration_hours) {
            duration_minutes = Math.round(parseFloat(duration_hours) * 60);
        }
        if (!duration_minutes && start_time && end_time) {
            duration_minutes = calcMinutesFromTimes(start_time, end_time);
        }
        if (!end_time && start_time && duration_minutes) {
            end_time = calcEndTime(start_time, duration_minutes);
        }
        if (!entry_date || !start_time || !end_time || !duration_minutes || !task_description || !project_name) {
            return c.json({ message: "Missing required fields: entry_date, start_time, end_time, duration_minutes, task_description, project_name", success: false }, 400);
        }

        // ⛔ MANUAL ROUTE GUARDRAIL: Max 2 Hours (120 mins) validation
        if (parseInt(duration_minutes, 10) > 120) {
            return c.json({
                message: "Validation Error: You cannot log a manual entry exceeding 2 hours (120 mins) at once. Please split your work into smaller slots.",
                success: false
            }, 400);
        }

        const projectId = await resolveProjectId(db, project_name);
        if (!projectId) {
            return c.json({ message: `Project "${project_name}" not found. Please pick an existing project.`, success: false }, 404);
        }
        const result = await db
            .prepare(`INSERT INTO daily_status_entries (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(employeeId, projectId, entry_date, start_time, end_time, parseInt(duration_minutes, 10), (module_name || "GENERAL").toUpperCase().trim(), task_description)
            .run();

        if (result.meta.changes === 0) throw new Error("Insert failed.");

        return c.json({ message: "Entry saved successfully!", success: true }, 201);

    } catch (error) {
        console.error("[Timesheet Insert Error]:", error);
        return c.json({ message: "Internal Server Error", success: false }, 500);
    }
};

// =========================================================================
// 2. ADMIN FILTER SEARCH
// =========================================================================
export const getAllTimesheetsAdmin = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        const { dateFrom, dateTo, employeeName, clientName } = Object.fromEntries(
            ['dateFrom', 'dateTo', 'employeeName', 'clientName'].map(k => [k, c.req.query(k)])
        );

        let sqlQuery = `
            SELECT t.id, t.employee_id, t.project_id, t.entry_date, t.start_time, t.end_time,
                   t.duration_minutes, t.task_description, t.module_name, t.is_email_sent, t.created_at,
                   e.name as employee_name, p.name as project_name
            FROM daily_status_entries t
            JOIN employee e ON t.employee_id = e.id
            JOIN projects p ON t.project_id = p.id
            WHERE 1=1
        `;
        const binds = [];

        if (currentUser.role === 'employee') {
            sqlQuery += ` AND t.employee_id = ?`;
            binds.push(currentUser.employee_id);
        } else if (employeeName && employeeName !== 'all') {
            sqlQuery += ` AND LOWER(e.name) = LOWER(?)`;
            binds.push(employeeName);
        }

        if (dateFrom) { sqlQuery += ` AND t.entry_date >= ?`; binds.push(dateFrom); }
        if (dateTo) { sqlQuery += ` AND t.entry_date <= ?`; binds.push(dateTo); }
        if (clientName && clientName !== 'all') {
            sqlQuery += ` AND LOWER(p.name) LIKE LOWER(?)`; binds.push(`%${clientName}%`);
        }

        sqlQuery += ` ORDER BY t.entry_date DESC, t.created_at DESC`;
        const stmt = db.prepare(sqlQuery);
        const { results } = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

        return c.json({ total_records: results.length, telemetry_logs: results, success: true }, 200);

    } catch (error) {
        console.error("[Filter Engine Error]:", error);
        return c.json({ message: "Internal Server Error", success: false }, 500);
    }
};

// =========================================================================
// 3. DELETE ENTRY (Direct REST endpoint)
// =========================================================================
export const deleteTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        const logId = c.req.param('id');

        if (!logId) return c.json({ message: "Missing entry ID", success: false }, 400);

        const result = await db
            .prepare(`DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?`)
            .bind(logId, currentUser.employee_id)
            .run();

        if (result.meta.changes === 0) return c.json({ message: "Entry not found or unauthorized.", success: false }, 404);

        return c.json({ message: "Entry deleted successfully!", success: true }, 200);

    } catch (error) {
        console.error("[Delete Error]:", error);
        return c.json({ message: "Internal Server Error", success: false }, 500);
    }
};

// In-memory sliding-window throttle — works EVERYWHERE (Node + Workers), so a
// chatty employee can't burn tokens by spamming the brain. Window + cap are
// env-tunable (AI_RATE_PER_MIN, default 20/min per user). Single-process state;
// on multi-isolate Workers the native binding below is the durable layer.
const RL_WINDOW_MS = 60_000;
const rlHits = new Map(); // key -> [timestamps within the window]
function inMemoryRateOk(key, maxPerMin) {
    const now = Date.now();
    const recent = (rlHits.get(key) || []).filter((t) => now - t < RL_WINDOW_MS);
    if (recent.length >= maxPerMin) { rlHits.set(key, recent); return false; }
    recent.push(now);
    rlHits.set(key, recent);
    if (rlHits.size > 5000) { // cheap GC so the map can't grow forever
        for (const [k, arr] of rlHits) if (!arr.some((t) => now - t < RL_WINDOW_MS)) rlHits.delete(k);
    }
    return true;
}

// Per-user throttle for the EXPENSIVE AI endpoint. Two layers: (1) Cloudflare's
// native rate-limit binding (env.AI_RATE_LIMITER) when configured — durable across
// Workers isolates; (2) an always-on in-memory window so local/Node deploys are
// protected too. Either layer saying "no" throttles the request.
async function aiRateLimitOk(c, user) {
    const key = user?.id ? `user:${user.id}` : `ip:${c.req.header('cf-connecting-ip') || 'anon'}`;
    const maxPerMin = Math.max(1, parseInt(c.env.AI_RATE_PER_MIN, 10) || 20);
    if (!inMemoryRateOk(String(key), maxPerMin)) return false;

    const limiter = c.env.AI_RATE_LIMITER;
    if (!limiter || typeof limiter.limit !== 'function') return true; // binding absent → in-memory only
    try {
        const { success } = await limiter.limit({ key: String(key) });
        return success;
    } catch {
        return true; // never block real users on a limiter fault
    }
}

// Standard 2-hour work slots (lunch gap 13:00–14:00) used to nudge a user who
// picked project + task but forgot the time. User feedback: chips ALWAYS dikhne
// chahiye — slot logged ho ya na ho. Agar logged slot tap kiya, normal add flow
// overlap detect karke overwrite-confirm (Yes/No) chips de deta hai → koi data loss
// nahi. Clicking a chip sends "HH:MM to HH:MM" with the project pill + ticked task
// still active → add flow handle karta hai.
const STD_SLOTS = [["09:00", "11:00"], ["11:00", "13:00"], ["14:00", "16:00"], ["16:00", "18:00"]];
function buildTimeSlotChips() {
    const fmt = (t) => {
        const [h, m] = t.split(":").map(Number);
        const ap = h < 12 ? "AM" : "PM";
        const hh = ((h + 11) % 12) + 1;
        return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
    };
    return STD_SLOTS.map(([s, e]) => ({ label: `${fmt(s)} – ${fmt(e)}`, value: `${s} to ${e}` }));
}

// =========================================================================
// 4. AI CHAT HANDLER — thin orchestrator over the tool registry
// =========================================================================
export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        const db = c.env.DB;
        const { message, history = [], pendingAction = null, selectedProject = null, selectedTasks = [], timezone = null, viewAs = null, editTimesheetId = null, replaceEntryIds = null, chipAction = null } = await c.req.json();

        if (!message) return c.json({ success: false, message: 'Message required' }, 400);

        // Throttle abusive bursts before spending an AI call (429 = too many).
        if (!(await aiRateLimitOk(c, user))) {
            return c.json({
                reply: "You're sending messages a bit too fast — please wait a few seconds and try again.",
                success: false,
            }, 429);
        }

        // selectedTasks: the predefined project tasks the user ticked in the UI.
        // These become each saved entry's module_name (see addTimesheet handler).
        // timezone: the user's IANA zone (sent by the frontend) so "today"/"kal"
        // resolve to the user's real local date, not UTC (fixes night-shift logs).
        // Org-viewer? FULLY DB-DRIVEN — gate SIRF 'all_employee_attendance' pe hai,
        // kyunki iska matlab hi hai "poore org ke employees dekh sakta hu" (HR/Admin/
        // Superadmin teeno ke paas hai). 'search_status' pe gate NAHI karte: wo ek
        // aam view permission hai jo normal employee ke paas bhi ho sakti hai → us
        // pe gate karne se employee dusro ka data dekh leta (privacy leak). Sir DB me
        // kisi role ko 'all_employee_attendance' de/le → AI khud adapt karega.
        let isOrgViewer = false;
        let permSet = new Set();
        try {
            const permRows = await db.prepare(
                `SELECT p.name FROM users u
                   JOIN role_permissions rp ON rp.role_id = u.role_id
                   JOIN permissions p ON p.id = rp.permission_id
                  WHERE u.id = ?`
            ).bind(user.id).all();
            permSet = new Set((permRows.results || []).map((r) => r.name));
            isOrgViewer = permSet.has('all_employee_attendance');
        } catch (e) {
            console.warn('[perm load failed]', e?.message || e);
        }

        // perms = LIVE permission set (har request pe fresh DB se). Tools isse apni
        // specific permission check karte hai → admin DB me OFF kare to AGLE message
        // pe AI khud mana kar deta, koi alag sync/config nahi. (auto-sync built-in)
        const ctx = { db, user, employeeId: user.employee_id, isOrgViewer, perms: permSet, env: c.env, selectedProject, selectedTasks: Array.isArray(selectedTasks) ? selectedTasks : [], today: todayISO(timezone) };

        // ── EDIT-CHIP exact update: frontend sends the just-saved row's id, so we
        // update THAT exact entry (no locating by start-time → no "5 matches /
        // confirm", no project/task re-select). Format: "update entry HH:MM to HH:MM
        // <new text>". The id makes it precise; end-time + description may change.
        const editCmd = editTimesheetId != null
            && String(message).match(/^\s*(?:update|edit)\s+entry\s+\d{1,2}:\d{2}\s+to\s+(\d{1,2}:\d{2})\s*(.*)$/i);
        if (editCmd) {
            const upd = { timesheet_id: editTimesheetId, new_end_time: editCmd[1] };
            const newDesc = editCmd[2].trim();
            if (newDesc) upd.new_task_description = newDesc;
            const out = await dispatchTool("update_timesheet", upd, ctx);
            return c.json(out, 200);
        }

        // ── EDIT WHOLE DAY (replace): the frontend "Edit" button sends the ids of
        // the entries being edited + the edited blocks as a fresh multi-block message.
        // DELETE those exact rows, then the normal add flow below re-saves the edited
        // blocks (under the restored project). Guard: only when the new message has a
        // time block, so an empty/garbled edit never wipes entries.
        if (Array.isArray(replaceEntryIds) && replaceEntryIds.length > 0 && user?.employee_id
            && /\d{1,2}\s*(?::\d{2})?\s*(?:to|till|se|[-–—])\s*\d/i.test(String(message))) {
            try {
                for (const rid of replaceEntryIds) {
                    await db.prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?")
                        .bind(rid, user.employee_id).run();
                }
                // Flag so the add handler's receipt says "Updated" (not "saved") —
                // this is an EDIT (delete old + re-save), not a fresh log.
                ctx.editReplace = true;
            } catch (e) {
                console.warn("[edit-replace delete failed]", e?.message || e);
            }
            // fall through → aiChat routes the edited blocks to add_timesheet_entries
        }

        // ── Confirm-intercept: a pending action (delete/update) + a yes/confirm ──
        const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());
        if (isConfirming && pendingAction?.action === "DELETE_TIMESHEET") {
            const out = await executeDelete(ctx, pendingAction);
            return c.json(out, 200);
        }
        if (isConfirming && pendingAction?.action === "UPDATE_TIMESHEET") {
            const out = await executeUpdate(ctx, pendingAction);
            return c.json(out, 200);
        }
        // Overlap → "Yes, update existing" / "No, keep existing" chips ka response.
        if (pendingAction?.action === "OVERWRITE_TIMESHEET") {
            const declining = /^(no|nahi|nahin|cancel|rehne|rakho|keep|nope)\b/i.test(message.trim());
            if (declining) {
                return c.json({
                    reply: "Okay — the existing entry is unchanged. Send a different time if you want to log this separately, or tap below to review what's already logged.",
                    options: [{ label: "📋 View today's entries", value: "show my entries for today" }],
                    optionsTitle: "What next?",
                }, 200);
            }
            if (isConfirming) {
                // SECURITY: pendingAction client se aata hai → employee_id ko blindly
                // honor mat karo. Sirf org-viewer + enter_status (add-for-others wala)
                // hi dusre employee ko target kar sakta hai; baaki sab ke liye id strip
                // → apne hi account pe overwrite (koi dusre ki entry chhu na sake).
                const canAddForOthers = isOrgViewer && permSet.has('enter_status');
                if (!canAddForOthers && pendingAction.employee_id) {
                    delete pendingAction.employee_id;
                }
                const out = await executeOverwrite(ctx, pendingAction);
                return c.json(out, 200);
            }
        }

        // ── NO-TIME NUDGE ──────────────────────────────────────────────────
        // User ne project AUR task chun liya (clearly logging mode) par message me
        // koi time nahi diya aur ye read/command bhi nahi → LLM ko mat bhejo (wo
        // "I don't understand" bol deta hai). Deterministically batao ki sirf time
        // reh gaya hai, aur ready time-slot chips do. Chip tap = "HH:MM to HH:MM"
        // (project pill + ticked task abhi bhi active) → seedha save, project/task
        // dobara nahi maangega. Read/delete/update jaise commands skip kar dete hai.
        // Task gate: AI_REQUIRE_TASK=false → sirf project se logging mode (task optional).
        const inLoggingMode = !!selectedProject
            && (!requireTask(c.env) || (Array.isArray(selectedTasks) && selectedTasks.length > 0));
        const looksReadOrCmd = /\b(show|list|view|search|filter|find|display|get|entr|logs?|dikha|batao|kitn|how many|how much|analy|delete|remove|hata|update|edit|total|report|leave|help)\b/i.test(message);
        if (inLoggingMode && !pendingAction && !isConfirming && !hasWorkTime(message) && !looksReadOrCmd) {
            // Chips HAMESHA — slot bhara ho ya na ho. Logged slot tap karoge to add flow
            // khud overlap pakad kar overwrite-confirm (Yes/No) de dega.
            const slotChips = buildTimeSlotChips();
            return c.json({
                reply: "Project and task are set — I just need the time. Tell me the hours you worked (e.g. \"9 to 11\"), or tap a slot below:",
                options: slotChips,
                optionsTitle: "Pick a time slot:",
                optionsSingleUse: true, // ek slot tap → baaki chips hide
            }, 200);
        }

        // ── DIRECT CHIP ACTION (router bypass — 100% reliable) ─────────────────
        // A read/analytics chip can carry a STRUCTURED action ({name,data}) instead
        // of relying on its text re-entering the NLP router. This makes chips immune
        // to routing regressions (a new regex can never "steal" a chip's text, e.g.
        // "show hours by month" being mistaken for an employee name). SECURITY: only
        // READ tools are allowed here — add/update/delete still go through full
        // validation + confirmation, never a blind client-supplied action. The
        // result then flows through the SAME sticky-viewer / add-for-others scoping
        // below as any other action (so viewAs still applies to the viewed teammate).
        const CHIP_ACTION_ALLOW = new Set(['analyze_timesheet', 'get_timesheet_logs', 'query_timesheet', 'get_employee_info']);
        let result;
        if (chipAction && typeof chipAction === 'object' && CHIP_ACTION_ALLOW.has(chipAction.name)) {
            result = { action: { name: chipAction.name, data: (chipAction.data && typeof chipAction.data === 'object') ? chipAction.data : {} } };
        } else {
            // ── Single AI round-trip → tool call or conversational reply ──
            // traceBegin/End wrap the whole turn so the console prints one MESSAGE
            // TRACE box (route + brain/tool call counts + tokens) per message.
            traceBegin(message);
            try {
                result = await aiChat(c.env, user.id, message, history, selectedProject, timezone, isOrgViewer, viewAs, selectedTasks);
            } finally {
                traceEnd();
            }
        }

        // "Log MY hours" / self-intent in a LOGGING context → clear any "Viewing: X"
        // pill so a follow-up "9-11 ..." logs for SELF, not the viewed teammate.
        // (Safety: stale read-pill ko add-for-others me leak hone se rokta hai.)
        const SELF_LOG = isOrgViewer
            && /\b(my|mera|meri|mere|apni|apna|apne|khud|self|mine)\b/i.test(message)
            && /\b(log|add|enter|fill|status|hours?|ghante)\b/i.test(message);

        if (result.action) {
            // ── SAFETY NET: never leak the HR's OWN profile while viewing someone ──
            // The brain sometimes routes a person-info question ("mother name", "his
            // details", "designation") to get_my_profile, which is SELF-only — so it
            // would show the logged-in HR's profile even though a teammate is selected.
            // When an org-viewer has a sticky "Viewing: X" and did NOT say my/mera,
            // redirect that self-profile call to get_employee_info for the VIEWED
            // teammate (employee_name=viewAs gets injected by the READ_TOOL block
            // below). Deterministic → model behaviour can't break the scoping.
            if (isOrgViewer && viewAs && typeof viewAs === 'string'
                && result.action.name === 'get_my_profile'
                && !/\b(my own|mine|my|mera|meri|mere|apni|apna|apne|khud|khudki|self)\b/i.test(message)) {
                result.action = { name: 'get_employee_info', data: { ...(result.action.data || {}) } };
            }

            // ── STICKY VIEWER SCOPE (org-viewer only) ──────────────────────────
            // Ek baar HR/Admin ne kisi employee ko (ya "apni") choose kiya, to AGLE
            // reads usi pe chalein — har baar naam dobara na dena pade (user feedback).
            // viewAs = frontend ka sticky "Viewing: <naam>" (us banda ka email).
            // Precedence: (1) is message me naam diya → wahi (naya sticky banta hai).
            // (2) "apni/meri/my/khud" bola → self + sticky CLEAR. (3) na naam na self →
            // pichla sticky (viewAs) lagao. READ tools par hi — log/edit/delete hamesha
            // khud ke (security): unka scope yahan kabhi nahi badalta.
            const READ_TOOL = /^(get_timesheet_logs|query_timesheet|analyze_timesheet|get_employee_info)$/.test(result.action.name);
            const SELF_INTENT = /\b(my own|mine|my|mera|meri|mere|apni|apna|apne|khud|khudki|self)\b/i;
            // User ne KHUD comparison maanga tabhi leaderboard chale — warna sticky
            // viewer jeet'ta hai ("Viewing: Puneet" + "total attendance" = PUNEET ka
            // total, sab employees ka nahi). Model kabhi-kabhi vague "total X" ko
            // compare samajh leta hai — ye deterministic override use rok deta hai.
            const COMPARE_WORDS = /\b(compare|comparison|sabse\s+(?:zyada|kam)|kisne|who\s+worked|which\s+employee|leaderboard|top\s+employee|all\s+employees?|every(?:one|body)|har\s+employee|sab(?:hi)?\s+employees?|sb\s+emplo)/i;
            let isCompareAll = result.action.data?.compare_employees === true;
            if (isCompareAll && viewAs && !COMPARE_WORDS.test(message)) {
                delete result.action.data.compare_employees;
                isCompareAll = false; // ab ye scoped read hai → niche viewAs lagega
            }
            let clearViewTarget = false;
            if (isOrgViewer && READ_TOOL && !isCompareAll) {
                if (result.action.data?.employee_name) {
                    // explicit naam is message me → dispatchTool ise resolve karke
                    // viewTarget laut'ata hai (naya sticky).
                } else if (SELF_INTENT.test(message)) {
                    clearViewTarget = true; // user ne saaf kaha "apni" → sticky hatao
                } else if (viewAs && typeof viewAs === 'string') {
                    result.action.data = { ...result.action.data, employee_name: viewAs };
                }
            }

            // ── ADD-FOR-OTHERS ────────────────────────────────────────────────
            // HR/Admin "Viewing: <X>" pill ke saath hours log kare (aur "my/apni"
            // na bole) → wo hours USI X ke liye save ho. Gate: org-viewer +
            // enter_status (dispatchTool me dobara verify). "Log my hours" chip me
            // "my" hota hai → SELF_INTENT true → self hi rehta (safe).
            // SELF_LOG → kabhi add-for-others inject mat karo (self hi), aur pill clear.
            if (result.action.name === 'add_timesheet_entries'
                && !SELF_LOG
                && isOrgViewer && permSet.has('enter_status')
                && !SELF_INTENT.test(message)
                && viewAs && typeof viewAs === 'string'
                && !result.action.data?.employee_name) {
                result.action.data = { ...result.action.data, employee_name: viewAs };
            }
            if (SELF_LOG) clearViewTarget = true; // self-log → "Viewing" pill hatao

            const out = await dispatchTool(result.action.name, result.action.data, ctx);
            // self bola → frontend ka pill clear karo (viewTarget: null bhej ke)
            if (clearViewTarget && out && typeof out === 'object' && out.viewTarget === undefined) {
                out.viewTarget = null;
            }
            return c.json(out, 200);
        }

        // Non-action reply (e.g. "log my hours" → "give me the time"). Self-log →
        // pill clear yahan bhi, taaki agle "9-11 ..." message me self hi rahe.
        if (SELF_LOG && result && typeof result === 'object' && result.viewTarget === undefined) {
            result.viewTarget = null;
        }
        return c.json(result, 200);

    } catch (error) {
        console.error("[AI Handler Error]:", error);
        return c.json({ reply: 'Internal server error. Please try again.', success: false }, 500);
    }
};

// =========================================================================
// 4b. AI FEEDBACK / "REPORT" — user taps Report in the chatbot when the AI
//     replied wrong. We snapshot the last ~10 messages so you can review the
//     failure later and turn it into a test case / prompt example.
// =========================================================================
export const submitAiFeedback = async (c) => {
    try {
        const db = c.env.DB;
        const user = c.get('user');
        const { messages = [], note = null, selectedProject = null } = await c.req.json();

        if (!Array.isArray(messages) || messages.length === 0) {
            return c.json({ success: false, message: 'Nothing to report — the chat is empty.' }, 400);
        }

        // Keep only the last 10 turns, and only the fields we need (no bloat).
        const trimmed = messages.slice(-10).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 4000),
            context: m.context ? String(m.context).slice(0, 200) : null,
        }));

        // Human-readable transcript so you can open a feedback row and instantly
        // see what the user said and what the AI replied — no JSON parsing needed:
        //   [1] USER (project: AI Project): 9 se 11 bug fix
        //   [2] AI: I couldn't read the time blocks...
        const transcript = trimmed
            .map((m, i) => {
                const who = m.role === 'assistant' ? 'AI' : 'USER';
                const ctx = m.context ? ` (project: ${m.context})` : '';
                return `[${i + 1}] ${who}${ctx}: ${m.content}`;
            })
            .join('\n');

        const employeeId = user.employee_id;
        const noteVal = note ? String(note).slice(0, 500) : null;
        const projVal = selectedProject ? String(selectedProject).slice(0, 200) : null;
        const messagesJson = JSON.stringify(trimmed);

        // Prefer the readable `transcript` column. If migration 0003 hasn't been
        // applied yet (older DB), gracefully fall back to the original insert so
        // reporting never breaks mid-deploy.
        try {
            await db
                .prepare('INSERT INTO ai_feedback (employee_id, note, selected_project, messages, transcript) VALUES (?, ?, ?, ?, ?)')
                .bind(employeeId, noteVal, projVal, messagesJson, transcript)
                .run();
        } catch (e) {
            if (/no column named transcript|has no column|no such column/i.test(String(e?.message))) {
                await db
                    .prepare('INSERT INTO ai_feedback (employee_id, note, selected_project, messages) VALUES (?, ?, ?, ?)')
                    .bind(employeeId, noteVal, projVal, messagesJson)
                    .run();
            } else {
                throw e;
            }
        }

        // Instant alert (Slack/Discord) so you SEE the mistake without watching the
        // DB. Best-effort + name lookup for a readable message; never blocks/saves-fail.
        try {
            const emp = await db.prepare('SELECT name FROM employee WHERE id = ?').bind(employeeId).first();
            await sendReportNotification(c.env, {
                employeeName: emp?.name || null,
                employeeId,
                project: projVal,
                note: noteVal,
                transcript,
            });
        } catch (e) {
            console.warn('[report notify skipped]', e?.message || e);
        }

        return c.json({ success: true, message: 'Thanks! Your report was saved.' }, 201);
    } catch (error) {
        console.error('[AI Feedback Error]:', error);
        return c.json({ success: false, message: 'Could not save the report. Please try again.' }, 500);
    }
};

// =========================================================================
// 5. GET PROJECTS
// =========================================================================
export const getProjects = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');

        // Chatbot me har user APNA OWN time log karta hai — to role chahe koi bhi ho
        // (HR/Admin/Employee), default me LOGGED-IN user ke ASSIGNED projects do. Ye sir
        // ke "Enter Status" form jaisा hi hai (Prachi/HR ko bhi sirf uske assigned
        // dikhte hain) aur fully DB-driven (project_assignments → employee_id). Pehle
        // HR/Admin ko SAARE company projects milte the → AI me doosron ke projects
        // dikh jate the (galat).
        let targetEmployeeId = currentUser.employee_id;

        // ── ADD-FOR-OTHERS scope ──────────────────────────────────────────────
        // HR/Admin jab "Viewing: <X>" pill ke saath '@'-project picker khole, to use
        // X ke ASSIGNED projects dikhne chahiye (X ka status log karna hai), apne nahi.
        // Pehle yahan hamesha apne hi projects aate the → dusre employee ka status
        // enter karte waqt galat (apne) projects/tasks dikhte the. Gate add-for-others
        // jaisा hi: org-viewer (all_employee_attendance) + enter_status DONO. viewAs =
        // us employee ka email (frontend sticky pill se). Normal employee / bina
        // permission → chup-chaap apna hi scope (security).
        const viewAs = String(c.req.query('viewAs') || '').trim();
        if (viewAs && viewAs !== (currentUser.email || '')) {
            try {
                const permRows = await db.prepare(
                    `SELECT p.name FROM users u
                       JOIN role_permissions rp ON rp.role_id = u.role_id
                       JOIN permissions p ON p.id = rp.permission_id
                      WHERE u.id = ?`
                ).bind(currentUser.id).all();
                const perms = new Set((permRows.results || []).map((r) => r.name));
                if (perms.has('all_employee_attendance') && perms.has('enter_status')) {
                    const tgt = await db.prepare(
                        `SELECT e.id
                           FROM employee e
                           JOIN users u ON u.employee_id = e.id
                          WHERE u.email = ? AND u.is_active = 1
                          LIMIT 1`
                    ).bind(viewAs).first();
                    if (tgt && tgt.id != null) targetEmployeeId = tgt.id;
                }
            } catch (e) {
                console.warn('[getProjects viewAs resolve failed]', e?.message || e);
            }
        }

        const { results } = await db
            .prepare(`SELECT DISTINCT p.id, p.name
                        FROM projects p
                        JOIN project_assignments pa ON pa.project_id = p.id
                       WHERE pa.employee_id = ?
                       ORDER BY p.name ASC`)
            .bind(targetEmployeeId)
            .all();

        return c.json({ projects: results, success: true }, 200);
    } catch (error) {
        console.error("[Projects Error]:", error);
        return c.json({ success: false, message: "Failed to fetch projects" }, 500);
    }
};


// =========================================================================
// ⭐ NEW CONTROLLER ACTION: Fetch Project Specific Tasks Dynamically
// =========================================================================
// Yeh function tab chalega jab frontend se request aayegi. 
// 'c' ka matlab hai Hono ka Context, jisme Request aur Environment variables hote hain.
export const getProjectTasksController = async (c) => {
  
  // 👉 LINE 1: Frontend jo URL bhejega (like /projects/2/tasks), usme se hum 'id' (Project ID) nikaal rahe hain
  const projectId = c.req.param('id');

  try {
    // prod.db has a `tasks` table (task_key, title, project_id, …) — there is no
    // `project_tasks`. We expose `title` as `task_name` so the frontend contract
    // (id + task_name) stays unchanged. Only real, active tasks for this project.
    const queryPrepare = c.env.DB.prepare(
      "SELECT id, title AS task_name FROM tasks WHERE project_id = ? ORDER BY title ASC"
    );

    const { results } = await queryPrepare.bind(projectId).all();

    return c.json({
      success: true,
      tasks: results
    }, 200);

  } catch (error) {
    // 👉 LINE 5: Agar database fail hota hai ya koi crash hota hai, toh error yahan pakda jayega
    console.error("❌ CLOUD D1 ERROR OCCURRED:", error);
    
    // 👉 LINE 6: Frontend ko safe error response bhejenge taaki user ki screen freeze na ho
    return c.json({ 
      success: false, 
      error: "Could not fetch tasks for this project. Please try again."
    }, 500);
  }
};