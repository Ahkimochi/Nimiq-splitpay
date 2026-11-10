// Pay view: what a participant sees when opening their personal pay link.

import { h, toast } from '../ui';
import { formatMoney } from '../money';
import { findPaidRecord, recordPaid, loadSplits } from '../store';
import {
  payNim,
  payUsdt,
  connectEvm,
  evmChainId,
  switchToPolygon,
  hasEvmProvider,
  friendlyError,
  nimiqExplorerTxUrl,
  polygonExplorerTxUrl,
  nimiqPayDeeplinks,
  POLYGON_CHAIN_ID,
  type InitResult,
} from '../wallet';
import { isValidEvmAddress, isValidNimiqAddress, shortenNimiqAddress } from '../validate';
import type { SharePayload, WalletState } from '../types';

export interface PayCallbacks {
  onBack: () => void;
  refreshWallet: () => Promise<void>;
}

type PayPhase = 'idle' | 'paying' | 'paid';

export function renderPayView(
  payload: SharePayload,
  wallet: WalletState,
  initResult: InitResult,
  cb: PayCallbacks,
): HTMLElement {
  const root = h('section', { class: 'view' });
  const isNim = payload.c === 'NIM';
  const addressValid = isNim ? isValidNimiqAddress(payload.a) : isValidEvmAddress(payload.a);

  // Known progress: if this split was created on this device, use live status.
  const localSplit = loadSplits().find((s) => s.id === payload.id);
  const paidRefsKnown = localSplit
    ? localSplit.participants.filter((p) => p.paid).length
    : null;

  const existingRecord = findPaidRecord(payload.ref);
  let phase: PayPhase = existingRecord ? 'paid' : 'idle';
  let ownTxHash: string | undefined = existingRecord?.txHash;

  // --- dynamic regions -----------------------------------------------------
  const statusRegion = h('div', { class: 'pay-status' });
  const actionRegion = h('div', { class: 'pay-actions' });
  const noteRegion = h('div', { class: 'pay-note' });

  function renderStatus(): void {
    statusRegion.replaceChildren();
    if (phase === 'paid') {
      statusRegion.append(
        h('div', { class: 'paid-banner', role: 'status' },
          h('div', { class: 'paid-banner-title' }, 'You paid your share ✓'),
          ownTxHash
            ? (() => {
                const link = h('a', {
                  class: 'tx-link mono',
                  href: isNim
                    ? nimiqExplorerTxUrl(wallet.network, ownTxHash!)
                    : polygonExplorerTxUrl(ownTxHash!),
                  target: '_blank', rel: 'noopener',
                }, `View transaction ${ownTxHash.slice(0, 12)}…`) as HTMLAnchorElement;
                return link;
              })()
            : h('span', { class: 'muted small' }, 'Marked as paid on this device.'),
        ),
      );
    } else if (phase === 'paying') {
      statusRegion.append(
        h('p', { class: 'muted', role: 'status' }, 'Waiting for approval in your wallet…'),
      );
    }
  }

  function deeplinkBlock(): HTMLElement {
    const links = nimiqPayDeeplinks();
    const a = h('a', { class: 'btn btn-primary btn-block', href: links.https },
      'Open in Nimiq Pay to pay') as HTMLAnchorElement;
    const b = h('a', { class: 'btn btn-ghost btn-block', href: links.scheme },
      'Try the Nimiq Pay app link') as HTMLAnchorElement;
    return h('div', {},
      h('p', { class: 'hint' },
        'Payments only work inside Nimiq Pay, where your wallet lives. This page will open there with one tap — nothing about your share changes.'),
      a, b);
  }

  function renderActions(): void {
    actionRegion.replaceChildren();
    noteRegion.replaceChildren();
    if (phase === 'paid' || phase === 'paying') return;

    if (!addressValid) {
      actionRegion.append(
        h('p', { class: 'form-error', role: 'alert' },
          'The payment address in this link does not look valid. Ask the organizer to send you a fresh link — do not pay to a different address.'),
      );
      return;
    }

    if (isNim) {
      if (initResult.status !== 'inside') {
        actionRegion.append(deeplinkBlock());
        return;
      }
      const btn = h('button', { type: 'button', class: 'btn btn-primary btn-block btn-big' },
        `Pay ${formatMoney(payload.amt, 'NIM')}`) as HTMLButtonElement;
      btn.addEventListener('click', () => void doPayNim(btn));
      actionRegion.append(btn);
      noteRegion.append(
        h('p', { class: 'hint' },
          'Nimiq Pay will show a confirmation before anything is sent. Your reference code is attached to the payment so the organizer can match it.'),
      );
    } else {
      // USDT
      if (!hasEvmProvider()) {
        actionRegion.append(deeplinkBlock());
        return;
      }
      const btn = h('button', { type: 'button', class: 'btn btn-primary btn-block btn-big' },
        `Pay ${formatMoney(payload.amt, 'USDT')}`) as HTMLButtonElement;
      btn.addEventListener('click', () => void doPayUsdt(btn));
      actionRegion.append(btn);
      noteRegion.append(
        h('p', { class: 'hint' },
          'USDT runs on the Polygon network. You need a little POL for network fees. Nimiq Pay will ask for approval first.'),
      );
    }
  }

  async function doPayNim(btn: HTMLButtonElement): Promise<void> {
    if (initResult.status !== 'inside') return;
    phase = 'paying';
    btn.disabled = true;
    btn.textContent = 'Waiting for approval…';
    renderStatus();
    try {
      const result = await payNim(initResult.provider, payload.a, payload.amt, payload.ref);
      phase = 'paid';
      ownTxHash = result.txHash;
      recordPaid({ ref: payload.ref, splitId: payload.id, txHash: result.txHash, at: new Date().toISOString() });
      toast('Payment sent 🎉', 'success');
      renderStatus();
      renderActions();
      void cb.refreshWallet();
    } catch (error) {
      phase = 'idle';
      const friendly = friendlyError(error);
      toast(friendly.message, friendly.kind === 'cancelled' ? 'info' : 'error');
      btn.disabled = false;
      btn.textContent = `Pay ${formatMoney(payload.amt, 'NIM')}`;
      renderStatus();
    }
  }

  async function doPayUsdt(btn: HTMLButtonElement): Promise<void> {
    phase = 'paying';
    btn.disabled = true;
    btn.textContent = 'Connecting wallet…';
    renderStatus();
    try {
      let from = wallet.evmAddress ?? (await connectEvm());
      let chain = await evmChainId();
      if (chain !== POLYGON_CHAIN_ID) {
        btn.textContent = 'Switching to Polygon…';
        await switchToPolygon();
        chain = await evmChainId();
        if (chain !== POLYGON_CHAIN_ID) {
          throw new Error('Please switch your wallet to the Polygon network to pay in USDT.');
        }
      }
      btn.textContent = 'Waiting for approval…';
      const txHash = await payUsdt(from, payload.a, payload.amt);
      phase = 'paid';
      ownTxHash = txHash;
      recordPaid({ ref: payload.ref, splitId: payload.id, txHash, at: new Date().toISOString() });
      toast('Payment sent 🎉', 'success');
      renderStatus();
      renderActions();
      void cb.refreshWallet();
    } catch (error) {
      phase = 'idle';
      const friendly = friendlyError(error);
      toast(friendly.message, friendly.kind === 'cancelled' ? 'info' : 'error');
      btn.disabled = false;
      btn.textContent = `Pay ${formatMoney(payload.amt, 'USDT')}`;
      renderStatus();
    }
  }

  // --- static layout -------------------------------------------------------
  const backBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, '← My splits') as HTMLButtonElement;
  backBtn.addEventListener('click', cb.onBack);

  const roster = payload.all.map((name) =>
    h('li', { class: `roster-item ${name === payload.n ? 'roster-item-you' : ''}` },
      name, name === payload.n ? ' (you)' : ''));

  root.append(
    backBtn,
    h('p', { class: 'eyebrow' }, `${payload.o} is splitting a bill`),
    h('h2', { class: 'view-title' }, payload.t),
    h('div', { class: 'card pay-card' },
      h('div', { class: 'pay-share-label' }, `${payload.n}, your share is`),
      h('div', { class: 'pay-share-amount' }, formatMoney(payload.amt, payload.c)),
      h('div', { class: 'pay-share-meta' },
        `of ${formatMoney(payload.tot, payload.c)} total · ${payload.cnt} people`),
      statusRegion,
      actionRegion,
      noteRegion,
      isNim
        ? h('p', { class: 'muted small' }, `Paid to ${shortenNimiqAddress(payload.a)} · Ref ${payload.ref}`)
        : h('p', { class: 'muted small' }, `Paid to ${payload.a.slice(0, 6)}…${payload.a.slice(-4)} on Polygon · Ref ${payload.ref}`),
    ),
    h('div', { class: 'card' },
      h('h3', { class: 'section-title' }, 'Who is in this split'),
      h('ul', { class: 'roster' }, ...roster),
      paidRefsKnown !== null
        ? h('p', { class: 'muted small' }, `Progress on this device: ${paidRefsKnown} of ${payload.cnt} shares marked paid.`)
        : h('p', { class: 'muted small' },
            'Progress is tracked by the organizer — after paying, show them your confirmation so they can tick you off.'),
    ),
  );

  renderStatus();
  renderActions();
  return root;
}
