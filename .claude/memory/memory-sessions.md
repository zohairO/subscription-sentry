# Session Log

Substantive work by session. Most recent at top.

---

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
