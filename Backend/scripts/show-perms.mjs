// FILE: backend/scripts/show-perms.mjs
// Kis role ke paas kaun-kaunse permission hain — readable form me (DB se live).
//
// Chalane ke liye:
//   npm run perms                 → har role ke saare permissions
//   npm run perms manage_project  → ek permission kis-kis role ke paas hai
//
// READ-ONLY: DB ko sirf padhta hai, kuch badalta nahi.

import { DatabaseSync } from 'node:sqlite';

const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const db = new DatabaseSync(DB_FILE, { readOnly: true });

const arg = process.argv[2]; // optional: ek permission ka naam

if (arg) {
    // ── Mode 2: ek permission kis-kis role ke paas hai ──
    const perm = db.prepare('SELECT id, name, description FROM permissions WHERE name = ?').get(arg);
    if (!perm) {
        console.log(`\n"${arg}" naam ka koi permission nahi hai.\n`);
        const all = db.prepare('SELECT name FROM permissions ORDER BY name').all();
        console.log('Available permissions:\n  ' + all.map((p) => p.name).join(', ') + '\n');
    } else {
        const roles = db.prepare(`
            SELECT r.name FROM role_permissions rp
            JOIN roles r ON r.id = rp.role_id
            WHERE rp.permission_id = ? ORDER BY r.level`).all(perm.id);
        console.log(`\nPermission: ${perm.name}  (${perm.description || ''})`);
        console.log('Kis-kis role ke paas:  ' + (roles.map((r) => r.name).join(', ') || '(koi nahi)') + '\n');
    }
} else {
    // ── Mode 1: har role ke saare permissions ──
    const roles = db.prepare('SELECT id, name, level FROM roles ORDER BY level').all();
    for (const r of roles) {
        const perms = db.prepare(`
            SELECT p.name FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ? ORDER BY p.id`).all(r.id);
        console.log('────────────────────────────────────────────────────────');
        console.log(`ROLE: ${r.name}  (level ${r.level})  →  ${perms.length} permissions`);
        console.log(perms.length ? '   ' + perms.map((p) => p.name).join(', ') : '   (koi permission nahi)');
    }
    console.log('────────────────────────────────────────────────────────');
    console.log('Tip:  npm run perms <permission_name>   (e.g. npm run perms manage_project)\n');
}

db.close();
