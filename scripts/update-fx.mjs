/**
 * Refresh src/data/fx-rates.json with live USD-based exchange rates.
 *
 * Run by the weekly CI cron (see .github/workflows/refresh-pricing.yml) and
 * optionally locally: `node scripts/update-fx.mjs`.
 *
 * Deterministic & safe:
 *  - Uses FX_RATES_URL (defaults to the free, keyless open.er-api.com).
 *  - Validates every rate is positive and within a plausible band before
 *    writing — a garbage API response leaves the committed fallback untouched.
 *  - Exits 0 even on network failure so it never breaks the pipeline; it just
 *    logs that it kept the existing rates.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../src/data/fx-rates.json');
const url = process.env.FX_RATES_URL || 'https://open.er-api.com/v6/latest/USD';

const isPlausible = (r) => Number.isFinite(r) && r > 0.1 && r < 10;
const round4 = (n) => Math.round(n * 10_000) / 10_000;

async function main() {
  const current = JSON.parse(readFileSync(target, 'utf-8'));

  let live;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    live = await res.json();
  } catch (e) {
    console.warn(`[update-fx] Could not fetch live rates (${e.message}). Keeping committed fallback.`);
    return;
  }

  const eur = Number(live?.rates?.EUR);
  const gbp = Number(live?.rates?.GBP);
  if (!isPlausible(eur) || !isPlausible(gbp)) {
    console.warn(`[update-fx] Live rates failed sanity check (EUR=${eur}, GBP=${gbp}). Keeping fallback.`);
    return;
  }

  const next = {
    base: 'USD',
    fetchedAt: new Date().toISOString().slice(0, 10),
    source: url,
    rates: { USD: 1, EUR: round4(eur), GBP: round4(gbp) },
  };

  const changed =
    current.rates.EUR !== next.rates.EUR || current.rates.GBP !== next.rates.GBP;

  writeFileSync(target, JSON.stringify(next, null, 2) + '\n');
  console.log(
    `[update-fx] ${changed ? 'Updated' : 'Refreshed (no change in)'} rates: ` +
      `EUR=${next.rates.EUR} GBP=${next.rates.GBP} (as of ${next.fetchedAt})`,
  );
}

main();
