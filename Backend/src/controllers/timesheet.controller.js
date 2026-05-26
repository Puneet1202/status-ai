// FILE: backend/src/controllers/timesheet.controller.js
// V2.3 - WATER-TIGHT PRODUCTION FREEZE (ALL EDGE CASES RESOLVED)

import { aiChat } from '../ai/chat.js';

// =========================================================================
// ✅ UTILITY HELPER: Safe Time Calculation, Overflow Wrap & Zero Padding
// =========================================================================
function calcEndTime(startTime, durationHours) {
    const hours = parseInt(durationHours, 10);
    const [startHH, startMM] = startTime.split(":").map(Number);
    
    // Total minutes mein convert karke shift duration add karo
    const totalMinutes = (startHH * 60 + startMM) + (hours * 60);
    
    // 24-hour wrap-around handles mid-night overflows safely
    const endHH = Math.floor(totalMinutes / 60) % 24; 
    const endMM = totalMinutes % 60;
    
    // Strictly force double-digit format (e.g., "09:00" instead of "9:00")
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(endHH)}:${pad(endMM)}`;
}

/**
 * 1. ADD STATUS ENTRY (Direct REST endpoint)
 */
export const addTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        const employeeId = currentUser.id;

        const body = await c.req.json();
        const {
            entry_date,
            start_time,
            end_time,
            duration_hours,
            module_name,
            task_description,
            project_name
        } = body;

        if (!entry_date || !start_time || !end_time || !duration_hours || !task_description || !project_name) {
            return c.json({ message: "Validation Fault: Missing required fields", success: false }, 400);
        }

        const result = await db
            .prepare(`
                INSERT INTO timesheets 
                (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(employeeId, entry_date, start_time, end_time, parseFloat(duration_hours), module_name || 'General', task_description, project_name)
            .run();

        if (result.meta.changes === 0) {
            throw new Error("D1 insert failed — no rows affected.");
        }

        return c.json({ message: "Status committed successfully!", success: true }, 201);

    } catch (error) {
        console.error("[Timesheet Insert Error]:", error);
        return c.json({ message: "Internal Server Error: Failed to write entry", success: false }, 500);
    }
};

/**
 * 2. MASTER FILTER SEARCH ENGINE
 */
export const getAllTimesheetsAdmin = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');

        const dateFrom = c.req.query('dateFrom');
        const dateTo = c.req.query('dateTo');
        const employeeName = c.req.query('employeeName');
        const clientName = c.req.query('clientName');

        let sqlQuery = `
            SELECT t.*, u.name as employee_name, u.email as employee_email 
            FROM timesheets t
            JOIN users u ON t.employee_id = u.id
            WHERE 1=1
        `;

        const binds = [];

        if (currentUser.role === 'employee') {
            sqlQuery += ` AND t.employee_id = ?`;
            binds.push(currentUser.id);
        } else if (employeeName && employeeName !== 'all' && employeeName !== 'All employees') {
            sqlQuery += ` AND LOWER(u.name) = LOWER(?)`;
            binds.push(employeeName);
        }

        if (dateFrom) {
            sqlQuery += ` AND t.entry_date >= ?`;
            binds.push(dateFrom);
        }
        if (dateTo) {
            sqlQuery += ` AND t.entry_date <= ?`;
            binds.push(dateTo);
        }

        if (clientName && clientName !== 'all' && clientName !== 'All clients') {
            sqlQuery += ` AND LOWER(t.project_name) LIKE LOWER(?)`;
            binds.push(`%${clientName}%`);
        }

        sqlQuery += ` ORDER BY t.entry_date DESC, t.created_at DESC`;

        const stmt = db.prepare(sqlQuery);
        const { results } = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

        return c.json({ total_records: results.length, telemetry_logs: results, success: true }, 200);

    } catch (error) {
        console.error("[Filter Engine Error]:", error);
        return c.json({ message: "Internal Server Error: Query failed", success: false }, 500);
    }
};

/**
 * 3. DELETE ENTRY (Direct REST endpoint)
 */
