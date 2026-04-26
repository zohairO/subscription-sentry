# Subscription Sentry

Chrome extension that tracks your subscriptions and pops up a reminder at checkout pages so you don't accidentally pile on another one.

## Data sources

1. **Gmail OAuth scan** — connect your Gmail once; the extension reads metadata (sender, subject, date) for known subscription services. **Primary.**
2. **Real-time checkout detection** — content script watches for checkout/subscribe pages and shows your current monthly load.
3. **Manual add** — popup fallback for anything Gmail doesn't catch (Apple/Google Play subs, services with no email receipt).

The extension uses the `gmail.metadata` OAuth scope: it can read sender/subject/date but **not email bodies**. For services where the amount appears in the subject line (Spotify, Apple, Stripe-issued receipts) we extract it automatically; for the rest you enter it once when importing.

## Build

```bash
npm install
npm run build
```

`npm run dev` is also available (Vite + HMR), but the build-and-reload workflow is simpler and just as fast.

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

After a code change: `npm run build`, then click the reload (↻) icon on the extension card.

## Gmail OAuth setup (one-time, required for the import to work)

The extension's `manifest.json` ships with a placeholder `client_id` that you need to replace with your own. This is unavoidable: each Chrome extension install needs its own OAuth credential pinned to its extension ID.

1. **Create a Google Cloud project** at <https://console.cloud.google.com/projectcreate>. Any name; you only use it for the OAuth client.
2. **Enable the Gmail API** at <https://console.cloud.google.com/apis/library/gmail.googleapis.com>.
3. **Configure the OAuth consent screen**:
   - User type: **External**
   - App name: Subscription Sentry (or anything)
   - User support email: yours
   - Developer contact: yours
   - Scopes: add `.../auth/gmail.metadata` (search for it in the picker)
   - Test users: add your own Gmail address
4. **Find your extension ID**: load `dist/` as an unpacked extension once. The ID appears on the extension's card on `chrome://extensions` (32-character lowercase string).
5. **Create the OAuth 2.0 Client ID** at <https://console.cloud.google.com/apis/credentials>:
   - Application type: **Chrome Extension**
   - Item ID: paste the extension ID from step 4
   - Save and copy the resulting client ID (looks like `1234567890-abcdef.apps.googleusercontent.com`)
6. **Edit `manifest.json`** and replace `REPLACE_WITH_YOUR_OAUTH_CLIENT_ID` with your client ID.
7. **Rebuild** with `npm run build` and reload the extension.

You should now be able to click "Connect Gmail" in the options page.

> **Note on the extension ID**: it's tied to the loaded folder; if you remove and re-load, you'll usually get the same ID, but if it changes, update the OAuth client. For Web Store publishing you'd need a separate OAuth client keyed to the published extension ID.

## Icons

Drop 16x16, 32x32, 48x48, 128x128 PNGs into `public/icons/` and wire them up in `manifest.json` (`action.default_icon` + top-level `icons`). See `public/icons/README.md`.

## Project layout

```
src/
  popup/       toolbar popup: list + monthly total + manual add + delete
  content/     checkout page detector (runs on every tab) + shadow-DOM overlay
  options/     Gmail connect + scan + per-service amount entry + sub management
  background/  service worker (install hook)
  lib/         pure logic (gmail-api, matchers, detectors, storage)
  types.ts     shared types
```

## Privacy

Local-first. The only outbound HTTPS calls go to `gmail.googleapis.com` (when you've explicitly connected) to fetch your own email metadata. No telemetry, no analytics, no third-party services. Subscription data lives in `chrome.storage.local`.
