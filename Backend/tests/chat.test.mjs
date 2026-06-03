// Unit tests for aiChat routing: small-talk gate, deterministic add, missing-time
// ask, multi-turn description carry, and the text-tool-call salvage.
// These paths don't need the live model (env without AI), except small-talk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiChat } from '../src/ai/chat.js';

const noAI = {};

test('deterministic add for a clean time-log', async () => {
  const r = await aiChat(noAI, 1, '9-11 fixed login bug, 2-4 testing', [], 'AI Project');
  assert.equal(r.action?.name, 'add_timesheet_entries');
  assert.equal(r.action.data.entries.length, 2);
});

test('missing-time + project selected → asks for time (no dead-end)', async () => {
  const r = await aiChat(noAI, 1, 'today i worked on the dashboard', [], 'AI Project');
  assert.match(r.reply, /what time/i);
  assert.match(r.reply, /AI Project/);
});

test('multi-task list without time → asks for a time per task (with example)', async () => {
  const r = await aiChat(noAI, 1, 'dataset cleanup, model training, lunch, chatbot work', [], 'AI Project');
  assert.match(r.reply, /time for each/i);
  assert.match(r.reply, /max 2 hours/i);
});

// BULLETPROOF: tasks with NO time must NEVER be saved — even if the model tries to
// HALLUCINATE times. The deterministic gate stops the model from being called.
test('tasks with no time → never invents/saves, asks for time (even if model would hallucinate)', async () => {
  const env = { AI: { run: async () => ({ response: '[{"start_time":"09:00","end_time":"11:00","task":"AI model training","is_lunch":false}]' }) } };
  const r = await aiChat(env, 1, 'AI model training, output review and fixes, lunch, chatbot development, testing and code review', [], 'AI Project');
  assert.equal(r.action, undefined);            // nothing saved
  assert.match(r.reply, /time for each task/i); // asks for the time instead
});

test('multi-turn: thin follow-up borrows description from previous message', async () => {
  const history = [{ role: 'user', content: 'today i worked on the dashboard' }];
  const r = await aiChat(noAI, 1, '9 to 11', history, 'AI Project');
  assert.match(r.action.data.entries[0].task_description, /dashboard/i);
});

test('multi-turn does NOT borrow from a greeting/question', async () => {
  let r = await aiChat(noAI, 1, '9 to 11', [{ role: 'user', content: 'hey' }], 'AI Project');
  assert.equal(r.action.data.entries[0].task_description, 'Work');
  r = await aiChat(noAI, 1, '9 to 11', [{ role: 'user', content: 'what should i log here?' }], 'AI Project');
  assert.equal(r.action.data.entries[0].task_description, 'Work');
});

test('own description is kept (not overwritten by enrichment)', async () => {
  const r = await aiChat(noAI, 1, '9-11 fixed the login bug', [{ role: 'user', content: 'unrelated older message text' }], 'AI Project');
  assert.match(r.action.data.entries[0].task_description, /login bug/i);
});

// REGRESSION: a work NOUN like "report"/"summary" must NOT hijack a time-log into
// the GET path. "9 se 11 report banayi" is an ADD, not a "show me a report" query.
test('time-log containing the word "report" still logs (not treated as a GET)', async () => {
  const r = await aiChat(noAI, 1, 'aaj maine 9 se 11 report banayi', [], 'AI Project');
  assert.equal(r.action?.name, 'add_timesheet_entries');
  assert.equal(r.action.data.entries.length, 1);
});

// The same word WITHOUT a time block stays a query (a read), never an add.
test('"report" with no time is NOT parsed as an add', async () => {
  const r = await aiChat(noAI, 1, 'show me my report', [], 'AI Project');
  assert.notEqual(r.action?.name, 'add_timesheet_entries');
});

// GET reliability: "show my last entries" is handled deterministically as a READ
// (was a generic "want me to log or show?" reply before).
test('"show me my last entry" → deterministic recent GET (no LLM)', async () => {
  const r = await aiChat(noAI, 1, 'show me my last entry', [], null);
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.recent, true);
});

test('"mera last log dikhao" (Hindi) → recent GET', async () => {
  const r = await aiChat(noAI, 1, 'mera last log dikhao', [], null);
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.recent, true);
});

// SAFETY: a real time-log that merely contains "last" must NOT be hijacked into a
// GET — the time block keeps it an ADD.
test('a time-log containing "last" still logs (ADD not broken)', async () => {
  const r = await aiChat(noAI, 1, '9 to 11 last minute bug fixes', [], 'AI Project');
  assert.equal(r.action?.name, 'add_timesheet_entries');
});

// Deterministic date-range reads (bulletproof — no LLM on the hot path).
test('"how many hours today" → deterministic GET for a single day', async () => {
  const r = await aiChat(noAI, 1, 'how many hours today', [], null);
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, r.action.data.to_date); // exactly one day
});

test('"show this week" → deterministic GET range ending today', async () => {
  const r = await aiChat(noAI, 1, 'show this week', [], null);
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.ok(!r.action.data.recent);
  assert.ok(r.action.data.from_date <= r.action.data.to_date);
});

test('"kitne ghante kaam kiya aaj" (Hindi today) → deterministic GET', async () => {
  const r = await aiChat(noAI, 1, 'kitne ghante kaam kiya aaj', [], null);
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, r.action.data.to_date);
});

test('garbled time → clear hint (not the time-ask)', async () => {
  const r = await aiChat(noAI, 1, 'worked 25ish oclock blah', [], 'AI Project');
  assert.match(r.reply, /couldn.t read the time blocks/i);
});

// REGRESSION: a digit GLUED to letters (a project name like "Core Infra V2") is
// NOT a failed time-log. Selecting such a project must ask for the time, never
// the bogus "couldn't read the time blocks" reply that made selection feel broken.
test('project name with a digit ("Core Infra V2") → asks for time, not "couldn\'t read"', async () => {
  const r = await aiChat(noAI, 1, 'Core Infra V2', [], 'Core Infra V2');
  assert.doesNotMatch(r.reply, /couldn.t read the time blocks/i);
  assert.match(r.reply, /what time/i);
});

// salvage: a model that DESCRIBES the tool call in text must be recovered, never
// shown raw. We simulate that by making the (general-path) model return the dump.
test('text tool-call dump is salvaged into an add action', async () => {
  const dump = '{"type":"function","name":"add_timesheet_entries","parameters":{"project_name":"AI Project","entry_date":"today","entries":[{"module_name":"PROJECT_WORK","task_description":"Updated the attendance sheet","start_time":"09:00","end_time":"11:00","is_lunch":false}]}}';
  // A no-time, no-project message routes to the general LLM path; the mock returns the dump.
  const env = { AI: { run: async () => ({ response: dump }) } };
  const r = await aiChat(env, 1, 'please add my work for the morning session somehow', [], null);
  assert.equal(r.action?.name, 'add_timesheet_entries');
  assert.equal(r.action.data.entries[0].start_time, '09:00');
});
