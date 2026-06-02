// Unit tests for the deterministic work-block parser.
// Run: npm test   (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkBlocks, parseEntryDate, deriveModule, isBreakLabel } from '../src/ai/timeParser.js';

const times = (msg) => parseWorkBlocks(msg).entries.map((e) => `${e.start_time}-${e.end_time}`).join(',');
const descs = (msg) => parseWorkBlocks(msg).entries.map((e) => e.task_description);

test('multiple bare ranges with ascending AM/PM inference', () => {
  assert.equal(times('9-11 API, 11-1 UI, 2-5 testing'), '09:00-11:00,11:00-13:00,14:00-17:00');
});

test('24-hour ranges', () => {
  assert.equal(times('09:00 to 11:00, 14:00 to 16:00'), '09:00-11:00,14:00-16:00');
});

test('explicit am/pm', () => {
  assert.equal(times('8 AM to 10AM'), '08:00-10:00');
  assert.equal(times('2pm to 5:30pm deployment'), '14:00-17:30');
});

test('arrow connectors normalize to a range', () => {
  assert.equal(times('11:00 → 11:30, 14:00 → 14:30, 16:00 → 18:00'), '11:00-11:30,14:00-14:30,16:00-18:00');
  assert.equal(times('9->11 API, 11->1 UI'), '09:00-11:00,11:00-13:00');
});

test('Hinglish "baje"', () => {
  assert.equal(times('9 baje se 12 baje tak meeting'), '09:00-12:00');
});

test('overnight / night shift', () => {
  assert.equal(times('11pm to 2am monitoring'), '23:00-02:00');
});

test('"12" means noon, not midnight', () => {
  assert.equal(times('12-1 lunch break 1-2 worked'), '13:00-14:00'); // 12-1 lunch dropped
  assert.equal(times('12 to 1 lunch, 1 to 3 coding'), '13:00-15:00');
});

test('break-splitting: prose with point + range breaks', () => {
  assert.equal(
    times('Worked from 8 AM to 7 PM. Took a 15 minute break at 10:30, lunch from 1 to 2, and a short break at 4:30 for 20 minutes'),
    '08:00-10:30,10:45-13:00,14:00-16:30,16:50-19:00'
  );
});

test('lunch is dropped — standalone, structured, and mid-list', () => {
  assert.equal(times('1 to 2 lunch'), '');
  assert.equal(times('12:00 PM - 12:45 PM: Lunch Break'), '');
  assert.equal(times('lunch from 1 to 2'), '');
  assert.equal(times('9 to 11 work, 1 to 2 lunch break, 2 to 4 testing'), '09:00-11:00,14:00-16:00');
});

test('"break-fix" is NOT treated as a break', () => {
  assert.equal(times('worked on break-fix from 9 to 11'), '09:00-11:00');
});

test('descriptions are kept in full (no truncation, commas preserved)', () => {
  const r = parseWorkBlocks(
    '9 to 11 check emails and update the attendance of the employees in excel sheet 11 to 13 Screening the resume of the candidate'
  ).entries;
  assert.equal(r.length, 2);
  assert.match(r[0].task_description, /excel sheet$/i);
  const c = parseWorkBlocks('9-11 fixed login bug, reviewed PRs, and deployed to prod').entries;
  assert.match(c[0].task_description, /reviewed PRs.*deployed/i);
});

test('greetings / non-work messages yield no blocks', () => {
  assert.equal(times('hello how are you'), '');
  assert.equal(times('show my hours this week'), '');
  assert.equal(times('thanks'), '');
});

test('module derivation', () => {
  assert.equal(deriveModule('fixed the login bug'), 'BUG_FIXING');
  assert.equal(deriveModule('client meeting sync'), 'MEETING');
  assert.equal(deriveModule('random stuff'), 'GENERAL');
});

test('isBreakLabel detects pure break phrases only', () => {
  assert.equal(isBreakLabel('lunch break'), true);
  assert.equal(isBreakLabel('tea break'), true);
  assert.equal(isBreakLabel('fixed the lunch-ordering feature'), false);
});

test('parseEntryDate relative + explicit', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  assert.equal(parseEntryDate('log yesterday 9-11', now), '2026-05-31');
  assert.equal(parseEntryDate('kal 9 to 11', now), '2026-05-31');
  assert.equal(parseEntryDate('today 2-4', now), '2026-06-01');
  assert.equal(parseEntryDate('parso 9-11', now), '2026-05-30');
  assert.equal(parseEntryDate('15 may 9-11', now), '2026-05-15');
  assert.equal(parseEntryDate('worked on 2026-04-20 from 9 to 11', now), '2026-04-20');
  assert.equal(parseEntryDate('9-11 API', now), undefined);
});
