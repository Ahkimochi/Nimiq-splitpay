// Standalone-mode end-to-end smoke test (jsdom). Loads the BUILT app bundle
// with NO Nimiq provider injected and exercises the real app code: home
// render -> create flow (equal split, remainder handling) -> persistence ->
// pay-link decode -> pay view standalone state. Verifies the app works fully
// outside Nimiq Pay and never fakes a payment.
// Run: npm run build, then npm install --no-save jsdom && node scripts/smoke.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const bundleName = readdirSync(new URL('../dist/assets/', import.meta.url).pathname)
  .find((f) => f.endsWith('.js'));
const bundleCode = readFileSync(new URL(`../dist/assets/${bundleName}`, import.meta.url), 'utf8');

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

window.eval(bundleCode);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(400);

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};
const text = (sel) => document.querySelector(sel)?.textContent ?? '';

check('home renders brand', text('.brand-name').includes('Split'));
check('wallet card = Browser preview (standalone)', text('.wallet-title').includes('Browser preview'));
check('standalone badge shown', text('.net-badge').includes('Browser'));
check('empty state shown', text('.empty-state h3').includes('No splits'));

// Create flow
const createBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Create a split'));
createBtn.click();
await sleep(100);
check('create form opens', !!document.querySelector('#f-title'), window.location.hash);

const setVal = (sel, v) => {
  const el = document.querySelector(sel);
  el.value = v;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};
setVal('#f-title', 'Dinner at Warung Sari');
setVal('#f-organizer', 'Budi');
setVal('#f-total', '100');
setVal('#f-nim-address', 'NQ17 D2ES UBTP N14D RG4E 2KBK 217A 2GH2 NNY1');
const nameInputs = [...document.querySelectorAll('.participant-row input')]
  .filter((i) => !i.classList.contains('participant-amount'));
['Budi', 'Ani', 'Citra'].forEach((name, i) => {
  nameInputs[i].value = name;
  nameInputs[i].dispatchEvent(new window.Event('input', { bubbles: true }));
});
await sleep(50);
check('preview computes equal share with remainder', text('.form-preview').includes('33.33334'), text('.form-preview').trim());

const saveBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Create split'));
saveBtn.click();
await sleep(100);
const splits = JSON.parse(window.localStorage.getItem('splitpay.splits.v1') || '[]');
check('split persisted', splits.length === 1);
check('shares sum exactly to total (10,000,000 luna)',
  splits.length === 1 && splits[0].participants.reduce((a, p) => a + p.shareMinor, 0) === 10_000_000,
  splits.length ? JSON.stringify(splits[0].participants.map((p) => p.shareMinor)) : '');
check('navigated to split detail', window.location.hash.startsWith('#/split/'), window.location.hash);
check('detail view shows 3 participant cards', document.querySelectorAll('.participant-card').length === 3);

// Pay link for participant 2, payload shaped exactly as src/links.ts builds it.
const s = splits[0];
const payload = { v: 1, id: s.id, t: s.title, o: s.organizer, c: s.currency, a: s.nimAddress,
  tot: s.totalMinor, amt: s.participants[1].shareMinor, n: s.participants[1].name,
  ref: 'SPL-' + s.id.slice(0, 4).toUpperCase() + '-2', cnt: 3, all: s.participants.map((p) => p.name) };
const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
window.location.hash = '#/pay/' + encoded;
await sleep(150);
check('pay view decodes link and shows share', text('.pay-share-amount').includes('33.33333'), text('.pay-share-amount').trim());
check('pay view standalone offers Nimiq Pay deeplink (no fake payment)',
  [...document.querySelectorAll('.pay-actions a')].some((a) => (a.getAttribute('href') || '').includes('nimpay.app/miniapps/open/')));
check('pay view shows no wallet pay button in standalone',
  document.querySelectorAll('.pay-actions button').length === 0);
check('no runtime errors', errors.length === 0, errors.join(' | '));

window.close();
process.exit(failures || errors.length ? 1 : 0);
