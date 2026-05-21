// FILE: backend/src/controllers/timesheet.controller.js
// KAAM: Status Logger Insertion Engine + Highly Optimized SQL Parameterized Search Filter

/**
 * 1. ADD STATUS ENTRY (Data Creation Pipeline)
 */
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