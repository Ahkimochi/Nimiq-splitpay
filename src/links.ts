// Personal pay links: the full share payload is encoded into the URL hash
// (#/pay/<base64url-json>) so links work with no backend and no accounts.
// Unicode-safe: the JSON is UTF-8 encoded before base64.

import type { SharePayload, Split } from './types';
import { randomCode } from './store';

/** Per-share reference code, e.g. "SPL-K7X3-1" (1-based participant index). */
export function shareRef(splitId: string, index: number): string {
  return `SPL-${splitId.slice(0, 4).toUpperCase()}-${index + 1}`;
}

export function buildSharePayload(split: Split, index: number): SharePayload {
  const participant = split.participants[index]!;
  const address = split.currency === 'NIM' ? split.nimAddress ?? '' : split.evmAddress ?? '';
  return {
    v: 1,
    id: split.id,
    t: split.title,
    o: split.organizer,
    c: split.currency,
    a: address,
    tot: split.totalMinor,
    amt: participant.shareMinor,
    n: participant.name,
    ref: shareRef(split.id, index),
    cnt: split.participants.length,
    all: split.participants.map((p) => p.name),
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Absolute URL of the pay view for a participant (keeps current path/host). */
export function shareUrl(split: Split, index: number): string {
  const payload = buildSharePayload(split, index);
  const encoded = toBase64Url(JSON.stringify(payload));
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/pay/${encoded}`;
}

/** Decode and validate a share payload from the route param. Null if invalid. */
export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as SharePayload;
    if (!parsed || parsed.v !== 1) return null;
    if (typeof parsed.id !== 'string' || typeof parsed.t !== 'string') return null;
    if (parsed.c !== 'NIM' && parsed.c !== 'USDT') return null;
    if (typeof parsed.a !== 'string' || typeof parsed.n !== 'string') return null;
    if (!Number.isSafeInteger(parsed.tot) || !Number.isSafeInteger(parsed.amt)) return null;
    if (parsed.amt < 0 || parsed.tot < 0) return null;
    if (!Array.isArray(parsed.all)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** A short-lived unique marker for cloned splits (keeps ids collision-free). */
export function freshSuffix(): string {
  return randomCode(3).toLowerCase();
}
