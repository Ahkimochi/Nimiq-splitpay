// Money handling: all amounts are integers of minor units.
// NIM: 1 NIM = 100_000 Luna (5 decimals). USDT: 6 decimals (Polygon ERC-20).

import type { Currency } from './types';

export const DECIMALS: Record<Currency, number> = {
  NIM: 5,
  USDT: 6,
};

export function factor(currency: Currency): number {
  return 10 ** DECIMALS[currency];
}

/**
 * Parse a user-typed decimal amount ("12.5", "12,50", ".5") into integer
 * minor units. Returns null for empty/invalid/negative input.
 * Pure integer arithmetic — no floating point drift.
 */
export function parseAmountToMinor(input: string, currency: Currency): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d*(\.\d*)?$/.test(s)) return null;
  const decimals = DECIMALS[currency];
  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  const intPart = intPartRaw === '' ? '0' : intPartRaw;
  if (fracPartRaw.length > decimals) return null; // too precise for this currency
  const frac = fracPartRaw.padEnd(decimals, '0');
  const minor = Number(intPart) * factor(currency) + (frac ? Number(frac) : 0);
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  return minor;
}

/** Format integer minor units for display: "1,234.5" (grouped, trimmed zeros). */
export function formatMinor(minor: number, currency: Currency): string {
  const decimals = DECIMALS[currency];
  const f = factor(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const intPart = Math.floor(abs / f);
  const fracPart = abs % f;
  const intStr = intPart.toLocaleString('en-US');
  let fracStr = '';
  if (fracPart > 0) {
    fracStr = '.' + String(fracPart).padStart(decimals, '0').replace(/0+$/, '');
  }
  return `${negative ? '-' : ''}${intStr}${fracStr}`;
}

/** Format with the currency code: "1,234.5 NIM". */
export function formatMoney(minor: number, currency: Currency): string {
  return `${formatMinor(minor, currency)} ${currency}`;
}

/** Convert minor units back to a plain decimal string for input fields. */
export function minorToInput(minor: number, currency: Currency): string {
  const decimals = DECIMALS[currency];
  const f = factor(currency);
  const intPart = Math.floor(minor / f);
  const fracPart = minor % f;
  if (fracPart === 0) return String(intPart);
  const frac = String(fracPart).padStart(decimals, '0').replace(/0+$/, '');
  return `${intPart}.${frac}`;
}

/**
 * Split `totalMinor` equally among `n` people. Remainder minor units are
 * distributed one each to the first participants, so shares always sum
 * exactly to the total.
 */
export function equalShares(totalMinor: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalMinor / n);
  const remainder = totalMinor - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
