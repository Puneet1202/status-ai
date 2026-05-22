// seed-db.js
// 🏛️ ENTERPRISE VARIABLE DATA SEEDER LAYER V2 - MARCH TO MAY 2026
import fs from 'fs';

const userId = 1; // Tera authorized employee_id

const projects = ['Project-X', 'Internal Tools', 'Business Development', 'Core Infra V2'];

const modules = {
    'Project-X': ['Auth Module', 'Session Management', 'Token Guardrails', 'Middleware Layer'],
    'Internal Tools': ['Database Migration', 'Telemetry Analytics', 'CLI Scaffolder', 'D1 Driver Wrapper'],
    'Business Development': ['Client Pitch Deck', 'API Monetization Strategy', 'RFPs Technical Review'],
    'Core Infra V2': ['API Gateway Optimization', 'Code Refactoring', 'Caching Strategy', 'Edge Compute Tuning']
};

const taskTemplates = [
    'Fixed critical racing condition and optimized state persistence.',
    'Implemented multi-tenant isolation firewall and ran security compliance audits.',
    'Refactored query compilation logic for serverless execution benchmarks.',
    'Integrated AI pipeline with few-shot classification prompt matrix.',
    'Developed modular context wrappers for real-time frontend binding.',
    'Patched minor memory leak inside data ingestion loops.',
    'Conducted peer code review and streamlined git branch merging strategies.',
    'Wrote end-to-end integration test suites for the core controller modules.'
];

// Time Slots Configuration (Total 8 Hours)
const shifts = [
    { start: '09:00', end: '11:00', hours: 2 },
    { start: '11:00', end: '13:00', hours: 2 },
    { start: '14:00', end: '16:00', hours: 2 },
    { start: '16:00', end: '18:00', hours: 2 }
];

function generateSeedSQL() {
    let sqlStatements = [];
    
    // Date Range Setup: March 1, 2026 to May 22, 2026
    let startDate = new Date('2026-03-01');
    let endDate = new Date('2026-05-22');

    let totalDaysCount = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        
        // 🛑 SATURDAY AND SUNDAY ARE STRICTLY OFF
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        totalDaysCount++;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        // Each day gets a different baseline project setup based on day iteration
        shifts.forEach((shift, index) => {
            // Dynamic rotation to make sure combination changes every single shift
            const projectIndex = (totalDaysCount + index) % projects.length;
            const project = projects[projectIndex];
            
            // Fetch modules strictly tied to that specific project
            const projectModules = modules[project];
            const moduleName = projectModules[(totalDaysCount * index) % projectModules.length];
            
            // Dynamic Task Template selection with variable sub-task iteration text
            const baseTemplate = taskTemplates[(totalDaysCount + index * 3) % taskTemplates.length];
            const subTaskVersion = `[Sprint-Iteration #${totalDaysCount}-${index + 1}]`;
            const taskDesc = `${subTaskVersion} ${baseTemplate}`;

            const sql = `INSERT INTO timesheets (employee_id, entry_date, start_time, end_time, duration_hours, module_name, task_description, project_name) VALUES (${userId}, '${dateStr}', '${shift.start}', '${shift.end}', ${shift.hours}, '${moduleName}', '${taskDesc}', '${project}');`;
            sqlStatements.push(sql);
        });
    }

    fs.writeFileSync('./seed.sql', sqlStatements.join('\n'));
    console.log(`\n=== 🏛️ DYNAMIC SEED GENERATION COMPLETE ===`);
    console.log(`Generated ${sqlStatements.length} UNIQUE time logs in './seed.sql'.`);
    console.log(`Every single day has randomized variations across modules and sprint iterations.`);
}

generateSeedSQL();