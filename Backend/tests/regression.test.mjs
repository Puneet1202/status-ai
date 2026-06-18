// REGRESSION SUITE — locks in behaviours that have broken before when new
// features were added. Routing is deterministic (no AI key → brain off), so these
// assertions are exact and stable. Run `npm test` after ANY change: if a green
// feature here goes red, the change broke something already working — fix it
// before shipping. Add a new test here every time a bug is fixed (so it can't
// silently come back).
//
// aiChat(env, userId, message, history, selectedProject, timeZone, isOrgViewer, viewAs, selectedTasks)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiChat } from '../src/ai/chat.js';

const noAI = {};
const route = (msg, { org = false, viewAs = null, project = null, tasks = [] } = {}) =>
  aiChat(noAI, 1, msg, [], project, 'Asia/Kolkata', org, viewAs, tasks);

// ───────────────────────── DATE PARSING ─────────────────────────
// REGRESSION: the typo-corrector once mangled "last" → "list", so "last month"
// silently fell back to recent. These guard the period parsing.
test('"show last month entries" → date RANGE, never recent', async () => {
  const r = await route('show last month entries');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.ok(!r.action.data.recent, 'last month must resolve a real range, not recent');
  assert.ok(r.action.data.from_date && r.action.data.to_date);
});

test('"show last week entries" → date range, never recent', async () => {
  const r = await route('show last week entries');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.ok(!r.action.data.recent);
  assert.ok(r.action.data.from_date <= r.action.data.to_date);
});

test('"this month entries" → range from the 1st, not recent', async () => {
  const r = await route('show this month entries');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.match(r.action.data.from_date, /-01$/);
});

// REGRESSION: "from 4 june 2026" was read as the WHOLE month of June.
test('"from 4 june 2026" → open range from that day to today', async () => {
  const r = await route('show entries from 4 june 2026');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, '2026-06-04');
  assert.ok(r.action.data.to_date >= '2026-06-04');
});

test('"4 june to 10 june 2026" → exact named-date range', async () => {
  const r = await route('show entries from 4 june to 10 june 2026');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, '2026-06-04');
  assert.equal(r.action.data.to_date, '2026-06-10');
});

test('"on 4 june 2026" → single day', async () => {
  const r = await route('show entries on 4 june 2026');
  assert.equal(r.action.data.from_date, '2026-06-04');
  assert.equal(r.action.data.to_date, '2026-06-04');
});

// ───────────────────────── TYPO TOLERANCE ─────────────────────────
test('typos still corrected: "staatus" → today entries', async () => {
  const r = await route('staatus');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, r.action.data.to_date);
});

test('typos still corrected: "yeaterday entries" → yesterday', async () => {
  const r = await route('yeaterday entries');
  assert.equal(r.action?.name, 'get_timesheet_logs');
  assert.equal(r.action.data.from_date, r.action.data.to_date);
});

// ───────────────────────── NAME vs NOT-A-NAME ─────────────────────────
// Real names must still resolve to an employee lookup…
test('"connect with Puneet" → employee lookup', async () => {
  const r = await route('connect with Puneet', { org: true });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.match(r.action.data.employee_name, /puneet/i);
});

test('bare "Vijay Kumar" (org-viewer) → employee lookup', async () => {
  const r = await route('Vijay Kumar', { org: true });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.match(r.action.data.employee_name, /vijay/i);
});

// …but command/field phrases must NEVER be mistaken for an employee name.
// REGRESSION: "show hours by month", "show email", "any pending status" each
// became "no employee named X".
test('"show hours by month" → analytics, NOT a name lookup', async () => {
  const r = await route('show hours by month', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'analyze_timesheet');
  assert.equal(r.action.data.group_by, 'month');
});

test('"show email" → profile field, NOT a name lookup', async () => {
  const r = await route('show email', { org: true, viewAs: 'puneet@keyss.in' });
  assert.ok(['get_employee_info', 'get_my_profile'].includes(r.action?.name));
  assert.equal(r.action.data.field, 'email');
  assert.notEqual(r.action.data.employee_name, 'email');
});

test('"any pending status" → pending report, NOT a name lookup', async () => {
  const r = await route('any pending status', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_pending_status');
});

// ───────────────────────── PERSONAL-INFO FIELDS ─────────────────────────
test('"my mobile number" → own profile, mobile field', async () => {
  const r = await route('my mobile number', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_my_profile'); // "my" → self even while viewing
  assert.equal(r.action.data.field, 'mobile');
});

test('"meri full detail" → own profile, full', async () => {
  const r = await route('meri full detail', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_my_profile');
  assert.equal(r.action.data.field, 'full');
});

test('"show address" while viewing someone → that employee, address field', async () => {
  const r = await route('show address', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.equal(r.action.data.field, 'address');
});

// REGRESSION: typo "deatils" must still resolve to the FULL detail view.
test('"show full deatils" (typo) → full detail view', async () => {
  const r = await route('show full deatils', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.equal(r.action.data.field, 'full');
});

test('"meri full detail" stays SELF even while viewing someone', async () => {
  const r = await route('meri full detail', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_my_profile');
  assert.equal(r.action.data.field, 'full');
});

test('"who am i" → standard profile card (no field)', async () => {
  const r = await route('who am i');
  assert.equal(r.action?.name, 'get_my_profile');
  assert.ok(!r.action.data.field);
});

// REGRESSION: "email address" must mean EMAIL, not the physical address.
test('"show my email address" → email field (not address)', async () => {
  const r = await route('show my email address', { org: true, viewAs: 'puneet@keyss.in' });
  assert.equal(r.action?.name, 'get_my_profile');
  assert.equal(r.action.data.field, 'email');
});

// REGRESSION: "my employee id" must answer deterministically (was a brain refusal).
test('"show my employee id" → empid field (deterministic)', async () => {
  const r = await route('show my employee id');
  assert.equal(r.action?.name, 'get_my_profile');
  assert.equal(r.action.data.field, 'empid');
});

test('"show my emplooye id" (typo) → empid field', async () => {
  const r = await route('show my emplooye id');
  assert.equal(r.action.data.field, 'empid');
});

// A NAMED employee + a field → that employee's field (even with no sticky pill).
test('"show vijay mobile number" → that employee + mobile field', async () => {
  const r = await route('show vijay mobile number', { org: true });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.equal(r.action.data.field, 'mobile');
  assert.match(r.action.data.employee_name, /vijay/i);
});

test('"puneet ka email" → that employee + email field', async () => {
  const r = await route('puneet ka email', { org: true });
  assert.equal(r.action?.name, 'get_employee_info');
  assert.equal(r.action.data.field, 'email');
  assert.match(r.action.data.employee_name, /puneet/i);
});

// ───────────────────────── ANALYTICS / READS ─────────────────────────
test('"total hours all time" → analyze, group none', async () => {
  const r = await route('total hours all time');
  assert.equal(r.action?.name, 'analyze_timesheet');
  assert.equal(r.action.data.group_by, 'none');
});

test('"show hours per project" → analyze, group project', async () => {
  const r = await route('show hours per project');
  assert.equal(r.action?.name, 'analyze_timesheet');
  assert.equal(r.action.data.group_by, 'project');
});
