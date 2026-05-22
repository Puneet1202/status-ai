// FILE: backend/src/controllers/timesheet.controller.js
// KAAM: Status Logger Insertion Engine + Highly Optimized SQL Parameterized Search Filter

/**
 * 1. ADD STATUS ENTRY (Data Creation Pipeline)
 */
import { aiChat } from '../ai/chat.js';

export const addTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user'); // AuthMiddleware se aaya hua authentic session user
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

        // Validation Guard: Data check parameters verification
        if (!entry_date || !start_time || !end_time || !duration_hours || !task_description || !project_name) {
            return c.json({ message: "Validation Fault: Missing required fields for status entry", success: false }, 400);
        }

        // Execution: SQL Parametric injection protection mapping
        const result = await db
            .prepare(`
                INSERT INTO timesheets 
                (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(employeeId, entry_date, start_time, end_time, parseFloat(duration_hours), module_name || 'General', task_description, project_name)
            .run();

        if (!result.success) {
            throw new Error("D1 Engine rejected operational status insert execution transaction packet.");
        }

        return c.json({ message: "Status committed successfully to KEYSS D1 infrastructure database!", success: true }, 201);

    } catch (error) {
        console.error("[Backend Timesheet Insertion Crash]:", error);
        return c.json({ message: "Internal Server Error: Failed to write entry log to DB", success: false }, 500);
    }
};

/**
 * 2. MASTER FILTER SEARCH ENGINE (Data Telemetry Grid Pipeline)
 */
export const getAllTimesheetsAdmin = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user');

        // URL parameters capture matrix from frontend search operations queries
        const dateFrom = c.req.query('dateFrom');
        const dateTo = c.req.query('dateTo');
        const employeeName = c.req.query('employeeName');
        const clientName = c.req.query('clientName');

        // Dynamic Query Base: Relational join to map employee names dynamically
        let sqlQuery = `
            SELECT t.*, u.name as employee_name, u.email as employee_email 
            FROM timesheets t
            JOIN users u ON t.employee_id = u.id
            WHERE 1=1
        `;
        
        const binds = [];

        // Dynamic Filtering Rule 1: Role Isolation Block (Employee vs Admin permissions)
        if (currentUser.role === 'employee') {
            sqlQuery += ` AND t.employee_id = ?`;
            binds.push(currentUser.id);
        } else if (employeeName && employeeName !== 'all' && employeeName !== 'All employees') {
            sqlQuery += ` AND LOWER(u.name) = LOWER(?)`;
            binds.push(employeeName);
        }

        // Dynamic Filtering Rule 2: Date Range Boundary Filters
        if (dateFrom) {
            sqlQuery += ` AND t.entry_date >= ?`;
            binds.push(dateFrom);
        }
        if (dateTo) {
            sqlQuery += ` AND t.entry_date <= ?`;
            binds.push(dateTo);
        }

        // Dynamic Filtering Rule 3: Client Context Parameter Verification
        if (clientName && clientName !== 'all' && clientName !== 'All clients') {
            sqlQuery += ` AND LOWER(t.project_name) LIKE LOWER(?)`;
            binds.push(`%${clientName}%`);
        }

        // Execution Sequence Sorting
        sqlQuery += ` ORDER BY t.entry_date DESC, t.created_at DESC`;

        const stmt = db.prepare(sqlQuery);
        const { results } = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

        return c.json({ total_records: results.length, telemetry_logs: results, success: true }, 200);

    } catch (error) {
        console.error("[Backend Core Filter Engine Execution Drop]:", error);
        return c.json({ message: "Internal Server Error: Query pipeline execution failed", success: false }, 500);
    }
};



// FILE: backend/src/controllers/timesheet.controller.js
// KAAM: Permanent Deletion of Status Block from Cloudflare D1 Storage

export const deleteTimesheetEntry = async (c) => {
    try {
        const db = c.env.DB;
        const currentUser = c.get('user'); // Session user verification
        const logId = c.req.param('id');   // URL se ID nikalna (:id)

        if (!logId) {
            return c.json({ message: "Validation Fault: Missing log entry identifier", success: false }, 400);
        }

        // Execution: Strict ownership check ke sath delete query (taaki employee sirf apna data delete kar sake)
        const result = await db
            .prepare(`
                DELETE FROM timesheets 
                WHERE id = ? AND employee_id = ?
            `)
            .bind(logId, currentUser.id)
            .run();

        if (!result.success) {
            throw new Error("D1 Engine rejected the delete transaction packet.");
        }

        return c.json({ message: "Status record successfully purged from infrastructure!", success: true }, 200);

    } catch (error) {
        console.error("[Backend Deletion Crash]:", error);
        return c.json({ message: "Internal Server Error: Failed to purge log entry", success: false }, 500);
    }
};



// =========================================================================
// PRODUCTION AI HANDLER: CONNECTS ENGINE TO CLOUDFLARE D1 LIFECYCLE
// =========================================================================
export const aiChatHandler = async (c) => {
    try {
        // 1. SECURITY MIDDLEWARE AUTH EXTRACTION
        const user = c.get('user'); 
        const db = c.env.DB; // Direct Native Cloudflare D1 Instance Binding

        // Extract raw unstructured user prompt payload from frontend/postman incoming JSON body
        const { message, history = [] } = await c.req.json();

        if (!message) {
            return c.json({ success: false, message: 'Message text input parameter required' }, 400);
        }

        // 🤖 2. TRIGGER THE CORE ENGINE (Phase 4 Orchestrator Pipeline)
        // Pass context layers directly to the independent processing matrix
        const result = await aiChat(c.env, user.id, message, history);

        // ======================================================================
        // 🚀 DYNAMIC ACTION DISPATCH ROUTER LAYER (FORM AUTOMATION INTERCEPTOR)
        // ======================================================================
        if (result.action) {
            const { action, data } = result.action;

            // Universal Confirmation Regex: Catches natural affirmative user speech
            const destructiveConfirmed =
                /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim()) &&
                /(delete|remove|undo|hata|clear)/i.test(message);

            // ACTION TYPE 1: STRUCTURED TIMESHEET AUTO-INSERTION
            if (action === "ADD_TIMESHEET") {
                // Runtime Schema Ingestion Validation
                if (!data.project_name || !data.duration_hours || !data.task_description) {
                    return c.json({ reply: "Action aborted. Payload timesheet parameters are incomplete." }, 200);
                }

                const entryDate = data.entry_date || new Date().toISOString().split('T')[0];
                const startTime = data.start_time || "09:00";
                const endTime = data.end_time || "18:00";
                const moduleName = data.module_name || "GENERAL";

                // Native D1 Database Execution Call Layer
                const insertResult = await db
                    .prepare(`
                        INSERT INTO timesheets 
                        (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `)
                    .bind(
                        user.id, 
                        entryDate, 
                        startTime, 
                        endTime, 
                        Number(data.duration_hours), 
                        moduleName.toUpperCase().trim(), 
                        data.task_description.trim(), 
                        data.project_name.trim()
                    )
                    .run();

                if (!insertResult.success) {
                    throw new Error("D1 execution engine dropped the insertion transaction packet.");
                }

                return c.json({
                    success: true,
                    action: "ADD_TIMESHEET",
                    reply: `Successfully logged ${data.duration_hours} hours under project "${data.project_name}" for module [${moduleName}]. Daily status entry saved!`
                }, 200);
            }

            // ACTION TYPE 2: SECURE SYSTEM DATA ELIMINATION (WITH TWO-STEP CHECKPOINT)
            if (action === "DELETE_TIMESHEET") {
                // Trace the latest matching entry for this specific employee to ensure boundary isolation
                const matchLog = await db
                    .prepare("SELECT id, project_name, duration_hours, task_description FROM timesheets WHERE employee_id = ? AND (project_name LIKE ? OR task_description LIKE ?) ORDER BY created_at DESC LIMIT 1")
                    .bind(user.id, `%${data.project_name || ''}%`, `%${data.task_description || ''}%`)
                    .first();

                if (!matchLog) {
                    return c.json({ reply: "Could not identify any recent timesheet entry matching your description query parameters." }, 200);
                }

                // TWO-STEP UX GUARD: Verification interceptor to stop accidental drop commands
                if (!destructiveConfirmed) {
                    return c.json({
                        requiresConfirmation: true,
                        pendingAction: "DELETE_TIMESHEET",
                        reply: `I found a recent entry for project "${matchLog.project_name}" (${matchLog.duration_hours} hrs: ${matchLog.task_description}). Please type "confirm delete" if you wish to remove it permanently.`
                    }, 200);
                }

                // If explicitly confirmed by secondary handshake rule, process deletion query transaction
                const deleteResult = await db
                    .prepare("DELETE FROM timesheets WHERE id = ? AND employee_id = ?")
                    .bind(matchLog.id, user.id)
                    .run();

                if (!deleteResult.success) {
                    throw new Error("D1 execution engine dropped the deletion transaction packet.");
                }

                return c.json({
                    success: true,
                    action: "DELETE_TIMESHEET",
                    reply: `Permanently cleared the requested status log entry from project "${matchLog.project_name}" successfully.`
                }, 200);
            }
        }

        // 3. READ-ONLY NATURAL SUMMARY PORTAL OUTPUT RESPONSE
        return c.json({ ...result, status: 200 }, 200);

    } catch (error) {
        console.error("[Gateway Routing Exception Logs]:", error);
        return c.json({ message: 'Internal server gateway exception encountered inside the AI handler loop.', status: 500 }, 500);
    }
};