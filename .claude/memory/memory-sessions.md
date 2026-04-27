# Session Log

Substantive work by session. Most recent at top.

---

## 2026-04-26

- **Major pivot: dropped Google Takeout / mbox import; adopted OAuth + `gmail.metadata` scope.** Reason: Takeout data takes 24–48h to be ready, which is a hard friction wall. See `memory-decisions.md` for the full decision and architecture.md § "Email data source: paths considered" for the path comparison.
- **Updated `architecture.md` and `CLAUDE.md`** to reflect:
  - Single `host_permissions` exception (`gmail.googleapis.com`).
  - "Zero network egress" → "no egress *of user data to third parties*; authenticated reads of the user's own data from Google are OK."
  - OAuth scope locked to `gmail.metadata` (sensitive, no CASA). Restricted scopes off-limits.
  - `gmail-api.ts` replaces `mbox-parser.ts` as the lone library candidate.
- **Wrote `src/lib/gmail-api.ts`** — OAuth token mgmt, scan loop with progress callback. Per-service: `from:(domains) newer_than:1y` then `messages.get?format=metadata`.
- **Reshaped `src/lib/subscription-matchers.ts`** — `senders: string[]` (used both for Gmail query and substring sender matching) and `amountInSubject?: boolean` flag per service.
- **Deleted `src/lib/mbox-parser.ts`** (preserved at commit `122cb88`).
- **Rewrote options page** (`html`/`ts`/`css`) — Connect/Scan/Disconnect flow, inline editable match grid (service/amount/currency/cadence/confidence) with per-row checkbox and "amount needed" yellow highlight when extraction failed.
- **Updated `manifest.json`** — added `identity` permission, `host_permissions: ["https://gmail.googleapis.com/*"]`, and `oauth2` block with placeholder client_id.
- **Updated `README.md`** with full Gmail OAuth setup walkthrough (GCP project → enable API → consent screen → extension ID → OAuth Chrome Extension client → paste `client_id` into `manifest.json` → rebuild).
- **Upgraded `@crxjs/vite-plugin` from beta.25 → 2.4.0 stable.** Fixes the "extension reloaded itself too frequently" / WebSocket 400 issue with `npm run dev`.
- **Build + typecheck green.** dist/ ~32 KB unminified.

### Open threads (pick up next session)

- **User must replace OAuth `client_id` placeholder** in `manifest.json` and rebuild before "Connect Gmail" works. Setup steps in README.
- **Verify the full v1 flow once OAuth client_id is set**:
  1. Connect Gmail → consent screen appears.
  2. Scan inbox → progress increments through 24 services.
  3. Edit any rows where amount wasn't extracted (Netflix, Disney+, Microsoft 365, etc. — typically the non-Stripe services).
  4. Import → subs appear in popup.
  5. Visit a real checkout page → overlay fires.
- **Per-environment OAuth client**: dev (unpacked) and Web Store (published) IDs differ. For now, use the dev OAuth client; if/when publishing, create a second one keyed to the Web Store extension ID.
- **Icons**: still placeholder. Lowest priority.

## 2026-04-24

- Added `CLAUDE.md` session playbook (operational companion to `architecture.md`).
- User extended `CLAUDE.md` with a mandatory auto-update memory protocol.
- Initialized `.claude/memory/` with profile, preferences, decisions, and sessions files.
- **Design A migration complete**: `src/types.ts` now has `SourceEvent` + `Subscription.sources: SourceEvent[]`. Storage rewritten around `upsertByService()` which merges by case-insensitive service name and appends a source event on every write. `addSubscription`/`updateSubscription` dropped.
- **Background service worker stub**: opens options page on install.
- **Content script + overlay**: `src/content/checkout-detector.ts` runs on every top-level frame, waits 1.2s for SPA checkouts, scores via `detectCheckout`, injects shadow-DOM overlay with per-currency monthly total + up to 8 subs. Dismiss is session-scoped (`sessionStorage`).
- **Popup**: list, monthly total grouped by currency, inline manual-add form (Enter/Escape shortcuts), delete. Opens options via `chrome.runtime.openOptionsPage`.
- **Options page**: mbox file picker → parse → preview matches with confidence bucket (high ≥80%, medium ≥60%, low otherwise) → import selected with `source: 'mbox'`. Subs list shows distinct sources as a "mbox · manual" style label. Overlay toggle wired to settings.
- **Build passes**: `npm run typecheck` + `npm run build` both green. Fixed `vite.config.ts` (cast manifest to `ManifestV3Export`, dropped unused path alias + `__dirname`) and trimmed unused `paths` from `tsconfig.json`. Lockfile committed.
- **GitHub repo live**: `https://github.com/zohairO/subscription-sentry` (private). Created via `gh repo create --private --source=. --push`. 8 commits on `main`.
- **v1 done criteria state** (code paths exist; needs user to load in Chrome and verify):
  1. Mbox import shows matches — code ready.
  2. Popup shows list + monthly total — code ready.
  3. Overlay fires on a real checkout — code ready, needs live test.
  4. Delete sub — code ready.
  5. Add sub manually — code ready.

### Open threads (pick up next session)

- **User verification pass**: load `dist/` as unpacked extension, run through all five v1 criteria. Watch for false positives on the overlay (checkout detector threshold is currently 4; may need tuning).
- **Icons**: still placeholder. Generate 16/32/48/128 PNGs and wire into `manifest.json` (`action.default_icon` + top-level `icons`).
- **CRXJS version warning**: `@crxjs/vite-plugin` 2.0.0-beta.25 is EOL. Package.json has `^2.0.0-beta.32` as range; npm resolved the pinned beta.25. Consider bumping to stable `^2.0.0` when available.
- **Possible next features (v2)**: renewal alarms, sub edit flow, CSV export, browser-history heuristic, annual↔monthly UI polish. All deferred per architecture.md.

## 2026-04-23

- Scaffolded project config: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json`, `.gitignore`, `README.md`, `public/icons/README.md`.
- Wrote pure-logic library files:
  - `src/lib/storage.ts` — typed wrapper around `chrome.storage.local`.
  - `src/lib/subscription-matchers.ts` — ~25 known service patterns with sender regex, subject hints, cadence, currency.
  - `src/lib/mbox-parser.ts` — Google Takeout mbox parser, QP/base64 decode, matcher + deduper.
  - `src/lib/checkout-detectors.ts` — scored heuristic (URL patterns + card inputs + payment iframes + keywords).
- Defined shared types in `src/types.ts`. Does **not yet** include `sources[]` — Design A migration still pending.
- Wrote `.claude/rules/architecture.md` capturing big-picture decisions.
- `git init`, initial commit `6830475` ("chore: initial scaffold + architecture rules").
- Added `CLAUDE.md` in commit `e2a5735`.
