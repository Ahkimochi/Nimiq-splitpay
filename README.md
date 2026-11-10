# SplitPay — split any bill with friends in NIM (and USDT)

**SplitPay** is a Nimiq Pay Mini App that turns bill splitting into a one-tap
payment. The organizer creates a split (dinner, taxi, rent, a group gift…),
every participant gets their own **personal pay link**, and each link opens a
pay page where the exact share is paid to the organizer in one tap inside
Nimiq Pay — with the share's reference code attached to the transaction so the
organizer can match every payment.

Built for the **Nimiq Mini Apps Competition, Cycle III** — Category: **Pay**.

- NIM is the primary currency (native Nimiq payments via the Mini App SDK).
- USDT on Polygon is supported as a second currency via the standard EIP-1193
  provider (`window.ethereum`).
- **No backend, no accounts, no tracking.** Split data lives in the links
  themselves and in the organizer's browser (`localStorage`).

## Features

- **Wallet status on load** — inside Nimiq Pay the app shows the connected
  account and the spendable NIM balance. Nimiq Pay keeps spendable NIM in an
  HTLC: `listAccounts()` returns `[walletAddress, htlcAddress?]`, and the
  balance shown is `getBalance(htlcAddress)` (falling back to the wallet
  address when there is no HTLC).
- **Create a split** — title, total, currency toggle (NIM / USDT), optional
  tip (0/5/10/15/20 %, added on top of the total), organizer name, receiving
  address (auto-filled from the connected account, editable, and validated —
  the Nimiq address checksum is verified, not just the shape).
- **Equal or custom shares** — equal shares distribute the rounding remainder
  one Luna at a time so shares always sum *exactly* to the total; custom
  amounts must sum exactly to the total and the form shows the
  missing/excess amount when they don't. All amounts are handled as integer
  minor units (NIM: 5 decimals, USDT: 6) — no floating-point drift.
- **Personal pay links** — `#/pay/<base64url-json>` encodes the split id,
  title, organizer, currency, recipient address, total, that participant's
  share, the full roster, and a reference code (`SPL-XXXX-N`). Copy button and
  native share sheet (with copy fallback).
- **One-tap pay page** — big share amount, bill total, organizer, roster, and
  progress (live when the split exists on the same device; otherwise an honest
  note that the organizer tracks it). The Pay button triggers a real wallet
  payment; success shows the transaction hash with an explorer link matching
  the host network. Cancellations and errors are explained in plain language.
- **Organizer tools** — "My Splits" list, per-participant status, manual
  mark-as-paid (e.g. someone paid cash), collected vs. outstanding summary,
  clone ("Split again") for repeat bills, and delete (with confirmation).
  Splits persist on the device.
- **Honest standalone mode** — opened in a regular browser, everything except
  paying works identically, and pay actions offer "Open in Nimiq Pay"
  deeplinks instead of a payment button. SplitPay never simulates a payment.

## How it integrates Nimiq Pay

All payment code is against the **real** `@nimiq/mini-app-sdk@0.2.5` API,
verified before coding from the package's own TypeScript definitions
(`dist/index.d.ts`, `dist/provider.d.ts`) and the official docs at
[nimiq.dev/mini-apps](https://nimiq.dev/mini-apps) (API reference and the
EVM-tokens guide). The exact calls used:

| Purpose | Call |
| --- | --- |
| Initialize | `init({ timeout })` from `@nimiq/mini-app-sdk` → `Promise<NimiqProvider>` (polls for `window.nimiq`, rejects when not injected) |
| Host network | `getHostNetwork()` → `'mainnet' \| 'testnet' \| undefined` |
| Account | `provider.listAccounts()` → `[walletAddress, htlcAddress?]` |
| Balance | `provider.getBalance(address)` → Luna (100,000 Luna = 1 NIM) |
| Pay a NIM share | `provider.sendBasicTransactionWithData({ recipient, value /* Luna */, data })` — `data` is `"SplitPay <reference>"`, always within the 64-byte limit; falls back to `provider.sendBasicTransaction({ recipient, value })` |
| Account changes | `provider.on('accountsChanged', …)` (the HTLC is replaced periodically) |
| Errors | rejections are `NimiqProviderError` — `PERMISSION_DENIED` (4001) is shown as a cancellation, `INVALID_TRANSACTION` (−32602), `NETWORK_ERROR` (−32000), `UNKNOWN_REQUEST` (4200) each get a specific message |