export const deleteTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');
        const logId = c.req.param('id');

        if (!logId) {
            return c.json({ message: "Validation Fault: Missing entry ID", success: false }, 400);
        }

        const result = await db
            .prepare(`DELETE FROM timesheets WHERE id = ? AND employee_id = ?`)
            .bind(logId, currentUser.id)
            .run();

        if (result.meta.changes === 0) {
            return c.json({ message: "Entry not found or already deleted.", success: false }, 404);
        }

        return c.json({ message: "Entry deleted successfully!", success: true }, 200);

    } catch (error) {
        console.error("[Delete Error]:", error);
        return c.json({ message: "Internal Server Error: Delete failed", success: false }, 500);
    }
};

/**
 * 4. AI CHAT HANDLER
 */
export const aiChatHandler = async (c) => {
    try {
        const user = c.get('user');
        const db = c.env.DB;

        const { message, history = [], pendingAction = null } = await c.req.json();

        if (!message) {
            return c.json({ success: false, message: 'Message required' }, 400);
        }

        // ================================================================
        // 🛡️ CONFIRM FLOW: INTERCEPT FOR DELETION BYPASS (100% Intact)
        // ================================================================
        const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());

        if (pendingAction && pendingAction.action === "DELETE_TIMESHEET" && isConfirming) {
            const deleteResult = await db
                .prepare("DELETE FROM timesheets WHERE id = ? AND employee_id = ?")
                .bind(pendingAction.matchId, user.id)
                .run();

            if (deleteResult.meta.changes === 0) {
                return c.json({ reply: "Entry not found or already deleted." }, 200);
            }

            return c.json({
                success: true,
                action: "DELETE_TIMESHEET",
                reply: `Entry from project "${pendingAction.projectName}" deleted successfully.`
            }, 200);
        }

        // Normal AI Core Pipeline execution (Calling chat.js with pendingAction)
        const result = await aiChat(c.env, user.id, message, history, pendingAction);

        // ================================================================
        // 🚀 METADATA INTENT ENGINE DISPATCH LAYER
        // ================================================================
        if (result.action) {
            const { action, data } = result.action;

            // ---------------------------------------------------------------------
            // 📝 INTENT A: ADD_TIMESHEET ENGINE (Purana 8-Hour Split Logic)
            // ---------------------------------------------------------------------
            if (action === "ADD_TIMESHEET") {
                if (!data.project_name || !data.duration_hours || !data.task_description) {
                    return c.json({ reply: "Please specify project name, hours, and task description clearly." }, 200);
                }

                const totalHours = parseInt(data.duration_hours, 10);
                if (isNaN(totalHours) || totalHours <= 0) {
                    return c.json({ reply: "Invalid duration. Please provide valid working hours." }, 200);
                }

                const todayStr = new Date().toISOString().split('T')[0];
                let entryDate = data.entry_date || data.date || todayStr;

                if (!entryDate || entryDate === "2024-07-26" || !entryDate.startsWith("2026-")) {
                    entryDate = todayStr;
                }
                const moduleName = (data.module_name || "GENERAL").toUpperCase().trim();

                const DAILY_SLOTS = [
                    { start: "09:00", end: "11:00" },
                    { start: "11:00", end: "13:00" },
                    { start: "14:00", end: "16:00" }, 
                    { start: "16:00", end: "18:00" },
                ];

                if (totalHours === 8) {
                    const results = [];
                    for (let index = 0; index < DAILY_SLOTS.length; index++) {
                        const slot = DAILY_SLOTS[index];
                        const splitResult = await db
                            .prepare(`
                                INSERT INTO timesheets 
                                (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `)
                            .bind(
                                user.id,
                                entryDate,
                                slot.start,
                                slot.end,
                                2,
                                moduleName,
                                `${data.task_description.trim()} (Part ${index + 1} of 4)`,
                                data.project_name.trim()
                            )
                            .run();

                        if (splitResult.meta.changes === 0) {
                            throw new Error(`Database Error: Matrix partition slot ${index + 1} failed.`);
                        }
                        results.push(splitResult);
                    }

                    return c.json({
                        success: true,
                        action: "ADD_TIMESHEET",
                        reply: `Logged 8 hours split across 4 ordered enterprise slots (09-11, 11-01, 02-04, 04-06) under "${data.project_name}" [${moduleName}] for ${entryDate}.`
                    }, 200);

                } else {
                    const startTime = data.start_time || "09:00";
                    // ✅ BUG 1 FIXED: Custom hours calculation activated safely
                    const endTime   = data.end_time   || calcEndTime(startTime, totalHours);

                    const insertResult = await db
                        .prepare(`
                            INSERT INTO timesheets 
                            (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `)
                        .bind(user.id, entryDate, startTime, endTime, totalHours, moduleName, data.task_description.trim(), data.project_name.trim())
                        .run();

                    if (insertResult.meta.changes === 0) {
                        throw new Error("Database Error: Inline write transaction failed on Cloudflare D1.");
                    }

                    return c.json({
                        success: true,
                        action: "ADD_TIMESHEET",
                        reply: `Logged ${totalHours} hours under "${data.project_name}" [${moduleName}] from ${startTime} to ${endTime} for ${entryDate}. Saved!`
                    }, 200);
                }
            }

            // ---------------------------------------------------------------------
            // 📊 INTENT B: GET_TIMESHEET ENGINE (Purana Native Filter Block)
            // ---------------------------------------------------------------------
            if (action === "GET_TIMESHEET") {
                const from = data.from_date;
                const to   = data.to_date || from;

                if (!from) {
                    return c.json({ reply: "Please specify a valid start date to view timesheets." }, 200);
                }

                const rows = await db
                    .prepare(`
                        SELECT id, entry_date, start_time, end_time, 
                               duration_hours, module_name, task_description, project_name
                        FROM timesheets
                        WHERE employee_id = ?
                        AND entry_date BETWEEN ? AND ?
                        ORDER BY entry_date ASC, start_time ASC
                    `)
                    .bind(user.id, from, to)
                    .all();

                const total = rows.results ? rows.results.reduce((sum, r) => sum + Number(r.duration_hours), 0) : 0;

                return c.json({
                    success: true,
                    action: "GET_TIMESHEET",
                    reply: `Showing logs from ${from} to ${to} — Total logged: ${total} hours.`,
                    data: rows.results || []
                }, 200);
            }

            // ---------------------------------------------------------------------
            // 📝 INTENT D: ADD_MULTIPLE_TIMESHEETS (✅ TOOL USE BATCH BLOCK)
            // ---------------------------------------------------------------------
          if (action === "add_timesheet_entries") {
    let { entries, project_name, entry_date } = data;

    const todayStr = new Date().toISOString().split('T')[0];
    const safeDate = (!entry_date || !entry_date.startsWith("2026-") || entry_date === "2024-07-26")
        ? todayStr : entry_date;

    // ✅ Fix 1 — Object hai to array banao
    if (!Array.isArray(entries)) {
        entries = entries ? [entries] : [];
    }

    // ✅ Fix 2 — Empty check
    if (entries.length === 0) {
        return c.json({ success: false, reply: "No valid entries found to log." }, 200);
    }

    // ✅ Fix 3 — 8 hours single entry → 4 slots mein split
    if (entries.length === 1 && Number(entries[0].duration_hours) === 8) {
        const DAILY_SLOTS = [
            { start: "09:00", end: "11:00" },
            { start: "11:00", end: "13:00" },
            { start: "14:00", end: "16:00" },
            { start: "16:00", end: "18:00" },
        ];
        const original = entries[0];
        entries = DAILY_SLOTS.map((slot, i) => ({
            start_time: slot.start,
            end_time: slot.end,
            duration_hours: 2,
            module_name: original.module_name || "GENERAL",
            task_description: `${original.task_description} (Part ${i + 1} of 4)`
        }));
    }

    const statements = entries.map(entry =>
        db.prepare(`
            INSERT INTO timesheets 
            (employee_id, entry_date, start_time, end_time, 
             duration_hours, module_name, task_description, project_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            user.id,
            safeDate,
            entry.start_time || "09:00",
            entry.end_time || calcEndTime(entry.start_time || "09:00", entry.duration_hours || 2),
            Number(entry.duration_hours) || 2,
            (entry.module_name || "GENERAL").toUpperCase().trim(),
            entry.task_description?.trim() || "Work Status Update",
            project_name?.trim()
        )
    );

    await db.batch(statements);

    return c.json({
        success: true,
        action: "ADD_MULTIPLE_TIMESHEETS",
        reply: `✅ ${entries.length} entries saved for ${safeDate}!`
    }, 200);
}

// ✅ GET block — date guardrail add kiya
if (action === "get_timesheet_logs") {
    const todayStr = new Date().toISOString().split('T')[0];
    let { from_date, to_date, module_name } = data;

    // Date guardrails
    if (!from_date || !from_date.startsWith("2026-")) from_date = "2026-01-01";
    if (!to_date   || !to_date.startsWith("2026-"))   to_date = todayStr;
    
    // ✅ Future date block
    if (to_date > todayStr) to_date = todayStr;

    // ✅ Dynamic query — module filter optional
    let query = `
        SELECT id, entry_date, start_time, end_time, 
               duration_hours, module_name, task_description, project_name 
        FROM timesheets
        WHERE employee_id = ?
        AND entry_date BETWEEN ? AND ?
    `;
    const binds = [user.id, from_date, to_date];

    if (module_name) {
        query += ` AND UPPER(module_name) = UPPER(?)`;
        binds.push(module_name);
    }

    query += ` ORDER BY entry_date ASC, start_time ASC`;

    const rows = await db.prepare(query).bind(...binds).all();
    const total = rows.results
        ? rows.results.reduce((sum, r) => sum + Number(r.duration_hours), 0)
        : 0;

    return c.json({
        success: true,
        action: "GET_TIMESHEET",
        reply: `${from_date} to ${to_date}${module_name ? ` [${module_name}]` : ''} — Total: ${total} hrs`,
        data: rows.results || []
    }, 200);
}

            // ---------------------------------------------------------------------
            // 🗑️ INTENT C: DELETE_TIMESHEET INTERCEPT STAGE (100% Intact)
            // ---------------------------------------------------------------------
            if (action === "DELETE_TIMESHEET") {
                let matchLog = null;

                if (data.timesheet_id) {
                    matchLog = await db
                        .prepare("SELECT id, project_name, duration_hours, task_description FROM timesheets WHERE id = ? AND employee_id = ?")
                        .bind(data.timesheet_id, user.id)
                        .first();
                }

                if (!matchLog && (data.project_name?.trim() || data.task_description?.trim())) {
                    let caseQuery = `SELECT id, project_name, duration_hours, task_description FROM timesheets WHERE employee_id = ?`;
                    const caseBinds = [user.id];

                    if (data.project_name?.trim()) {
                        caseQuery += ` AND project_name LIKE ?`;
                        caseBinds.push(`%${data.project_name.trim()}%`);
                    }
                    if (data.task_description?.trim()) {
                        caseQuery += ` AND task_description LIKE ?`;
                        caseBinds.push(`%${data.task_description.trim()}%`);
                    }

                    caseQuery += ` ORDER BY created_at DESC LIMIT 1`;
                    matchLog = await db.prepare(caseQuery).bind(...caseBinds).first();
                }

                if (!matchLog) {
                    const userWasSpecific = data.timesheet_id || data.project_name?.trim() || data.task_description?.trim();
                    if (userWasSpecific) {
                        return c.json({ reply: "Could not find any entry matching your description. Please check details." }, 200);
                    }
                    matchLog = await db
                        .prepare("SELECT id, project_name, duration_hours, task_description FROM timesheets WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1")
                        .bind(user.id)
                        .first();
                }

                if (!matchLog) {
                    return c.json({ reply: "No timesheet entries found to delete." }, 200);
                }

                return c.json({
                    requiresConfirmation: true,
                    pendingAction: {
                        action: "DELETE_TIMESHEET",
                        matchId: matchLog.id,
                        projectName: matchLog.project_name
                    },
                    reply: `Found entry: "${matchLog.project_name}" (${matchLog.duration_hours} hrs — ${matchLog.task_description}). Type "confirm" to delete permanently.`
                }, 200);
            }
        }

        // Default direct AI conversational response layer
        return c.json({ ...result, status: 200 }, 200);

    } catch (error) {
        console.error("[AI Handler Error]:", error);
        return c.json({ message: 'Internal server error in AI handler.', status: 500 }, 500);
    }
};