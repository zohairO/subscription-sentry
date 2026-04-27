# Decisions

Date-stamped architectural and product decisions. Most recent at top.

---

## 2026-04-26

- **Google Takeout dropped as primary data source.** 24–48h latency is unacceptable for "useful to me today" UX.
- **Path A chosen: OAuth + `gmail.metadata` scope.** Sensitive (not restricted), no CASA, free Google verification keeps the publish path open. Trade-off accepted: no email body, so amount can only come from subject lines (~50–60% of services) or one-time manual entry per service.
- **Architectural exception granted:** `host_permissions: ["https://gmail.googleapis.com/*"]` is now allowed. This is the *only* exception; no other host_permission entry without an architectural review.
- **Network-egress promise refined.** From "zero network egress" to "no egress *of user data to third parties* — only authenticated reads of the user's own data from Google's API." Update propagated to architecture.md and CLAUDE.md.
- **Restricted scopes (`gmail.readonly`, etc.) remain off-limits** until user explicitly accepts CASA Tier 2 cost ($5–15K). Path B is documented as the escape hatch if amount-from-subject coverage proves insufficient.
- **`mbox-parser.ts` removed from the source tree.** Lives in git history (commit `122cb88`) and is restorable. No longer the library candidate; `gmail-api.ts` takes that slot.
- **Path C (Gmail UI scrape) held in reserve** as documented fallback if Google tightens metadata scope or verification stalls. All paths recorded in architecture.md § "Email data source: paths considered."

(Original brief note from this date preserved in git history at the previous version of this file.)


## 2026-04-24

- **Memory system set up.** Four project-scoped memory files under `.claude/memory/` (profile, preferences, decisions, sessions). CLAUDE.md mandates update-as-you-go.
- **Chrome only.** No cross-browser. No adapter layer over `chrome.*`. Firefox / Safari are off the table.
- **Publish path stays open.** Auto-popup continues to work on the Chrome Web Store since `<all_urls>` content-script matches are allowed; minimal permissions kept (`storage`, `activeTab`, no `host_permissions`).
- **Design A now, Design C long-term.** One row per service with a `sources[]` history for v1. Migrate to first-write-wins once matcher/detector reliability is proven.
- **Only library candidate: `src/lib/mbox-parser.ts`.** Other `lib/` files are scoped to this app; no extraction optimization.
- **v1 done = 5 criteria:**
  1. Mbox import runs and shows matches in the options page.
  2. Popup shows list + monthly total.
  3. Overlay fires on at least one real checkout page during normal browsing.
  4. Delete a sub from the popup.
  5. Add a sub manually from the popup.
- **Deferred to v2:** renewal alarms, edit flow, categories, CSV export/import, browser history heuristic, annual↔monthly conversion UI polish.

## 2026-04-23

- **Name: Subscription Sentry.**
- **Project root:** `/Users/zohairoomatia/Desktop/projects/subscription-sentry`.
- **Stack:** TypeScript 5 + Vite 5 + `@crxjs/vite-plugin` + Manifest V3. `chrome.storage.local` for persistence. Vanilla DOM in UI layers. Shadow DOM for overlay. No framework.
- **Data sources (layered):**
  1. Google Takeout `.mbox` import (primary, batch, one-time historical).
  2. Real-time checkout detection via content script on `<all_urls>` (killer feature).
  3. Manual add (popup fallback).
  4. Browser history heuristic — **v2**.
  5. CSV paste — **v2**.
- **Strict layering:** `src/lib/` is pure logic. No `chrome.*` or DOM imports except in `storage.ts`. UI (`popup`, `options`, `content`) only calls `lib/` functions.
- **Overlay UX is the product.** Any trade-off between internal elegance and overlay quality: overlay wins.
- **Hard rules:**
  - Zero network egress against user data. Ever.
  - No `host_permissions` in `manifest.json`.
  - No runtime dependencies. Stdlib only.
  - Amount is cents (integer). Never float.
  - Types use `service` and `cadence` (not `serviceName`/`billingCycle`).
