// src/components/CurrencyProvider.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { CurrencyCode, CurrencyContextType } from '../lib/currency';
import { EXCHANGE_RATES, CURRENCY_LOCALES, isValidCurrencyCode } from '../lib/currency';
import { CurrencyContext } from '../lib/currency-context';

const STORAGE_KEY = 'saas-downgrader-currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Render inicial: siempre USD (evita mismatch de hidratación SSG Astro)
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');

  // Tras montaje en cliente: leer localStorage y escuchar eventos
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidCurrencyCode(stored)) {
        setCurrencyState(stored);
      }
    } catch {
      // localStorage no disponible
    }

    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && isValidCurrencyCode(detail)) {
        setCurrencyState(detail);
      }
    };
    window.addEventListener('currencyChange', handleEvent);
    return () => {
      window.removeEventListener('currencyChange', handleEvent);
    };
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
      window.dispatchEvent(new CustomEvent('currencyChange', { detail: c }));
    } catch {
      // Ignorar error de storage
    }
  }, []);

  const fmt = useCallback(
    (amount: number): string => {
      const rate = EXCHANGE_RATES[currency];
      const locale = CURRENCY_LOCALES[currency];
      const converted = amount * rate;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(converted);
    },
    [currency]
  );

  const convert = useCallback(
    (amount: number): number => {
      const rate = EXCHANGE_RATES[currency];
      return Math.round(amount * rate * 100) / 100;
    },
    [currency]
  );

  const value: CurrencyContextType = { currency, setCurrency, fmt, convert };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Re-export useCurrency from shared context module for backward compatibility */
export { useCurrencyShared as useCurrency } from '../lib/currency-context';
