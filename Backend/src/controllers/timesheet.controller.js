// FILE: backend/src/controllers/timesheet.controller.js
// V3.2 - PRODUCTION READY BLUEPRINT (WITH TIME MATRIX & GET SEARCH FILTERS)

import { aiChat } from '../ai/chat.js';

// =========================================================================
// 🛠️ UTILITY HELPER: Resolve or Create Project ID from Name String
// =========================================================================
async function getOrCreateProjectId(db, projectName) {
    const cleanName = projectName.trim();
    
    // Check if the project already exists in projects master catalog
    const existing = await db
        .prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)")
        .bind(cleanName)
        .first();
        
    if (existing) return existing.id;

    // Dynamic row insertion if it's a completely new project container
    const insertResult = await db
        .prepare("INSERT INTO projects (name) VALUES (?)")
        .bind(cleanName)
        .run();
        
    if (insertResult.meta.changes === 0) {
        throw new Error(`Dynamic allocation failure for project identifier: ${cleanName}`);
    }
    
    return insertResult.meta.last_row_id;
}

// =========================================================================
// 🛠️ UTILITY HELPER: Pure Minutes-Based Safe Time Calculation 
// =========================================================================
function calcEndTime(startTime, durationMinutes) {
    const totalMinutesInput = parseInt(durationMinutes, 10) || 120;
    const [startHH, startMM] = startTime.split(":").map(Number);
    
    // Total minutes summation tracking layout
    const totalMinutes = (startHH * 60 + startMM) + totalMinutesInput;
    
    // 24-hour wrap-around handles mid-night overflows safely
    const endHH = Math.floor(totalMinutes / 60) % 24; 
    const endMM = totalMinutes % 60;
    
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(endHH)}:${pad(endMM)}`;
}

// =========================================================================
// 🛠️ UTILITY HELPER: Pure Time-String To Minutes Calculation (Claude Fix)
// =========================================================================
function calcMinutesFromTimes(startTime, endTime) {
    if (!startTime || !endTime) return 120; // Backup fallback 2 hours
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : 120; // Negative sequence hone par 2hr fallback layout
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
        
        let entryDate = body.entry_date;
        let startTime = body.start_time || "09:00";
        let endTime = body.end_time;
        let moduleName = (body.module_name || "GENERAL").toUpperCase().trim();
        let taskDescription = body.task_description;
        let projectName = body.project_name;
        
        // 🌟 Backward Compatibility & Normalization Layer
        let durationMinutes = body.duration_minutes;
        if (!durationMinutes && body.duration_hours) {
            durationMinutes = Math.round(parseFloat(body.duration_hours) * 60);
        }

        if (!durationMinutes && startTime && endTime) {
            durationMinutes = calcMinutesFromTimes(startTime, endTime);
        }

        if (!endTime && startTime && durationMinutes) {
            endTime = calcEndTime(startTime, durationMinutes);
        }

        if (!entryDate || !startTime || !endTime || !durationMinutes || !taskDescription || !projectName) {
            return c.json({ message: "Validation Fault: Missing required configurations or duration mappings", success: false }, 400);
        }

        // Dynamic Relation Binding Pipeline
        const projectId = await getOrCreateProjectId(db, projectName);

        const result = await db
            .prepare(`
                INSERT INTO daily_status_entries 
                (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(employeeId, projectId, entryDate, startTime, endTime, parseInt(durationMinutes, 10), moduleName, taskDescription)
            .run();

        if (result.meta.changes === 0) {
            throw new Error("D1 insert failed — zero rows affected.");
        }

        return c.json({ message: "Status committed successfully into enterprise ledger!", success: true }, 201);

    } catch (error) {
        console.error("[Timesheet Insert Error]:", error);
        return c.json({ message: "Internal Server Error: Failed to write entry", success: false }, 500);
    }
};

