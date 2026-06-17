// src/lib/currency.ts
// Tipos, tasas de cambio y funciones puras para el sistema de multidivisa.
import { FX_RATES, type CurrencyCode as FxCurrencyCode } from './fx';

export type CurrencyCode = FxCurrencyCode;

export interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  fmt: (amount: number) => string;
  convert: (amount: number) => number;
}

/**
 * Exchange rates. Base: USD = 1. Sourced from src/data/fx-rates.json (the single
 * committed source of truth, refreshed by scripts/update-fx.mjs) so client and
 * static prices never diverge. Do NOT hardcode rates here.
 */
export const EXCHANGE_RATES: Record<CurrencyCode, number> = FX_RATES;

/** Locales para Intl.NumberFormat */
export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

/** Símbolos de moneda para uso en texto (ej. "$/hr" en labels) */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Type guard que verifica si un string es un CurrencyCode válido.
 */
export function isValidCurrencyCode(value: string): value is CurrencyCode {
  return value === 'USD' || value === 'EUR' || value === 'GBP';
}

/**
 * Formatea un monto en USD a la moneda target con Intl.NumberFormat.
 * @param currency - Código de moneda target
 * @param amount - Monto en USD
 */
export function formatCurrency(currency: CurrencyCode, amount: number): string {
  const rate = EXCHANGE_RATES[currency];
  const locale = CURRENCY_LOCALES[currency];
  const converted = amount * rate;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(converted);
}

/**
 * Convierte un monto en USD al valor numérico en la moneda target.
 * Usado para CSV export (valores crudos).
 * @param currency - Código de moneda target
 * @param amount - Monto en USD
 */
export function convertCurrency(currency: CurrencyCode, amount: number): number {
  const rate = EXCHANGE_RATES[currency];
  return Math.round(amount * rate * 100) / 100;
}
