// Unit tests for the add_timesheet_entries handler (validation + persistence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkBlocks } from '../src/ai/timeParser.js';
import addTool from '../src/ai/tools/addTimesheet.tool.js';

// Mock D1: records the bound values of every batched INSERT.
function mockDb() {
  const saved = [];
  return {
    saved,
    prepare(sql) {
      return {
        _sql: sql,
        _args: null,
        bind(...a) { this._args = a; return this; },
        async first() { return /SELECT id FROM projects/.test(this._sql) ? { id: 1 } : null; },
        async run() { return { meta: { changes: 1, last_row_id: 1 } }; },
      };
    },
    async batch(stmts) {
      for (const s of stmts) {
        saved.push({ start: s._args[3], end: s._args[4], mins: s._args[5], module: s._args[6], desc: s._args[7], task: s._args[8] });
      }
      return stmts.map(() => ({ meta: { changes: 1 } }));
    },
  };
}
const ctx = (over = {}) => ({ db: mockDb(), user: { id: 1 }, selectedProject: 'AI Project', selectedTasks: [], today: '2026-06-01', ...over });

test('partial save: valid blocks saved, >2h block flagged', async () => {
  const c = ctx();
  const out = await addTool.handler(c, { entries: parseWorkBlocks('9-11 API, 11-1 UI, 2-5 testing').entries });
  assert.equal(c.db.saved.length, 2); // 9-11, 11-1 saved; 2-5 (3h) flagged
  assert.match(out.reply, /Not saved/);
});

test('all blocks within 2h are saved', async () => {
  const c = ctx();
  await addTool.handler(c, { entries: parseWorkBlocks('09:00 to 11:00, 11:00 to 13:00, 14:00 to 16:00').entries });
  assert.equal(c.db.saved.length, 3);
});

test('module_name = AI auto-derived; ticked tasks go to task_name column', async () => {
  const c = ctx({ selectedTasks: ['Embedding Pipeline Setup'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-11 fixed login bug').entries });
  assert.equal(c.db.saved[0].module, 'BUG_FIXING');           // auto
  assert.equal(c.db.saved[0].task, 'Embedding Pipeline Setup'); // separate column
  assert.match(c.db.saved[0].desc, /login bug/i);
});

test('multiple ticked tasks joined; no tasks → task_name null', async () => {
  let c = ctx({ selectedTasks: ['Prompt Tuning', 'Model Output Extraction'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-11 api work').entries });
  assert.equal(c.db.saved[0].task, 'Prompt Tuning | Model Output Extraction');

  c = ctx({ selectedTasks: [] });
  await addTool.handler(c, { entries: parseWorkBlocks('2-4 testing').entries });
  assert.equal(c.db.saved[0].task, null);
  assert.equal(c.db.saved[0].module, 'TESTING');
});

test('no project selected → asks to pick one (nothing saved)', async () => {
  const c = ctx({ selectedProject: null });
  const out = await addTool.handler(c, { entries: parseWorkBlocks('9-11 work').entries, project_name: null });
  assert.equal(c.db.saved.length, 0);
  assert.match(out.reply, /select a project/i);
});

test('overlapping blocks are blocked (relational, nothing saved)', async () => {
  // Explicit overlap (e.g. from LLM extraction) — the parser's ascending
  // inference avoids overlaps on its own, so we test the handler guard directly.
  const c = ctx();
  const out = await addTool.handler(c, {
    entries: [
      { start_time: '09:00', end_time: '11:00', task_description: 'A', module_name: 'X', is_lunch: false },
      { start_time: '10:00', end_time: '12:00', task_description: 'B', module_name: 'Y', is_lunch: false },
    ],
  });
  assert.equal(c.db.saved.length, 0);
  assert.match(out.reply, /overlap/i);
});