**USDT path** (per [nimiq.dev/mini-apps/features/evm-tokens](https://nimiq.dev/mini-apps/features/evm-tokens)):
standard EIP-1193 `window.ethereum` — `eth_requestAccounts`,
`eth_chainId` / `wallet_switchEthereumChain` to Polygon (`0x89`), then an
ERC-20 `transfer(address, uint256)` to the organizer via
`eth_sendTransaction` against the USDT contract on Polygon
(`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, 6 decimals). The `transfer`
calldata is ABI-encoded in ~10 lines, so the app needs no extra dependencies.
Note: mini-app EVM transactions use standard gas, so the payer needs a little
POL for network fees (the pay page says so).

**Deeplinks** (standalone mode): `nimiqpay://miniapp?url=<host>` and
`https://nimpay.app/miniapps/open/<host>`, per the official docs.

**Explorer links**: NIM payments link to `https://nimiq.watch/#<txHash>`
(mainnet) / `https://testnet.nimiq.watch/#<txHash>` (testnet); USDT payments
link to `https://polygonscan.com/tx/<txHash>`.

## Run locally

```bash
npm install
npm run dev        # Vite dev server
npm run build      # type-check (tsc --noEmit) + production build into dist/
npm run preview    # serve the production build
```

In a plain browser you get the standalone mode described above. To test real
payments, host the built app (or the dev server) and open it as a mini app
inside Nimiq Pay.

Optional end-to-end smoke test of the built bundle in standalone mode
(home → create → persistence → pay-link decode → pay view):

```bash
npm run build
npm install --no-save jsdom && node scripts/smoke.mjs
```

## Deploy (GitHub Pages)

The Vite config uses a relative base (`base: './'`), so the build works at
any path — a GitHub Pages project site (`/<repo>/`), a custom domain root, or
the URL Nimiq Pay loads the mini app from.

1. `npm run build`
2. Publish the `dist/` folder with GitHub Pages (Settings → Pages → deploy
   from a branch/folder, or a `gh-pages` workflow that uploads `dist/`).
3. Open the live URL once in a browser to sanity-check standalone mode, then
   open it inside Nimiq Pay to test a real payment on testnet first.

## Architecture

- **Stack**: Vite 6 + TypeScript (vanilla DOM, no framework) +
  `@nimiq/mini-app-sdk`. Production bundle ≈ 44 kB JS (14.5 kB gzip) + 9 kB CSS.
- **No backend**: a split is just data. The organizer's copy lives in
  `localStorage` (`splitpay.splits.v1`); each pay link carries its own copy of
  the share data in the URL hash, so links work on any device with no server
  and no sign-up. Payments a participant makes are remembered on their device
  (`splitpay.paid.v1`) and, when the split also lives on that device, the
  organizer's copy is updated too.
- **Consequence, stated honestly**: payment status does not sync across
  devices — there is no server to sync through. The organizer confirms
  payments from the wallet (each carries its `SPL-…` reference) or marks them
  paid manually. This is deliberate: zero infrastructure, zero data leaving
  the device, and links that keep working forever.
- **Code layout**: `src/wallet.ts` (all Nimiq/EVM integration),
  `src/money.ts` (integer-minor-unit math), `src/validate.ts` (Nimiq checksum
  + EVM address validation — the checksum algorithm is copied from the
  official `@nimiq/utils` package), `src/links.ts` (pay-link encode/decode),
  `src/store.ts` (localStorage), `src/views/` (home, create, detail, pay),
  `src/main.ts` (hash router + wallet bootstrap).

## License

MIT — see [LICENSE](LICENSE).
