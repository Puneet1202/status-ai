// FILE: backend/src/controllers/timesheet.controller.js
// V4.0 - FULLY DYNAMIC | ZERO HARDCODED TIMES | GLOBAL READY

import { aiChat } from '../ai/chat.js';

// =========================================================================
// UTILITY: Resolve or Create Project ID
// =========================================================================
async function getOrCreateProjectId(db, projectName) {
    const cleanName = projectName.trim();
    const existing = await db
        .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)")
        .bind(cleanName)
        .first();
    if (existing) return existing.id;

    const insertResult = await db
        .prepare("INSERT INTO projects (name) VALUES (?)")
        .bind(cleanName)
        .run();

    if (insertResult.meta.changes === 0) {
        throw new Error(`Project creation failed: ${cleanName}`);
    }
    return insertResult.meta.last_row_id;
}

// =========================================================================
// UTILITY: Calculate end time from start + duration
// =========================================================================
function calcEndTime(startTime, durationMinutes) {
    const [sh, sm] = startTime.split(":").map(Number);
    const total = sh * 60 + sm + parseInt(durationMinutes, 10);
    const pad = (n) => String(n).padStart(2, "0");
    // Handles overnight: 23:00 + 240min = 03:00 next day
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

// =========================================================================
// UTILITY: Calculate duration from start and end time
// =========================================================================
function calcMinutesFromTimes(startTime, endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    // Overnight shift: e.g. 23:00 to 03:00 = 240 mins
    if (diff < 0) diff += 24 * 60;
    return diff;
}

// =========================================================================
// UTILITY: Validate time format HH:MM
// =========================================================================
function isValidTime(t) {
    return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);
}

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
// 3. DELETE ENTRY
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
// 4. AI CHAT HANDLER
// =========================================================================
export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        const db = c.env.DB;
        const { message, history = [], pendingAction = null, selectedProject = null } = await c.req.json();

        if (!message) return c.json({ success: false, message: 'Message required' }, 400);

        // Confirm delete flow
        const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());
        if (pendingAction?.action === "DELETE_TIMESHEET" && isConfirming) {
            const deleteResult = await db
                .prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?")
                .bind(pendingAction.matchId, user.id)
                .run();

            if (deleteResult.meta.changes === 0) return c.json({ reply: "Entry not found or already deleted." }, 200);

            return c.json({ success: true, action: "DELETE_TIMESHEET", reply: `Entry from "${pendingAction.projectName}" permanently deleted.` }, 200);
        }

        const result = await aiChat(c.env, user.id, message, history, pendingAction);

        if (result.action) {
            const { action, data } = result.action;

            // ----------------------------------------------------------------
            // ADD TIMESHEET
            // ----------------------------------------------------------------
            if (action === "ADD_TIMESHEET" || action === "add_timesheet_entries") {
                const targetProjectName = selectedProject;
                const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
                const hasTask = data.task_description || hasEntries;

                if (!targetProjectName) {
                    return c.json({ reply: "Please select a project first! Type '@' to choose." }, 200);
                }
                if (!hasTask) {
                    return c.json({ reply: "Please describe what you worked on." }, 200);
                }

                const projectId = await getOrCreateProjectId(db, targetProjectName);
                const todayStr = new Date().toISOString().split('T')[0];
                let entryDate = data.entry_date || todayStr;
                if (!entryDate.startsWith("2026-")) entryDate = todayStr;

                // Build entries array
                let entriesToBatch = [];

                if (action === "add_timesheet_entries" && hasEntries) {
                    // ✅ DYNAMIC: Use exactly what AI parsed — no slot snapping
                    entriesToBatch = data.entries;
                } else {
                    // Single entry from old action format
                    let mins = data.duration_minutes;
                    if (!mins && data.duration_hours) mins = Math.round(Number(data.duration_hours) * 60);
                    if (!mins && data.start_time && data.end_time) mins = calcMinutesFromTimes(data.start_time, data.end_time);

                    // ✅ No fallback to 120 — if times not given, we cannot assume
                    if (!data.start_time) {
                        return c.json({ reply: "Could not detect start time. Please mention when you started, e.g. 'from 10am to 2pm'." }, 200);
                    }

                    entriesToBatch = [{
                        start_time: data.start_time,
                        end_time: data.end_time || (mins ? calcEndTime(data.start_time, mins) : null),
                        duration_minutes: mins,
                        module_name: data.module_name || "GENERAL",
                        task_description: data.task_description
                    }];
                }
                // Filter out lunch entries
// Filter out lunch entries
entriesToBatch = entriesToBatch.filter(e => !e.is_lunch);

// ⛔ Single, clean check for empty entries
if (entriesToBatch.length === 0) {
    return c.json({ 
        reply: "No workable time entries found. Ya toh aapne time mention nahi kiya, ya phir sirf lunch break skip hua hai." 
    }, 200);
}
              // Max 2 hour per entry validation
const exceeding = entriesToBatch.find(e => {
    const mins = e.duration_minutes || calcMinutesFromTimes(e.start_time, e.end_time);
    return mins > 120;
});

if (exceeding) {
    return c.json({
        reply: `Entry from ${exceeding.start_time} to ${exceeding.end_time} exceeds 2 hours. Please split into separate slots of max 2 hours each.`
    }, 200);
}

                // ✅ FULLY DYNAMIC batch insert — no slot snapping, no hardcoded times
                const statements = entriesToBatch.map(entry => {
                    const startTime = entry.start_time;
                    const endTime = entry.end_time || (entry.duration_minutes ? calcEndTime(startTime, entry.duration_minutes) : null);

                    // If still no end time — reject this entry
                    if (!isValidTime(startTime) || !isValidTime(endTime)) {
                        throw new Error(`Invalid time format for entry: ${JSON.stringify(entry)}`);
                    }

                    const rawMinutes = entry.duration_minutes || calcMinutesFromTimes(startTime, endTime);
                    const modName = (entry.module_name || "GENERAL").toUpperCase().trim();

                    return db.prepare(`
                        INSERT INTO daily_status_entries 
                        (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        user.id,
                        projectId,
                        entryDate,
                        startTime,
                        endTime,
                        rawMinutes,
                        modName,
                        entry.task_description?.trim() || "Work update"
                    );
                });
await db.batch(statements);

                // ✅ DYNAMIC RECEIPT GENERATOR
                const summaryLines = entriesToBatch.map(e =>
                    `• ${e.start_time} → ${e.end_time} (${(( e.duration_minutes || calcMinutesFromTimes(e.start_time, e.end_time)) / 60).toFixed(1)} hrs) — ${e.task_description}`
                ).join('\n');

                const totalMins = entriesToBatch.reduce((sum, e) =>
                    sum + (e.duration_minutes || calcMinutesFromTimes(e.start_time, e.end_time)), 0
                );

                return c.json({
                    success: true,
                    action: "ADD_MULTIPLE_TIMESHEETS",
                    reply: `✅ ${entriesToBatch.length} ${entriesToBatch.length === 1 ? 'entry' : 'entries'} saved under "${targetProjectName}" for ${entryDate}.\n\n${summaryLines}\n\nTotal: ${(totalMins / 60).toFixed(1)} hrs`
                }, 200);
            }

            // ----------------------------------------------------------------
            // GET TIMESHEET
            // ----------------------------------------------------------------
            if (action === "GET_TIMESHEET" || action === "get_timesheet_logs") {
                const todayStr = new Date().toISOString().split('T')[0];
                let fromDate = data.from_date || data.date || "2026-01-01";
                let toDate = data.to_date || fromDate || todayStr;

                if (!fromDate.startsWith("2026-")) fromDate = "2026-01-01";
                if (!toDate.startsWith("2026-") || toDate > todayStr) toDate = todayStr;

                let logQuery = `
                    SELECT d.id, d.entry_date, d.start_time, d.end_time,
                           d.duration_minutes, d.module_name, d.task_description, p.name as project_name
                    FROM daily_status_entries d
                    JOIN projects p ON d.project_id = p.id
                    WHERE d.employee_id = ? AND d.entry_date BETWEEN ? AND ?
                `;
                const queryBinds = [user.id, fromDate, toDate];

                if (data.module_name) {
                    logQuery += ` AND UPPER(d.module_name) = UPPER(?)`; queryBinds.push(data.module_name);
                }
                if (data.project_name) {
                    logQuery += ` AND LOWER(p.name) LIKE LOWER(?)`; queryBinds.push(`%${data.project_name.trim()}%`);
                }

                logQuery += ` ORDER BY d.entry_date ASC, d.start_time ASC`;
                const dbRows = await db.prepare(logQuery).bind(...queryBinds).all();

                const totalMinutes = (dbRows.results || []).reduce((sum, r) => sum + parseInt(r.duration_minutes || 0, 10), 0);

                return c.json({
                    success: true,
                    action: "GET_TIMESHEET",
                    reply: `${fromDate} to ${toDate} — Total: ${(totalMinutes / 60).toFixed(1)} hrs (${totalMinutes} mins)`,
                    data: dbRows.results || []
                }, 200);
            }

            // ----------------------------------------------------------------
            // DELETE TIMESHEET
            // ----------------------------------------------------------------
            if (action === "DELETE_TIMESHEET") {
                let matchLog = null;

                if (data.entry_id || data.timesheet_id) {
                    matchLog = await db
                        .prepare(`SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.id = ? AND d.employee_id = ?`)
                        .bind(data.entry_id || data.timesheet_id, user.id)
                        .first();
                }

                if (!matchLog && (data.project_name?.trim() || data.task_description?.trim())) {
                    let q = `SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ?`;
                    const b = [user.id];
                    if (data.project_name?.trim()) { q += ` AND p.name LIKE ?`; b.push(`%${data.project_name.trim()}%`); }
                    if (data.task_description?.trim()) { q += ` AND d.task_description LIKE ?`; b.push(`%${data.task_description.trim()}%`); }
                    q += ` ORDER BY d.created_at DESC LIMIT 1`;
                    matchLog = await db.prepare(q).bind(...b).first();
                }

                if (!matchLog) {
                    matchLog = await db
                        .prepare(`SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`)
                        .bind(user.id)
                        .first();
                }

                if (!matchLog) return c.json({ reply: "No timesheet entries found to delete." }, 200);

                return c.json({
                    requiresConfirmation: true,
                    pendingAction: { action: "DELETE_TIMESHEET", matchId: matchLog.id, projectName: matchLog.project_name },
                    reply: `Found: "${matchLog.project_name}" — ${(matchLog.duration_minutes / 60).toFixed(1)} hrs — "${matchLog.task_description}". Type "confirm" to delete.`
                }, 200);
            }
        }

        return c.json({ ...result, status: 200 }, 200);

    } catch (error) {
        console.error("[AI Handler Error]:", error);
        return c.json({ message: 'Internal server error.', status: 500 }, 500);
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