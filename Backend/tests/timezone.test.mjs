// Regression guard for the night-shift timezone bug.
// Before the fix, "today" was computed in UTC, so a user logging at 01:00 IST
// (= 19:30 the PREVIOUS day in UTC) had their work filed under yesterday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayISO } from '../src/ai/tools/_helpers.js';

// 2026-06-03 20:30 UTC === 2026-06-04 02:00 IST (a night-shift user past midnight).
const nightShiftInstant = new Date('2026-06-03T20:30:00Z');

test('IST date rolls to the next day for a post-midnight night-shift instant', () => {
  assert.equal(todayISO('Asia/Kolkata', nightShiftInstant), '2026-06-04'); // user's REAL day
  assert.equal(todayISO('UTC', nightShiftInstant), '2026-06-03');          // old buggy value
});

test('US Pacific is still on the previous day at that same instant', () => {
  // 20:30 UTC === 13:30 PDT same day → 2026-06-03 for a US user.
  assert.equal(todayISO('America/Los_Angeles', nightShiftInstant), '2026-06-03');
});

test('an invalid/empty zone falls back without throwing', () => {
  assert.equal(todayISO('Not/AZone', nightShiftInstant), '2026-06-03'); // invalid → safe UTC fallback
  assert.equal(todayISO(null, nightShiftInstant), '2026-06-04');        // null → DEFAULT_TZ (IST)
});
