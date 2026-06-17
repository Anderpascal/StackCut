/**
 * POST /api/monitor — Stack Monitor opt-in.
 *
 * A user submits the tools they want watched plus their email. We subscribe
 * them to Buttondown tagged with each watched tool (`watch:slack`, …) and a
 * `stack-monitor` tag. That tagging is the whole storage layer: when the weekly
 * pricing-refresh PR (see .github/workflows/refresh-pricing.yml) changes a
 * tool's price, a maintainer can broadcast to exactly the segment watching that
 * tool — targeted alerts with no separate database and no per-user tracking.
 *
 * Same hardening as /api/subscribe, shared via ./_guard.js.
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

const RATE_LIMIT = { max: 5, windowSeconds: 60 * 60, keyPrefix: 'monitor' };
const MAX_TOOLS = 30;
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  const parsed = readJsonBody(req, 4_000);
  if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });
  const body = parsed.body;

  if (isHoneypotTripped(body)) {
    return res.status(200).json({ success: true, message: 'Monitoring enabled' });
  }

  const emailCheck = validateEmail(body.email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

  // Validate the watched tool slugs: array of clean kebab-case ids, deduped.
  const rawTools = Array.isArray(body.tools) ? body.tools : [];
  const tools = [...new Set(rawTools.filter((t) => typeof t === 'string' && SLUG_RE.test(t)))].slice(0, MAX_TOOLS);
  if (tools.length === 0) {
    return res.status(400).json({ error: 'Select at least one tool to monitor' });
  }

  const ip = getClientIp(req);
  if (await isRateLimited(ip, RATE_LIMIT)) {
    res.setHeader('Retry-After', String(RATE_LIMIT.windowSeconds));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const tags = ['stack-monitor', ...tools.map((t) => `watch:${t}`)];
  const result = await buttondownSubscribe(emailCheck.email, {
    tags,
    metadata: { watching: tools.join(',') },
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({
    success: true,
    watching: tools.length,
    message: result.alreadySubscribed
      ? 'Your watch list has been updated'
      : `Monitoring ${tools.length} tool${tools.length === 1 ? '' : 's'} for price changes`,
  });
}
