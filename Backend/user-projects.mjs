// FILE: Backend/user-projects.mjs
// KAAM: Kisi bhi user ke projects (aur har project ke task count) dekhna.
//
// Chalane ka tareeka:
//   node user-projects.mjs vijay@keyss.in     -> us user ke saare projects
//   node user-projects.mjs                    -> top users by project count
//
// (Yeh sirf PADHTA hai — koi data add/change/delete NAHI karta.)

import { getPool } from './src/db/mysqlAdapter.js';
import { readFileSync, existsSync } from 'node:fs';

// .env load (DB_NAME etc.)
if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const email = process.argv[2];
const pool = getPool();

if (email) {
  const [rows] = await pool.query(
    `SELECT p.id AS project_id, p.name AS project, COUNT(pt.id) AS tasks
       FROM users u
       JOIN employee e            ON e.id = u.employee_id
       JOIN project_assignments pa ON pa.employee_id = e.id
       JOIN projects p            ON p.id = pa.project_id
       LEFT JOIN project_tasks pt ON pt.project_id = p.id
      WHERE LOWER(u.email) = LOWER(?)
      GROUP BY p.id, p.name
      ORDER BY p.name`,
    [email]
  );
  if (rows.length === 0) {
    console.log(`"${email}" ke koi assigned project nahi mile (ya email galat hai / employee se linked nahi).`);
  } else {
    console.log(`\n${email} ke projects: ${rows.length}`);
    console.table(rows);
  }
} else {
  const [rows] = await pool.query(
    `SELECT u.email, e.name AS employee, COUNT(pa.project_id) AS projects
       FROM users u
       JOIN employee e            ON e.id = u.employee_id
       JOIN project_assignments pa ON pa.employee_id = e.id
      GROUP BY u.id, u.email, e.name
      ORDER BY projects DESC
      LIMIT 20`
  );
  console.log('\nTop users by project count:');
  console.table(rows);
}

process.exit(0);
