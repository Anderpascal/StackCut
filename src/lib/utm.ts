export function buildAffiliateUrl(
  baseUrl: string,
  productId: string,
  planId?: string,
  campaign = 'downgrade'
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'stackcut');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', campaign);
    url.searchParams.set('utm_content', planId ? `${productId}_${planId}` : productId);
    return url.toString();
  } catch {
    return baseUrl;
  }
}
