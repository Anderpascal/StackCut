/**
 * Data freshness — turns a `lastVerified` ISO date into a trust signal.
 *
 * For a site whose pillar is price fidelity, surfacing *when* a figure was last
 * checked (and admitting when it might be stale) is itself a credibility win.
 * Thresholds intentionally match the staleness rule in scripts/validate-data.mjs.
 */

export type FreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';

export interface Freshness {
  level: FreshnessLevel;
  /** Whole days since the date was verified (null when unknown). */
  daysAgo: number | null;
  /** Short human label, e.g. "Verified 6 days ago". */
  label: string;
  /** Longer caveat shown on stale data. */
  caveat: string | null;
}

const FRESH_MAX_DAYS = 30;
const AGING_MAX_DAYS = 90;

/** Days between an ISO `YYYY-MM-DD` date and `now` (defaults to current time). */
function daysSince(isoDate: string, now: number = Date.now()): number | null {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now - parsed) / 86_400_000);
}

export function getFreshness(isoDate: string | null | undefined, now: number = Date.now()): Freshness {
  if (!isoDate) {
    return { level: 'unknown', daysAgo: null, label: 'Verification date unknown', caveat: null };
  }
  const daysAgo = daysSince(isoDate, now);
  if (daysAgo === null || daysAgo < 0) {
    return { level: 'unknown', daysAgo: null, label: 'Verification date unknown', caveat: null };
  }

  const ago =
    daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

  if (daysAgo <= FRESH_MAX_DAYS) {
    return { level: 'fresh', daysAgo, label: `Verified ${ago}`, caveat: null };
  }
  if (daysAgo <= AGING_MAX_DAYS) {
    return {
      level: 'aging',
      daysAgo,
      label: `Verified ${ago}`,
      caveat: 'Pricing may have changed since we last checked — confirm on the vendor page.',
    };
  }
  return {
    level: 'stale',
    daysAgo,
    label: `Last verified ${ago}`,
    caveat: 'This figure is over 90 days old and may be outdated. Always confirm on the vendor’s pricing page before deciding.',
  };
}

/** Tailwind classes per level, for the badge dot + text. Uses the ledger palette. */
export const FRESHNESS_CLASSES: Record<FreshnessLevel, { dot: string; text: string; ring: string }> = {
  fresh: { dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'border-emerald-400/20 bg-emerald-400/5' },
  aging: { dot: 'bg-amber-400', text: 'text-amber-400', ring: 'border-amber-400/20 bg-amber-400/5' },
  stale: { dot: 'bg-red-400', text: 'text-red-400', ring: 'border-red-400/20 bg-red-400/5' },
  unknown: { dot: 'bg-zinc-500', text: 'text-zinc-500', ring: 'border-zinc-800 bg-transparent' },
};
