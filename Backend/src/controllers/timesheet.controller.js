// FILE: backend/src/controllers/timesheet.controller.js
// V5.0 - REGISTRY DISPATCH | SHARED HELPERS | GLOBAL READY

import { aiChat } from '../ai/chat.js';
import { dispatchTool } from '../ai/tools/index.js';
import { executeDelete } from '../ai/tools/deleteTimesheet.tool.js';
import { executeUpdate } from '../ai/tools/updateTimesheet.tool.js';
import {
    getOrCreateProjectId,
    calcEndTime,
    calcMinutesFromTimes,
    todayISO,
} from '../ai/tools/_helpers.js';

// =========================================================================
// 1. ADD STATUS ENTRY (Direct REST endpoint)
// =========================================================================
export const addTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        const employeeId = currentUser.id;
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

        const projectId = await getOrCreateProjectId(db, project_name);
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
                   u.name as employee_name, u.email as employee_email, p.name as project_name
            FROM daily_status_entries t
            JOIN users u ON t.employee_id = u.id
            JOIN projects p ON t.project_id = p.id
            WHERE 1=1
        `;
        const binds = [];

        if (currentUser.role === 'employee') {
            sqlQuery += ` AND t.employee_id = ?`;
            binds.push(currentUser.id);
        } else if (employeeName && employeeName !== 'all') {
            sqlQuery += ` AND LOWER(u.name) = LOWER(?)`;
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
            .bind(logId, currentUser.id)
            .run();

        if (result.meta.changes === 0) return c.json({ message: "Entry not found or unauthorized.", success: false }, 404);

        return c.json({ message: "Entry deleted successfully!", success: true }, 200);

    } catch (error) {
        console.error("[Delete Error]:", error);
        return c.json({ message: "Internal Server Error", success: false }, 500);
    }
};

// Best-effort per-user throttle for the EXPENSIVE AI endpoint. Uses Cloudflare's
// native rate-limit binding (env.AI_RATE_LIMITER) when configured; if the binding
// is absent (e.g. plain local dev) it silently no-ops so nothing ever breaks.
// To turn it ON: uncomment the [[unsafe.bindings]] block in wrangler.toml.
async function aiRateLimitOk(c, user) {
    const limiter = c.env.AI_RATE_LIMITER;
    if (!limiter || typeof limiter.limit !== 'function') return true; // not configured → skip
    const key = user?.id ? `user:${user.id}` : `ip:${c.req.header('cf-connecting-ip') || 'anon'}`;
    try {
        const { success } = await limiter.limit({ key: String(key) });
        return success;
    } catch {
        return true; // never block real users on a limiter fault
    }
}

// =========================================================================
// 4. AI CHAT HANDLER — thin orchestrator over the tool registry
// =========================================================================
export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        const db = c.env.DB;
        const { message, history = [], pendingAction = null, selectedProject = null, selectedTasks = [], timezone = null } = await c.req.json();

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
        const ctx = { db, user, env: c.env, selectedProject, selectedTasks: Array.isArray(selectedTasks) ? selectedTasks : [], today: todayISO(timezone) };

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

        // ── Single AI round-trip → tool call or conversational reply ──
        const result = await aiChat(c.env, user.id, message, history, selectedProject, timezone);

        if (result.action) {
            const out = await dispatchTool(result.action.name, result.action.data, ctx);
            return c.json(out, 200);
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

        const noteVal = note ? String(note).slice(0, 500) : null;
        const projVal = selectedProject ? String(selectedProject).slice(0, 200) : null;
        const messagesJson = JSON.stringify(trimmed);

        // Prefer the readable `transcript` column. If migration 0003 hasn't been
        // applied yet (older DB), gracefully fall back to the original insert so
        // reporting never breaks mid-deploy.
        try {
            await db
                .prepare('INSERT INTO ai_feedback (employee_id, note, selected_project, messages, transcript) VALUES (?, ?, ?, ?, ?)')
                .bind(user.id, noteVal, projVal, messagesJson, transcript)
                .run();
        } catch (e) {
            if (/no column named transcript|has no column|no such column/i.test(String(e?.message))) {
                await db
                    .prepare('INSERT INTO ai_feedback (employee_id, note, selected_project, messages) VALUES (?, ?, ?, ?)')
                    .bind(user.id, noteVal, projVal, messagesJson)
                    .run();
            } else {
                throw e;
            }
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
        const { results } = await db.prepare("SELECT id, name FROM projects ORDER BY name ASC").all();
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
  
  // Telemetry: Server ke console mein print karega ki kis project ke liye request aayi hai
  console.log("==> Controller Triggered for Project ID:", projectId);

  try {
    // 👉 LINE 2: Cloudflare D1 Remote Database se connect karke query taiyaar kar rahe hain
    // Hum bol rahe hain: "project_tasks table se id aur task_name nikaalo jahan project_id matches"
    const queryPrepare = c.env.DB.prepare(
      "SELECT id, task_name FROM project_tasks WHERE project_id = ?"
    );

    // 👉 LINE 3: Query ke andar actual projectId ko bind (fit) kar rahe hain aur saara data (.all()) nikaal rahe hain
    const { results } = await queryPrepare.bind(projectId).all();
    
    // 👉 LINE 4: Agar sab sahi raha, toh frontend ko 200 OK status ke sath ekdum saaf JSON data bhej rahe hain
    return c.json({ 
      success: true, 
      tasks: results // Isme saare tasks ki array hogi (like ['UI Design', 'Bug Fix'])
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