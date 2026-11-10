// Core domain types for SplitPay.

export type Currency = 'NIM' | 'USDT';

export type SplitMode = 'equal' | 'custom';

export interface Participant {
  /** Stable local id inside the split. */
  id: string;
  name: string;
  /** Share amount in integer minor units (Luna for NIM, 1e-6 for USDT). */
  shareMinor: number;
  paid: boolean;
  /** How the share was marked paid. */
  paidVia?: 'wallet' | 'manual';
  /** Transaction hash, when paid through a wallet. */
  txHash?: string;
  /** ISO timestamp of when the share was marked paid. */
  paidAt?: string;
}

export interface Split {
  id: string;
  title: string;
  /** Organizer display name. */
  organizer: string;
  currency: Currency;
  /** Normalized Nimiq user-friendly address (NIM splits). */
  nimAddress?: string;
  /** Normalized EVM address (USDT splits, Polygon). */
  evmAddress?: string;
  /** Total including tip, integer minor units. */
  totalMinor: number;
  /** Tip percentage that was applied on top of the base total (0 = none). */
  tipPercent: number;
  mode: SplitMode;
  participants: Participant[];
  createdAt: string;
}

/** Compact payload encoded into a personal pay link (#/pay/<base64url>). */
export interface SharePayload {
  v: 1;
  /** Split id. */
  id: string;
  /** Bill title. */
  t: string;
  /** Organizer display name. */
  o: string;
  /** Currency. */
  c: Currency;
  /** Recipient address (Nimiq for NIM, EVM for USDT). */
  a: string;
  /** Total incl. tip, minor units. */
  tot: number;
  /** This participant's share, minor units. */
  amt: number;
  /** This participant's name. */
  n: string;
  /** Reference code attached to the payment, e.g. "SPL-K7X3-1". */
  ref: string;
  /** Number of participants. */
  cnt: number;
  /** Names of all participants (for the roster/progress display). */
  all: string[];
}

/** A locally recorded payment for a share link opened on this device. */
export interface PaidRecord {
  ref: string;
  splitId: string;
  txHash?: string;
  at: string;
}

export type WalletKind = 'inside' | 'standalone';

export interface WalletState {
  kind: WalletKind;
  /** Host network, when known. */
  network: 'mainnet' | 'testnet';
  /** Connected Nimiq wallet address (accounts[0]), when inside Nimiq Pay. */
  nimAddress?: string;
  /** Spendable NIM balance (HTLC) in Luna, when it could be read. */
  nimBalanceLuna?: number;
  /** Connected EVM address, when the user connected it (for USDT splits). */
  evmAddress?: string;
}
