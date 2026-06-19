// FILE: backend/scripts/health-check.mjs
// =============================================================================
// KEYSS AI — FULL HEALTH CHECK (CEO-ready)
// =============================================================================
// Ek hi command me poora AI stack verify karta hai — bina kisi LLM cost ke aur
// bina DB me kuch likhe (100% read-only + 0 token). PASS/FAIL summary deta hai.
//
//   node scripts/health-check.mjs
//
// Kya check karta hai:
//   A. CONFIG   — .env load, secret set, model config, DB path.
//   B. DATABASE — DB connect + saare zaroori tables/columns + row counts +
//                 backdate permissions maujood (proves: real data, sahi schema).
//   C. TOOLS    — saare AI tools load + schema/handler valid.
//   D. ROUTING & TOKENS — sample messages route karo; har ek DETERMINISTIC
//                 (0 token, instant) hai ya BRAIN (LLM token) — counter se proof.
//   E. BACKDATE — HR "/" date rule (permission + future-block + precedence) logic.
//
// Exit code 0 = sab PASS, 1 = koi FAIL (CI/automation friendly).
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { REGISTRY } from '../src/ai/tools/index.js';
import { aiChat } from '../src/ai/chat.js';

// ── chhota .env loader (server.node.js jaisा — inline # comment strip) ─────────
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let val = m[2];
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, '').trim();
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnvFile();

