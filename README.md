# Subscription Sentry

Chrome extension that tracks your subscriptions and pops up a reminder at checkout pages so you don't accidentally pile on another one.

## Data sources (layered)

1. **Google Takeout mbox import** — one-time historical scan (Options page).
2. **Real-time checkout detection** — content script watches for checkout/subscribe pages and shows your current monthly load.
3. **Browser history heuristic** — *(v2)* surfaces visited sites that look like subscription services.
4. **Manual add + CSV paste** — *(v2 for CSV)* escape hatch for Apple/Google Play subs.

## Run it

```bash
npm install
npm run dev
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

Changes hot-reload during `npm run dev`.

## Build for personal use

```bash
npm run build
```

Load the `dist/` folder as above. That's it — no store submission needed for personal use.

## Icons

Drop 16x16, 32x32, 48x48, 128x128 PNGs into `public/icons/` and wire them up in `manifest.json`. See `public/icons/README.md`.

## Project layout

```
src/
  popup/       toolbar popup: list + monthly total
  content/     checkout page detector (runs on every tab)
  overlay/     shadow-DOM reminder shown at checkout
  options/     settings + mbox import
  background/  service worker (storage, alarms)
  lib/         pure logic (parsers, matchers, detectors)
  types.ts     shared types
```
