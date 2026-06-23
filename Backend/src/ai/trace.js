// backend/src/ai/trace.js
// =========================================================================
// PER-MESSAGE TRACE (dev visibility)
// One chat message → which PATH did it take? This prints a single clean box
// per user message showing: the route (small-talk vs brain), how many BRAIN
// calls fired, how many TOOL calls ran (and which), and the total tokens.
//
// So you can see, for any message type, exactly which files handled it and how
// many model/tool calls it cost. Single-process dev tool — module-level state
// (the server handles one chat turn at a time locally).
// =========================================================================

let cur = null;
let last = null; // most recently COMPLETED trace (chat-logging isse route/tokens leta hai)

// Last fully-handled message ka trace snapshot (traceEnd ke baad bhi available).
// chat-logging (ai_chat_logs) route/tool/tokens yahan se padhta hai.
export function getLastTrace() { return last; }

// Called once at the start of a chat message (controller wraps aiChat).
export function traceBegin(message) {
  cur = {
    message: String(message || '').replace(/\s+/g, ' ').slice(0, 60),
    route: '(deterministic — no model)',
    brain: 0,
    tools: [],
    tokens: { input: 0, output: 0, total: 0 },
    t0: Date.now(),
  };
}

// Which branch handled it (set at the decision point in chat.js).
export function traceRoute(label) { if (cur) cur.route = label; }

// One BRAIN model call fired (brainRouter logs each call here).
export function traceBrain(usage) {
  if (!cur) return;
  cur.brain++;
  if (usage) {
    cur.tokens.input += usage.input || 0;
    cur.tokens.output += usage.output || 0;
    cur.tokens.total += usage.total || 0;
  }
}

// One TOOL call ran (tools/index.js dispatch).
export function traceTool(name) { if (cur && name) cur.tools.push(name); }

// Called once after the message is fully handled (controller, after aiChat).
export function traceEnd() {
  if (!cur) return;
  last = cur; // snapshot for chat-logging before we clear cur
  const ms = Date.now() - cur.t0;
  const tools = cur.tools.length ? `${cur.tools.length}  (${cur.tools.join(', ')})` : '0';
  console.log(
    `\n  ╭─ MESSAGE TRACE ───────────────────────────────────────\n` +
    `  │  msg:    "${cur.message}"\n` +
    `  │  route:  ${cur.route}\n` +
    `  │  brain:  ${cur.brain} call(s)        tools: ${tools}\n` +
    `  │  tokens: in ${cur.tokens.input} · out ${cur.tokens.output} · total ${cur.tokens.total}\n` +
    `  │  time:   ${(ms / 1000).toFixed(2)}s\n` +
    `  ╰────────────────────────────────────────────────────────`
  );
  cur = null;
}
