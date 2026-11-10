// Wallet integration — coded strictly against the verified API of
// @nimiq/mini-app-sdk@0.2.5 (dist/index.d.ts + dist/provider.d.ts) and the
// official docs (nimiq.dev/mini-apps, checked 2026-11-10):
//
//   import { init } from '@nimiq/mini-app-sdk' -> Promise<NimiqProvider>
//   nimiq.listAccounts(): Promise<string[]>
//   nimiq.getBalance(address): Promise<number>            // Luna
//   nimiq.sendBasicTransaction({ recipient, value, fee?, validityStartHeight? })
//       : Promise<string>                                  // tx hash
//   nimiq.sendBasicTransactionWithData({ recipient, value, data, ... })
//       : Promise<string>                                  // data <= 64 UTF-8 bytes
//   nimiq.on('accountsChanged', (accounts: string[]) => void)
//   getHostNetwork(): 'mainnet' | 'testnet' | undefined
//   Errors reject with NimiqProviderError (type/message/code).
//
// USDT runs over the standard EIP-1193 provider window.ethereum
// (USDT on Polygon, chain 0x89, contract 0xc2132D05D31c914a87C6611C10748AEb04B58e8F),
// per https://nimiq.dev/mini-apps/features/evm-tokens.

import {
  init,
  getHostNetwork,
  NimiqProviderError,
  type NimiqProvider,
} from '@nimiq/mini-app-sdk';
import { isValidNimiqAddress } from './validate';

export const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
export const POLYGON_CHAIN_ID = '0x89';
export const LUNA_PER_NIM = 100_000;

export type InitResult =
  | { status: 'inside'; provider: NimiqProvider }
  | { status: 'standalone' };

let providerPromise: Promise<InitResult> | null = null;

/**
 * Initialize the Nimiq provider. Never throws: when the provider is not
 * injected (plain browser), resolves to { status: 'standalone' }.
 * init() itself polls for window.nimiq for up to `timeout` ms.
 */
export function initWallet(): Promise<InitResult> {
  if (!providerPromise) {
    providerPromise = (async (): Promise<InitResult> => {
      // Fast path: nothing injected and no host context -> standalone.
      // init() would still be authoritative, so we only use this to skip the
      // full 5s wait when both globals are clearly absent after a grace tick.
      try {
        const provider = await init({ timeout: 2_500 });
        return { status: 'inside', provider };
      } catch {
        return { status: 'standalone' };
      }
    })();
  }
  return providerPromise;
}

export function hostNetwork(): 'mainnet' | 'testnet' {
  try {
    return getHostNetwork() ?? 'mainnet';
  } catch {
    return 'mainnet';
  }
}

export interface AccountInfo {
  walletAddress: string;
  htlcAddress?: string;
  /** Spendable balance in Luna (HTLC balance per SDK README; wallet as fallback). */
  balanceLuna?: number;
}

/**
 * Read the connected account + spendable balance.
 * listAccounts() returns [walletAddress, htlcAddress?]; Nimiq Pay keeps the
 * spendable NIM in the HTLC, so the HTLC balance is the meaningful number
 * (falling back to the wallet address balance when there is no HTLC).
 */
export async function readAccount(provider: NimiqProvider): Promise<AccountInfo> {
  const accounts = await provider.listAccounts();
  const walletAddress = accounts[0];
  if (!walletAddress) throw new Error('No Nimiq account was shared by the wallet.');
  const htlcAddress = accounts[1];
  let balanceLuna: number | undefined;
  if (typeof provider.getBalance === 'function') {
    try {
      balanceLuna = await provider.getBalance(htlcAddress ?? walletAddress);
    } catch {
      balanceLuna = undefined; // balance is informational; never block on it
    }
  }
  return { walletAddress, htlcAddress, balanceLuna };
}

/** Subscribe to account replacement (new HTLC) if the provider supports it. */
export function onAccountsChanged(
  provider: NimiqProvider,
  listener: (accounts: string[]) => void,
): void {
  try {
    provider.on('accountsChanged', listener);
  } catch {
    // Older hosts may not support events — balance refresh is best-effort.
  }
}

export interface PayNimResult {
  txHash: string;
  /** True when the reference was attached as the transaction message. */
  attachedRef: boolean;
}

/**
 * Pay a NIM share. Attaches the reference code as the transaction message
 * via sendBasicTransactionWithData when it fits the 64-byte limit
 * (our references always do); otherwise falls back to a plain transaction.
 * Resolves with the transaction hash returned by the wallet.
 */
export async function payNim(
  provider: NimiqProvider,
  recipient: string,
  valueLuna: number,
  reference: string,
): Promise<PayNimResult> {
  if (!isValidNimiqAddress(recipient)) {
    throw new Error('The organizer’s Nimiq address in this link is not valid.');
  }
  if (!Number.isSafeInteger(valueLuna) || valueLuna <= 0) {
    throw new Error('The amount to pay is not valid.');
  }
  const data = `SplitPay ${reference}`;
  const fitsMessage = new TextEncoder().encode(data).length <= 64;
  if (fitsMessage && typeof provider.sendBasicTransactionWithData === 'function') {
    const txHash = await provider.sendBasicTransactionWithData({
      recipient,
      value: valueLuna,
      data,
    });
    return { txHash, attachedRef: true };
  }
  const txHash = await provider.sendBasicTransaction({ recipient, value: valueLuna });
  return { txHash, attachedRef: false };
}

