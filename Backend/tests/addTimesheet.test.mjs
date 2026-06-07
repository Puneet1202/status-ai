// Unit tests for the add_timesheet_entries handler (validation + persistence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkBlocks } from '../src/ai/timeParser.js';
import { matchProjectTask } from '../src/ai/tools/_helpers.js';
import addTool from '../src/ai/tools/addTimesheet.tool.js';

// Mock D1: records the bound values of every batched INSERT.
function mockDb(projectTasks = []) {
  const saved = [];
  return {
    saved,
    prepare(sql) {
      return {
        _sql: sql,
        _args: null,
        bind(...a) { this._args = a; return this; },
        async first() { return /SELECT id FROM projects/.test(this._sql) ? { id: 1 } : null; },
        async all() {
          // Prod schema: the handler resolves real tasks via `SELECT id, title FROM tasks`.
          // Give each task an id by index (State Bug Fixes=1, UI Layout Refactoring=2, …).
          return /FROM tasks/.test(this._sql)
            ? { results: projectTasks.map((t, i) => ({ id: i + 1, title: t })) }
            : { results: [] };
        },
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
// The prod handler keys writes on `employeeId` (= employee.id), not `user.id`.
const ctx = ({ projectTasks = [], ...over } = {}) => ({
  db: mockDb(projectTasks), employeeId: 1, user: { id: 1 }, selectedProject: 'AI Project', selectedTasks: [], today: '2026-06-01', ...over,
});

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

// Prod schema: a ticked UI task becomes the entry's module_name (the company app
// reads module_name in its reports); the task_id FK is left null in that case.
test('ticked UI task becomes module_name; task_id FK stays null', async () => {
  const c = ctx({ selectedTasks: ['Embedding Pipeline Setup'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-11 fixed login bug').entries });
  assert.equal(c.db.saved[0].module, 'Embedding Pipeline Setup'); // ticked task → module_name
  assert.equal(c.db.saved[0].task, null);                         // task_id FK unset
  assert.match(c.db.saved[0].desc, /login bug/i);
});

test('multiple ticked tasks joined into module_name; no tasks → auto module', async () => {
  let c = ctx({ selectedTasks: ['Prompt Tuning', 'Model Output Extraction'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-11 api work').entries });
  assert.equal(c.db.saved[0].module, 'Prompt Tuning | Model Output Extraction'); // joined → module_name
  assert.equal(c.db.saved[0].task, null);                                         // task_id FK unset

  c = ctx({ selectedTasks: [] });
  await addTool.handler(c, { entries: parseWorkBlocks('2-4 testing').entries });
  assert.equal(c.db.saved[0].task, null);
  assert.equal(c.db.saved[0].module, 'TESTING'); // no ticked tasks → auto-derived module
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

test('matchProjectTask: confident keyword match, else null', () => {
  const tasks = ['State Bug Fixes', 'UI Layout Refactoring', 'Prompt Tuning'];
  assert.equal(matchProjectTask('fixed the state bug', tasks), 'State Bug Fixes');
  assert.equal(matchProjectTask('refactored the ui layout', tasks), 'UI Layout Refactoring');
  assert.equal(matchProjectTask('random unrelated thing', tasks), null);
  assert.equal(matchProjectTask('9 to 11', []), null);
});

test('per-block task_id auto-assigned from project tasks (different task per slot)', async () => {
  // mockDb assigns task ids by index: State Bug Fixes=1, UI Layout Refactoring=2.
  const c = ctx({ projectTasks: ['State Bug Fixes', 'UI Layout Refactoring'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-10 fixed the state bug, 11-12 refactored the ui layout').entries });
  assert.equal(c.db.saved.length, 2);
  assert.equal(c.db.saved[0].task, 1); // matched "State Bug Fixes" → task_id 1
  assert.equal(c.db.saved[1].task, 2); // matched "UI Layout Refactoring" → task_id 2
});

test('UI-ticked tasks override per-block matching → module_name on all blocks', async () => {
  const c = ctx({ projectTasks: ['State Bug Fixes'], selectedTasks: ['Prompt Tuning'] });
  await addTool.handler(c, { entries: parseWorkBlocks('9-10 fixed the state bug, 11-12 misc work').entries });
  assert.equal(c.db.saved[0].module, 'Prompt Tuning'); // ticked task wins over auto-match
  assert.equal(c.db.saved[1].module, 'Prompt Tuning');
  assert.equal(c.db.saved[0].task, null);              // FK not set when UI tasks are ticked
  assert.equal(c.db.saved[1].task, null);
});
