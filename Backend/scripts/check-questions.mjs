// FILE: backend/scripts/check-questions.mjs
// Apni sawaal-list test karo. Do tarah se likh sakte ho (scripts/questions.txt):
//   1) sirf sawaal           → coverage dikhata hai (kaunse tool pe gaya)
//   2) sawaal | expected     → strict PASS/FAIL (e.g. "tasks over 1 hour | query_timesheet")
//
// expected ki values: add_timesheet_entries | get_timesheet_logs | query_timesheet
//                     | analyze_timesheet | get_my_profile | chat
//
// Chalao:  npm run check:questions      (file: scripts/questions.txt)
// Instant, no server, no AI cost. # se shuru line = comment.

import { readFileSync } from 'node:fs';
import { aiChat } from '../src/ai/chat.js';

const stubEnv = { AI: { run: async () => ({ response: '' }) } };
const PROJECT = 'AI Project';
const file = process.argv[2] || 'scripts/questions.txt';

const lines = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('#'));

const run = async () => {
  const counts = {};
  let pass = 0, fail = 0, checked = 0;
  console.log(`\nChecking ${lines.length} questions from ${file}…\n`);
  for (const line of lines) {
    const [qRaw, expectRaw] = line.split('|');
    const q = qRaw.trim();
    const expect = expectRaw ? expectRaw.trim() : null;
    let tool;
    try {
      const r = await aiChat(stubEnv, 1, q, [], PROJECT);
      tool = (r && r.action && r.action.name) || 'chat';
    } catch (e) {
      tool = 'ERROR';
    }
    counts[tool] = (counts[tool] || 0) + 1;
    if (expect) {
      checked++;
      const ok = tool === expect;
      ok ? pass++ : fail++;
      console.log(`  ${ok ? '✅' : '❌'} [${tool.padEnd(22)}] ${q}` + (ok ? '' : `   (expected ${expect})`));
    } else {
      const handled = tool !== 'chat' && tool !== 'ERROR';
      console.log(`  ${handled ? '🟢' : '⚪'} [${tool.padEnd(22)}] ${q}`);
    }
  }
  const handled = lines.length - (counts['chat'] || 0) - (counts['ERROR'] || 0);
  console.log('\n────────────────────────────────────────');
  if (checked > 0) console.log(`  PASS/FAIL (lines with | expected):  ${pass}/${checked} passed` + (fail ? `   ❌ ${fail} failed` : '  ✅'));
  console.log('  Coverage (all lines):');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`     ${t.padEnd(24)} ${n}`));
  console.log(`  🟢 Handled by a tool : ${handled}/${lines.length}`);
  console.log('────────────────────────────────────────\n');
  process.exit(fail ? 1 : 0);
};

run();
