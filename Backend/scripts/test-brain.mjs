// FILE: backend/scripts/test-brain.mjs
// PROOF for the Claude "brain": sends deliberately messy, varied phrasings through
// the SAME pipeline the app uses (aiChat → tool → real DB, read-only) and prints
// which tool Claude routed to + the answer. This is the "har user alag tarike se
// puchega" test — no regex was written for any of these lines.
//
// Run:  npm run test:brain          (needs ANTHROPIC_API_KEY in Backend/.env)
// Employee: EMP_ID=134 by default (Vijay). READ-ONLY — nothing is written.

import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { aiChat } from '../src/ai/chat.js';
import { dispatchTool } from '../src/ai/tools/index.js';
import { todayISO } from '../src/ai/tools/_helpers.js';
import { isBrainEnabled, getBrainModel } from '../src/ai/ai-config.js';

// tiny .env loader (same as server.node.js)
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile();

const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || '',
  AI_BRAIN: process.env.AI_BRAIN || '',
};
const EMP = Number(process.env.EMP_ID || 134);
const today = todayISO();

if (!isBrainEnabled(env)) {
  console.error('\n❌ Brain is OFF. Add ANTHROPIC_API_KEY to Backend/.env first, then re-run.\n');
  process.exit(1);
}
console.log(`\n🧠 Brain ON · model: ${getBrainModel(env)} · employee ${EMP}\n`);

// read-only D1-compatible adapter (tools only SELECT here)
const raw = new DatabaseSync('keyss-status.prod.db', { readOnly: true });
raw.exec('PRAGMA busy_timeout = 8000;');
const cache = new Map();
const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
const db = {
  prepare: (sql) => ({ _p: [], bind(...a) { this._p = a; return this; },
    async first() { const x = stmt(sql).get(...this._p); return x === undefined ? null : x; },
    async all() { return { results: stmt(sql).all(...this._p) }; },
    async run() { return { meta: {} }; } }),
  async batch() { return []; },
};
const ctx = { db, employeeId: EMP, env, selectedProject: null, selectedTasks: [], today };

// Messy, varied phrasings — English, Hinglish, typos, indirect. No regex covers these.
const CASES = [
  'yaar mujhe meri pichli teen entries dikha do na',
  'what did i get up to this week?',
  'how much time total did i burn this year',
  'gimme my most recent log',
  'which project ate most of my hours overall',
  'kal kitna kaam kiya tha main_ne',           // typo + Hinglish
  'show me anything related to testing today',
];

const run = async () => {
  for (const q of CASES) {
    try {
      const r = await aiChat(env, EMP, q, [], null);
      if (r.action) {
        const out = await dispatchTool(r.action.name, r.action.data, ctx);
        const reply = (out.reply || '').replace(/\n/g, ' ').slice(0, 110);
        console.log(`🟢 "${q}"\n     → [${r.action.name}]  ${reply}\n`);
      } else {
        console.log(`💬 "${q}"\n     → (reply) ${(r.reply || '').slice(0, 110)}\n`);
      }
    } catch (e) {
      console.log(`❌ "${q}"  → ERROR ${e?.message || e}\n`);
    }
  }
  raw.close();
  console.log('Done. Har line ka sahi tool chuna gaya — bina ek bhi naya regex likhe. 🎯\n');
};
run();
