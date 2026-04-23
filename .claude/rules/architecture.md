# Subscription Sentry — Architecture

Concise big-picture context for this Chrome extension. Read this first when starting a session; most debugging sessions will not need it, which is the point.

## What this is

A Chrome extension (Manifest V3) that tracks the user's recurring subscriptions and shows an **overlay reminder at checkout pages** so they see their existing monthly spend before signing up for another one. The user is one person running this locally today; the door is open to publishing to the Chrome Web Store later, so permission posture is kept publish-compatible from day 1.

## Core architecture

- **Local-first, no backend.** `chrome.storage.local` is the only persistence. Nothing ever leaves the device. This is both a product promise and an architectural constraint — no code anywhere should make network calls against user data.
- **Three data sources feed one unified subscription list**:
  1. **Mbox import** — one-time historical scan of a Google Takeout `.mbox` file (Options page).
  2. **Checkout detection** — content script on every page, passively scores whether the page is a checkout and shows the overlay.
  3. **Manual add** — fallback from the popup.
  Browser-history heuristic and CSV paste are v2.
- **The checkout overlay is the product.** Mbox parser, matchers, storage — all of it exists to make that overlay accurate and useful when it fires. If a design decision trades overlay quality for internal elegance, overlay wins.
- **Strict layering.** `src/lib/` is pure logic (parse, match, detect). No Chrome APIs live there except inside `storage.ts`. UI layers (`popup/`, `options/`, `content/`) never touch parsing internals — they call `src/lib` functions. This is how pieces stay testable and (for `mbox-parser.ts`) extractable.
- **No framework in v1.** Vanilla TS + DOM. Add one only if the options page grows genuinely complex.

## What's important

- Overlay UX at the moment of checkout. Non-intrusive, dismissible, accurate total.
- Mbox parse accuracy on common services (Netflix, Spotify, Apple, Google, Australian streaming).
- Zero network egress — ever. No telemetry, no error reporting, no "anonymous" analytics.
- Staying publish-compatible: minimal permissions, no `host_permissions`, clean manifest.

## What's not important

- Covering every obscure subscription service. Coverage of the top ~25 is the target.
- Cross-browser support. Chrome only; no adapter layer over `chrome.*`.
- Admin polish on the options page.
- Perfect handling of every MIME encoding edge case in mbox parsing.
- Multi-device sync, cloud backup, or account system.

## Data model and reconciliation

Same service from multiple sources (mbox + checkout + manual) collapses to **one row per service with a source history** (Design A):

```ts
interface Subscription {
  id: string;
  service: string;
  amount: number;          // cents
  currency: string;
  cadence: Cadence;
  sources: SourceEvent[];  // append-only history
  // ...
}
interface SourceEvent { source: Source; at: string; snapshot?: {...} }
```

Current `types.ts` does not yet have `sources[]` — this is a pending migration. The storage layer itself is already compatible (no dedupe in `addSubscription`); only the type and the upsert-by-service-name helper need to be added.

**Long-term goal is Design C** (first-write-wins, no history). Once the matcher + detector prove reliable, the source history becomes noise. Plan to strip it out in a future simplification pass. Until then, history stays because it's the only way to debug why a given row looks the way it does.

## Permissions posture (publish-compatible)

- `permissions`: `storage`, `activeTab` only.
- `host_permissions`: **none.** Do not add. Adding any entry here puts the extension in a stricter review category.
- `content_scripts.matches`: `<all_urls>` — unavoidable for the overlay feature, and legitimate. If publishing: privacy policy states "all processing is local," and an onboarding screen explains why the extension reads pages.

If a new feature requires `host_permissions`, stop and reconsider before adding it.

## Library candidates

- **`src/lib/mbox-parser.ts`** is the only file intentionally kept extractable. "Parse a Google Takeout mbox, decode QP/base64, yield structured messages" is a standalone problem and could ship as its own npm package later. Keep it:
  - Pure. No `chrome.*`. No DOM references. No extension-specific types bleeding in (it yields `RawMessage`; the matching step that uses our `Subscription`/`MboxMatch` types lives alongside but is a separate function).
  - No runtime dependencies beyond the standard library + `atob`.
- `subscription-matchers.ts` and `checkout-detectors.ts` are scoped to this app. No need to optimize for extraction. Still keep them framework-free — that's just good hygiene.

## v1 "done" criteria

The bar for v1 being shippable for personal use:

1. Mbox import runs and shows matches in the options page.
2. Popup shows the subscription list and a monthly total.
3. Overlay fires on at least one real checkout page during normal browsing.
4. User can delete a subscription from the popup.
5. User can manually add a subscription from the popup.

Explicitly deferred to v2: renewal-date alarms, edit flow for existing subs, categories, CSV export/import, browser history heuristic, annual↔monthly conversion UI polish.

## Known inconsistencies / tensions

- **Amount is in cents (integer)** across the codebase but not branded as a distinct type. If a float amount ever lands in storage it'll silently produce wrong totals. If this bites, introduce a `Cents` branded type.
- **`types.ts` uses `service` and `cadence`**, not `serviceName` or `billingCycle`. Any new code must match this naming. Earlier draft prose may still use the old terms — ignore it, types are source of truth.
- **Design A not yet reflected in `types.ts`.** Next coding task is the `sources[]` migration before any UI consumer is written.
- **Confidence is a number (0–1)**, not a string enum. Settled. `MboxMatch.confidence` is a score.

## Tech stack

- TypeScript 5, Vite 5, `@crxjs/vite-plugin` (Manifest V3 handling + HMR).
- `chrome.storage.local` for persistence.
- No runtime dependencies.
- Vanilla DOM in UI layers (popup, options, content overlay uses shadow DOM).

## Directory layout

```
src/
  popup/       toolbar popup: list + monthly total + manual add
  content/     runs on every page; detects checkout; injects shadow-DOM overlay
  options/     settings + mbox import + sub management
  background/  service worker (install hook, alarms when added later)
  lib/         pure logic (parsers, matchers, detectors, storage wrapper)
  types.ts     shared types (source of truth for naming)
public/
  icons/       PNGs wired into manifest.action.default_icon + top-level icons
manifest.json  MV3 manifest, publish-compatible
```

## Notes for future Claude sessions

- Confirm `types.ts` + `sources[]` state before writing storage/UI code.
- Do not add `host_permissions`. If tempted, re-read the permissions section.
- If a file in `src/lib/` starts depending on `chrome.*` or the DOM, that's a smell — `storage.ts` is the only allowed exception.
- The overlay is the product. Features that don't improve the overlay are v2.
