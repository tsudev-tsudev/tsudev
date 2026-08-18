'use strict';
// Realtime alerting for tsudev (TSD §4.2). Routes error/incident alerts to
// Telegram and email. Safe no-op when credentials are absent (local dev):
// it logs what *would* be sent so the wiring is verifiable without secrets.
//
// Activate in production by setting:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   (Telegram routing → @nguyentrangtinhsu)
//   ALERT_EMAIL_WEBHOOK                     (POST endpoint that emails the payload)
//                                           or ALERT_EMAIL_TO with an SMTP relay.

const LEVELS = { info: 'ℹ️', warning: '⚠️', error: '🚨', critical: '🔥' };

// Basic per-process rate limit so a crash loop doesn't flood channels.
const _recent = new Map();
function _throttled(key, windowMs = 60000) {
  const now = Date.now();
  const last = _recent.get(key) || 0;
  if (now - last < windowMs) return true;
  _recent.set(key, now);
  return false;
}

function _format({ service, level, message, error, context }) {
  const emoji = LEVELS[level] || 'ℹ️';
  const lines = [
    `${emoji} *tsudev alert* - \`${service || 'unknown'}\``,
    `*level:* ${level || 'info'}`,
    `*message:* ${message || '(no message)'}`,
  ];
  if (context)
    lines.push(`*context:* ${typeof context === 'string' ? context : JSON.stringify(context)}`);
  if (error) {
    const stack = (error.stack || String(error)).split('\n').slice(0, 6).join('\n');
    lines.push('```\n' + stack + '\n```');
  }
  lines.push(`*time:* ${new Date().toISOString()}`);
  return lines.join('\n');
}

async function _sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[alert] TELEGRAM not configured - would send:\n' + text);
    return { skipped: 'telegram' };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  return { telegram: res.status };
}

async function _sendEmail(payload) {
  const hook = process.env.ALERT_EMAIL_WEBHOOK;
  const to = process.env.ALERT_EMAIL_TO || 'devnguyentrangtinhsu@gmail.com';
  if (!hook) {
    console.log(`[alert] EMAIL not configured - would email ${to}`);
    return { skipped: 'email' };
  }
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject: `[tsudev] ${payload.level} · ${payload.service}`,
      text: payload.message,
      meta: payload,
    }),
  });
  return { email: res.status };
}

// Fire an alert. Non-blocking-friendly: never throws.
async function alert(payload) {
  try {
    const key = `${payload.service}:${payload.message}`.slice(0, 120);
    if ((payload.level === 'error' || payload.level === 'critical') && _throttled(key)) {
      return { throttled: true };
    }
    const text = _format(payload);
    const [tg, em] = await Promise.allSettled([_sendTelegram(text), _sendEmail(payload)]);
    return { telegram: tg.value || tg.reason, email: em.value || em.reason };
  } catch (e) {
    console.error('[alert] failed to dispatch:', e && e.message);
    return { error: e && e.message };
  }
}

module.exports = { alert };
