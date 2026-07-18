# UkrTube

[Українська версія](README.md)

UkrTube is a Manifest V3 Chrome extension that adds a **UkrTube** tab with Ukrainian videos to the YouTube home page. It requests complete random selections from the `/feed` endpoint and lets the user filter videos by topic, keywords, and publication date.

## Features

- A native-looking **UkrTube** tab on the YouTube home page.
- A fresh random selection after page reload or the **Refresh** button.
- Infinite loading of random batches without duplicates in the current feed.
- Server-side topic, keyword, and date filters across the feed catalogue.
- One-click filter reset and visible date-range shortcuts.
- An options page for saving and testing the API key.
- A custom blue-and-yellow extension icon that opens settings when selected.
- Video cards with title, channel, thumbnail, duration, views, and publication date.
- Progressive channel-avatar and view-count recovery from public YouTube video pages.
- Light and dark themes that follow the current YouTube page.
- Filter settings stored with Chrome Sync.
- An experimental local Chrome AI runtime kept behind a disabled feature flag.
- No build step: Chrome loads the source files directly.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support.
- Access to the configured feed service.
- A valid API token for that service.

## Install for local development

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository directory.
5. Open the extension options, enter your API key, and select **Save and test**.
6. Open the YouTube home page and select the **UkrTube** tab.

After a source change, use **Reload** on `chrome://extensions`, then refresh YouTube with `Ctrl + Shift + R` or `Cmd + Shift + R`.

## Configuration

Open **Extension options** on `chrome://extensions`, or select **API key** inside the UkrTube filter panel. The key is stored only in the current Chrome profile through `chrome.storage.local`; it is not synchronized or added to project files.

When the key is saved, the extension removes a `Bearer` prefix, surrounding quotes, and extra whitespace. A hidden or unsupported character inside the key is reported before a request is sent.

The feed service is fixed to `https://uatb.bgdn.dev`. A credential used by a browser extension must still be protected on the server with narrow permissions, rate limits, monitoring, expiry, and rotation.

## Project structure

```text
.
├── manifest.json
├── src
│   ├── background   # Feed API, YouTube metadata, offscreen bridge, messages
│   ├── assets       # Editable source and generated extension icon sizes
│   ├── content      # Feed state, filters, UI, controller, and styles
│   ├── offscreen    # Experimental local AI runtime
│   ├── options      # API key settings page
│   ├── shared       # Shared API key validation
│   └── config.js    # Public API origin
├── scripts          # Project validation
├── tests            # Runtime contract tests
└── docs             # Architecture notes
```

The order of JavaScript files in `manifest.json` is intentional. Chrome content scripts share one isolated extension world, so foundational state and helpers load before the controller starts.

See [Architecture](docs/ARCHITECTURE.md) for the module responsibilities and runtime flow.

## Permissions

- `storage` stores filter settings in Chrome Sync and the API key locally.

The extension does not inject scripts into arbitrary websites. Its content scripts run only on `https://www.youtube.com/*`.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Report security issues using the private process described in [SECURITY.md](SECURITY.md), not through a public issue.

## License

Released under the [MIT License](LICENSE).
