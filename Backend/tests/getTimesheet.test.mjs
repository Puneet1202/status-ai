// Unit tests for the get_timesheet_logs handler — proves it now LISTS the actual
// entries (content + project), supports "recent/last" mode, and the date-range
// path still works. Uses a minimal D1 mock (offline, deterministic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import getTool from '../src/ai/tools/getTimesheet.tool.js';

function mockDb(rows) {
  return { prepare() { return { bind() { return this; }, async all() { return { results: rows }; } }; } };
}
const ctx = (rows) => ({ db: mockDb(rows), user: { id: 1 }, today: '2026-06-03' });

const ROWS = [
  { id: 2, entry_date: '2026-06-03', start_time: '11:00', end_time: '12:00', duration_minutes: 60, module_name: 'X', task_description: 'Reviewed the PR', project_name: 'AI Project' },
  { id: 1, entry_date: '2026-06-03', start_time: '09:00', end_time: '11:00', duration_minutes: 120, module_name: 'Y', task_description: 'Fixed login bug', project_name: 'AI Project' },
];

test('recent mode LISTS the entries (content + project), not just a total', async () => {
  const out = await getTool.handler(ctx(ROWS), { recent: true });
  assert.match(out.reply, /Reviewed the PR/);
  assert.match(out.reply, /Fixed login bug/);
  assert.match(out.reply, /AI Project/);
  assert.match(out.reply, /Total:/);
  assert.equal(out.action, 'GET_TIMESHEET');
});

test('recent mode with no entries → friendly empty message', async () => {
  const out = await getTool.handler(ctx([]), { recent: true });
  // recent-mode ka empty message "No entries logged yet." hai (date-range mode
  // me hi "No records found for <range>" aata hai) — test ab usi se match karta hai.
  assert.match(out.reply, /No entries logged yet/i);
});

test('date-range mode still works and lists entries', async () => {
  const out = await getTool.handler(ctx(ROWS), { from_date: '2026-06-03', to_date: '2026-06-03' });
  assert.match(out.reply, /2026-06-03/);
  assert.match(out.reply, /Fixed login bug/);
  assert.match(out.reply, /Total:/);
});
