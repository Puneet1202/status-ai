// REAL-WORLD SCENARIO TESTS
// =========================================================================
// Ye file un exact situations ko cover karti hai jinki tumhe chinta thi:
// night shift, US/India timezone, short message vs lambi message, Hinglish.
// Inko chalane ke liye:  npm test   (ya sirf:  node --test tests/scenarios.test.mjs)
//
// IMPORTANT: ye saare tests DETERMINISTIC hain — koi AI/network call nahi.
// Yahi tumhare app ki "AI accuracy" ki asli neev hai: common formats code se
// parse hote hain (instant, free, har baar same result). Naya format pakad mein
// aaye to bas yahan ek line add kar do — ye hai "treadmill" se bachne ka tareeka.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkBlocks, parseEntryDate } from '../src/ai/timeParser.js';
import { todayISO } from '../src/ai/tools/_helpers.js';

const times = (msg) => parseWorkBlocks(msg).entries.map((e) => `${e.start_time}-${e.end_time}`).join(',');

// ── A. SHORT vs LONG message (koi chhota likhta hai, koi bada) ──────────────
test('SHORT: bare ek block', () => {
  assert.equal(times('9-11 api work'), '09:00-11:00');
});

test('LONG: poora din, multiple blocks + lunch beech mein', () => {
  // 6 blocks, lunch 1-2 drop hona chahiye, har block apna alag
  assert.equal(
    times('9-10 standup, 10-12 api, 12-1 ui, 1-2 lunch, 2-4 testing, 4-6 code review'),
    '09:00-10:00,10:00-12:00,12:00-13:00,14:00-16:00,16:00-18:00'
  );
});

// ── B. NIGHT SHIFT (raat ki shift, midnight cross) ──────────────────────────
test('NIGHT SHIFT: 11pm se 2am (agle din tak roll)', () => {
  assert.equal(times('11pm to 2am server monitoring'), '23:00-02:00');
});

test('NIGHT SHIFT: split shift raat bhar', () => {
  assert.equal(times('10pm to 12am deploy, 12am to 2am monitoring'), '22:00-00:00,00:00-02:00');
});

// ── C. HINGLISH (Hindi + English mix) ───────────────────────────────────────
test('HINGLISH: "baje se ... tak"', () => {
  assert.equal(times('subah 9 baje se 11 baje tak meeting thi'), '09:00-11:00');
});

// ── D. TIMEZONE: yahi wo bug tha jo Gemini ne pakda ─────────────────────────
// Ek US user aur ek India user EXACT same instant pe "aaj" bolein to dono ko
// apni-apni local date milni chahiye — UTC nahi.
test('TIMEZONE: night-shift India user ko apni asli local date milti hai', () => {
  const instant = new Date('2026-06-03T20:30:00Z'); // = 2026-06-04 02:00 IST
  const indiaToday = todayISO('Asia/Kolkata', instant);
  assert.equal(indiaToday, '2026-06-04');

  // "kal" us India-today se ek din peeche hona chahiye (na ki UTC se)
  const istNoon = new Date(`${indiaToday}T12:00:00Z`);
  assert.equal(parseEntryDate('kal 9 to 11', istNoon), '2026-06-03');
});

test('TIMEZONE: US Pacific user usi instant pe ek din peeche hai', () => {
  const instant = new Date('2026-06-03T20:30:00Z'); // = 2026-06-03 13:30 PDT
  assert.equal(todayISO('America/Los_Angeles', instant), '2026-06-03');
});

// ── E. EDGE: overlap / galat input gracefully handle ho ─────────────────────
test('EDGE: arrow aur dash dono formats chalein', () => {
  assert.equal(times('9->11 api, 2 to 4 testing'), '09:00-11:00,14:00-16:00');
});

// ── F. MODULE: agile ceremonies ab MEETING banein (pehle GENERAL the) ───────
test('MODULE: standup/sprint/demo ko MEETING mein daale, GENERAL nahi', () => {
  const mod = (msg) => parseWorkBlocks(msg).entries[0].module_name;
  assert.equal(mod('9-10 daily standup'), 'MEETING');
  assert.equal(mod('2-3 sprint planning'), 'MEETING');
  assert.equal(mod('4-5 product demo'), 'MEETING');
});
