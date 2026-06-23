// FILE: backend/mcp/server.mjs
// ─────────────────────────────────────────────────────────────────────────────
// status-ai  ·  MCP server (stdio)  ·  LOCAL TEST BUILD
//
// KYA HAI: Tumhare EXISTING AI tools (addTimesheet, queryTimesheet, analyze, ...)
// ko Model-Context-Protocol par "expose" karta hai — taaki Claude Desktop (ya koi
// bhi MCP client) seedha "log 9-11 api work" / "show my hours" bol sake. App
// dubara nahi banaya — sirf `dispatchTool` + REGISTRY reuse kiya. Existing backend
// (chat.js, controller, brain) ko CHHUA NAHI — ye alag entrypoint hai.
//
// AUTH: user apna JWT `MCP_AUTH_TOKEN` me deta hai (wahi company/JWT token jo
// website use karti hai). Yahi se employeeId + permissions DB se resolve hote hai
// → har call usi bande ke data par scope. Koi nayi auth nahi.
//
// CHALANE KE LIYE:
//   MCP_AUTH_TOKEN=<jwt> node mcp/server.mjs
//   (ya .env me MCP_AUTH_TOKEN set karke `node mcp/server.mjs`)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { verify } from 'hono/jwt';

import { makeSqliteD1 } from '../src/db/sqliteAdapter.js';
import { REGISTRY, dispatchTool } from '../src/ai/tools/index.js';
import { todayISO, DEFAULT_TZ } from '../src/ai/tools/_helpers.js';

// ── chhota .env loader (server.node.js jaisा hi — koi extra package nahi) ──────
function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    const quoted = /^(['"])([\s\S]*)\1\s*(?:#.*)?$/.exec(val);
    val = quoted ? quoted[2] : val.replace(/\s+#.*$/, '').trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
// backend/.env load karo (cwd se nahi — Claude Desktop/Codex kahin se bhi spawn
// kare, token .env se mile aur config me dobara na daalna pade).
const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(join(BACKEND_DIR, '.env'));

const DB_FILE = process.env.DB_FILE || 'keyss-status.prod.db';
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev_access_secret_change_me';
const MCP_TZ = process.env.MCP_TZ || DEFAULT_TZ;
const db = makeSqliteD1(DB_FILE);

// env-stub: tools jab `ctx.env` maangte hai (sirf AI/provider fields). MCP path me
// koi LLM call nahi hoti (host LLM hi reasoning karta hai) → minimal env kaafi hai.
const env = { DB: db, ACCESS_TOKEN_SECRET };

// ── identity resolve — middleware wali EXACT chain, ek hi jagah ───────────────
// token → userId → DB se user (role/employee_id) → role_permissions se perms.
async function resolveCtx() {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    throw new Error('MCP_AUTH_TOKEN missing. Apna JWT token set karo (website se copy).');
  }
  let payload;
  try {
    payload = await verify(token, ACCESS_TOKEN_SECRET, 'HS256');
  } catch {
    throw new Error('Invalid/expired MCP_AUTH_TOKEN. Naya token le ke dobara try karo.');
  }
  const userId = Number(payload.id ?? payload.sub ?? payload.userId);
  if (!userId || Number.isNaN(userId)) throw new Error('Token me valid user id nahi mila.');

  const user = await db.prepare(
    `SELECT u.id, u.email, u.employee_id, u.client_id, u.is_active,
            r.name AS role, COALESCE(e.name, '') AS name
       FROM users u
       JOIN roles r         ON r.id = u.role_id
       LEFT JOIN employee e ON e.id = u.employee_id
      WHERE u.id = ?`
  ).bind(userId).first();
  if (!user) throw new Error('User DB me nahi mila.');
  if (user.is_active === 0) throw new Error('Account inactive hai.');

  const permRows = await db.prepare(
    `SELECT p.name FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p       ON p.id = rp.permission_id
      WHERE u.id = ?`
  ).bind(userId).all();
  const perms = new Set((permRows.results || []).map((r) => r.name));
  const isOrgViewer = perms.has('all_employee_attendance');

  return {
    db, user, env,
    employeeId: user.employee_id,
    isOrgViewer, perms,
    selectedProject: null, selectedTasks: [],
    today: todayISO(MCP_TZ),
  };
}

// ── tool reply ko MCP text content me badlo ───────────────────────────────────
function toText(out) {
  if (out == null) return 'OK';
  if (typeof out === 'string') return out;
  if (typeof out.reply === 'string') {
    // chips (options) ko bhi text me jod do taaki host LLM ko context mile.
    const opts = Array.isArray(out.options) && out.options.length
      ? '\n\nOptions: ' + out.options.map((o) => o.label || o.value).join(' | ')
      : '';
    return out.reply + opts;
  }
  return JSON.stringify(out);
}

// ── MCP server ────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'status-ai', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// Ek chhota CONNECTION-CONFIRM tool (sirf MCP me, shared REGISTRY me nahi). User
// "ping status-ai" bole to saaf pata chale ki wo APNE tool/identity se juda hai.
const PING_TOOL = {
  name: 'status_ai_ping',
  description:
    "Confirm you are connected to the status-ai timesheet tools. Returns the logged-in user's name, employee id, role and tool count. Use when the user asks 'are you connected to my tool', 'ping status-ai', 'who am I on status-ai'.",
  inputSchema: { type: 'object', properties: {} },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    PING_TOOL,
    ...Object.values(REGISTRY).map((m) => ({
      name: m.name,
      description: m.schema.description,
      inputSchema: m.schema.parameters || { type: 'object', properties: {} },
    })),
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const ctx = await resolveCtx();              // har call pe fresh perms (live)
    if (name === 'status_ai_ping') {
      const txt = `✅ Connected to status-ai\n• User: ${ctx.user.name || ctx.user.email} (${ctx.user.email})\n• Employee ID: ${ctx.employeeId ?? 'N/A'}\n• Role: ${ctx.user.role}${ctx.isOrgViewer ? ' (HR/Admin — can view others)' : ''}\n• Tools available: ${Object.keys(REGISTRY).length}`;
      return { content: [{ type: 'text', text: txt }] };
    }
    const out = await dispatchTool(name, args || {}, ctx);
    return { content: [{ type: 'text', text: toText(out) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[status-ai MCP] stdio server ready · tools:', Object.keys(REGISTRY).length);
