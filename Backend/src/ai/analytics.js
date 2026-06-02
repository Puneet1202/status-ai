// FILE: backend/src/ai/analytics.js
// =========================================================================
// AI INTERACTION ANALYTICS LOGGER
// =========================================================================
// 1000-2000 users ki company ke liye: har AI turn ka lightweight log save
// karo taaki admin dekh sake:
//   - Kaun kya style mein baat karta hai (hindi/english/hinglish)
//   - Kaunsa intent sabse common hai (add/get/update/delete/smalltalk)
//   - Kahan AI fail hoti hai (no_action / error)
//   - Kitne users ek din mein active hain
//
// DB Table (migration mein add karo):
//   CREATE TABLE IF NOT EXISTS ai_interaction_logs (
//     id          INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id     INTEGER NOT NULL,
//     intent      TEXT NOT NULL,       -- add|get|update|delete|smalltalk|unknown
//     tool_called TEXT,                -- add_timesheet_entries|get_timesheet_logs|...
//     success     INTEGER NOT NULL,    -- 1 = success, 0 = fail/no-action
//     msg_length  INTEGER,             -- message character count (no PII stored)
//     lang_hint   TEXT,               -- 'hi' | 'en' | 'mixed'
//     created_at  TEXT DEFAULT (datetime('now'))
//   );
//
// PRIVACY: Message text is NEVER stored. Only metadata (length, intent, lang hint).
// =========================================================================

// Detect language hint from message — rough heuristic, no heavy library needed.
function detectLang(message) {
  const m = String(message || '');
  const hindiChars = (m.match(/[\u0900-\u097F]/g) || []).length;
  if (hindiChars > 3) return 'hi';

  // Hinglish signals: common romanized Hindi words
  const hinglishWords = /\b(kaam|kiya|tha|thi|aaj|kal|baje|se|tak|mera|meri|aur|nahi|hai|hain|karo|karte|kuch|bahut|theek|sahi|galat|woh|yeh|kitna|kitne|dikhao|batao|hatao|mita|badlo)\b/i;
  if (hinglishWords.test(m)) return 'mixed';
  return 'en';
}

// Classify intent from the result object returned by aiChat().
function classifyIntent(result, cleanMessage) {
  if (!result) return 'unknown';

  if (result.action) {
    const name = result.action.name;
    if (name === 'add_timesheet_entries') return 'add';
    if (name === 'get_timesheet_logs') return 'get';
    if (name === 'update_timesheet') return 'update';
    if (name === 'delete_timesheet') return 'delete';
    return 'tool_other';
  }

  if (result.requiresConfirmation) return 'confirm_pending';

  // Small talk signals
  const social = /^(hi|hey|hello|thanks|thank|okay|ok|bye|good morning|good night|kaise ho|how are you)/i;
  if (social.test((cleanMessage || '').trim())) return 'smalltalk';

  if (result.reply) return 'conversational';
  return 'unknown';
}

// Log one AI turn. Fails silently — analytics must NEVER break the main flow.
export async function logInteraction(db, userId, message, result, toolCalled = null) {
  if (!db || !userId) return; // no-op in test/local env without DB

  try {
    const intent = classifyIntent(result, message);
    const success = (result?.success === true || !!result?.reply) ? 1 : 0;
    const msgLength = String(message || '').length;
    const langHint = detectLang(message);

    await db
      .prepare(`
        INSERT INTO ai_interaction_logs (user_id, intent, tool_called, success, msg_length, lang_hint)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, intent, toolCalled || null, success, msgLength, langHint)
      .run();
  } catch (err) {
    // Never throw — analytics is best-effort
    console.warn('[Analytics] Log failed (non-fatal):', err?.message || err);
  }
}

// =========================================================================
// ADMIN ANALYTICS QUERY HELPERS
// =========================================================================
// These are called from a new admin endpoint (add to timesheet.routes.js):
//   GET /api/timesheet/admin/analytics?days=7
// =========================================================================

// Returns intent distribution + daily active users for the last N days.
export async function getAnalyticsSummary(db, days = 7) {
  const results = {};

  try {
    // Intent breakdown
    const intentRows = await db
      .prepare(`
        SELECT intent, COUNT(*) as count
        FROM ai_interaction_logs
        WHERE created_at >= datetime('now', ?)
        GROUP BY intent
        ORDER BY count DESC
      `)
      .bind(`-${days} days`)
      .all();
    results.intentBreakdown = intentRows.results || [];

    // Daily active users (unique)
    const dauRows = await db
      .prepare(`
        SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
        FROM ai_interaction_logs
        WHERE created_at >= datetime('now', ?)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `)
      .bind(`-${days} days`)
      .all();
    results.dailyActiveUsers = dauRows.results || [];

    // Language distribution
    const langRows = await db
      .prepare(`
        SELECT lang_hint, COUNT(*) as count
        FROM ai_interaction_logs
        WHERE created_at >= datetime('now', ?)
        GROUP BY lang_hint
      `)
      .bind(`-${days} days`)
      .all();
    results.languageDistribution = langRows.results || [];

    // Failure rate
    const failRows = await db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures
        FROM ai_interaction_logs
        WHERE created_at >= datetime('now', ?)
      `)
      .bind(`-${days} days`)
      .first();
    results.failureRate = failRows || { total: 0, failures: 0 };

  } catch (err) {
    console.error('[Analytics] Summary query failed:', err?.message || err);
  }

  return results;
}
