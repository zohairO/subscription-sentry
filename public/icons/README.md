# Icons

Chrome wants PNGs at 16, 32, 48, and 128 px. Drop them here with names:

- `icon-16.png`
- `icon-32.png`
- `icon-48.png`
- `icon-128.png`

Then add this block to the root of `manifest.json`:

```json
"icons": {
  "16": "public/icons/icon-16.png",
  "32": "public/icons/icon-32.png",
  "48": "public/icons/icon-48.png",
  "128": "public/icons/icon-128.png"
},
"action": {
  "default_popup": "src/popup/popup.html",
  "default_title": "Subscription Sentry",
  "default_icon": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  }
}
```

Until then, Chrome uses a default placeholder. The extension works without icons.
