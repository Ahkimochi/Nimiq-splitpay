// Create-a-split form. Returns the form element; calls onCreate with a
// validated Split when the user saves.

import { h, toast } from '../ui';
import { equalShares, formatMoney, parseAmountToMinor } from '../money';
import { isValidEvmAddress, isValidNimiqAddress, normalizeNimiqAddress } from '../validate';
import { newSplitId } from '../store';
import type { Currency, Participant, Split, WalletState } from '../types';

interface ParticipantRow {
  name: HTMLInputElement;
  amount: HTMLInputElement;
  row: HTMLElement;
}

export function renderCreateForm(
  wallet: WalletState,
  onCreate: (split: Split) => void,
  onCancel: () => void,
): HTMLElement {
  let currency: Currency = 'NIM';
  let mode: 'equal' | 'custom' = 'equal';
  const rows: ParticipantRow[] = [];

  const root = h('section', { class: 'view' });

  // --- basic fields -------------------------------------------------------
  const titleInput = h('input', {
    class: 'input', type: 'text', id: 'f-title', maxlength: '80',
    placeholder: 'Dinner at Warung Sari', autocomplete: 'off',
  }) as HTMLInputElement;
  const organizerInput = h('input', {
    class: 'input', type: 'text', id: 'f-organizer', maxlength: '40',
    placeholder: 'Your name', autocomplete: 'off',
  }) as HTMLInputElement;
  const totalInput = h('input', {
    class: 'input', type: 'text', id: 'f-total', inputmode: 'decimal',
    placeholder: '0.00', autocomplete: 'off',
  }) as HTMLInputElement;
  const tipSelect = h('select', { class: 'input', id: 'f-tip' },
    h('option', { value: '0' }, 'No tip'),
    h('option', { value: '5' }, 'Tip 5%'),
    h('option', { value: '10' }, 'Tip 10%'),
    h('option', { value: '15' }, 'Tip 15%'),
    h('option', { value: '20' }, 'Tip 20%'),
  ) as HTMLSelectElement;

  const nimAddressInput = h('input', {
    class: 'input mono', type: 'text', id: 'f-nim-address', maxlength: '60',
    placeholder: 'NQ…', autocomplete: 'off', spellcheck: 'false',
  }) as HTMLInputElement;
  if (wallet.nimAddress) nimAddressInput.value = wallet.nimAddress;

  const evmAddressInput = h('input', {
    class: 'input mono', type: 'text', id: 'f-evm-address', maxlength: '50',
    placeholder: '0x…', autocomplete: 'off', spellcheck: 'false',
  }) as HTMLInputElement;
  if (wallet.evmAddress) evmAddressInput.value = wallet.evmAddress;

  const nimAddressField = h('div', { class: 'field' },
    h('label', { class: 'label', for: 'f-nim-address' }, 'Your Nimiq address (receives the NIM)'),
    nimAddressInput,
    h('p', { class: 'hint' }, 'Auto-filled from Nimiq Pay when connected. Everyone pays their share to this address.'),
  );
  const evmAddressField = h('div', { class: 'field' },
    h('label', { class: 'label', for: 'f-evm-address' }, 'Your Polygon address (receives the USDT)'),
    evmAddressInput,
    h('p', { class: 'hint' }, 'USDT runs on Polygon. Auto-filled after you connect your EVM address.'),
  );
  evmAddressField.style.display = 'none';

  // --- currency toggle ----------------------------------------------------
  const nimBtn = h('button', { type: 'button', class: 'seg-btn seg-btn-active' }, 'NIM') as HTMLButtonElement;
  const usdtBtn = h('button', { type: 'button', class: 'seg-btn' }, 'USDT') as HTMLButtonElement;
  const setCurrency = (next: Currency) => {
    currency = next;
    nimBtn.classList.toggle('seg-btn-active', next === 'NIM');
    usdtBtn.classList.toggle('seg-btn-active', next === 'USDT');
    nimAddressField.style.display = next === 'NIM' ? '' : 'none';
    evmAddressField.style.display = next === 'USDT' ? '' : 'none';
    refreshPreview();
  };
  nimBtn.addEventListener('click', () => setCurrency('NIM'));
  usdtBtn.addEventListener('click', () => setCurrency('USDT'));

  // --- mode toggle ----------------------------------------------------------
  const equalBtn = h('button', { type: 'button', class: 'seg-btn seg-btn-active' }, 'Split equally') as HTMLButtonElement;
  const customBtn = h('button', { type: 'button', class: 'seg-btn' }, 'Custom amounts') as HTMLButtonElement;
  const setMode = (next: 'equal' | 'custom') => {
    mode = next;
    equalBtn.classList.toggle('seg-btn-active', next === 'equal');
    customBtn.classList.toggle('seg-btn-active', next === 'custom');
    rows.forEach((r) => {
      r.amount.style.display = next === 'custom' ? '' : 'none';
    });
    refreshPreview();
  };
  equalBtn.addEventListener('click', () => setMode('equal'));
  customBtn.addEventListener('click', () => setMode('custom'));

  // --- participants ---------------------------------------------------------
  const rowsContainer = h('div', { class: 'participant-rows' });

  const addRow = (name = '') => {
    const nameInput = h('input', {
      class: 'input', type: 'text', maxlength: '40', placeholder: 'Name',
      'aria-label': 'Participant name', autocomplete: 'off',
    }) as HTMLInputElement;
    nameInput.value = name;
    const amountInput = h('input', {
      class: 'input participant-amount', type: 'text', inputmode: 'decimal',
      placeholder: '0.00', 'aria-label': 'Custom amount', autocomplete: 'off',
    }) as HTMLInputElement;
    amountInput.style.display = 'none';
    const removeBtn = h('button', {
      type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Remove participant',
    }, '✕') as HTMLButtonElement;
    const row = h('div', { class: 'participant-row' }, nameInput, amountInput, removeBtn);
    const entry: ParticipantRow = { name: nameInput, amount: amountInput, row };
    removeBtn.addEventListener('click', () => {
      const idx = rows.indexOf(entry);
      if (idx >= 0) rows.splice(idx, 1);
      row.remove();
      refreshPreview();
    });
    nameInput.addEventListener('input', refreshPreview);
    amountInput.addEventListener('input', refreshPreview);
    rows.push(entry);
    rowsContainer.append(row);
  };
  addRow('You');
  addRow('');
  addRow('');

  const addBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, '+ Add person') as HTMLButtonElement;
  addBtn.addEventListener('click', () => {
    addRow('');
    const last = rows[rows.length - 1];
    last?.name.focus();
  });

  // --- summary / preview ------------------------------------------------------
  const preview = h('p', { class: 'form-preview muted', role: 'status' });
  const errorBox = h('p', { class: 'form-error', role: 'alert' });
  errorBox.style.display = 'none';

  function effectiveTotalMinor(): number | null {
    const base = parseAmountToMinor(totalInput.value, currency);
    if (base === null || base <= 0) return null;
    const tip = Number(tipSelect.value) || 0;
    return Math.round((base * (100 + tip)) / 100);
  }

  function refreshPreview(): void {
    const named = rows.filter((r) => r.name.value.trim().length > 0);
    const total = effectiveTotalMinor();
    if (total === null || named.length === 0) {
      preview.textContent = named.length === 0
        ? 'Add at least one person to split with.'
        : 'Enter the bill total to see the shares.';
      return;
    }
    if (mode === 'equal') {
      const shares = equalShares(total, named.length);
      preview.textContent = `${named.length} people · ${formatMoney(shares[0]!, currency)} each` +
        (shares.some((s) => s !== shares[0]) ? ' (rounded fairly)' : '') +
        ` · Total ${formatMoney(total, currency)}`;
    } else {
      preview.textContent = `Total ${formatMoney(total, currency)} — custom amounts must add up to it exactly.`;
    }
  }
  totalInput.addEventListener('input', refreshPreview);
  tipSelect.addEventListener('change', refreshPreview);

  function showError(message: string): void {
    errorBox.textContent = message;
    errorBox.style.display = '';
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // --- actions ------------------------------------------------------------------
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary btn-block' },
    'Create split & get pay links') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => {
    errorBox.style.display = 'none';
    const title = titleInput.value.trim();
    if (!title) return showError('Give the bill a title, e.g. “Dinner at Warung Sari”.');
    const organizer = organizerInput.value.trim();
    if (!organizer) return showError('Add your name so friends know who organized this split.');
    const total = effectiveTotalMinor();
    if (total === null) return showError(`Enter a valid total amount in ${currency}.`);

    let nimAddress: string | undefined;
    let evmAddress: string | undefined;
    if (currency === 'NIM') {
      const raw = nimAddressInput.value.trim();
      if (!isValidNimiqAddress(raw)) {
        return showError('The receiving Nimiq address is not valid. Check it for typos — payments go to this address.');
      }
      nimAddress = normalizeNimiqAddress(raw);
    } else {
      const raw = evmAddressInput.value.trim();
      if (!isValidEvmAddress(raw)) {
        return showError('The receiving Polygon address is not valid. It should start with 0x and be 42 characters.');
      }
      evmAddress = raw;
    }

    const named = rows.filter((r) => r.name.value.trim().length > 0);
    if (named.length === 0) return showError('Add at least one person to split with.');
    const names = named.map((r) => r.name.value.trim());
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      return showError(`“${duplicates[0]}” appears twice. Give everyone a unique name so their pay links stay personal.`);
    }

    let shareMinors: number[];
    if (mode === 'equal') {
      shareMinors = equalShares(total, named.length);
    } else {
      shareMinors = [];
      for (const entry of named) {
        const parsed = parseAmountToMinor(entry.amount.value, currency);
        if (parsed === null || parsed <= 0) {
          return showError(`Enter a valid amount for ${entry.name.value.trim()}.`);
        }
        shareMinors.push(parsed);
      }
      const sum = shareMinors.reduce((a, b) => a + b, 0);
      if (sum !== total) {
        return showError(
          `Custom amounts add up to ${formatMoney(sum, currency)}, but the total is ${formatMoney(total, currency)}. ` +
          (sum < total ? `You are missing ${formatMoney(total - sum, currency)}.` : `That is ${formatMoney(sum - total, currency)} too much.`));
      }
    }

    const participants: Participant[] = named.map((_entry, i) => ({
      id: `${i}`,
      name: names[i]!,
      shareMinor: shareMinors[i]!,
      paid: false,
    }));
    const split: Split = {
      id: newSplitId(),
      title,
      organizer,
      currency,
      nimAddress,
      evmAddress,
      totalMinor: total,
      tipPercent: Number(tipSelect.value) || 0,
      mode,
      participants,
      createdAt: new Date().toISOString(),
    };
    toast('Split created 🎉', 'success');
    onCreate(split);
  });

  const cancelBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancel') as HTMLButtonElement;
  cancelBtn.addEventListener('click', onCancel);

  root.append(
    h('h2', { class: 'view-title' }, 'Split a bill'),
    h('div', { class: 'field' },
      h('label', { class: 'label', for: 'f-title' }, 'What is this bill for?'),
      titleInput),
    h('div', { class: 'field-row' },
      h('div', { class: 'field' },
        h('label', { class: 'label', for: 'f-total' }, 'Total amount'),
        totalInput),
      h('div', { class: 'field' },
        h('label', { class: 'label' }, 'Currency'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Currency' }, nimBtn, usdtBtn)),
    ),
    h('div', { class: 'field' },
      h('label', { class: 'label', for: 'f-tip' }, 'Tip'),
      tipSelect,
      h('p', { class: 'hint' }, 'The tip is added on top of the total before splitting.')),
    h('div', { class: 'field' },
      h('label', { class: 'label', for: 'f-organizer' }, 'Your name (organizer)'),
      organizerInput),
    nimAddressField,
    evmAddressField,
    h('div', { class: 'field' },
      h('label', { class: 'label' }, 'Who is splitting?'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Split mode' }, equalBtn, customBtn),
      rowsContainer,
      addBtn,
      h('p', { class: 'hint' }, 'Tip: include yourself if you also owe a share. Everyone gets their own personal pay link.')),
    preview,
    errorBox,
    h('div', { class: 'form-actions' }, cancelBtn, saveBtn),
  );

  refreshPreview();
  return root;
}
