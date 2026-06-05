// FILE: backend/src/services/mailer.js
// One job: deliver a login OTP by email.
//
// Transport is SendGrid's HTTP API (https://api.sendgrid.com/v3/mail/send). We use
// `fetch` directly — no SDK — so the SAME code runs on Cloudflare Workers AND on
// Node (`wrangler dev` and `node src/server.node.js`), both of which ship a global
// `fetch`. Nothing here is bundler/runtime specific.
//
// Config (set in .dev.vars locally, and as wrangler secrets in production):
//   SENDGRID_API_KEY     — your SendGrid API key (starts with "SG.")
//   SENDGRID_FROM_EMAIL  — a VERIFIED sender on your SendGrid account
//   SENDGRID_FROM_NAME   — optional display name (default below)
//
// DEV FALLBACK: when the key/sender isn't configured yet, we DON'T fail — we log
// the OTP to the server console so you can test the whole login flow before
// SendGrid is wired up. Production must have the secrets set.

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_FROM_NAME = 'KEYSS Timesheet';
const OTP_TTL_MINUTES = 10;

/**
 * Send a one-time login code to `toEmail`.
 * @returns {Promise<{delivered: boolean, dev?: boolean}>}
 *   delivered=true  → SendGrid accepted the message.
 *   delivered=false, dev=true → not configured; OTP was logged to console instead.
 * @throws only when SendGrid IS configured but the API call itself fails.
 */
export async function sendOtpEmail(env, toEmail, otp) {
    const apiKey = env.SENDGRID_API_KEY;
    const fromEmail = env.SENDGRID_FROM_EMAIL;
    const fromName = env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME;

    // Not configured → dev fallback. Never blocks local testing.
    if (!apiKey || !fromEmail) {
        console.log(
            `\n\n` +
            `============================================\n` +
            `   🔑  LOGIN OTP (dev)\n` +
            `   ${toEmail}\n` +
            `   CODE  →   ${otp}\n` +
            `============================================\n\n`
        );
        return { delivered: false, dev: true };
    }

    const res = await fetch(SENDGRID_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: toEmail }] }],
            from: { email: fromEmail, name: fromName },
            subject: `Your ${fromName} login code`,
            content: [
                {
                    type: 'text/plain',
                    value:
                        `Your one-time login code is ${otp}\n\n` +
                        `It expires in ${OTP_TTL_MINUTES} minutes. ` +
                        `If you didn't request this, you can safely ignore this email.`,
                },
            ],
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[SendGrid error]', res.status, detail);
        throw new Error('Could not send the login email. Please try again.');
    }

    return { delivered: true };
}

export { OTP_TTL_MINUTES };
