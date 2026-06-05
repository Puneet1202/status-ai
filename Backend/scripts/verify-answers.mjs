// FILE: backend/scripts/verify-answers.mjs
// SAHI JAWAB verify karta hai (sirf routing nahi). Har case ke liye:
//   1) DB se KHUD sach nikaalta hai (independent SQL),
//   2) AI ko poora sawaal deta hai (NL → routing → tool → reply),
//   3) check karta hai ki AI ke reply me wahi sach hai.
// Isse tumhe chat me manually dekhne ki zaroorat nahi — script bolti hai PASS/FAIL.
//
// Chalao:  npm run verify
// Self-validating: sach DB se aata hai, isliye data badle to bhi sahi rehta hai.
// READ-ONLY: kuch nahi badalta. (employee badalna ho: EMP_ID=84 npm run verify)

import { DatabaseSync } from 'node:sqlite';
import { aiChat } from '../src/ai/chat.js';
import { dispatchTool } from '../src/ai/tools/index.js';
import { todayISO } from '../src/ai/tools/_helpers.js';

const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const EMP = Number(process.env.EMP_ID || 134);
const today = todayISO();

// minimal READ-ONLY D1-compatible adapter (tools sirf SELECT karte hain yahan)
const raw = new DatabaseSync(DB_FILE, { readOnly: true });
raw.exec('PRAGMA busy_timeout = 8000;');
const cache = new Map();
const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
const roDb = {
  prepare: (sql) => ({ _p: [], bind(...a) { this._p = a; return this; },
    async first() { const x = stmt(sql).get(...this._p); return x === undefined ? null : x; },
    async all() { return { results: stmt(sql).all(...this._p) }; },
    async run() { const i = stmt(sql).run(...this._p); return { meta: { changes: i.changes, last_row_id: Number(i.lastInsertRowid) } }; } }),
  async batch(s) { const o = []; for (const x of s) o.push(await x.run()); return o; },
};
const stubEnv = { AI: { run: async () => ({ response: '' }) } };
const ctx = { db: roDb, employeeId: EMP, env: stubEnv, selectedProject: null, selectedTasks: [], today };

// NL sawaal → AI ka asli reply
async function answer(q) {
  const r = await aiChat(stubEnv, EMP, q, [], null);
  if (r && r.action) {
    const out = await dispatchTool(r.action.name, r.action.data, ctx);
    return { tool: r.action.name, reply: out.reply || '' };
  }
  return { tool: 'chat', reply: (r && r.reply) || '' };
}

// ── DB se SACH (independent) ──
const q1 = (sql, ...p) => stmt(sql).get(...p);
const h2023 = q1("SELECT ROUND(SUM(duration_minutes)/60.0,1) h, COUNT(*) n FROM daily_status_entries WHERE employee_id=? AND entry_date BETWEEN '2023-01-01' AND '2023-12-31'", EMP);
const topProj = q1("SELECT p.name FROM daily_status_entries d JOIN projects p ON p.id=d.project_id WHERE d.employee_id=? GROUP BY p.name ORDER BY SUM(d.duration_minutes) DESC LIMIT 1", EMP);
const todayAgg = q1("SELECT ROUND(SUM(duration_minutes)/60.0,1) h, COUNT(*) n FROM daily_status_entries WHERE employee_id=? AND entry_date=?", EMP, today);
const aiToday = q1("SELECT COUNT(*) n FROM daily_status_entries WHERE employee_id=? AND entry_date=? AND LOWER(task_description) LIKE '%ai%'", EMP, today);
const yearTotal = q1("SELECT ROUND(SUM(duration_minutes)/60.0,1) h FROM daily_status_entries WHERE employee_id=? AND substr(entry_date,1,4)=?", EMP, String(new Date().getFullYear()));

// ── Test cases: { q, want } — `want` = DB se nikla sach jo reply me hona chahiye ──
const CASES = [
  { q: 'total hours in 2023',                 want: String(h2023.h) },        // exact hours
  { q: 'show my hours by year',               want: `2023 — ${h2023.h}` },    // 2023 row sahi
  { q: 'which project did I work on the most', want: topProj.name },          // top project
  { q: 'how many total hours this year',      want: String(yearTotal.h) },    // is saal total
];
// aaj ka data ho to uspe bhi check (warna skip — data badalta rehta hai)
if (todayAgg.n > 0) {
  CASES.push({ q: 'how many hours did I work today', want: String(todayAgg.h) });
  if (aiToday.n > 0) CASES.push({ q: 'show only AI-related activities today', want: `Found ${aiToday.n}` });
}

const run = async () => {
  let pass = 0;
  console.log(`\nVerifying ${CASES.length} answers for employee ${EMP} (DB se sach nikaal ke)…\n`);
  for (const c of CASES) {
    const { tool, reply } = await answer(c.q);
    const ok = reply.toLowerCase().includes(String(c.want).toLowerCase());
    if (ok) pass++;
    console.log(`  ${ok ? '✅' : '❌'} "${c.q}"`);
    console.log(`       expected to contain: "${c.want}"   [${tool}]`);
    if (!ok) console.log(`       GOT: ${reply.replace(/\n/g, ' ').slice(0, 120)}`);
  }
  console.log('\n────────────────────────────────────────');
  console.log(`  ANSWERS CORRECT: ${pass}/${CASES.length}` + (pass === CASES.length ? '  ✅ sab sahi' : `   ❌ ${CASES.length - pass} galat`));
  console.log('────────────────────────────────────────\n');
  process.exit(pass === CASES.length ? 0 : 1);
};
run();
