# Subscription Sentry — Architecture

Concise big-picture context for this Chrome extension. Read this first when starting a session; most debugging sessions will not need it, which is the point.

## What this is

A Chrome extension (Manifest V3) that tracks the user's recurring subscriptions and shows an **overlay reminder at checkout pages** so they see their existing monthly spend before signing up for another one. The user is one person running this locally today; the door is open to publishing to the Chrome Web Store later, so permission posture is kept publish-compatible from day 1.

## Core architecture

- **Local-first persistence.** `chrome.storage.local` is the only on-device persistence. No cloud backup, no sync, no remote logging.
- **Bounded network egress.** The extension makes outbound HTTPS calls to exactly **one** third party: `gmail.googleapis.com`, when the user has explicitly connected their Gmail account, to read their own email metadata. No telemetry. No analytics. No other domain.
- **Three data sources feed one unified subscription list**:
  1. **Gmail OAuth scan** — user authorises the extension once; we paginate `messages.list` per known service sender, fetch metadata-only (sender, subject, date), match in-process. **Primary.**
  2. **Checkout detection** — content script on every page; passively scores whether the page is a checkout and shows the overlay.
  3. **Manual add** — fallback from the popup.
- **The checkout overlay is the product.** Gmail import, matchers, storage — all of it exists to make that overlay accurate when it fires. If a design decision trades overlay quality for internal elegance, overlay wins.
- **Strict layering.** `src/lib/` is pure logic (match, detect). No Chrome APIs live there except inside `storage.ts` and `gmail-api.ts`. UI layers (`popup/`, `options/`, `content/`) never touch parsing internals — they call `src/lib` functions.
- **No framework in v1.** Vanilla TS + DOM. Add one only if the options page grows genuinely complex.

## Email data source: paths considered

This decision was rebuilt on 2026-04-26 after Google Takeout's 24–48 hour latency proved unacceptable. The chosen path is **A**. Other paths are recorded so we can revisit if A breaks.

| Path | What it is | Personal friction | Publish friction | Status |
|---|---|---|---|---|
| **A. OAuth + `gmail.metadata`** | User OAuths once. Extension calls Gmail API for metadata-only (sender/subject/date). Match in-process. | ~3 clicks, ~30s scan. 7-day re-auth in Testing mode; none in Production. | Sensitive scope, free Google verification (4–8 weeks). **No CASA.** | **CHOSEN.** |
| B. OAuth + `gmail.readonly` | Same as A but with body access (full amount extraction). | Same as A. | **Restricted scope. CASA Tier 2 ($5–15K).** Hard wall. | Rejected. |
| C. Content-script scrape `mail.google.com` | Inject into Gmail's web UI; parse the search-results DOM. | Zero auth. Requires user to be logged into Gmail. | No new permissions; ToS gray area; brittle to DOM changes. | Held in reserve. |
| D. Google Takeout `.mbox` | User exports Gmail via Takeout, drops `.mbox` into options page. | **24–48 hour wait. Multi-GB download.** Setup only. | None. Strict zero-network. | Rejected (initial v1 path; latency killed it). |
| E. Bank/card transactions (Basiq AU, Plaid US) | Read recurring charges from the user's bank instead of email. | New trust ask (bank credentials). Vendor pricing. | Different product entirely; not local-first. | Rejected for v1. |

**Trade-offs accepted with A:**

- **No body access.** Amount can only be inferred from subject lines. ~50–60% of services include amount in subject (Spotify, Apple, most Stripe-issued). The rest require one-time manual amount entry per service.
- **Single architectural exception** to "no `host_permissions`": `https://gmail.googleapis.com/*` is now allowed (and only that). See *Permissions posture* below.
- **One outbound third-party call.** The "zero network egress" promise is refined to "no egress *of user data to third parties* — only authenticated reads of the user's own data from Google."

If A becomes untenable (e.g. Google tightens metadata scope, verification stalls), **C** is the documented fallback. **B** is the documented escape hatch if amount-from-subject coverage proves insufficient and CASA cost becomes acceptable.

## What's important

- Overlay UX at the moment of checkout. Non-intrusive, dismissible, accurate per-currency total.
- Gmail-scan reliability for the top ~25 services (Netflix, Spotify, Apple, Google, Adobe, Microsoft, Amazon, Australian streaming).
- Bounded network egress: exactly one third-party domain, only when the user has authorised it.
- Staying publish-compatible: scoped permissions, single-domain `host_permissions`, sensitive (not restricted) OAuth scope.

## What's not important

- Covering every obscure subscription service. Top ~25 is the target.
- Cross-browser support. Chrome only; no adapter layer over `chrome.*`.
- Admin polish on the options page.
- Server-side persistence, multi-device sync, or accounts.
- Body-level email parsing (path B). Out of scope until CASA cost is acceptable.

## Data model and reconciliation

Same service from multiple sources (gmail + checkout + manual) collapses to **one row per service with a source history** (Design A):

