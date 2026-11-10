// SplitPay — app entry, hash router, wallet bootstrap.

import './style.css';
import { h, clear, toast } from './ui';
import {
  initWallet,
  readAccount,
  onAccountsChanged,
  hostNetwork,
  connectEvm,
  friendlyError,
  type InitResult,
} from './wallet';
import {
  loadSplits,
  upsertSplit,
  deleteSplit as storeDeleteSplit,
  newSplitId,
} from './store';
import { decodeSharePayload, freshSuffix } from './links';
import { renderWalletCard } from './views/home';
import { renderSplitCard } from './views/splitList';
import { renderCreateForm } from './views/create';
import { renderSplitDetail } from './views/detail';
import { renderPayView } from './views/pay';
import type { Split, WalletState } from './types';

const app = document.getElementById('app');
if (!app) throw new Error('Missing #app element');

const wallet: WalletState = {
  kind: 'standalone',
  network: hostNetwork(),
};

let initResult: InitResult = { status: 'standalone' };
let evmBusy = false;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'split'; id: string }
  | { name: 'pay'; encoded: string }
  | { name: 'notfound' };

function parseRoute(): Route {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '#') return { name: 'home' };
  if (hash === '#/create') return { name: 'create' };
  const splitMatch = hash.match(/^#\/split\/([a-z0-9]+)$/i);
  if (splitMatch) return { name: 'split', id: splitMatch[1]! };
  const payMatch = hash.match(/^#\/pay\/([A-Za-z0-9_-]+)$/);
  if (payMatch) return { name: 'pay', encoded: payMatch[1]! };
  return { name: 'notfound' };
}

function navigate(hash: string): void {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------------------------------------------------------------------------
// Wallet bootstrap
// ---------------------------------------------------------------------------

async function refreshWallet(): Promise<void> {
  if (initResult.status !== 'inside') return;
  try {
    const info = await readAccount(initResult.provider);
    wallet.nimAddress = info.walletAddress;
    wallet.nimBalanceLuna = info.balanceLuna;
  } catch {
    // Keep whatever state we have; the header shows a generic connected state.
  }
  if (parseRoute().name === 'home') render();
}

async function bootstrapWallet(): Promise<void> {
  initResult = await initWallet();
  if (initResult.status === 'inside') {
    wallet.kind = 'inside';
    wallet.network = hostNetwork();
    onAccountsChanged(initResult.provider, () => void refreshWallet());
    await refreshWallet();
  }
  render();
}

async function handleConnectEvm(): Promise<void> {
  evmBusy = true;
  render();
  try {
    wallet.evmAddress = await connectEvm();
    toast('EVM address connected for USDT splits', 'success');
  } catch (error) {
    const friendly = friendlyError(error);
    toast(friendly.message, friendly.kind === 'cancelled' ? 'info' : 'error');
  } finally {
    evmBusy = false;
    render();
  }
}

// ---------------------------------------------------------------------------
// Split actions
// ---------------------------------------------------------------------------

function handleCreate(split: Split): void {
  upsertSplit(split);
  navigate(`#/split/${split.id}`);
}

function handleTogglePaid(split: Split, participantId: string): void {
  const splits = loadSplits();
  const target = splits.find((s) => s.id === split.id);
  if (!target) return;
  const participant = target.participants.find((p) => p.id === participantId);
  if (!participant) return;
  participant.paid = !participant.paid;
  participant.paidVia = participant.paid ? 'manual' : undefined;
  participant.paidAt = participant.paid ? new Date().toISOString() : undefined;
  participant.txHash = participant.paid ? participant.txHash : undefined;
  upsertSplit(target);
  render();
}

function handleClone(split: Split): void {
  const clone: Split = {
    ...split,
    id: `${newSplitId()}${freshSuffix()}`.slice(0, 11),
    title: split.title,
    participants: split.participants.map((p) => ({
      ...p,
      paid: false,
      paidVia: undefined,
      txHash: undefined,
      paidAt: undefined,
    })),
    createdAt: new Date().toISOString(),
  };
  upsertSplit(clone);
  toast('Cloned — a fresh copy with all shares unpaid', 'success');
  navigate(`#/split/${clone.id}`);
}

function handleDelete(split: Split): void {
  storeDeleteSplit(split.id);
  toast('Split deleted', 'info');
  navigate('#/');
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function renderHeader(): HTMLElement {
  return h('header', { class: 'app-header' },
    h('a', { class: 'brand', href: '#/' },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '◐'),
      h('span', { class: 'brand-name' }, 'Split', h('span', { class: 'brand-accent' }, 'Pay')),
    ),
    wallet.kind === 'inside'
      ? h('span', { class: 'net-badge' }, wallet.network === 'testnet' ? 'Nimiq Testnet' : 'Nimiq Pay')
      : h('span', { class: 'net-badge net-badge-off' }, 'Browser preview'),
  );
}

function renderFooter(): HTMLElement {
  return h('footer', { class: 'app-footer' },
    h('p', {}, 'SplitPay splits bills in NIM & USDT. Payments are made by your Nimiq Pay wallet — SplitPay never sees your keys.'),
    h('p', { class: 'muted small' }, 'Splits are stored only on this device. Pay links contain the bill details, so treat them like the bill itself.'),
  );
}

function renderHome(main: HTMLElement): void {
  const splits = loadSplits();
  main.append(renderWalletCard(wallet, { onConnectEvm: () => void handleConnectEvm(), evmBusy }));

  const createBtn = h('button', { type: 'button', class: 'btn btn-primary btn-block' },
    '+ Create a split') as HTMLButtonElement;
  createBtn.addEventListener('click', () => navigate('#/create'));
  main.append(createBtn);

  main.append(h('h2', { class: 'section-title splits-heading' }, 'My splits'));
  if (splits.length === 0) {
    main.append(
      h('div', { class: 'card empty-state' },
        h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, '🧾'),
        h('h3', {}, 'No splits yet'),
        h('p', { class: 'muted' },
          'Split a dinner, a taxi, or the rent. Everyone gets a personal pay link and pays their share in one tap.'),
      ),
    );
    return;
  }
  const list = h('div', { class: 'split-list' });
  for (const split of splits) {
    list.append(renderSplitCard(split, (id) => navigate(`#/split/${id}`)));
  }
  main.append(list);
}

function render(): void {
  if (!app) return;
  clear(app);
  const route = parseRoute();
  const main = h('main', { class: 'app-main', id: 'main' });
  app.append(renderHeader(), main, renderFooter());

  switch (route.name) {
    case 'home':
      renderHome(main);
      break;
    case 'create':
      main.append(renderCreateForm(wallet, handleCreate, () => navigate('#/')));
      break;
    case 'split': {
      const split = loadSplits().find((s) => s.id === route.id);
      if (!split) {
        main.append(
          h('div', { class: 'card empty-state' },
            h('h3', {}, 'Split not found'),
            h('p', { class: 'muted' },
              'This split is not stored on this device. Splits live in this browser only — open SplitPay on the device where you created it.'),
            (() => {
              const b = h('button', { type: 'button', class: 'btn btn-primary' }, 'Go to my splits') as HTMLButtonElement;
              b.addEventListener('click', () => navigate('#/'));
              return b;
            })(),
          ),
        );
        break;
      }
      main.append(renderSplitDetail(split, {
        onTogglePaid: handleTogglePaid,
        onClone: handleClone,
        onDelete: handleDelete,
        onBack: () => navigate('#/'),
      }));
      break;
    }
    case 'pay': {
      const payload = decodeSharePayload(route.encoded);
      if (!payload) {
        main.append(
          h('div', { class: 'card empty-state' },
            h('h3', {}, 'This pay link looks broken'),
            h('p', { class: 'muted' },
              'The link may have been cut off while sharing. Ask the organizer to copy and send it again.'),
            (() => {
              const b = h('button', { type: 'button', class: 'btn btn-primary' }, 'Go to my splits') as HTMLButtonElement;
              b.addEventListener('click', () => navigate('#/'));
              return b;
            })(),
          ),
        );
        break;
      }
      main.append(renderPayView(payload, wallet, initResult, {
        onBack: () => navigate('#/'),
        refreshWallet,
      }));
      break;
    }
    default:
      main.append(
        h('div', { class: 'card empty-state' },
          h('h3', {}, 'Page not found'),
          h('p', { class: 'muted' }, 'This address does not match any SplitPay page.'),
        ),
      );
  }
  window.scrollTo({ top: 0 });
}

// First paint immediately (standalone-capable), then upgrade with wallet state.
render();
window.addEventListener('hashchange', render);
void bootstrapWallet();
