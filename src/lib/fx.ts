/**
 * Foreign-exchange rates — single committed source of truth.
 *
 * Why a JSON file instead of a hardcoded object: rates drift daily, and a site
 * about price accuracy must not show stale EUR/GBP figures. The committed JSON
 * is refreshed by `scripts/update-fx.mjs` (run on the same weekly CI cron as the
 * pricing scrape), so the build stays deterministic — no network call at build
 * time — while the numbers stay current.
 *
 * Both the React currency provider (client) and the inline price-converter in
 * Layout.astro read these same rates, so static and interactive prices agree.
 */
import fxData from '../data/fx-rates.json';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP'];

export const FX_RATES: Record<CurrencyCode, number> = {
  USD: fxData.rates.USD,
  EUR: fxData.rates.EUR,
  GBP: fxData.rates.GBP,
};

/** ISO date the committed rates were last refreshed. */
export const FX_FETCHED_AT: string = fxData.fetchedAt;
export const FX_SOURCE: string = fxData.source;

/**
 * Fetch live USD-based rates from a provider. Used by scripts/update-fx.mjs at
 * CI time, NOT at request/build time. Accepts any endpoint returning
 * `{ rates: { EUR: number, GBP: number, ... } }` (e.g. open.er-api.com).
 * Returns null on any failure so callers can keep the committed fallback.
 */
export async function fetchLiveFxRates(
  url: string,
): Promise<{ rates: Record<CurrencyCode, number>; fetchedAt: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    const eur = Number(json?.rates?.EUR);
    const gbp = Number(json?.rates?.GBP);
    // Sanity-check: rates must be positive and within a plausible band, or we
    // refuse them rather than ship a garbage conversion.
    if (!isPlausibleRate(eur) || !isPlausibleRate(gbp)) return null;
    return {
      rates: { USD: 1, EUR: round4(eur), GBP: round4(gbp) },
      fetchedAt: new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

function isPlausibleRate(r: number): boolean {
  return Number.isFinite(r) && r > 0.1 && r < 10;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
