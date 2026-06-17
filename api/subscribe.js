/**
 * POST /api/subscribe — newsletter opt-in (Buttondown).
 *
 * Hardening is shared with the other endpoints via ./_guard.js:
 *  1. POST only.
 *  2. Same-origin enforcement (blocks cross-site abuse).
 *  3. Body size/shape guard.
 *  4. Honeypot field.
 *  5. Per-IP rate limit (durable via Upstash, in-memory fallback).
 *  6. Strict email validation.
 */
import {
  getClientIp,
  isAllowedOrigin,
  readJsonBody,
  isHoneypotTripped,
  validateEmail,
  isRateLimited,
  buttondownSubscribe,
} from './_guard.js';

const RATE_LIMIT = { max: 5, windowSeconds: 60 * 60, keyPrefix: 'subscribe' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  const parsed = readJsonBody(req, 2_000);
  if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });
  const body = parsed.body;

  // Bot caught by honeypot — fake success so it doesn't retry.
  if (isHoneypotTripped(body)) {
    return res.status(200).json({ success: true, message: 'Subscribed successfully' });
  }

  const emailCheck = validateEmail(body.email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

  const ip = getClientIp(req);
  if (await isRateLimited(ip, RATE_LIMIT)) {
    res.setHeader('Retry-After', String(RATE_LIMIT.windowSeconds));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const tags = typeof body.source === 'string' ? [body.source.slice(0, 40)] : undefined;
  const result = await buttondownSubscribe(emailCheck.email, { tags });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({
    success: true,
    message: result.alreadySubscribed ? 'Already subscribed' : 'Subscribed successfully',
  });
}
