import type { SaaSProductData } from '../types/saas';

/**
 * Test helper: creates a mock SaaSProductData with sensible defaults.
 * All fields can be overridden via the `overrides` parameter.
 */
export function createMockProduct(
  overrides: Partial<SaaSProductData> = {}
): SaaSProductData {
  return {
    id: overrides.id || 'test-tool',
    name: overrides.name || 'Test Tool',
    slug: overrides.slug || 'test-tool',
    category: overrides.category || 'Dev Tools',
    description: overrides.description || 'A test SaaS product for unit testing.',
    websiteUrl: overrides.websiteUrl || 'https://example.com',
    affiliateUrl: overrides.affiliateUrl ?? null,
    pricingModel: overrides.pricingModel || 'per_user',
    freeTrialDays: overrides.freeTrialDays ?? null,
    lastVerified: overrides.lastVerified || '2026-06-01',
    popularityScore: overrides.popularityScore,
    g2Rating: overrides.g2Rating,
    featureIds: overrides.featureIds || [],
    proprietaryFeatures: overrides.proprietaryFeatures || [],
    plans: overrides.plans || [
      {
        id: 'basic',
        name: 'Basic',
        priceMonthly: 10,
        priceAnnually: 100,
        seatsIncluded: 1,
        features: {},
        isEnterprise: false,
      },
    ],
    openSourceAlternatives: overrides.openSourceAlternatives,
  };
}

/** Simple currency formatter mock: returns "$N" */
export const mockFmt = (val: number): string => `$${val}`;
