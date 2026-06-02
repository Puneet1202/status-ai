// FILE: backend/src/routers/public.routes.js
// =========================================================================
// PUBLIC API — authenticated via X-API-Key (for external companies)
// =========================================================================
// Any company's website / app connects with just ONE header:
//   X-API-Key: keyss_live_abc123
//
// Endpoints:
//   POST /v1/chat          → AI chat (same as internal /api/timesheet/ai/chat)
//   POST /v1/log           → Direct log entry (no AI, just save)
//   GET  /v1/status        → Key info + rate limit status
//   GET  /v1/logs          → Get company's logs (date range)
//
// Admin endpoints (JWT auth, not API key):
//   POST /v1/admin/keys/create   → Create new API key for a company
//   GET  /v1/admin/keys          → List all keys
//   POST /v1/admin/keys/revoke   → Revoke a key
// =========================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiKeyMiddleware } from '../middlewares/apikey.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { aiChat } from '../ai/chat.js';
import { dispatchTool } from '../ai/tools/index.js';
import { logInteraction } from '../ai/analytics.js';
import { todayISO } from '../ai/tools/_helpers.js';

const publicRouter = new Hono();

// ── Allow CORS from any origin (companies embed on their sites) ───────────
publicRouter.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (API Key auth)
// ═══════════════════════════════════════════════════════════════════════════

// GET /v1/status — Key health check + rate limit info
publicRouter.get('/status', apiKeyMiddleware, (c) => {
  return c.json({
    ok: true,
    company: c.get('company_name'),
    plan: c.get('api_plan'),
    rate_remaining: c.get('rate_remaining'),
    message: 'API key is valid and active.',
  });
});

// POST /v1/chat — AI-powered chat (same engine as internal)
publicRouter.post('/chat', apiKeyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const companyId = c.get('company_id');
    const { message, history = [], pendingAction = null, selectedProject = null, selectedTasks = [] } = await c.req.json();

    if (!message?.trim()) {
      return c.json({ error: 'Bad Request', message: 'message field is required.' }, 400);
    }

    // Minimal user context for the AI pipeline
    const user = { id: `company_${companyId}`, role: 'api', company_id: companyId };
    const ctx = { db, user, env: c.env, selectedProject, selectedTasks: Array.isArray(selectedTasks) ? selectedTasks : [], today: todayISO() };

    // Confirm-intercept for pending delete/update actions
    const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());
    if (isConfirming && pendingAction?.action) {
      if (pendingAction.action === 'DELETE_TIMESHEET') {
        const { executeDelete } = await import('../ai/tools/deleteTimesheet.tool.js');
        const out = await executeDelete(ctx, pendingAction);
        return c.json(out, 200);
      }
      if (pendingAction.action === 'UPDATE_TIMESHEET') {
        const { executeUpdate } = await import('../ai/tools/updateTimesheet.tool.js');
        const out = await executeUpdate(ctx, pendingAction);
        return c.json(out, 200);
      }
    }

    const result = await aiChat(c.env, user.id, message, history, selectedProject);

    if (result.action) {
      const out = await dispatchTool(result.action.name, result.action.data, ctx);
      logInteraction(db, user.id, message, out, result.action.name);
      return c.json(out, 200);
    }

    logInteraction(db, user.id, message, result, null);
    return c.json(result, 200);

  } catch (err) {
    console.error('[Public /v1/chat error]:', err);
    return c.json({ error: 'Internal Server Error', message: 'Please try again.' }, 500);
  }
});

// GET /v1/logs — Company's timesheet logs (date range)
publicRouter.get('/logs', apiKeyMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const companyId = c.get('company_id');
    const from = c.req.query('from') || todayISO();
    const to = c.req.query('to') || todayISO();
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

    const rows = await db
      .prepare(`
        SELECT d.id, d.entry_date, d.start_time, d.end_time, d.duration_minutes,
               d.module_name, d.task_description, d.created_at,
               p.name AS project_name,
               u.name AS employee_name
        FROM daily_status_entries d
        JOIN projects p ON p.id = d.project_id
        JOIN users u ON u.id = d.employee_id
        WHERE d.entry_date BETWEEN ? AND ?
        ORDER BY d.entry_date DESC, d.start_time ASC
        LIMIT ?
      `)
      .bind(from, to, limit)
      .all();

    return c.json({ success: true, from, to, count: (rows.results || []).length, logs: rows.results || [] });
  } catch (err) {
    console.error('[Public /v1/logs error]:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (JWT auth — only your internal admins)
// ═══════════════════════════════════════════════════════════════════════════

// POST /v1/admin/keys/create — Create a new API key for a company
publicRouter.post('/admin/keys/create', authMiddleware, async (c) => {
  try {
    const caller = c.get('user');
    if (caller.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin only.' }, 403);
    }

    const db = c.env.DB;
    const { company_name, contact_email, plan = 'free', key_name = 'Default Key' } = await c.req.json();
    if (!company_name) return c.json({ error: 'company_name is required.' }, 400);

    // Generate a random API key: keyss_live_ + 32 random hex chars
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const rawKey = `keyss_live_${randomHex}`;
    const keyPrefix = rawKey.slice(0, 16) + '...'; // show first 16 chars in UI

    // SHA-256 hash — only this goes in DB
    const keyHash = await sha256hex(rawKey, c.env);

    // Upsert company
    let companyId;
    const existing = await db.prepare(`SELECT id FROM companies WHERE name = ?`).bind(company_name).first();
    if (existing) {
      companyId = existing.id;
    } else {
      const ins = await db
        .prepare(`INSERT INTO companies (name, plan, contact_email) VALUES (?, ?, ?)`)
        .bind(company_name, plan, contact_email || null)
        .run();
      companyId = ins.meta.last_row_id;
    }

    await db
      .prepare(`INSERT INTO api_keys (company_id, key_hash, key_prefix, name, plan) VALUES (?, ?, ?, ?, ?)`)
      .bind(companyId, keyHash, keyPrefix, key_name, plan)
      .run();

    return c.json({
      success: true,
      message: 'API key created. Store this key safely — it will NOT be shown again.',
      api_key: rawKey,       // shown ONCE to the admin, never stored
      key_prefix: keyPrefix, // safe to show in dashboards
      company: company_name,
      plan,
    }, 201);

  } catch (err) {
    console.error('[Admin key create error]:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// GET /v1/admin/keys — List all keys (prefix only, not hashes)
publicRouter.get('/admin/keys', authMiddleware, async (c) => {
  try {
    const caller = c.get('user');
    if (caller.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const db = c.env.DB;
    const rows = await db
      .prepare(`
        SELECT k.id, k.key_prefix, k.name, k.plan, k.is_active,
               k.requests_today, k.last_used_at, k.created_at,
               c.name AS company_name
        FROM api_keys k JOIN companies c ON c.id = k.company_id
        ORDER BY k.created_at DESC
      `)
      .all();

    return c.json({ success: true, keys: rows.results || [] });
  } catch (err) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// POST /v1/admin/keys/revoke — Disable a key
publicRouter.post('/admin/keys/revoke', authMiddleware, async (c) => {
  try {
    const caller = c.get('user');
    if (caller.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const db = c.env.DB;
    const { key_id } = await c.req.json();
    if (!key_id) return c.json({ error: 'key_id required' }, 400);

    await db.prepare(`UPDATE api_keys SET is_active = 0 WHERE id = ?`).bind(key_id).run();
    return c.json({ success: true, message: `Key ${key_id} revoked.` });
  } catch (err) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// ── Helper: sha256 (needs env for Web Crypto) ─────────────────────────────
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default publicRouter;
