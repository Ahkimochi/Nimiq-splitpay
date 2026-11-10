// Organizer detail view for one split: per-participant pay links + status,
// manual mark-as-paid, clone ("split again") and delete.

import { h, toast, copyText, shareNative } from '../ui';
import { formatMoney } from '../money';
import { shareUrl } from '../links';
import { collectedMinor } from './splitList';
import type { Split } from '../types';

export interface DetailCallbacks {
  onTogglePaid: (split: Split, participantId: string) => void;
  onClone: (split: Split) => void;
  onDelete: (split: Split) => void;
  onBack: () => void;
}

export function renderSplitDetail(split: Split, cb: DetailCallbacks): HTMLElement {
  const root = h('section', { class: 'view' });
  const collected = collectedMinor(split);
  const paidCount = split.participants.filter((p) => p.paid).length;

  const recipient = split.currency === 'NIM' ? split.nimAddress : split.evmAddress;

  const rows = split.participants.map((participant, index) => {
    const url = shareUrl(split, index);

    const copyBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-small' }, 'Copy link') as HTMLButtonElement;
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(url);
      toast(ok ? `Pay link for ${participant.name} copied` : 'Copy failed — long-press the link to copy it.', ok ? 'success' : 'error');
    });

    const shareBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-small' }, 'Share') as HTMLButtonElement;
    shareBtn.addEventListener('click', async () => {
      const shared = await shareNative({
        title: 'SplitPay',
        text: `Hi ${participant.name}, your share of “${split.title}” is ${formatMoney(participant.shareMinor, split.currency)}. Pay it here:`,
        url,
      });
      if (!shared) {
        const ok = await copyText(url);
        toast(ok ? 'Share not available — link copied instead' : 'Could not share or copy the link.', ok ? 'info' : 'error');
      }
    });

    const toggleBtn = h('button', {
      type: 'button',
      class: `btn btn-small ${participant.paid ? 'btn-ghost' : 'btn-secondary'}`,
    }, participant.paid ? 'Mark unpaid' : 'Mark as paid') as HTMLButtonElement;
    toggleBtn.addEventListener('click', () => cb.onTogglePaid(split, participant.id));

    const status = participant.paid
      ? h('span', { class: 'status status-paid' },
          participant.paidVia === 'wallet' ? 'Paid via wallet ✓' : 'Paid ✓ (marked)')
      : h('span', { class: 'status status-open' }, 'Waiting to pay');

    return h('li', { class: 'participant-card' },
      h('div', { class: 'participant-head' },
        h('span', { class: 'participant-name' }, participant.name),
        h('span', { class: 'participant-amount' }, formatMoney(participant.shareMinor, split.currency)),
      ),
      h('div', { class: 'participant-row-between' }, status,
        participant.txHash ? h('span', { class: 'mono muted small' }, `${participant.txHash.slice(0, 10)}…`) : h('span', {})),
      h('div', { class: 'participant-actions' }, copyBtn, shareBtn, toggleBtn),
    );
  });

  const cloneBtn = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Split again (clone)') as HTMLButtonElement;
  cloneBtn.addEventListener('click', () => cb.onClone(split));

  const deleteBtn = h('button', { type: 'button', class: 'btn btn-danger-ghost' }, 'Delete split') as HTMLButtonElement;
  deleteBtn.addEventListener('click', () => {
    if (window.confirm(`Delete “${split.title}”? The pay links for this split will stop matching your list.`)) {
      cb.onDelete(split);
    }
  });

  const backBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, '← All splits') as HTMLButtonElement;
  backBtn.addEventListener('click', cb.onBack);

  root.append(
    backBtn,
    h('h2', { class: 'view-title' }, split.title),
    h('p', { class: 'muted' },
      `Total ${formatMoney(split.totalMinor, split.currency)}` +
      (split.tipPercent > 0 ? ` (incl. ${split.tipPercent}% tip)` : '') +
      ` · ${split.participants.length} people · organized by ${split.organizer}`),
    h('p', { class: 'muted small' }, `Payments go to ${recipient ?? ''}`),
    h('div', { class: 'summary-card card' },
      h('div', { class: 'summary-item' },
        h('span', { class: 'summary-label' }, 'Collected'),
        h('span', { class: 'summary-value' }, formatMoney(collected, split.currency))),
      h('div', { class: 'summary-item' },
        h('span', { class: 'summary-label' }, 'Outstanding'),
        h('span', { class: 'summary-value' }, formatMoney(split.totalMinor - collected, split.currency))),
      h('div', { class: 'summary-item' },
        h('span', { class: 'summary-label' }, 'Paid'),
        h('span', { class: 'summary-value' }, `${paidCount} of ${split.participants.length}`)),
    ),
    h('h3', { class: 'section-title' }, 'Pay links — send each person their own'),
    h('ul', { class: 'participant-list' }, ...rows),
    h('p', { class: 'hint' },
      'When someone pays through their link inside Nimiq Pay, ask them to show you the confirmation — or just mark them as paid here. Statuses live on this device.'),
    h('div', { class: 'form-actions' }, deleteBtn, cloneBtn),
  );
  return root;
}
