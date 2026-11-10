// "My Splits" list item.

import { h } from '../ui';
import { formatMoney } from '../money';
import type { Split } from '../types';

export function collectedMinor(split: Split): number {
  return split.participants.filter((p) => p.paid).reduce((sum, p) => sum + p.shareMinor, 0);
}

export function renderSplitCard(split: Split, onOpen: (id: string) => void): HTMLElement {
  const paidCount = split.participants.filter((p) => p.paid).length;
  const totalCount = split.participants.length;
  const collected = collectedMinor(split);
  const settled = paidCount === totalCount;

  const card = h('article', { class: 'card split-card' });
  const open = () => onOpen(split.id);
  card.addEventListener('click', open);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open split ${split.title}`);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });

  const pct = totalCount === 0 ? 0 : Math.round((paidCount / totalCount) * 100);
  card.append(
    h('div', { class: 'split-card-head' },
      h('h3', { class: 'split-card-title' }, split.title),
      h('span', { class: `badge ${settled ? 'badge-done' : 'badge-open'}` },
        settled ? 'Settled ✓' : `${paidCount}/${totalCount} paid`),
    ),
    h('div', { class: 'split-card-meta' },
      `${formatMoney(split.totalMinor, split.currency)} · organized by ${split.organizer}`),
    h('div', { class: 'progress', 'aria-hidden': 'true' },
      h('div', { class: 'progress-bar', style: `width:${pct}%` })),
    h('div', { class: 'split-card-foot' },
      h('span', {}, `Collected ${formatMoney(collected, split.currency)}`),
      h('span', { class: 'muted' }, `Outstanding ${formatMoney(split.totalMinor - collected, split.currency)}`),
    ),
  );
  return card;
}
