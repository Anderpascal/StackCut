/**
 * Tests for src/lib/affiliates.ts — the monetization layer.
 *
 * Two invariants matter here:
 *  1. A broken/placeholder affiliate link can never be treated as real
 *     (the "12345/67890" class of bug that shipped to production once).
 *  2. THE GOLDEN RULE: monetization never influences recommendation/ranking.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidAffiliateUrl,
  getAffiliateUrl,
  getMonetizedUrl,
  isMonetized,
  assertNoAffiliateInfluence,
} from '../lib/affiliates';
import { createMockProduct } from './helpers';

describe('isValidAffiliateUrl', () => {
  it('accepts a real https partner link', () => {
    expect(isValidAffiliateUrl('https://notion.grsm.io/stackcut')).toBe(true);
    expect(isValidAffiliateUrl('https://crisp.chat/en/partners/?ref=stackcut')).toBe(true);
  });

  it('rejects placeholder/template IDs (the bug that once shipped)', () => {
    expect(isValidAffiliateUrl('https://hubspot.sjv.io/c/12345/67890/98765')).toBe(false);
    expect(isValidAffiliateUrl('https://x.com/c/your-id/ref')).toBe(false);
    expect(isValidAffiliateUrl('https://example.com/aff')).toBe(false);
    expect(isValidAffiliateUrl('https://changeme.io')).toBe(false);
  });

  it('rejects non-https, malformed, and empty values', () => {
    expect(isValidAffiliateUrl('http://insecure.io/aff')).toBe(false);
    expect(isValidAffiliateUrl('not-a-url')).toBe(false);
    expect(isValidAffiliateUrl('http://localhost:3000')).toBe(false);
    expect(isValidAffiliateUrl(null)).toBe(false);
    expect(isValidAffiliateUrl(undefined)).toBe(false);
    expect(isValidAffiliateUrl('')).toBe(false);
  });
});

describe('getAffiliateUrl / getMonetizedUrl / isMonetized', () => {
  it('returns the affiliate link only when valid', () => {
    const real = createMockProduct({ affiliateUrl: 'https://notion.grsm.io/stackcut' });
    expect(getAffiliateUrl(real)).toBe('https://notion.grsm.io/stackcut');
    expect(isMonetized(real)).toBe(true);
  });

  it('treats a placeholder link as no link at all', () => {
    const fake = createMockProduct({
      affiliateUrl: 'https://hubspot.sjv.io/c/12345/67890/98765',
      websiteUrl: 'https://hubspot.com',
    });
    expect(getAffiliateUrl(fake)).toBeNull();
    expect(isMonetized(fake)).toBe(false);
    // The user still reaches the product — falls back to the plain site.
    expect(getMonetizedUrl(fake)).toBe('https://hubspot.com');
  });

  it('falls back to websiteUrl when there is no affiliate link', () => {
    const plain = createMockProduct({ affiliateUrl: null, websiteUrl: 'https://slack.com' });
    expect(getMonetizedUrl(plain)).toBe('https://slack.com');
  });
});

describe('THE GOLDEN RULE: ranking must not read affiliateUrl', () => {
  it('assertNoAffiliateInfluence throws if a sort touches affiliateUrl', () => {
    expect(() => assertNoAffiliateInfluence(['annualSavings', 'matchScore'])).not.toThrow();
    expect(() => assertNoAffiliateInfluence(['affiliateUrl'])).toThrow(/never read affiliateUrl/);
  });

  it('static guard: source of ranking modules does not reference affiliateUrl', async () => {
    // If any future refactor makes the engine sort by monetization, this fails.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const engine = fs.readFileSync(
      path.resolve(here, '../components/DowngradeEngine.tsx'),
      'utf-8',
    );
    // The component renders an affiliate link via getMonetizedUrl(), but the
    // analysis/useMemo block must never branch on affiliateUrl.
    const analysisBlock = engine.slice(
      engine.indexOf('const analysis = useMemo'),
      engine.indexOf('// Determine which features are available'),
    );
    expect(analysisBlock).not.toMatch(/affiliateUrl/);
  });
});