```ts
interface SourceEvent {
  source: Source;
  at: string;
  snapshot?: Partial<Pick<Subscription, 'amount' | 'currency' | 'cadence' | 'nextRenewal'>>;
}

interface Subscription {
  id: string;
  service: string;
  amount: number;          // cents (integer)
  currency: string;
  cadence: Cadence;
  nextRenewal?: string;
  sources: SourceEvent[];  // append-only history
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  notes?: string;
  archived?: boolean;
}
```

`upsertByService()` is the single write path: looks up existing row by case-insensitive service name; if found, merges the new fields (without overwriting known values with `undefined`) and appends a `SourceEvent`; if not found, creates a new row with one event.

**Long-term goal is Design C** (first-write-wins, no history). Once the matcher proves reliable, the source history becomes noise. Plan to strip it out in a future simplification pass. Until then, history stays because it's the only way to debug why a given row looks the way it does.

## Permissions posture

- `permissions`: `storage`, `activeTab`, `identity`.
- `host_permissions`: **`https://gmail.googleapis.com/*` only.** Single-domain, scoped to Gmail API. Adding any other entry without architectural review is forbidden.
- `oauth2.scopes`: `https://www.googleapis.com/auth/gmail.metadata` only. Sensitive, not restricted; no CASA required.
- `content_scripts.matches`: `<all_urls>` — unavoidable for the overlay feature, and legitimate. If publishing: privacy policy states "metadata only, processed locally," and an onboarding screen explains why the extension reads pages.

If a new feature appears to require a different host_permission entry or a restricted OAuth scope, **stop and revisit this decision** rather than adding it.

## Library candidates

- **`src/lib/gmail-api.ts`** is the only file intentionally kept extractable. "OAuth + paginate + fetch metadata for known senders" is a standalone problem and could ship as its own npm package later (e.g., for any extension that needs to read a user's email metadata). Keep it:
  - Pure call-graph: takes a token + a query, returns parsed metadata. No DOM. No storage references.
  - No runtime dependencies beyond `fetch` and `chrome.identity` (the auth token request is the one Chrome-API touch and is isolated to a single function).
- `subscription-matchers.ts` and `checkout-detectors.ts` are scoped to this app. No need to optimize for extraction. Still keep them framework-free.
- `mbox-parser.ts` is removed (lived in git history; commit `122cb88`). If we ever need it back, restore from there.

## v1 "done" criteria

The bar for v1 being shippable for personal use:

1. Gmail OAuth connect runs and the inbox scan returns matched services in the options page.
2. Popup shows the subscription list and a monthly total.
3. Overlay fires on at least one real checkout page during normal browsing.
4. User can delete a subscription from the popup.
5. User can manually add a subscription from the popup.

Explicitly deferred to v2: renewal-date alarms, edit flow for existing subs, categories, CSV export/import, browser history heuristic, annual↔monthly conversion UI polish, full body access (path B).

## Known inconsistencies / tensions

- **Amount is in cents (integer)** across the codebase but not branded as a distinct type. If a float amount ever lands in storage it'll silently produce wrong totals. If this bites, introduce a `Cents` branded type.
- **OAuth client setup is per-environment.** The `client_id` in `manifest.json` is tied to a specific Chrome Extension ID. Dev (unpacked) and Web Store (published) IDs differ; production will need a second OAuth client or a pinned `key` field in the manifest.
- **Amount-from-subject coverage is partial.** ~50–60% of services include the amount in the subject line. Rest default to 0 and prompt the user inline. If coverage drops below "useful," revisit path B.

## Tech stack

- TypeScript 5, Vite 5, `@crxjs/vite-plugin` 2.4 stable.
- `chrome.storage.local` for persistence; `chrome.identity` for OAuth.
- No runtime dependencies.
- Vanilla DOM in UI layers (popup, options, content overlay uses shadow DOM).

## Directory layout

```
src/
  popup/       toolbar popup: list + monthly total + manual add
  content/     runs on every page; detects checkout; injects shadow-DOM overlay
  options/     Gmail OAuth connect + scan + per-service amount entry
  background/  service worker (install hook, alarms when added later)
  lib/         pure logic (gmail-api, matchers, detectors, storage)
  types.ts     shared types (source of truth for naming)
public/
  icons/       PNGs wired into manifest.action.default_icon + top-level icons
manifest.json  MV3 manifest with oauth2 + identity + scoped host_permissions
```

## Notes for future Claude sessions

- The `host_permissions` exception is **`gmail.googleapis.com` only**. If a future feature wants to add another host, that is an architectural review, not an incremental change.
- Restricted OAuth scopes (`gmail.readonly`, `gmail.modify`, etc.) are off-limits without confirming the user accepts the CASA cost.
- If a file in `src/lib/` starts depending on the DOM, that's a smell. `storage.ts` and `gmail-api.ts` are the only `chrome.*` exceptions.
- The overlay is the product. Features that don't improve the overlay are v2.
- See *Email data source: paths considered* before suggesting any data-source change. The trade-offs are recorded; don't relitigate them without a new constraint.
