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

// =========================================================================
// 4. AI CHAT HANDLER — thin orchestrator over the tool registry
// =========================================================================
export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        const db = c.env.DB;
        const { message, history = [], pendingAction = null, selectedProject = null } = await c.req.json();

        if (!message) return c.json({ success: false, message: 'Message required' }, 400);

        const ctx = { db, user, env: c.env, selectedProject, today: todayISO() };

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
        const result = await aiChat(c.env, user.id, message, history);

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
      error: "Database se tasks fetch karne mein koi dikkat aayi hai." 
    }, 500);
  }
};