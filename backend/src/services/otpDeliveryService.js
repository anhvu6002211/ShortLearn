const PURPOSE_LABELS = Object.freeze({
  verify_email: 'xac minh email',
  login: 'dang nhap',
  password_reset: 'dat lai mat khau',
});

function exposeDevelopmentCode() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_EXPOSE_OTP === 'true';
}

async function deliverOtp({ email, code, purpose, challengeId, expiresInSeconds }) {
  const mode = (process.env.AUTH_OTP_DELIVERY_MODE || 'console').trim().toLowerCase();

  if (mode === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_OTP_DELIVERY_MODE=console is disabled in production.');
    }
    console.info(`[ShortLearn OTP] ${email} | ${PURPOSE_LABELS[purpose]} | ${code} | ${challengeId}`);
    return;
  }

  if (mode === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_OTP_FROM;
    if (!apiKey || !from) throw new Error('RESEND_API_KEY and AUTH_OTP_FROM are required in resend mode.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Mã xác minh ShortLearn',
        text: `Mã ${PURPOSE_LABELS[purpose]} ShortLearn của bạn là: ${code}. Mã hết hạn sau ${Math.ceil(expiresInSeconds / 60)} phút.`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}.`);
    return;
  }

  if (mode !== 'webhook') throw new Error(`Unsupported AUTH_OTP_DELIVERY_MODE: ${mode}`);
  const webhookUrl = process.env.AUTH_OTP_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('AUTH_OTP_WEBHOOK_URL is required in webhook mode.');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AUTH_OTP_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.AUTH_OTP_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ email, code, purpose, challenge_id: challengeId, expires_in: expiresInSeconds }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) throw new Error(`OTP webhook returned HTTP ${response.status}.`);
}

module.exports = { deliverOtp, exposeDevelopmentCode };
