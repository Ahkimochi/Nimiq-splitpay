# SplitPay — Competition Submission Pack

**Competition:** Nimiq Mini Apps Competition, Cycle III
**Category:** **Pay**
**App:** SplitPay — split any bill with friends in NIM (and USDT); everyone pays their share in one tap inside Nimiq Pay.

---

## (a) Description (164 words — limit is 250)

> SplitPay makes splitting a bill with friends effortless inside Nimiq Pay. The organizer enters a title, a total, and who is splitting; SplitPay calculates exact equal shares (or accepts custom amounts), adds an optional tip, and generates a personal pay link for every participant. Each link opens a focused pay page showing that person's share, the bill total, and everyone involved. One tap on "Pay" triggers a real Nimiq payment to the organizer for the exact amount, with a reference code attached to the transaction so payments are easy to match. USDT on Polygon is supported too. The organizer tracks collected versus outstanding amounts, marks cash payments manually, and can clone a split for next time. There is no backend and no sign-up: splits live in the links and on the organizer's device. SplitPay is for friends, roommates, teams, and communities who share everyday expenses and want everyone to settle up in seconds, in NIM, without spreadsheets, screenshots, or chasing people for bank details.

## (b) Category

**Pay** (selected in the portal on the Registration Dashboard at submission time)

## (c) Submission details — fill these in before submitting

| Field | Value |
| --- | --- |
| Lead name / pseudonym | `[YOUR NAME OR PSEUDONYM]` |
| GitHub profile | `[https://github.com/YOUR-USERNAME]` |
| Nimiq wallet payout address | `[YOUR NQ… ADDRESS]` |
| Repository URL (public, MIT) | `[https://github.com/YOUR-USERNAME/nimiq-splitpay]` |
| Live app URL (GitHub Pages) | `[https://YOUR-USERNAME.github.io/nimiq-splitpay/]` |

## (d) Step-by-step checklist

1. **Create a Nimiq wallet** (if you don't have one yet) in Nimiq Pay / Nimiq Wallet. Keep the payout address (starts with `NQ…`) ready — prizes are paid in USDC to the winner's Nimiq wallet.
2. **Create the public GitHub repo**: create a new public repository (e.g. `nimiq-splitpay`), then push this folder's contents to it. The repo already contains the MIT `LICENSE`, `README.md`, and a `.gitignore` that excludes `node_modules/` and `dist/`.
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/nimiq-splitpay.git
   git push -u origin main
   ```
3. **Enable GitHub Pages**: run `npm run build` locally and publish the `dist/` folder (Settings → Pages), or add a Pages workflow that builds and uploads `dist/`. Confirm the live URL loads and shows the SplitPay home screen (browser/standalone mode is expected outside Nimiq Pay).
4. **Register** on the competition Registration Dashboard (miniappscompetition.com).
5. **Submit via the portal**: paste the description from section (a), select category **Pay**, and fill in your name/pseudonym, GitHub profile link, Nimiq payout address, repo URL, and live URL from section (c). Cycle III ends **Wed 11 Nov 2026** — submit before the deadline.
6. **Optional but scored (builder promotion)**: post about SplitPay in the Skool builder community, and record a short demo walkthrough (create a split → open a pay link → pay a share inside Nimiq Pay) to share with the submission/community.

### Quick pre-submission sanity checks

- [ ] Live URL opens on a phone browser without errors.
- [ ] Creating a split and copying a pay link works on the live URL.
- [ ] Pay link opened inside Nimiq Pay (testnet first) shows the Pay button and completes a test payment.
- [ ] Repo is public and the MIT LICENSE file is present.
- [ ] Payout address in the submission form is your own Nimiq address, double-checked character by character.
