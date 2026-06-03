// FILE: backend/test/stress.mjs
// Live stress + accuracy harness for the AI timesheet endpoint.
//
//   node test/stress.mjs            # smoke (~60 cases)
//   node test/stress.mjs --full     # soak (1000+ cases)
//   CONCURRENCY=20 BASE_URL=http://localhost:8787 node test/stress.mjs --full
//
// Requires a running `wrangler dev` and ACCESS_TOKEN_SECRET (env or .dev.vars).
// Signs its own employee JWT (HS256) matching auth.middleware.js.

import { readFileSync } from "node:fs";
import { sign } from "hono/jwt";
import { buildCases } from "./cases.mjs";

const FULL = process.argv.includes("--full");
const BASE_URL = process.env.BASE_URL || "http://localhost:8787";
const ENDPOINT = `${BASE_URL}/api/timesheet/ai/chat`;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10", 10);
const ACCURACY_GATE = parseFloat(process.env.ACCURACY_GATE || "0.85"); // CI fail threshold
const TEST_USER_ID = parseInt(process.env.TEST_USER_ID || "1", 10);

// ── Resolve the JWT secret (env first, then Backend/.dev.vars) ───────────────
function resolveSecret() {
  if (process.env.ACCESS_TOKEN_SECRET) return process.env.ACCESS_TOKEN_SECRET;
  try {
    const raw = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.startsWith("ACCESS_TOKEN_SECRET"));
    if (line) return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  } catch { /* no .dev.vars */ }
  return null;
}

async function makeToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { id: TEST_USER_ID, name: "Stress Bot", email: "stress@test.dev", role: "employee", exp: now + 3600 },
    secret
  );
}

// ── One case = a sequence of turns sharing history + pendingAction ───────────
async function runCase(testCase, token) {
  const history = [];
  let pendingAction = null;
  let lastResp = null;
  const responses = [];
  const started = performance.now();

  for (const turn of testCase.turns) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: turn.message,
        history: history.slice(-10),
        pendingAction,
        selectedProject: turn.selectedProject ?? null,
        timezone: turn.timezone ?? null, // exercises the night-shift date fix
      }),
    });

    const data = await res.json().catch(() => ({ reply: "<non-json>" }));
    responses.push(data);
    lastResp = data;

    // advance conversation state exactly like the real frontend
    history.push({ role: "user", content: turn.message });
    history.push({ role: "assistant", content: data.reply || "" });
    pendingAction = data.pendingAction ?? null;
  }

  const latencyMs = performance.now() - started;
  let passed = false;
  let error = null;
  try {
    passed = !!testCase.expect(lastResp, responses);
  } catch (e) {
    error = e.message;
  }

  return { id: testCase.id, category: testCase.category, latencyMs, passed, error, lastReply: lastResp?.reply };
}

// ── Bounded-concurrency pool ─────────────────────────────────────────────────
async function runPool(cases, token, size) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < cases.length) {
      const c = cases[cursor++];
      results.push(await runCase(c, token));
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

// ── Stats ────────────────────────────────────────────────────────────────────
function pct(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

function report(results) {
  const byCat = {};
  for (const r of results) {
    (byCat[r.category] ??= { total: 0, pass: 0, lat: [] });
    byCat[r.category].total++;
    if (r.passed) byCat[r.category].pass++;
    byCat[r.category].lat.push(r.latencyMs);
  }

  console.log("\n══════════════ ACCURACY BY CATEGORY ══════════════");
  for (const [cat, s] of Object.entries(byCat).sort()) {
    const acc = ((s.pass / s.total) * 100).toFixed(1);
    const lat = s.lat.slice().sort((a, b) => a - b);
    console.log(
      `  ${cat.padEnd(22)} ${String(s.pass).padStart(4)}/${String(s.total).padEnd(4)}  ` +
      `acc ${acc.padStart(5)}%   p50 ${pct(lat, 50).toFixed(0)}ms  p95 ${pct(lat, 95).toFixed(0)}ms`
    );
  }

  const allLat = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pass = results.filter((r) => r.passed).length;
  const acc = pass / results.length;

  console.log("\n══════════════ LATENCY (all requests) ══════════════");
  console.log(`  count ${results.length}`);
  console.log(`  p50 ${pct(allLat, 50).toFixed(0)}ms   p95 ${pct(allLat, 95).toFixed(0)}ms   ` +
              `p99 ${pct(allLat, 99).toFixed(0)}ms   max ${allLat[allLat.length - 1].toFixed(0)}ms`);

  const fails = results.filter((r) => !r.passed);
  if (fails.length) {
    console.log(`\n══════════════ FAILURES (${fails.length}) ══════════════`);
    for (const f of fails.slice(0, 25)) {
      console.log(`  #${f.id} [${f.category}] ${f.error ? "ERR " + f.error : ""}`);
      console.log(`      reply: ${String(f.lastReply).slice(0, 120).replace(/\n/g, " ⏎ ")}`);
    }
    if (fails.length > 25) console.log(`  ...and ${fails.length - 25} more`);
  }

  console.log(`\n══════════════ OVERALL: ${(acc * 100).toFixed(1)}% accuracy ` +
              `(gate ${(ACCURACY_GATE * 100).toFixed(0)}%) ══════════════\n`);
  return acc;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const secret = resolveSecret();
  if (!secret) {
    console.error("✗ ACCESS_TOKEN_SECRET not found (set env var or Backend/.dev.vars). Aborting.");
    process.exit(2);
  }

  const token = await makeToken(secret);
  const cases = buildCases({ full: FULL });
  console.log(`▶ ${FULL ? "FULL SOAK" : "SMOKE"} run — ${cases.length} cases, ` +
              `concurrency ${CONCURRENCY}, target ${ENDPOINT}`);

  // Fail fast if the server isn't up.
  try {
    const ping = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: "ping" }),
    });
    if (ping.status === 401) {
      console.error("✗ 401 from server — ACCESS_TOKEN_SECRET mismatch with wrangler. Aborting.");
      process.exit(2);
    }
  } catch {
    console.error(`✗ Cannot reach ${ENDPOINT}. Is \`wrangler dev\` running? Aborting.`);
    process.exit(2);
  }

  const t0 = performance.now();
  const results = await runPool(cases, token, CONCURRENCY);
  const wallMs = performance.now() - t0;

  const acc = report(results);
  console.log(`⏱ wall time ${(wallMs / 1000).toFixed(1)}s`);
  process.exit(acc >= ACCURACY_GATE ? 0 : 1);
})();
