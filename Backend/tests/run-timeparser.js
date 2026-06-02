// FILE: Backend/tests/run-timeparser.js
// =========================================================================
// AUTOMATED TIMEPARSER TESTS — Zero dependencies, zero network
// Run: node tests/run-timeparser.js
// =========================================================================
// Yeh script directly Node.js se chalta hai — no wrangler, no server needed.
// Har test case expected output se compare karta hai.
// Green checkmark = pass, Red cross = fail with actual output.
// =========================================================================

import { parseWorkBlocks, deriveModule, isBreakLabel, parseEntryDate } from '../src/ai/timeParser.js';

let passed = 0;
let failed = 0;

function assert(label, actual, check) {
  const ok = check(actual);
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     Got:`, JSON.stringify(actual, null, 2));
    failed++;
  }
}

function test(groupName, fn) {
  console.log(`\n📦 ${groupName}`);
  fn();
}

// ============================================================
// GROUP 1: parseWorkBlocks — basic time ranges
// ============================================================
test('Basic Time Ranges', () => {
  let r = parseWorkBlocks('9-11 api work').entries;
  assert('9-11 api work → 1 entry', r, e => e.length === 1);
  assert('start = 09:00', r[0], e => e.start_time === '09:00');
  assert('end = 11:00', r[0], e => e.end_time === '11:00');

  r = parseWorkBlocks('9am to 1pm UI design').entries;
  assert('9am to 1pm → start 09:00', r[0], e => e.start_time === '09:00');
  assert('9am to 1pm → end 13:00', r[0], e => e.end_time === '13:00');

  r = parseWorkBlocks('14:00 to 16:00 testing').entries;
  assert('24h format 14:00-16:00', r[0], e => e.start_time === '14:00' && e.end_time === '16:00');

  r = parseWorkBlocks('9 to 11 kaam kiya, 11 to 1 testing').entries;
  assert('two blocks: count = 2', r, e => e.length === 2);
  assert('second block start = 11:00', r[1], e => e.start_time === '11:00');
  assert('second block end = 13:00', r[1], e => e.end_time === '13:00');
});

// ============================================================
// GROUP 2: Lunch / Break handling
// ============================================================
test('Lunch & Break Subtraction', () => {
  let r = parseWorkBlocks('9-11 api, 11-1 lunch, 1-3 testing').entries;
  assert('lunch excluded → 2 work blocks', r, e => e.length === 2);
  assert('first block 09:00-11:00', r[0], e => e.start_time === '09:00' && e.end_time === '11:00');
  assert('second block 13:00-15:00', r[1], e => e.start_time === '13:00' && e.end_time === '15:00');

  r = parseWorkBlocks('9-5 kaam kiya, lunch 1-2 tha').entries;
  assert('lunch subtraction: 2 blocks', r, e => e.length === 2);
});

// ============================================================
// GROUP 3: Overnight shifts
// ============================================================
test('Overnight / Night Shifts', () => {
  let r = parseWorkBlocks('11pm to 2am night shift').entries;
  assert('overnight 23:00-02:00', r[0], e => e.start_time === '23:00' && e.end_time === '02:00');
});

// ============================================================
// GROUP 4: Hinglish / mixed language
// ============================================================
test('Hinglish Input', () => {
  let r = parseWorkBlocks('9 baje se 11 baje tak api kaam').entries;
  assert('hinglish 9 baje se 11 baje → 09:00-11:00', r[0], e => e.start_time === '09:00' && e.end_time === '11:00');

  r = parseWorkBlocks('aaj 10-12 standup call kiya').entries;
  assert('aaj 10-12 → 1 entry', r, e => e.length === 1);
});

// ============================================================
// GROUP 5: Edge cases — no time, overlap, single block
// ============================================================
test('Edge Cases', () => {
  let r = parseWorkBlocks('').entries;
  assert('empty message → 0 entries', r, e => e.length === 0);

  r = parseWorkBlocks('good morning').entries;
  assert('no time → 0 entries', r, e => e.length === 0);

  r = parseWorkBlocks('9-11 bug fix').entries;
  assert('single block', r, e => e.length === 1);
  assert('task_description not empty', r[0], e => e.task_description.length > 0);
});

// ============================================================
// GROUP 6: deriveModule
// ============================================================
test('Module Derivation', () => {
  assert('daily standup → STANDUP_MEETING', deriveModule('daily standup'), m => m === 'STANDUP_MEETING');
  assert('bug fix → BUG_FIXING', deriveModule('fixed login bug'), m => m === 'BUG_FIXING');
  assert('sprint planning → SPRINT_PLANNING', deriveModule('sprint planning session'), m => m === 'SPRINT_PLANNING');
  // "client demo" → CLIENT_MEETING is correct: client-specific meetings take priority over generic DEMO
  assert('client demo → CLIENT_MEETING (correct)', deriveModule('client demo presentation'), m => m === 'CLIENT_MEETING');
  assert('standalone demo → DEMO', deriveModule('product demo'), m => m === 'DEMO');
  assert('code review → CODE_REVIEW', deriveModule('reviewed PR #42'), m => m === 'CODE_REVIEW');
  assert('deployment → DEPLOYMENT', deriveModule('deployed to production'), m => m === 'DEPLOYMENT');
  assert('ui work → UI_DEVELOPMENT', deriveModule('worked on react component'), m => m === 'UI_DEVELOPMENT');
  assert('api work → API_DEVELOPMENT', deriveModule('built new API endpoint'), m => m === 'API_DEVELOPMENT');
  assert('unknown → GENERAL', deriveModule('random stuff'), m => m === 'GENERAL');
  assert('retrospective → RETROSPECTIVE', deriveModule('sprint retro'), m => m === 'RETROSPECTIVE');
  assert('onboarding → LEARNING', deriveModule('onboarding new joiner'), m => m === 'LEARNING');
  assert('docker → DEVOPS', deriveModule('set up docker container'), m => m === 'DEVOPS');
  assert('kubernetes → DEVOPS', deriveModule('kubernetes deployment'), m => m === 'DEVOPS');
});

// ============================================================
// GROUP 7: isBreakLabel
// ============================================================
test('Break Label Detection', () => {
  assert('"lunch" → break', isBreakLabel('lunch'), ok => ok === true);
  assert('"tea break" → break', isBreakLabel('tea break'), ok => ok === true);
  assert('"lunch break" → break', isBreakLabel('lunch break'), ok => ok === true);
  assert('"API work" → NOT break', isBreakLabel('API work'), ok => ok === false);
  assert('"break-fix" → NOT break (hyphenated)', isBreakLabel('break-fix'), ok => ok === false);
});

// ============================================================
// GROUP 8: parseEntryDate — IST aware
// ============================================================
test('Date Parsing (IST aware)', () => {
  // Simulate a time just after midnight IST (00:30 IST = 19:00 UTC previous day)
  // In this case, "aaj" should give IST-local date, not UTC date
  const midnightIST = new Date('2026-06-02T19:00:00Z'); // = 00:30 AM IST on June 3
  const d = parseEntryDate('aaj kaam kiya', midnightIST);
  assert('midnight IST → IST-local date (June 3, not June 2)', d, date => date === '2026-06-03');

  const d2 = parseEntryDate('kal kaam kiya', midnightIST);
  assert('kal at midnight IST → June 2', d2, date => date === '2026-06-02');

  const d3 = parseEntryDate('yesterday work done', new Date('2026-06-02T10:00:00Z'));
  assert('yesterday → day before today', d3, date => date === '2026-06-01');

  const d4 = parseEntryDate('15 may kaam kiya', new Date('2026-06-01T00:00:00Z'));
  assert('15 may → 2026-05-15', d4, date => date === '2026-05-15');

  const d5 = parseEntryDate('no date here just work', new Date());
  assert('no date → undefined', d5, d => d === undefined);
});

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  console.log(`\n⚠️  ${failed} test(s) FAILED — fix these before merging!`);
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed!`);
}
