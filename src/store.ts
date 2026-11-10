// Persistence: everything lives in localStorage on this device.
// - splitpay.splits.v1 : Split[] created by the organizer on this device
// - splitpay.paid.v1   : PaidRecord[] for share links paid on this device

import type { PaidRecord, Split } from './types';

const SPLITS_KEY = 'splitpay.splits.v1';
const PAID_KEY = 'splitpay.paid.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/blocked: the app keeps working in-memory for the session,
    // but nothing more we can do — never crash on persistence.
  }
}

export function loadSplits(): Split[] {
  const splits = read<Split[]>(SPLITS_KEY, []);
  return Array.isArray(splits) ? splits : [];
}

export function saveSplits(splits: Split[]): void {
  write(SPLITS_KEY, splits);
}

export function upsertSplit(split: Split): Split[] {
  const splits = loadSplits();
  const idx = splits.findIndex((s) => s.id === split.id);
  if (idx >= 0) splits[idx] = split;
  else splits.unshift(split);
  saveSplits(splits);
  return splits;
}

export function deleteSplit(id: string): Split[] {
  const splits = loadSplits().filter((s) => s.id !== id);
  saveSplits(splits);
  return splits;
}

export function loadPaidRecords(): PaidRecord[] {
  const records = read<PaidRecord[]>(PAID_KEY, []);
  return Array.isArray(records) ? records : [];
}

export function findPaidRecord(ref: string): PaidRecord | undefined {
  return loadPaidRecords().find((r) => r.ref === ref);
}

export function recordPaid(record: PaidRecord): void {
  const records = loadPaidRecords().filter((r) => r.ref !== record.ref);
  records.unshift(record);
  write(PAID_KEY, records);
}

/** Random id using the crypto RNG, base32-ish alphabet without confusing chars. */
const ID_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY';

export function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length];
  }
  return out;
}

export function newSplitId(): string {
  return randomCode(8).toLowerCase();
}