/**
 * 2. MASTER FILTER SEARCH ENGINE (Admin Dashboard Layer)
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
            SELECT t.id, t.employee_id, t.project_id, t.entry_date, t.start_time, t.end_time, 
                   t.duration_minutes, t.task_description, t.module_name, t.is_email_sent, t.created_at,
                   u.name as employee_name, u.email as employee_email,
                   p.name as project_name
            FROM daily_status_entries t
            JOIN users u ON t.employee_id = u.id
            JOIN projects p ON t.project_id = p.id
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
            sqlQuery += ` AND LOWER(p.name) LIKE LOWER(?)`;
            binds.push(`%${clientName}%`);
        }

        sqlQuery += ` ORDER BY t.entry_date DESC, t.created_at DESC`;

        const stmt = db.prepare(sqlQuery);
        const { results } = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

        return c.json({ total_records: results.length, telemetry_logs: results, success: true }, 200);

    } catch (error) {
        console.error("[Filter Engine Error]:", error);
        return c.json({ message: "Internal Server Error: Query failed to process logs", success: false }, 500);
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
            .prepare(`DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?`)
            .bind(logId, currentUser.id)
            .run();

        if (result.meta.changes === 0) {
            return c.json({ message: "Entry not found or unauthorized deletion scope request.", success: false }, 404);
        }

        return c.json({ message: "Entry deleted successfully!", success: true }, 200);

    } catch (error) {
        console.error("[Delete Error]:", error);
        return c.json({ message: "Internal Server Error: Delete transaction failed", success: false }, 500);
    }
};

/**
 * 4. AI CHAT HANDLER INTERACTION ENGINE
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
        // 🛡️ CONFIRM FLOW: INTERCEPT FOR DELETION BYPASS MATRIX
        // ================================================================
        const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());

        if (pendingAction && pendingAction.action === "DELETE_TIMESHEET" && isConfirming) {
            const deleteResult = await db
                .prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?")
                .bind(pendingAction.matchId, user.id)
                .run();

            if (deleteResult.meta.changes === 0) {
                return c.json({ reply: "Entry not found or already tracking metadata execution drop." }, 200);
            }

            return c.json({
                success: true,
                action: "DELETE_TIMESHEET",
                reply: `Status record from project "${pendingAction.projectName}" has been permanently purged.`
            }, 200);
        }

        // Normal AI Core Pipeline execution context router
        const result = await aiChat(c.env, user.id, message, history, pendingAction);

        // ================================================================
        // 🚀 METADATA INTENT ENGINE DISPATCH LAYER (ACTIONS PROCESSOR)
        // ================================================================
        if (result.action) {
            const { action, data } = result.action;

            // ---------------------------------------------------------------------
            // 📝 INTENT A & D: ADD_TIMESHEET / add_timesheet_entries CONSOLIDATION
            // ---------------------------------------------------------------------
            if (action === "ADD_TIMESHEET" || action === "add_timesheet_entries") {
                
                const targetProjectName = data.project_name;
                if (!targetProjectName || !data.task_description) {
                    return c.json({ reply: "Please specify project name and task description clearly." }, 200);
                }

                // Resolve matching project identifier pointer string to integer ID
                const projectId = await getOrCreateProjectId(db, targetProjectName);
                const todayStr = new Date().toISOString().split('T')[0];
                let entryDate = data.entry_date || todayStr;

                if (!entryDate || entryDate === "2024-07-26" || !entryDate.startsWith("2026-")) {
                    entryDate = todayStr;
                }

                // Normalizing structured batch array variables
                let entriesToBatch = [];
                if (action === "add_timesheet_entries" && Array.isArray(data.entries)) {
                    entriesToBatch = data.entries;
                } else {
                    // Convert potential old single string keys or duration layouts dynamically
                    let computedMin = data.duration_minutes;
                    if (!computedMin && data.duration_hours) computedMin = Math.round(Number(data.duration_hours) * 60);
                    
                    // Fallback runtime time duration extraction if fields missing from tool payload
                    if (!computedMin && data.start_time && data.end_time) {
                        computedMin = calcMinutesFromTimes(data.start_time, data.end_time);
                    }
                    if (!computedMin) computedMin = 120; // 2 hour default allocation fallback

                    entriesToBatch = [{
                        start_time: data.start_time || "09:00",
                        end_time: data.end_time || null,
                        duration_minutes: computedMin,
                        module_name: data.module_name || "GENERAL",
                        task_description: data.task_description
                    }];
                }

                if (entriesToBatch.length === 0) {
                    return c.json({ reply: "No operational metadata slots extracted to commit." }, 200);
                }

                // 🔄 CLAUDE FIX: Calculate derived context for the first item to evaluate 8-Hour check safely
                const firstEntry = entriesToBatch[0];
                const calculatedMins = firstEntry.duration_minutes 
                    || calcMinutesFromTimes(firstEntry.start_time, firstEntry.end_time);

                // 🔄 8-Hour Single Block Partitioning Guardrail Engine
                if (entriesToBatch.length === 1 && calculatedMins === 480) {
                    const DAILY_SLOTS = [
                        { start: "09:00", end: "11:00" },
                        { start: "11:00", end: "13:00" },
                        { start: "14:00", end: "16:00" }, 
                        { start: "16:00", end: "18:00" },
                    ];
                    const originalNode = entriesToBatch[0];
                    entriesToBatch = DAILY_SLOTS.map((slot, idx) => ({
                        start_time: slot.start,
                        end_time: slot.end,
                        duration_minutes: 120,
                        module_name: originalNode.module_name || "GENERAL",
                        task_description: `${originalNode.task_description.trim()} (Part ${idx + 1} of 4)`
                    }));
                }

                // Compile database statements pool array for atomic D1 batch operation execution
                const statements = entriesToBatch.map(entry => {
                    const startTime = entry.start_time || "09:00";
                    const endTime = entry.end_time || (entry.duration_minutes ? calcEndTime(startTime, entry.duration_minutes) : "11:00");
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
                        entry.task_description?.trim() || "Work Status Update"
                    );
                });

                await db.batch(statements);

                return c.json({
                    success: true,
                    action: "ADD_MULTIPLE_TIMESHEETS",
                    reply: `✅ Successfully saved ${entriesToBatch.length} tracking partitions under project "${targetProjectName}" for allocation date ${entryDate}!`
                }, 200);
            }

            // ---------------------------------------------------------------------
            // 📊 INTENT B: GET_TIMESHEET / get_timesheet_logs DISPATCH LAYER
            // ---------------------------------------------------------------------
            if (action === "GET_TIMESHEET" || action === "get_timesheet_logs") {
                const todayStr = new Date().toISOString().split('T')[0];
                let fromDate = data.from_date || data.date;
                let toDate = data.to_date || fromDate || todayStr;
                const filterModule = data.module_name;

                if (!fromDate || !fromDate.startsWith("2026-")) fromDate = "2026-01-01";
                if (!toDate || !toDate.startsWith("2026-")) toDate = todayStr;
                if (toDate > todayStr) toDate = todayStr;

                let logQuery = `
                    SELECT d.id, d.entry_date, d.start_time, d.end_time, 
                           d.duration_minutes, d.module_name, d.task_description, p.name as project_name
                    FROM daily_status_entries d
                    JOIN projects p ON d.project_id = p.id
                    WHERE d.employee_id = ?
                    AND d.entry_date BETWEEN ? AND ?
                `;
                const queryBinds = [user.id, fromDate, toDate];

                if (filterModule) {
                    logQuery += ` AND UPPER(d.module_name) = UPPER(?)`;
                    queryBinds.push(filterModule);
                }

                // ✅ CLAUDE FIX: Dynamic project name search query parameter check
                if (data.project_name) {
                    logQuery += ` AND LOWER(p.name) LIKE LOWER(?)`;
                    queryBinds.push(`%${data.project_name.trim()}%`);
                }

                logQuery += ` ORDER BY d.entry_date ASC, d.start_time ASC`;

                const dbRows = await db.prepare(logQuery).bind(...queryBinds).all();
                
                const totalMinutes = dbRows.results 
                    ? dbRows.results.reduce((sum, r) => sum + parseInt(r.duration_minutes || 0, 10), 0) 
                    : 0;
                
                const totalHoursDisplay = (totalMinutes / 60).toFixed(1);

                return c.json({
                    success: true,
                    action: "GET_TIMESHEET",
                    reply: `${fromDate} to ${toDate}${filterModule ? ` [${filterModule}]` : ''} — Total logged status: ${totalHoursDisplay} hrs (${totalMinutes} mins)`,
                    data: dbRows.results || []
                }, 200);
            }

            // ---------------------------------------------------------------------
            // 🗑️ INTENT C: DELETE_TIMESHEET INTERCEPT STAGE
            // ---------------------------------------------------------------------
            if (action === "DELETE_TIMESHEET") {
                let matchLog = null;

                if (data.entry_id || data.timesheet_id) {
                    const lookupId = data.entry_id || data.timesheet_id;
                    matchLog = await db
                        .prepare(`
                            SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description 
                            FROM daily_status_entries d
                            JOIN projects p ON d.project_id = p.id
                            WHERE d.id = ? AND d.employee_id = ?
                        `)
                        .bind(lookupId, user.id)
                        .first();
                }

                if (!matchLog && (data.project_name?.trim() || data.task_description?.trim())) {
                    let textSearchQuery = `
                        SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description 
                        FROM daily_status_entries d
                        JOIN projects p ON d.project_id = p.id
                        WHERE d.employee_id = ?
                    `;
                    const textSearchBinds = [user.id];

                    if (data.project_name?.trim()) {
                        textSearchQuery += ` AND p.name LIKE ?`;
                        textSearchBinds.push(`%${data.project_name.trim()}%`);
                    }
                    if (data.task_description?.trim()) {
                        textSearchQuery += ` AND d.task_description LIKE ?`;
                        textSearchBinds.push(`%${data.task_description.trim()}%`);
                    }

                    textSearchQuery += ` ORDER BY d.created_at DESC LIMIT 1`;
                    matchLog = await db.prepare(textSearchQuery).bind(...textSearchBinds).first();
                }

                if (!matchLog) {
                    const wasExplicit = data.entry_id || data.timesheet_id || data.project_name?.trim() || data.task_description?.trim();
                    if (wasExplicit) {
                        return c.json({ reply: "Could not find any entry matching your description. Please check details." }, 200);
                    }
                    // Extract latest fallback record context 
                    matchLog = await db
                        .prepare(`
                            SELECT d.id, p.name as project_name, d.duration_minutes, d.task_description 
                            FROM daily_status_entries d
                            JOIN projects p ON d.project_id = p.id
                            WHERE d.employee_id = ? 
                            ORDER BY d.created_at DESC LIMIT 1
                        `)
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
                    reply: `Found entry: "${matchLog.project_name}" (${(matchLog.duration_minutes / 60).toFixed(1)} hrs — ${matchLog.task_description}). Type "confirm" to apply delete permanent lifecycle action.`
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