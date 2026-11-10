// Home view: wallet status card ("My Splits" is the main content).

import { h } from '../ui';
import { formatMinor } from '../money';
import { shortenNimiqAddress, shortenEvmAddress } from '../validate';
import type { WalletState } from '../types';

export interface HomeCallbacks {
  onConnectEvm: () => void;
  evmBusy: boolean;
}

export function renderWalletCard(state: WalletState, cb: HomeCallbacks): HTMLElement {
  const card = h('section', { class: 'card wallet-card', 'aria-label': 'Wallet status' });

  if (state.kind === 'inside') {
    const rows: Node[] = [
      h('div', { class: 'wallet-dot wallet-dot-on', 'aria-hidden': 'true' }),
      h('div', { class: 'wallet-main' },
        h('div', { class: 'wallet-title' }, 'Connected to Nimiq Pay'),
        h('div', { class: 'wallet-sub' },
          state.nimAddress ? shortenNimiqAddress(state.nimAddress) : 'Account loading…',
          state.network === 'testnet' ? ' · Testnet' : '',
        ),
      ),
    ];
    if (state.nimBalanceLuna !== undefined) {
      rows.push(
        h('div', { class: 'wallet-balance' },
          h('span', { class: 'wallet-balance-amount' }, formatMinor(state.nimBalanceLuna, 'NIM')),
          h('span', { class: 'wallet-balance-unit' }, 'NIM'),
        ),
      );
    }
    card.append(h('div', { class: 'wallet-row' }, ...rows));

    if (state.evmAddress) {
      card.append(
        h('p', { class: 'wallet-note' }, `USDT (Polygon): ${shortenEvmAddress(state.evmAddress)}`),
      );
    } else {
      const btn = h('button', { class: 'btn btn-ghost btn-small', type: 'button' },
        cb.evmBusy ? 'Connecting…' : 'Connect EVM address (for USDT splits)') as HTMLButtonElement;
      btn.disabled = cb.evmBusy;
      btn.addEventListener('click', cb.onConnectEvm);
      card.append(h('div', { class: 'wallet-actions' }, btn));
    }
  } else {
    card.append(
      h('div', { class: 'wallet-row' },
        h('div', { class: 'wallet-dot wallet-dot-off', 'aria-hidden': 'true' }),
        h('div', { class: 'wallet-main' },
          h('div', { class: 'wallet-title' }, 'Browser preview'),
          h('div', { class: 'wallet-sub' },
            'You can create and share splits here. To pay a share, open the link inside Nimiq Pay.'),
        ),
      ),
    );
  }
  return card;
}
