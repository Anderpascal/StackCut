// src/components/CurrencySelector.tsx
import React from 'react';
import { useCurrencyShared as useCurrency } from '../lib/currency-context';
import type { CurrencyCode } from '../lib/currency';
import { CURRENCY_SYMBOLS } from '../lib/currency';

const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: `USD (${CURRENCY_SYMBOLS.USD})` },
  { value: 'EUR', label: `EUR (${CURRENCY_SYMBOLS.EUR})` },
  { value: 'GBP', label: `GBP (${CURRENCY_SYMBOLS.GBP})` },
];

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
      <label htmlFor="currency-select" className="text-xs text-zinc-400">
        Currency:
      </label>
      <select
        id="currency-select"
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
        aria-label="Select currency"
      >
        {CURRENCY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
