# UkrTube

[Українська версія](README.uk.md)

UkrTube is a Manifest V3 Chrome extension that adds a **UkrTube** tab with Ukrainian videos to the YouTube home page. The tab displays an infinite feed backed by a server-side catalogue and lets the user filter videos by topic, keywords, and publication date.

## Features

- A native-looking **UkrTube** tab on the YouTube home page.
- Cursor-based infinite scrolling without duplicates between pages.
- Server-side topic, keyword, and date filters across the indexed catalogue.
- Video cards with title, channel, thumbnail, duration, views, and publication date.
- Progressive channel-avatar and view-count recovery when the feed catalogue has not stored them yet.
- Light and dark themes that follow the current YouTube page.
- Filter settings stored with Chrome Sync.
- An experimental local Chrome AI runtime kept behind a disabled feature flag.
- No build step: Chrome loads the source files directly.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support.
- Access to the configured feed service.
- A valid API token for that service.
- Node.js 20 or newer only when running the development checks.

## Install for local development

1. Clone or download this repository.
2. Copy `src/config.js` to `src/config.local.js`.
3. Put your API token in `src/config.local.js`. This file is ignored by Git.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Select **Load unpacked** and choose the repository directory.
7. Open the YouTube home page and select the **UkrTube** tab.

After a source change, use **Reload** on `chrome://extensions`, then refresh YouTube with `Ctrl + Shift + R` or `Cmd + Shift + R`.

## Configuration

The committed `src/config.js` contains public defaults and a placeholder token. Local credentials belong in `src/config.local.js`:

```js
globalThis.EXTENSION_CONFIG = {
  apiUrl: "https://your-service.example/random",
  apiToken: "YOUR_TOKEN",
};
```

The background service loads the public file first and then applies the optional local override. Never commit a real credential. A token shipped inside any browser extension must be treated as a public client credential and protected on the server with narrow permissions, rate limits, monitoring, and rotation.

## Project structure

```text
.
├── manifest.json
├── src
│   ├── background   # Feed API, YouTube metadata, offscreen bridge, messages
│   ├── content      # Feed state, filters, UI, controller, and styles
│   ├── offscreen    # Experimental local AI runtime
│   ├── config.js
│   └── config.local.js  # Local only; ignored by Git
├── scripts          # Project validation
├── tests            # Runtime contract tests
└── docs             # Architecture notes
```

The order of JavaScript files in `manifest.json` is intentional. Chrome content scripts share one isolated extension world, so foundational state and helpers load before the controller starts.

See [Architecture](docs/ARCHITECTURE.md) for the module responsibilities and runtime flow.

## Development

Install the formatting dependency once:

```bash
npm install
```

Run all structural and runtime checks:

```bash
npm run check
```

Check formatting or apply it:

```bash
npm run format:check
npm run format
```

## Permissions

- `storage` stores filter settings in Chrome Sync.
- `offscreen` hosts the optional local AI runtime.
- Host access to YouTube reads public video pages and thumbnails.
- Host access to the feed service loads catalogue pages.

The extension does not inject scripts into arbitrary websites. Its content scripts run only on `https://www.youtube.com/*`.

## Experimental local AI

The local AI controls are intentionally hidden in version 1.3.0 (`SHOW_AI_CONTROLS` is `false`). The offscreen runtime remains in the repository for future experiments and is not started during the normal feed flow.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Report security issues using the private process described in [SECURITY.md](SECURITY.md), not through a public issue.

## License

Released under the [MIT License](LICENSE).
