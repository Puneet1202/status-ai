// FILE: backend/scripts/test-questions.mjs
// Apni sawaalon ki list ek baar mein test karo — har sawaal kaunse tool pe jaata
// hai (route hota hai) wo check karta hai, aur ✅/❌ + "X/Y passed" deta hai.
//
// Chalane ke liye:  npm run test:ai
//
// Ye DETERMINISTIC routing test karta hai (add/show/analyze/profile/greeting) —
// koi server ya AI cost nahi, turant. delete/update model pe jaate hain, isliye
// unhe 'chat' maana jaata hai (routing test ke liye).
//
// Apne sawaal add karna ho? Niche CASES array me ek line jodo:
//   { q: 'tumhara sawaal', expect: 'analyze_timesheet' }
// expect ki values: add_timesheet_entries | get_timesheet_logs | analyze_timesheet
//                   | get_my_profile | chat

import { aiChat } from '../src/ai/chat.js';

// Stub AI: model-path sawaal crash na karein (khaali reply de dein).
const stubEnv = { AI: { run: async () => ({ response: '' }) } };
const PROJECT = 'AI Project'; // add-type sawaalon ke liye ek selected project

const CASES = [
  // ── ADD (time-log) ──
  { q: '9-11 fixed login bug, 2-4 testing',                 expect: 'add_timesheet_entries' },
  { q: '9 se 11 report banayi',                             expect: 'add_timesheet_entries' },

  // ── SHOW / LIST (get) ──
  { q: 'show my hours today',                               expect: 'get_timesheet_logs' },
  { q: 'how many hours did I work today',                   expect: 'get_timesheet_logs' },
  { q: 'show my last entries',                              expect: 'get_timesheet_logs' },
  { q: 'how many hours did I work yesterday',               expect: 'get_timesheet_logs' },
  { q: 'show me yeaterday logs',                            expect: 'get_timesheet_logs' }, // typo-tolerant
  { q: 'this week ka kaam dikhao',                          expect: 'get_timesheet_logs' },

  // ── ANALYTICS (totals / breakdowns / comparisons) ──
  { q: 'how many total hours this year',                    expect: 'analyze_timesheet' },
  { q: 'show my hours by year',                             expect: 'analyze_timesheet' },
  { q: 'hours per project this year',                       expect: 'analyze_timesheet' },
  { q: 'which project did I work on the most',              expect: 'analyze_timesheet' },
  { q: 'total hours in 2023',                               expect: 'analyze_timesheet' },
  { q: 'monthly breakdown this year',                       expect: 'analyze_timesheet' },
  { q: 'overall kitne ghante',                              expect: 'analyze_timesheet' },

  // ── PROFILE ──
  { q: 'what is my name',                                   expect: 'get_my_profile' },
  { q: 'who am i',                                          expect: 'get_my_profile' },

  // ── GREETING / SMALL-TALK (chat) ──
  { q: 'hi',                                                expect: 'chat' },
  { q: 'thanks',                                            expect: 'chat' },
];

function routedName(r) {
  return r && r.action && r.action.name ? r.action.name : 'chat';
}

const run = async () => {
  let pass = 0;
  const fails = [];
  console.log('\nRunning ' + CASES.length + ' question routing tests…\n');
  for (const c of CASES) {
    let got;
    try {
      const r = await aiChat(stubEnv, 1, c.q, [], PROJECT);
      got = routedName(r);
    } catch (e) {
      got = 'ERROR: ' + e.message;
    }
    const ok = got === c.expect;
    if (ok) pass++; else fails.push({ ...c, got });
    console.log(`  ${ok ? '✅' : '❌'}  "${c.q}"`);
    if (!ok) console.log(`        expected: ${c.expect}   got: ${got}`);
  }
  console.log('\n────────────────────────────────────────');
  console.log(`  RESULT: ${pass}/${CASES.length} passed` + (fails.length ? `   (${fails.length} failed)` : '  — ALL PASS ✅'));
  console.log('────────────────────────────────────────\n');
  process.exit(fails.length ? 1 : 0); // non-zero exit if any fail (CI-friendly)
};

run();
