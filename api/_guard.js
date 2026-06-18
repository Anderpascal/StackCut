/**
 * Shared hardening helpers for serverless endpoints (subscribe, monitor).
 *
 * Files prefixed with "_" are NOT treated as routes by Vercel, so this is a
 * private library both handlers import. Centralizing means the origin check,
 * rate limiter, honeypot and email validation can't drift between endpoints.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DANGEROUS_PATTERNS = [/<script/i, /javascript:/i, /on\w+=/i, /data:/i];

// In-memory fallback limiter (per warm instance). Best-effort only.
const memoryHits = new Map();

export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // server-to-server / curl; rate limiter + honeypot still apply

  // Allowlist = canonical site + THIS project's own Vercel deploys only.
  // VERCEL_URL is the current deployment host (e.g. stackcut-abc.vercel.app);
  // VERCEL_PROJECT_PRODUCTION_URL is the project's production host. Both are
  // auto-injected by Vercel, so we no longer trust every *.vercel.app subdomain
  // (which would let any stranger's preview deploy POST to these endpoints).
  const allowedHosts = new Set();
  for (const raw of [
    process.env.PUBLIC_SITE_ORIGIN || 'https://stackcut.app',
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
  ]) {
    if (!raw) continue;
    try {
      allowedHosts.add(new URL(raw.startsWith('http') ? raw : `https://${raw}`).host);
    } catch {
      /* ignore malformed env value */
    }
  }

  try {
    return allowedHosts.has(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Parse + size-guard a JSON body. Returns { ok, body, error, status }. */
export function readJsonBody(req, maxBytes = 4_000) {
  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > maxBytes) return { ok: false, status: 413, error: 'Payload too large' };
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, status: 400, error: 'Invalid JSON' };
    }
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid request body' };
  }
  return { ok: true, body };
}

/** Hidden honeypot field convention: `company_website` must be empty. */
export function isHoneypotTripped(body) {
  return typeof body.company_website === 'string' && body.company_website.trim() !== '';
}

/** Validate + normalize an email. Returns { ok, email, error }. */
export function validateEmail(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'Email is required' };
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return { ok: false, error: 'Email address too long' };
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: 'Invalid email address' };
  if (DANGEROUS_PATTERNS.some((p) => p.test(email))) return { ok: false, error: 'Invalid email address' };
  return { ok: true, email };
}

async function upstashRateLimit(ip, { max, windowSeconds, keyPrefix }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = `ratelimit:${keyPrefix}:${ip}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds), 'NX'],
      ]),
    });
    if (!res.ok) return { limited: false };
    const data = await res.json();
    const count = Array.isArray(data) ? Number(data[0]?.result ?? 0) : 0;
    return { limited: count > max };
  } catch {
    return { limited: false };
  }
}

function memoryRateLimit(ip, { max, windowSeconds, keyPrefix }) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const mapKey = `${keyPrefix}:${ip}`;
  const hits = (memoryHits.get(mapKey) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  memoryHits.set(mapKey, hits);
  if (memoryHits.size > 5_000) {
    for (const [k, v] of memoryHits) {
      if (v.every((t) => now - t >= windowMs)) memoryHits.delete(k);
    }
  }
  return { limited: hits.length > max };
}

/** Durable rate limit (Upstash) with in-memory fallback. opts: {max, windowSeconds, keyPrefix}. */
export async function isRateLimited(ip, opts) {
  const durable = await upstashRateLimit(ip, opts);
  if (durable) return durable.limited;
  return memoryRateLimit(ip, opts).limited;
}

/**
 * Add or update a Buttondown subscriber. `tags` segments the list (e.g. the
 * tools a user is monitoring) without any extra tracking infrastructure.
 * Returns { ok, status, alreadySubscribed, error }.
 */
export async function buttondownSubscribe(email, { tags, metadata } = {}) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) return { ok: false, status: 500, error: 'Newsletter service not configured' };
  try {
    const res = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        tags: Array.isArray(tags) && tags.length ? tags.slice(0, 25) : undefined,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      }),
    });
    if (res.status === 409) return { ok: true, status: 200, alreadySubscribed: true };
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, status: 502, error: data.detail || 'Subscription failed' };
    }
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 500, error: 'Internal server error' };
  }
}
