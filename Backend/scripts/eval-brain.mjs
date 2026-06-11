// FILE: backend/scripts/eval-brain.mjs
// SCORED EVAL (golden test set) — "AI kitna sahi hai" ko MEASURE karne ki technique.
// Har case me message + EXPECTED result (kaunsa tool chalna chahiye) pehle se likha
// hai; script SAME pipeline (aiChat — deterministic intents + Groq brain) se चला कर
// automatic PASS/FAIL देता है aur ek SCORE chhapta hai. Isi se pata chalta hai model/
// provider badalne par accuracy giri ya badhi (regression detection).
//
// Run:  npm run eval:brain        (Backend/.env me AI_PROVIDER + key chahiye)
// READ-ONLY: koi DB write nahi hota (sirf routing check hota hai).

import { readFileSync, existsSync } from 'node:fs';
import { aiChat } from '../src/ai/chat.js';
import { getProvider, getBrainModel, isBrainEnabled } from '../src/ai/ai-config.js';
import { makeStubAI } from '../src/ai/providers/cloudflareRest.js';

// tiny .env loader (same as server.node.js)
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
loadEnvFile();

const env = {
  AI_PROVIDER: process.env.AI_PROVIDER || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
  AI_MODEL: process.env.AI_MODEL || '',
  AI_BRAIN: process.env.AI_BRAIN || '',
  AI: makeStubAI(),
};

if (!isBrainEnabled(env)) {
  console.error('\n❌ Brain OFF — .env me selected provider ki key daalo, fir chalao.\n');
  process.exit(1);
}
console.log(`\n🧪 EVAL — provider: ${getProvider(env)} · model: ${getBrainModel(env)}\n`);

// ── GOLDEN SET ──────────────────────────────────────────────────────────────
// expect: tool-name | ['toolA','toolB'] (koi bhi chale) | 'reply' (NO tool — sirf text)
// org: true = HR/Admin ke roop me; argCheck: routed args par extra shart.
const CASES = [
  // — deterministic intents (0 token, hamesha same) —
  { q: 'who i am', expect: 'get_my_profile' },
  { q: 'what can you do', expect: 'reply' },
  { q: 'can you apply my leave', expect: 'reply' },
  { q: 'total employee', expect: 'list_employees' },
  { q: 'show my today entry', expect: 'get_timesheet_logs' },
  { q: '9 to 11 fixed login bug', expect: 'add_timesheet_entries', proj: 'Inhouse Project' },

  // — brain (real LLM) — messy/vague phrasings, English + Hinglish —
  { q: 'gimme my most recent log', expect: 'get_timesheet_logs' },
  { q: 'which project ate most of my hours overall', expect: 'analyze_timesheet' },
  { q: 'kal maine kitna kaam kiya tha', expect: ['get_timesheet_logs', 'analyze_timesheet', 'query_timesheet'] },
  { q: 'delete my last entry', expect: 'delete_timesheet' },
  { q: 'aaj ki 9-11 wali entry ko 10-12 kar do', expect: 'update_timesheet' },
  { q: 'show me anything related to testing today', expect: ['query_timesheet', 'get_timesheet_logs'] },
  { q: 'maine 9 se 11 API banayi fir 1 se 2 lunch kiya', expect: 'add_timesheet_entries', proj: 'Inhouse Project' },
  { q: 'how productive was i this month', expect: ['analyze_timesheet', 'get_timesheet_logs'] },

  // — org-viewer (HR/Admin) —
  { q: 'sabse zyada kisne kaam kiya last month', org: true, expect: 'analyze_timesheet', argCheck: (d) => d.compare_employees === true },
  { q: "show vijay's status this week", org: true, expect: ['get_timesheet_logs', 'query_timesheet'], argCheck: (d) => /vijay/i.test(d.employee_name || '') },
  { q: 'analyze prachi ke hours is month', org: true, expect: 'analyze_timesheet', argCheck: (d) => /prachi/i.test(d.employee_name || '') },

  // — chit-chat / junk → NO tool (fabrication na ho) —
  { q: 'hey kaise ho', expect: 'reply' },
  { q: 'hsgnf', expect: 'reply' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;

for (const c of CASES) {
  let verdict, detail;
  try {
    const r = await aiChat(env, 1, c.q, [], c.proj || null, null, !!c.org);
    const tool = r?.action?.name || null;
    const wantTools = c.expect === 'reply' ? [] : [].concat(c.expect);
    const toolOk = c.expect === 'reply' ? !tool && !!r?.reply : wantTools.includes(tool);
    const argOk = !c.argCheck || (tool && c.argCheck(r.action.data || {}));
    verdict = toolOk && argOk;
    detail = tool ? `[${tool}] ${JSON.stringify(r.action.data || {}).slice(0, 90)}` : `(reply) ${(r?.reply || '').slice(0, 70)}`;
  } catch (e) {
    verdict = false;
    detail = 'ERROR ' + (e?.message || e);
  }
  if (verdict) { pass++; console.log(`  PASS  "${c.q}"`); }
  else { fail++; console.log(`  FAIL  "${c.q}"\n        → ${detail}  (expected: ${JSON.stringify(c.expect)})`); }
  // Groq free tier = 8000 TPM; har brain call ~4.2k tokens → sahi MODEL-score ke
  // liye EVAL_SLEEP_MS=35000 se chalao (warna 429 → fallback ka score milta hai).
  await sleep(Number(process.env.EVAL_SLEEP_MS || 800));
}

const total = pass + fail;
const score = ((pass / total) * 100).toFixed(0);
console.log(`\n========== SCORE: ${pass}/${total} (${score}%) — provider: ${getProvider(env)} · ${getBrainModel(env)} ==========`);
console.log('Yahi number provider/model compare karne ka scientific tareeka hai —');
console.log('model badlo → dobara chalao → score compare. 90%+ = production-ready routing.\n');
process.exit(fail ? 1 : 0);
