// Shared React Context for currency — MUST be in a separate file
// to avoid module duplication across Astro build chunks.
import { createContext, useContext } from 'react';
import type { CurrencyContextType } from './currency';

export const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function useCurrencyShared(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency() must be used within a <CurrencyProvider>');
  }
  return ctx;
}
