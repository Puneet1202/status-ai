// FILE: backend/src/services/reportNotifier.js
// Best-effort "a user reported a wrong AI reply" alert → Slack / Discord webhook.
//
// WHY: reports are saved to the ai_feedback table, but nobody watches a DB. This
// pings you the moment a report lands, with the readable transcript — so you SEE
// every mistake and can fix it. Plug-and-play: set REPORT_WEBHOOK_URL in .env.
//   • Slack:   create an "Incoming Webhook" → paste its URL.
//   • Discord: channel → Integrations → Webhooks → copy URL (append nothing).
// One payload works for BOTH (Slack reads `text`, Discord reads `content`).
//
// It NEVER throws: a webhook hiccup must not fail saving the report.

export async function sendReportNotification(env, { employeeName, employeeId, project, note, transcript }) {
  const url = env?.REPORT_WEBHOOK_URL;
  if (!url) return; // not configured → silently skip (report still saved to DB)

  const who = employeeName ? `${employeeName} (id ${employeeId})` : `employee ${employeeId}`;
  const lines = [
    `🚩 *New AI report* from ${who}` + (project ? `  ·  project: ${project}` : ''),
    note ? `📝 Note: ${note}` : null,
    '```',
    String(transcript || '(no transcript)').slice(0, 2500),
    '```',
  ].filter(Boolean);
  const text = lines.join('\n');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }), // text=Slack, content=Discord
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
  } catch (e) {
    console.warn('[report webhook failed → report still saved in DB]', e?.message || e);
  }
}
