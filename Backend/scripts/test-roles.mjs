// FILE: backend/scripts/test-roles.mjs
// END-TO-END role test — HR side + EMPLOYEE side, REAL server + REAL brain.
//
// Kya karta hai:
//   1. .env se ACCESS_TOKEN_SECRET padhta hai, HR (Simran) + Employee (Puneet)
//      ke liye khud JWT sign karta hai (OTP login ki zaroorat nahi).
//   2. Chalte hue server (http://localhost:8787) pe /api/timesheet/ai/chat hit
//      karta hai — wahi raasta jo browser ka chatbot leta hai (auth → controller
//      → brain/deterministic → tools → DB).
//   3. Har reply ko expected-pattern se check karta hai → ✅/❌ + time.
//   4. ADD-test ki entries me "[AI-TEST]" marker hota hai — aakhir me wahi rows
//      DB se DELETE kar di jaati hai (asli data ganda nahi hota).
//
// Chalane se PEHLE: dusre terminal me server chalu ho —  npm run dev:node
// Chalane ko:        npm run test:roles
//
// NOTE: Brain (AI_PROVIDER) jo bhi .env me set hai usi se chalega — yahi point
// hai: model badal ke yahi script dubara chalao, dono roles turant verify.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sign } from 'hono/jwt';

// ── config: .env se secret + DB path ────────────────────────────────────────
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const envOf = (k, dflt = '') => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : dflt;
};
const SECRET = envOf('ACCESS_TOKEN_SECRET', 'dev-secret-change-me');
const DB_FILE = envOf('DB_FILE', 'keyss-status.prod.db');
const BASE = process.env.TEST_BASE_URL || 'http://localhost:8787';

// ── users (DB ke asli active users) ─────────────────────────────────────────
const HR = { id: 2268, label: 'HR · Simran (Simran@keyss.in)' };
const EMP = { id: 2267, label: 'EMPLOYEE · Puneet (Puneet@keyss.in)' };

const PROJECT = 'Inhouse Project'; // add-test ke liye selected project (UI ki pill jaisa)
const MARKER = '[AI-TEST]';        // in entries ko aakhir me DB se delete karte hai

// ── test cases ───────────────────────────────────────────────────────────────
// expect = regex jo reply me milna chahiye (case-insensitive)
const EMP_CASES = [
  { name: 'profile (who am i)', msg: 'who am i', expect: /puneet/i },
  { name: 'greeting (hi)', msg: 'hi', expect: /.+/ },
  { name: 'recent logs', msg: 'show my last entries', expect: /entr|log|•|abhi tak/i },
  { name: 'analytics (total hours this year)', msg: 'how many total hours this year', expect: /hrs|hours|ghante|total/i },
  {
    name: `add 2 entries (${MARKER}, baad me delete)`,
    msg: `9 to 10:15 ${MARKER} dataset cleanup and preparation, 10:15 to 11 ${MARKER} model training review`,
    expect: /saved|✅/i,
    project: PROJECT,
  },
];

const HR_CASES = [
  { name: 'profile (who am i)', msg: 'who am i', expect: /simran/i },
  { name: 'employee list', msg: 'show employees', expect: /active employee|Neha|Anurag/i },
  { name: 'employee info (single-shot email)', msg: 'show info of neha@keyss.in', expect: /neha/i },
  { name: 'analytics for other (brain tool-call)', msg: 'total hours of neha@keyss.in all time', expect: /hrs|hours|total/i },
  { name: 'pending today (NEW tool)', msg: 'who has not filled their status today', expect: /pending|nahi bhara|sabne/i },
  { name: 'my permissions (menu)', msg: 'what are my permissions', expect: /can do|permission/i },
  { name: 'permission sub-menu (chip click)', msg: 'perm:all_employee_attendance', expect: /attendance|status|pending/i },
  {
    name: `ADD-for-others (viewing Neha → log for Neha)`,
    msg: `8 to 9 ${MARKER} reviewed reports`,
    expect: /Neha/i, // dispatchTool prefixes "👤 Neha saini ..." when scoped to target
    project: PROJECT,
    viewAs: 'neha@keyss.in',
  },
  {
    name: `SAFETY: "log my hours" while viewing Neha → clears pill (self)`,
    msg: 'log my hours',
    expect: /time|duration|provide|9-11/i, // asks for time; must NOT be scoped to Neha
    viewAs: 'neha@keyss.in',
    expectViewCleared: true,
  },
  {
    name: `STICKY: "show last 5 entries" while viewing Neha → Neha's (no "whose?")`,
    msg: 'show last 5 entries',
    expect: /Neha/i, // must use the selected teammate, not ask whose
    viewAs: 'neha@keyss.in',
  },
];