// ---------------------------------------------------------------------------
// EVM (USDT on Polygon) via window.ethereum — EIP-1193
// ---------------------------------------------------------------------------

interface EthereumProvider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasEvmProvider(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** Request the user's EVM account (triggers the Nimiq Pay confirmation dialog). */
export async function connectEvm(): Promise<string> {
  if (!window.ethereum) throw new Error('No EVM wallet is available in this browser.');
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  const account = accounts?.[0];
  if (!account) throw new Error('No EVM account was shared by the wallet.');
  return account;
}

/** Check which chain the EVM provider is currently on (hex chain id). */
export async function evmChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return (await window.ethereum.request({ method: 'eth_chainId' })) as string;
  } catch {
    return null;
  }
}

/** Ask the wallet to switch to Polygon. Throws if the user declines. */
export async function switchToPolygon(): Promise<void> {
  if (!window.ethereum) throw new Error('No EVM wallet is available in this browser.');
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: POLYGON_CHAIN_ID }],
  });
}

function erc20TransferData(to: string, amountMinor: bigint): string {
  const selector = 'a9059cbb'; // transfer(address,uint256)
  const addressWord = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountWord = amountMinor.toString(16).padStart(64, '0');
  return `0x${selector}${addressWord}${amountWord}`;
}

/**
 * Pay a USDT share: ERC-20 transfer() on the USDT contract on Polygon via
 * eth_sendTransaction. Requires the provider to be on Polygon — the caller
 * checks/switches the chain first. Resolves with the transaction hash.
 */
export async function payUsdt(from: string, recipient: string, amountMinor: number): Promise<string> {
  if (!window.ethereum) throw new Error('No EVM wallet is available in this browser.');
  const data = erc20TransferData(recipient, BigInt(amountMinor));
  const txHash = (await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: USDT_POLYGON, data, value: '0x0' }],
  })) as string;
  if (!txHash) throw new Error('The wallet did not return a transaction hash.');
  return txHash;
}

// ---------------------------------------------------------------------------
// Error presentation
// ---------------------------------------------------------------------------

export type FriendlyError =
  | { kind: 'cancelled'; message: string }
  | { kind: 'error'; message: string };

/** Map wallet/provider errors to plain-language messages. */
export function friendlyError(error: unknown): FriendlyError {
  // EIP-1193 user rejection (EVM path).
  const code = (error as { code?: number } | null)?.code;
  if (code === 4001) {
    return { kind: 'cancelled', message: 'You cancelled the payment in your wallet. Nothing was sent.' };
  }
  if (NimiqProviderError.is(error)) {
    switch (error.type) {
      case 'PERMISSION_DENIED':
        return { kind: 'cancelled', message: 'You cancelled the payment in Nimiq Pay. Nothing was sent.' };
      case 'INVALID_TRANSACTION':
        return {
          kind: 'error',
          message: `The wallet rejected this transaction as invalid. ${error.message}`.trim(),
        };
      case 'NETWORK_ERROR':
        return {
          kind: 'error',
          message:
            'The payment could not be submitted because of a network problem. Please check in Nimiq Pay whether it went through before trying again.',
        };
      case 'UNKNOWN_REQUEST':
        return {
          kind: 'error',
          message: 'Your version of Nimiq Pay does not support this payment request. Please update Nimiq Pay and try again.',
        };
      default:
        return { kind: 'error', message: error.message || 'The payment failed in the wallet.' };
    }
  }
  if (error instanceof Error) {
    if (/user (rejected|denied)|denied by user|rejected the request/i.test(error.message)) {
      return { kind: 'cancelled', message: 'You cancelled the payment in your wallet. Nothing was sent.' };
    }
    return { kind: 'error', message: error.message };
  }
  return { kind: 'error', message: 'Something went wrong while paying. Please try again.' };
}

/** Nimiq explorer URL for a transaction hash on the given network. */
export function nimiqExplorerTxUrl(network: 'mainnet' | 'testnet', txHash: string): string {
  return network === 'testnet'
    ? `https://testnet.nimiq.watch/#${txHash}`
    : `https://nimiq.watch/#${txHash}`;
}

/** Polygonscan URL for a transaction hash. */
export function polygonExplorerTxUrl(txHash: string): string {
  return `https://polygonscan.com/tx/${txHash}`;
}

/** "Open in Nimiq Pay" deeplinks for the current page (per official docs). */
export function nimiqPayDeeplinks(): { scheme: string; https: string } {
  const host = `${location.host}${location.pathname}${location.hash}`;
  return {
    scheme: `nimiqpay://miniapp?url=${encodeURIComponent(host)}`,
    https: `https://nimpay.app/miniapps/open/${host}`,
  };
}
