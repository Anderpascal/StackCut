/**
 * Affiliate monetization — single source of truth.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  THE GOLDEN RULE (do not break this):
 *  An `affiliateUrl` may change WHERE a click goes, never WHETHER a product is
 *  recommended or HOW it ranks. Ranking is computed exclusively from the
 *  feature/price math in DowngradeEngine / StackAuditor. No sort, filter, or
 *  score in this codebase is allowed to read `affiliateUrl`.
 *  `assertNoAffiliateInfluence()` and the test in
 *  src/__tests__ guard this invariant.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * It also defends against shipping broken/placeholder affiliate IDs (the
 * "12345/67890" class of mistake): `isValidAffiliateUrl` rejects them, and the
 * content schema + validate-data.mjs fail the build if one slips into the data.
 */

import type { SaaSProductData } from '../types/saas';

/**
 * Patterns that betray a non-real affiliate link: copy-pasted template IDs,
 * obvious placeholders, or localhost. Keep this list in sync with the same
 * check in scripts/validate-data.mjs.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /12345/, // template numeric IDs (e.g. sjv.io/c/12345/67890)
  /67890/,
  /98765/,
  /\byour[-_]?(id|ref|affiliate)\b/i,
  /\b(example|placeholder|changeme|todo|xxxx+)\b/i,
  /localhost|127\.0\.0\.1/,
];

/** True only for a syntactically valid, non-placeholder https affiliate URL. */
export function isValidAffiliateUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(url))) return false;
  return true;
}

/**
 * The affiliate URL for a product if (and only if) it is real. Returns null for
 * missing, malformed, or placeholder links so callers can fall back cleanly.
 */
export function getAffiliateUrl(
  product: Pick<SaaSProductData, 'affiliateUrl'>,
): string | null {
  return isValidAffiliateUrl(product.affiliateUrl) ? product.affiliateUrl : null;
}

/**
 * The outbound URL to send a user to: the affiliate link when one is verified,
 * otherwise the plain vendor website. Either way the user reaches the product —
 * monetization never gates the destination's existence.
 */
export function getMonetizedUrl(
  product: Pick<SaaSProductData, 'affiliateUrl' | 'websiteUrl'>,
): string {
  return getAffiliateUrl(product) ?? product.websiteUrl;
}

/** Whether a product currently earns commission (drives the "sponsored" rel/label). */
export function isMonetized(
  product: Pick<SaaSProductData, 'affiliateUrl'>,
): boolean {
  return getAffiliateUrl(product) !== null;
}

/**
 * Defensive runtime assertion for ranking/ordering code paths. Pass the list of
 * object keys a sort/score function is about to read; throws if it touches
 * `affiliateUrl`. Cheap insurance that the golden rule isn't violated by a
 * future refactor.
 */
export function assertNoAffiliateInfluence(readKeys: readonly string[]): void {
  if (readKeys.includes('affiliateUrl')) {
    throw new Error(
      '[affiliates] Ranking/scoring must never read affiliateUrl. ' +
        'Monetization is decoupled from recommendation by design.',
    );
  }
}