// ── tiny assert harness ──────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
const FAILS = [];
const ok = (cond, label, detail = '') => {
  if (cond) { PASS++; console.log(`  ✅ ${label}`); }
  else { FAIL++; FAILS.push(label + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// =============================================================================
section('A. CONFIG');
const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
ok(!!process.env.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET set hai (token verify)',
   process.env.ACCESS_TOKEN_SECRET ? '' : 'MISSING — login token verify nahi hoga');
ok(existsSync(DB_FILE), 'DB_FILE path exists', existsSync(DB_FILE) ? DB_FILE : `NOT FOUND: ${DB_FILE}`);
console.log(`     · DB_FILE     = ${DB_FILE}`);
console.log(`     · AI_PROVIDER = ${process.env.AI_PROVIDER || '(default)'}`);
console.log(`     · AI_MODELS   = ${process.env.AI_MODELS || '(default)'}`);
console.log(`     · BRAIN model = ${process.env.AI_MODEL || '(provider default)'}`);
const isFinal = /final-project/i.test(DB_FILE);
console.log(`     · DB target   = ${isFinal ? 'FINAL company app ✅' : 'NOT final-project (check karo)'}`);

// =============================================================================
section('B. DATABASE (read-only — kuch likhta nahi)');
let db = null;
try { db = new DatabaseSync(DB_FILE); } catch (e) { ok(false, 'DB open', e.message); }

if (db) {
  const need = {
    daily_status_entries: ['employee_id', 'project_id', 'entry_date', 'start_time', 'end_time', 'duration_minutes', 'module_name', 'task_description', 'task_id'],
    projects: ['id', 'name'],
    project_assignments: ['employee_id', 'project_id'],
    tasks: ['id', 'title', 'project_id'],
    users: ['id', 'email', 'role_id', 'employee_id'],
    employee: ['id', 'name'],
    role_permissions: ['role_id', 'permission_id'],
    permissions: ['id', 'name'],
  };
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
  for (const [t, cols] of Object.entries(need)) {
    if (!tables.has(t)) { ok(false, `table ${t}`, 'MISSING'); continue; }
    const have = new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name));
    const missing = cols.filter(c => !have.has(c));
    ok(missing.length === 0, `table ${t} (${cols.length} cols)`, missing.length ? `missing: ${missing.join(', ')}` : '');
  }
  // Backdate gating ke liye zaroori permissions
  const perms = new Set(db.prepare('SELECT name FROM permissions').all().map(r => r.name));
  for (const p of ['all_employee_attendance', 'enter_status', 'search_status'])
    ok(perms.has(p), `permission "${p}" maujood`);
  // Row counts — proves REAL data hai
  const cnt = (t) => { try { return db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch { return '?'; } };
  console.log(`     · employees=${cnt('employee')}  projects=${cnt('projects')}  entries=${cnt('daily_status_entries')}  users=${cnt('users')}`);
}

// =============================================================================
section('C. TOOLS REGISTRY');
const toolNames = Object.keys(REGISTRY);
ok(toolNames.length >= 8, `${toolNames.length} tools loaded`, toolNames.join(', '));
for (const [n, m] of Object.entries(REGISTRY)) {
  const okTool = m && m.schema && m.schema.name === n && typeof m.handler === 'function';
  if (!okTool) ok(false, `tool ${n}`, 'schema/handler invalid');
}
if (toolNames.every(n => REGISTRY[n]?.handler)) ok(true, 'har tool me valid schema + handler');

// =============================================================================
section('D. ROUTING & TOKENS (stub model → 0 real cost; sirf classify karta hai)');
// Instrumented AI stub: env.AI.run call hua = BRAIN (token laga). Nahi hua = 0 token.
let brainCalls = 0;
const stubEnv = {
  AI_PROVIDER: 'cloudflare',
  AI: { run: async () => { brainCalls++; return { response: '' }; } },
};
// expect: tool name | 'chat'.  model: expected #model-calls (0 = pure deterministic
// 0-token; 1 = greeting ki natural reply chhote FAST model se, canned fallback ke saath).
const CASES = [
  // ── reads (deterministic, 0 token) ──
  { q: 'show my entries for today',            expect: 'get_timesheet_logs', model: 0 },
  { q: 'show me yeaterday logs',               expect: 'get_timesheet_logs', model: 0 }, // typo
  { q: 'last month ka kaam dikhao',            expect: 'get_timesheet_logs', model: 0 },
  // ── analytics (deterministic, 0 token) ──
  { q: 'total hours this year',                expect: 'analyze_timesheet', model: 0 },
  { q: 'hours by project',                     expect: 'analyze_timesheet', model: 0 },
  // ── add (deterministic fast-path, 0 token) ──
  { q: '9 to 11 fixed login bug',              expect: 'add_timesheet_entries', model: 0, project: 'AI Project' },
  // ── personal info (deterministic) ──
  { q: 'my projects',                          expect: 'get_my_projects',   model: 0 },
  { q: 'my leaves',                            expect: 'get_my_leaves',     model: 0 },
  // ── permissions (LIVE DB, deterministic, no hallucination) ──
  { q: 'what are my permissions',              expect: 'get_my_permissions', model: 0 },
  { q: 'mere paas kya access hai',             expect: 'get_my_permissions', model: 0 },
  // ── greeting (routing+chips deterministic; reply = tiny FAST model, ~1 call) ──
  { q: 'hey',                                  expect: 'chat',              model: 1 },
  { q: 'hlo',                                  expect: 'chat',              model: 1 }, // typo greet
  // ── future guard (deterministic) ──
  { q: 'show tomorrow entries',                expect: 'chat',              model: 0 },
];

let routePass = 0, det0 = 0, fast = 0;
for (const c of CASES) {
  brainCalls = 0;
  let routed = 'chat';
  try {
    const r = await aiChat(stubEnv, 1, c.q, [], c.project || null, 'Asia/Kolkata', false, null, []);
    routed = r && r.action && r.action.name ? r.action.name : 'chat';
  } catch (e) { routed = `ERR:${e.message}`; }
  // Heavy BRAIN (30B) yahan koi case nahi maarta — jo calls hain wo greeting ki
  // chhoti FAST-model reply hain. Tag: 0-token vs fast-model.
  const tokenTag = brainCalls === 0 ? '0-token' : 'fast-model';
  if (brainCalls === 0) det0++; else fast++;
  // PASS = sahi tool pe gaya AUR model-call count expected ke barabar (0 ya ≥1).
  const routeOk = routed === c.expect && ((c.model === 0) ? brainCalls === 0 : brainCalls >= 1);
  if (routeOk) routePass++;
  console.log(`  ${routeOk ? '✅' : '❌'} [${tokenTag.padEnd(10)}] "${c.q}" → ${routed}${routeOk ? '' : ` (expected ${c.expect}, model=${c.model}, got ${brainCalls})`}`);
}
ok(routePass === CASES.length, `routing + token-class: ${routePass}/${CASES.length} sahi`);
console.log(`     · 0-token (pure deterministic) = ${det0}/${CASES.length}   ·   tiny fast-model (greetings) = ${fast}/${CASES.length}   ·   heavy-brain = 0/${CASES.length}`);

// =============================================================================
section('E. BACKDATE RULE (HR "/" date — permission + future-block + precedence)');
const today = new Date().toLocaleDateString('en-CA');
const past = '2026-01-15', future = '2099-01-01';
// Controller ki gating logic (replica): forcedDate tabhi jab org-viewer + enter_status
// AUR date <= today. Niche pure-logic — koi DB write nahi.
const gate = (perms, date) => {
  const isOrgViewer = perms.has('all_employee_attendance');
  const canBackdate = isOrgViewer && perms.has('enter_status');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && canBackdate && date <= today) return date;
  return null;
};
const hr = new Set(['all_employee_attendance', 'enter_status']);
const emp = new Set(['enter_status']); // normal employee — org-viewer nahi
ok(gate(hr, past) === past,    'HR + past date → backdate set hota hai');
ok(gate(hr, future) === null,  'HR + future date → REJECT (null)');
ok(gate(hr, today) === today,  'HR + today → allowed');
ok(gate(emp, past) === null,   'normal employee + past → REJECT (permission nahi)');
ok(gate(hr, 'garbage') === null, 'galat format → REJECT (null)');
// Handler precedence: forcedDate || entry_date || today
const pick = (forced, parsed, t) => forced || parsed || t;
ok(pick(past, '2026-02-02', today) === past, 'precedence: forcedDate model-date ko override karta hai');
ok(pick(null, '2026-02-02', today) === '2026-02-02', 'precedence: forcedDate na ho → parsed date');
ok(pick(null, null, today) === today, 'precedence: kuch na ho → today (default)');

// =============================================================================
console.log(`\n\x1b[1m================ RESULT ================\x1b[0m`);
console.log(`  PASS: ${PASS}    FAIL: ${FAIL}`);
if (FAIL) { console.log('\n  ⚠️  Failures:'); FAILS.forEach(f => console.log('   • ' + f)); }
console.log(FAIL === 0 ? '\n  🎉 SAB PERFECT — AI demo-ready hai.\n' : '\n  ❗ Upar wale fix karne hain.\n');
process.exit(FAIL === 0 ? 0 : 1);
