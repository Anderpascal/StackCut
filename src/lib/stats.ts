/**
 * Dataset-wide statistics shown on the homepage and tool pages.
 *
 * Single source so every "X tools / Y plans / $Z on the books" figure across
 * the site is computed identically from the real data — never hardcoded.
 */
import type { SaaSProduct } from './saas-data';

export interface DatasetStats {
  productsIndexed: number;
  totalPlans: number;
  /** Sum, per tool, of (most expensive priced plan − cheapest priced plan), annualised. */
  totalSpread: number;
  avgSpreadPerTool: number;
}

export function getDatasetStats(products: SaaSProduct[]): DatasetStats {
  const totalPlans = products.reduce((sum, p) => sum + p.plans.length, 0);

  const totalSpread = products.reduce((sum, p) => {
    const priced = p.plans.filter(pl => pl.priceMonthly !== null && pl.priceMonthly > 0);
    if (priced.length < 2) return sum;
    const annual = priced.map(pl => pl.priceAnnually ?? pl.priceMonthly! * 12);
    return sum + (Math.max(...annual) - Math.min(...annual));
  }, 0);

  return {
    productsIndexed: products.length,
    totalPlans,
    totalSpread,
    avgSpreadPerTool: products.length > 0 ? totalSpread / products.length : 0,
  };
}

/** Compact money label, e.g. 2_400_000 -> "$2.4M+". */
export function formatCompactSavings(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M+`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K+`;
  return `$${value.toLocaleString()}+`;
}
