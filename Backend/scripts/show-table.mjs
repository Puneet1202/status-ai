// FILE: backend/scripts/show-table.mjs
// Kisi bhi table ke fields (columns), defaults, allowed values aur foreign keys
// readable form me dikhata hai — DB se live.
//
// Chalane ke liye:
//   npm run schema tasks
//   npm run schema users
//   npm run schema            → saare table ke naam
//
// READ-ONLY: DB ko sirf padhta hai, kuch badalta nahi.

import { DatabaseSync } from 'node:sqlite';

const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const db = new DatabaseSync(DB_FILE, { readOnly: true });

const table = process.argv[2];

if (!table) {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('\nSaare tables:\n  ' + names.map((t) => t.name).join(', '));
    console.log('\nKisi ek ko dekho:  npm run schema <table_name>   (e.g. npm run schema tasks)\n');
    db.close();
    process.exit(0);
}

const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
if (!exists) {
    console.log(`\n"${table}" naam ka koi table nahi hai. ( npm run schema  → saare naam )\n`);
    db.close();
    process.exit(1);
}

const cols = db.prepare(`PRAGMA table_info(${table})`).all();
const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
const count = db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;

console.log(`\n==================== TABLE: ${table}  (${count} rows) ====================\n`);
console.log('FIELDS (columns):');
for (const c of cols) {
    const bits = [c.type || 'TEXT'];
    if (c.pk) bits.push('PRIMARY KEY');
    if (c.notnull) bits.push('NOT NULL');
    if (c.dflt_value !== null) bits.push(`default ${c.dflt_value}`);
    console.log(`  • ${c.name.padEnd(20)} ${bits.join(', ')}`);
}

if (fks.length) {
    console.log('\nFOREIGN KEYS (kis table se juda hai):');
    for (const f of fks) console.log(`  • ${f.from}  →  ${f.table}(${f.to})`);
}

// Full CREATE statement bhi — isme CHECK (allowed values) dikhte hain.
const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(table).sql;
console.log('\nPOORA DEFINITION (CHECK = allowed values yahan dikhte hain):\n');
console.log(sql);
console.log('');

db.close();
