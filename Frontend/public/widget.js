/**
 * KEYSS AI Widget — Embeddable Chat Assistant
 * =============================================
 * Drop into ANY website with ONE script tag:
 *
 *   <script
 *     src="https://your-worker.workers.dev/widget.js"
 *     data-api-key="keyss_live_YOUR_KEY_HERE"
 *     data-title="Work Tracker AI"
 *     data-theme="dark"
 *     data-position="bottom-right"
 *   ></script>
 *
 * Config attributes:
 *   data-api-key   (required) — Your API key from the KEYSS dashboard
 *   data-api-url   (optional) — Override API URL (default: auto-detected from script src)
 *   data-title     (optional) — Widget title text (default: "KEYSS AI")
 *   data-theme     (optional) — "dark" | "light" (default: "dark")
 *   data-position  (optional) — "bottom-right" | "bottom-left" (default: "bottom-right")
 *   data-accent    (optional) — Accent color hex (default: "#6366f1")
 *
 * Zero dependencies. Vanilla JS + CSS. Works in any framework or plain HTML.
 * Does NOT pollute global scope (everything is in an IIFE).
 */
(function () {
  'use strict';

  // ── Read config from the script tag ──────────────────────────────────────
  const scriptEl = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const cfg = {
    apiKey: scriptEl.getAttribute('data-api-key') || '',
    apiUrl: scriptEl.getAttribute('data-api-url') || (function () {
      // Auto-detect: same origin as the script src
      const src = scriptEl.src || '';
      const url = new URL(src, window.location.href);
      return url.origin;
    })(),
    title: scriptEl.getAttribute('data-title') || 'KEYSS AI',
    theme: scriptEl.getAttribute('data-theme') || 'dark',
    position: scriptEl.getAttribute('data-position') || 'bottom-right',
    accent: scriptEl.getAttribute('data-accent') || '#6366f1',
  };

  if (!cfg.apiKey) {
    console.warn('[KEYSS Widget] data-api-key is missing. Widget will not load.');
    return;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let messages = [];
  let pendingAction = null;
  const STORAGE_KEY = `keyss_widget_history_${cfg.apiKey.slice(-8)}`;

  // Restore chat history
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) messages = saved.slice(-30);
  } catch (_) {}

  // ── Styles ────────────────────────────────────────────────────────────────
  const isDark = cfg.theme === 'dark';
  const colors = isDark ? {
    bg: '#0f172a', bgPanel: '#1e293b', bgMsg: '#0b0f19',
    border: '#1e293b', text: '#cbd5e1', textMuted: '#64748b',
    userBubble: cfg.accent, userText: '#ffffff',
    botBubble: '#1e293b', botText: '#cbd5e1',
    input: '#0b0f19', inputBorder: '#334155',
  } : {
    bg: '#ffffff', bgPanel: '#f8fafc', bgMsg: '#f1f5f9',
    border: '#e2e8f0', text: '#1e293b', textMuted: '#94a3b8',
    userBubble: cfg.accent, userText: '#ffffff',
    botBubble: '#e2e8f0', botText: '#1e293b',
    input: '#ffffff', inputBorder: '#cbd5e1',
  };

  const css = `
    #keyss-widget-btn {
      position: fixed; ${cfg.position === 'bottom-left' ? 'left: 24px' : 'right: 24px'}; bottom: 24px;
      width: 56px; height: 56px; border-radius: 16px;
      background: ${cfg.accent}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px ${cfg.accent}55;
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 999999;
    }
    #keyss-widget-btn:hover { transform: scale(1.08); box-shadow: 0 12px 40px ${cfg.accent}77; }
    #keyss-widget-btn svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2; }

    #keyss-widget-pulse {
      position: absolute; top: -4px; right: -4px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #10b981;
    }
    #keyss-widget-pulse::before {
      content: ''; position: absolute; inset: 0; border-radius: 50%;
      background: #10b981; animation: keyss-ping 1.5s infinite;
    }
    @keyframes keyss-ping {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    #keyss-widget-panel {
      position: fixed; ${cfg.position === 'bottom-left' ? 'left: 24px' : 'right: 24px'}; bottom: 96px;
      width: min(420px, calc(100vw - 32px));
      height: min(600px, calc(100vh - 120px));
      background: ${colors.bg}; border: 1px solid ${colors.border};
      border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 999998; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;
      transform-origin: bottom right;
    }
    #keyss-widget-panel.keyss-hidden {
      transform: scale(0.85) translateY(16px); opacity: 0; pointer-events: none;
    }

    #keyss-widget-header {
      padding: 16px 20px; background: ${colors.bgPanel};
      border-bottom: 1px solid ${colors.border};
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .keyss-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: ${cfg.accent}22; display: flex; align-items: center; justify-content: center;
      border: 1px solid ${cfg.accent}44; position: relative;
    }
    .keyss-avatar svg { width: 18px; height: 18px; stroke: ${cfg.accent}; fill: none; stroke-width: 2; }
    .keyss-avatar-dot {
      position: absolute; bottom: -2px; right: -2px;
      width: 10px; height: 10px; border-radius: 50%;
      background: #10b981; border: 2px solid ${colors.bg};
    }
    .keyss-header-title { font-size: 14px; font-weight: 600; color: ${colors.text}; }
    .keyss-header-sub { font-size: 11px; color: ${colors.textMuted}; }
    .keyss-close-btn {
      background: none; border: none; cursor: pointer; padding: 6px;
      border-radius: 8px; color: ${colors.textMuted};
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .keyss-close-btn:hover { background: ${colors.border}; color: ${colors.text}; }
    .keyss-close-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; }

    #keyss-widget-messages {
      flex: 1; overflow-y: auto; padding: 20px 16px;
      background: ${colors.bgMsg}; display: flex; flex-direction: column; gap: 16px;
      scroll-behavior: smooth;
    }
    #keyss-widget-messages::-webkit-scrollbar { width: 4px; }
    #keyss-widget-messages::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 4px; }

    .keyss-empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; padding: 24px;
      color: ${colors.textMuted};
    }
    .keyss-empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: ${colors.bgPanel}; display: flex; align-items: center; justify-content: center;
      border: 1px solid ${colors.border}; margin-bottom: 16px;
    }
    .keyss-empty-icon svg { width: 28px; height: 28px; stroke: ${cfg.accent}; fill: none; stroke-width: 1.5; }
    .keyss-empty-title { font-size: 14px; font-weight: 600; color: ${colors.text}; margin-bottom: 8px; }
    .keyss-empty-sub { font-size: 12px; line-height: 1.6; }
    .keyss-hint { display: inline-block; background: ${cfg.accent}11; border: 1px solid ${cfg.accent}33;
      color: ${cfg.accent}; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-family: monospace; margin-top: 4px; }

    .keyss-msg { display: flex; flex-direction: column; }
    .keyss-msg.user { align-items: flex-end; }
    .keyss-msg.bot { align-items: flex-start; }
    .keyss-bubble {
      max-width: 82%; padding: 10px 14px; border-radius: 16px;
      font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    .keyss-msg.user .keyss-bubble {
      background: ${colors.userBubble}; color: ${colors.userText}; border-bottom-right-radius: 4px;
    }
    .keyss-msg.bot .keyss-bubble {
      background: ${colors.botBubble}; color: ${colors.botText}; border-bottom-left-radius: 4px;
      border: 1px solid ${colors.border};
    }
    .keyss-msg.bot.error .keyss-bubble {
      background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5;
    }
    .keyss-timestamp { font-size: 10px; color: ${colors.textMuted}; margin-top: 4px; padding: 0 4px; }

    .keyss-typing { display: flex; align-items: center; gap: 8px; }
    .keyss-typing-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: ${colors.bgPanel}; border: 1px solid ${colors.border};
      display: flex; align-items: center; justify-content: center;
    }
    .keyss-typing-icon svg { width: 14px; height: 14px; stroke: ${cfg.accent}; fill: none; stroke-width: 2; }
    .keyss-dots { display: flex; gap: 4px; }
    .keyss-dots span {
      width: 6px; height: 6px; border-radius: 50%; background: ${colors.textMuted};
      animation: keyss-bounce 1s infinite;
    }
    .keyss-dots span:nth-child(2) { animation-delay: 0.2s; }
    .keyss-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes keyss-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    #keyss-widget-footer {
      padding: 12px 16px; background: ${colors.bgPanel};
      border-top: 1px solid ${colors.border}; flex-shrink: 0;
    }
    .keyss-input-row {
      display: flex; align-items: flex-end; gap: 8px;
      background: ${colors.input}; border: 1px solid ${colors.inputBorder};
      border-radius: 12px; padding: 8px 8px 8px 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .keyss-input-row:focus-within {
      border-color: ${cfg.accent}88;
      box-shadow: 0 0 0 3px ${cfg.accent}22;
    }
    .keyss-input {
      flex: 1; background: none; border: none; outline: none; resize: none;
      font-family: inherit; font-size: 13px; color: ${colors.text};
      line-height: 1.5; max-height: 100px; overflow-y: auto;
    }
    .keyss-input::placeholder { color: ${colors.textMuted}; }
    .keyss-send-btn {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      background: ${cfg.accent}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, opacity 0.15s;
    }
    .keyss-send-btn:hover { background: ${cfg.accent}cc; }
    .keyss-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .keyss-send-btn svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2; }
    .keyss-footer-hint {
      font-size: 10px; color: ${colors.textMuted}; text-align: right;
      margin-top: 6px; padding: 0 2px;
    }
    .keyss-footer-hint kbd {
      border: 1px solid ${colors.border}; border-radius: 4px;
      padding: 1px 4px; font-family: inherit; font-size: 9px;
    }
  `;

  // ── Icons (inline SVG) ────────────────────────────────────────────────────
  const ICON_SPARKLES = `<svg viewBox="0 0 24 24"><path d="M9.937 15.5A2 2 0 008 17.5a2 2 0 01-1.937-1.5M9.937 8.5A2 2 0 018 6.5a2 2 0 01-1.937 2M14.5 20l1-3m-1 3-1-3m1 3v-3M20 9l-3 1m3-1-3-1m3 1h-3M4 15l3-1M4 15l3 1M4 15h3m7-8 1.5-1.5M14.5 7l1.5 1.5M14.5 7V4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_CPU      = `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`;
  const ICON_SEND     = `<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  const ICON_X        = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_LOADER   = `<svg viewBox="0 0 24 24" class="keyss-spin" style="animation:keyss-spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
  const ICON_SHIELD   = `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

  // Add @keyframes spin to css
  const fullCss = css + `@keyframes keyss-spin { to { transform: rotate(360deg); } }`;

  // ── DOM Helpers ───────────────────────────────────────────────────────────
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'html') node.innerHTML = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v);
    });
    children.forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Inject styles ─────────────────────────────────────────────────────────
  const styleTag = el('style', { html: fullCss });
  document.head.appendChild(styleTag);

  // ── Build UI ──────────────────────────────────────────────────────────────
  // Toggle button
  const btn = el('button', { id: 'keyss-widget-btn', title: 'Open AI Assistant', html: ICON_SPARKLES });
  const pulse = el('div', { id: 'keyss-widget-pulse' });
  btn.appendChild(pulse);

  // Panel
  const panel = el('div', { id: 'keyss-widget-panel', class: 'keyss-hidden' });

  // Header
  const avatar = el('div', { class: 'keyss-avatar', html: ICON_CPU });
  avatar.appendChild(el('div', { class: 'keyss-avatar-dot' }));
  const headerInfo = el('div', {});
  headerInfo.appendChild(el('div', { class: 'keyss-header-title' }, cfg.title));
  headerInfo.appendChild(el('div', { class: 'keyss-header-sub' }, 'AI Assistant • Online'));
  const headerLeft = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } });
  headerLeft.appendChild(avatar);
  headerLeft.appendChild(headerInfo);
  const closeBtn = el('button', { class: 'keyss-close-btn', title: 'Close', html: ICON_X });
  const header = el('div', { id: 'keyss-widget-header' });
  header.appendChild(headerLeft);
  header.appendChild(closeBtn);

  // Messages area
  const msgArea = el('div', { id: 'keyss-widget-messages' });

  // Footer / input
  const textarea = el('textarea', {
    class: 'keyss-input', rows: '1', placeholder: "Ask me anything or log your hours...",
  });
  const sendBtn = el('button', { class: 'keyss-send-btn', type: 'button', title: 'Send', html: ICON_SEND, disabled: 'true' });
  const inputRow = el('div', { class: 'keyss-input-row' });
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  const hint = el('div', { class: 'keyss-footer-hint' });
  hint.innerHTML = `Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line`;
  const footer = el('div', { id: 'keyss-widget-footer' });
  footer.appendChild(inputRow);
  footer.appendChild(hint);

  panel.appendChild(header);
  panel.appendChild(msgArea);
  panel.appendChild(footer);

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ── Render messages ───────────────────────────────────────────────────────
  function renderMessages() {
    msgArea.innerHTML = '';
    if (messages.length === 0) {
      const empty = el('div', { class: 'keyss-empty-state' });
      const icon = el('div', { class: 'keyss-empty-icon', html: ICON_SHIELD });
      const title = el('div', { class: 'keyss-empty-title' }, cfg.title);
      const sub = el('div', { class: 'keyss-empty-sub' });
      sub.innerHTML = 'Log your work hours naturally.<br>';
      const hint2 = el('span', { class: 'keyss-hint' }, '9-11 API work, 11-1 lunch, 1-3 testing');
      sub.appendChild(hint2);
      empty.appendChild(icon);
      empty.appendChild(title);
      empty.appendChild(sub);
      msgArea.appendChild(empty);
      return;
    }
    messages.forEach(m => {
      const wrap = el('div', { class: `keyss-msg ${m.role}${m.error ? ' error' : ''}` });
      const bubble = el('div', { class: 'keyss-bubble' }, m.content);
      const ts = el('div', { class: 'keyss-timestamp' }, m.time || '');
      wrap.appendChild(bubble);
      wrap.appendChild(ts);
      msgArea.appendChild(wrap);
    });
    if (isLoading) {
      const typing = el('div', { class: 'keyss-msg bot' });
      const row = el('div', { class: 'keyss-typing' });
      const icon = el('div', { class: 'keyss-typing-icon', html: ICON_LOADER });
      const dots = el('div', { class: 'keyss-dots' });
      [1, 2, 3].forEach(() => dots.appendChild(el('span')));
      row.appendChild(icon);
      row.appendChild(dots);
      typing.appendChild(row);
      msgArea.appendChild(typing);
    }
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  renderMessages();

  // ── API call ──────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    messages.push({ role: 'user', content: text, time: timestamp() });
    isLoading = true;
    renderMessages();
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    const history = messages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${cfg.apiUrl}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
        body: JSON.stringify({ message: text, history, pendingAction }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      pendingAction = data.pendingAction ?? null;
      const reply = data.reply || (data.success ? '✅ Logged successfully!' : 'Got it!');
      messages.push({ role: 'bot', content: reply, time: timestamp() });

    } catch (err) {
      const aborted = err?.name === 'AbortError';
      messages.push({
        role: 'bot', error: true, time: timestamp(),
        content: aborted ? 'Request timed out. Please try again.' : (err.message || 'Something went wrong.'),
      });
    } finally {
      clearTimeout(abortTimer);
      isLoading = false;
      sendBtn.disabled = false;
      renderMessages();
      // Persist history
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch (_) {}
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  btn.addEventListener('click', () => {
    isOpen = true;
    panel.classList.remove('keyss-hidden');
    textarea.focus();
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    panel.classList.add('keyss-hidden');
  });

  textarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    sendBtn.disabled = !this.value.trim();
  });

  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(this.value);
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(textarea.value));

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
      isOpen = false;
      panel.classList.add('keyss-hidden');
    }
  });

  console.log(`[KEYSS Widget] Loaded — API: ${cfg.apiUrl} | Theme: ${cfg.theme}`);
})();