// ── helpers ──────────────────────────────────────────────────────────────────
async function makeToken(userId) {
  // auth.middleware payload.id se user uthata hai (DB se role/employee_id khud aata hai)
  return sign({ id: userId, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET, 'HS256');
}

async function chat(token, msg, project = null, viewAs = null) {
  const t0 = Date.now();
  const resp = await fetch(`${BASE}/api/timesheet/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: msg, history: [], selectedProject: project, viewAs }),
  });
  const ms = Date.now() - t0;
  let body = {};
  try { body = await resp.json(); } catch { /* non-json */ }
  return { status: resp.status, reply: body?.reply || '', viewTarget: body?.viewTarget, ms };
}

async function runSide(label, userId, cases) {
  console.log(`\n━━━ ${label} ━━━`);
  const token = await makeToken(userId);
  let pass = 0;
  for (const c of cases) {
    let got;
    try {
      got = await chat(token, c.msg, c.project || null, c.viewAs || null);
    } catch (e) {
      console.log(`  ❌ ${c.name} — server unreachable: ${e.message}`);
      continue;
    }
    let ok = got.status === 200 && c.expect.test(got.reply);
    if (ok && c.expectViewCleared) ok = got.viewTarget === null; // self-log must clear the pill
    if (ok) pass++;
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}  (${(got.ms / 1000).toFixed(1)}s)`);
    if (!ok) {
      console.log(`       status=${got.status}  reply="${String(got.reply).slice(0, 160)}"`);
    } else {
      console.log(`       ↳ ${String(got.reply).split('\n')[0].slice(0, 100)}`);
    }
  }
  console.log(`  → ${pass}/${cases.length} passed`);
  return { pass, total: cases.length };
}

function cleanupTestEntries() {
  // sirf [AI-TEST] marker waali rows udao — asli data untouched
  const db = new DatabaseSync(DB_FILE);
  const n = db.prepare(`DELETE FROM daily_status_entries WHERE task_description LIKE ?`).run(`%${MARKER}%`);
  db.close();
  return n.changes ?? 0;
}

// ── run ──────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\nTEST TARGET : ${BASE}`);
  console.log(`BRAIN (env) : ${envOf('AI_PROVIDER', '(default)')} · ${envOf('AI_MODEL', '(provider default)')}`);
  console.log(`DB          : ${DB_FILE}`);

  // server zinda hai?
  try { await fetch(BASE); } catch {
    console.error(`\n❌ Server ${BASE} pe nahi mila. Pehle dusre terminal me:  npm run dev:node\n`);
    process.exit(2);
  }

  const emp = await runSide(EMP.label, EMP.id, EMP_CASES);
  const hr = await runSide(HR.label, HR.id, HR_CASES);

  const deleted = cleanupTestEntries();
  console.log(`\n🧹 Cleanup: ${deleted} ${MARKER} test entries DB se delete ki.`);

  const pass = emp.pass + hr.pass, total = emp.total + hr.total;
  console.log('\n────────────────────────────────────────');
  console.log(`  RESULT: ${pass}/${total} passed ${pass === total ? '— ALL PASS ✅' : `(${total - pass} failed ❌)`}`);
  console.log('────────────────────────────────────────\n');
  process.exit(pass === total ? 0 : 1);
};

main();
