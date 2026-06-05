// FILE: backend/scripts/seed-tasks.mjs
// Har project ke liye 4 sample task DB me daalta hai — tasks table ke EXACT rules
// ke hisaab se (task_type/status/priority allowed values, unique task_key, valid
// assignee employee, future due_date). Taaki app me task dropdown chale.
//
// Chalane ke liye:  npm run seed:tasks
//
// SAFE + IDEMPOTENT: jis project ke paas pehle se task hai use SKIP karta hai, to
// dobara chalane par duplicate nahi bante. DB backup pehle se hai.

import { DatabaseSync } from 'node:sqlite';

const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA busy_timeout = 10000;'); // server chalu ho to lock par wait kare

// 4 generic tasks — title + valid task_type (CHECK: Development/Bug/Design/Marketing/Testing)
const TEMPLATE = [
    { title: 'UI Development',  type: 'Development', hours: 6 },
    { title: 'Bug Fixing',      type: 'Bug',         hours: 4 },
    { title: 'Testing & QA',    type: 'Testing',     hours: 3 },
    { title: 'Code Review',     type: 'Development', hours: 2 },
];

// due_date = aaj + 14 din (YYYY-MM-DD)
const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

// Sirf non-deleted projects
const projects = db.prepare("SELECT id, name FROM projects WHERE status != 'deleted' ORDER BY id").all();

// assignee map: project_id -> ek real employee (jo us project pe assigned hai)
const assignRows = db.prepare('SELECT project_id, employee_id FROM project_assignments').all();
const assigneeByProject = new Map();
for (const a of assignRows) {
    if (!assigneeByProject.has(a.project_id)) assigneeByProject.set(a.project_id, a.employee_id);
}
// fallback assignee (agar project pe koi assigned nahi) — koi bhi valid employee
const fallbackAssignee = db.prepare('SELECT id FROM employee WHERE name IS NOT NULL ORDER BY id LIMIT 1').get().id;

const insert = db.prepare(`
    INSERT INTO tasks (task_key, project_id, title, task_type, status, priority, assignee_id, due_date, estimated_hours)
    VALUES (?, ?, ?, ?, 'To Do', 'Medium', ?, ?, ?)`);

const hasTask = db.prepare('SELECT 1 FROM tasks WHERE project_id = ? LIMIT 1');

let created = 0, skipped = 0;
db.exec('BEGIN');
try {
    for (const p of projects) {
        if (hasTask.get(p.id)) { skipped++; continue; }       // already has tasks → skip
        const assignee = assigneeByProject.get(p.id) ?? fallbackAssignee;
        TEMPLATE.forEach((t, i) => {
            insert.run(`T${p.id}-${i + 1}`, p.id, t.title, t.type, assignee, due, t.hours);
            created++;
        });
    }
    db.exec('COMMIT');
} catch (e) {
    db.exec('ROLLBACK');
    console.error('Seed failed, rolled back:', e.message);
    db.close();
    process.exit(1);
}

const total = db.prepare('SELECT COUNT(*) n FROM tasks').get().n;
console.log(`✅ Tasks seed done.`);
console.log(`   Projects processed: ${projects.length}  |  new tasks: ${created}  |  skipped (already had tasks): ${skipped}`);
console.log(`   Total tasks in DB now: ${total}`);
db.close();
