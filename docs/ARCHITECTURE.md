# Architecture

## Runtime overview

The extension has four isolated runtime areas:

1. **Content runtime** adds the Ukrainian tab, owns feed state, renders cards, and sends typed messages.
2. **Background worker** calls the feed service, reads public YouTube metadata for legacy message handlers, and controls the offscreen document.
3. **Offscreen runtime** contains the experimental local language and classification model.
4. **Options runtime** stores the API key locally and asks the background worker to test it.

The normal version 1.3.0 path is:

```text
UkrTube tab click
  -> content controller
  -> GET_FILTERED_FEED message
  -> background feed API
  -> /feed endpoint
  -> cards rendered by the content view
  -> optional avatar and view-count enrichment
```

## Content modules

- `state.js`: constants, categories, date presets, and mutable feed state.
- `platform.js`: YouTube page detection, theme detection, Chrome storage, messaging, and native-feed visibility.
- `filters.js`: filter state and filter-panel controls.
- `view.js`: section layout, messages, skeletons, metadata formatting, and video cards.
- `metadata-enrichment.js`: progressive avatar and view-count updates for loaded cards.
- `ai-filter.js`: delayed filter reloads and the hidden local AI classification flow.
- `controller.js`: filtered feed requests, activation, infinite scrolling, and single-page navigation.

These files are classic content scripts because Manifest V3 does not load declared content scripts as ES modules. They run in the same Chrome isolated world. Their order in `manifest.json` is therefore part of the runtime contract.

## Background modules

- `service-worker.js`: configuration loading and module startup order.
- `utils.js`: input normalization and YouTube response parsing helpers.
- `metadata.js`: legacy per-video metadata loading.
- `metadata-cache.js`: cached avatar and view-count enrichment from video pages.
- `feed-api.js`: complete filtered feed pages and legacy random ID requests.
- `offscreen-bridge.js`: offscreen document lifecycle.
- `messaging.js`: public runtime message contract.

## Offscreen modules

- `model-config.js`: model input options and constrained response schema.
- `runtime-state.js`: active sessions, translators, timeout state, and common helpers.
- `language.js`: language detection and optional translation.
- `session.js`: local model session lifecycle.
- `classifier.js`: prompt construction and normalized results.
- `messaging.js`: offscreen message contract and status reporting.

## Options modules

- `index.html`: Ukrainian settings form and accessible status area.
- `styles.css`: responsive light and dark settings layout.
- `index.js`: local key storage, visibility control, removal, and connection testing.

## Configuration

`src/config.js` contains the public `https://uatb.bgdn.dev` service origin. The options page stores the user's API key under `ukrtubeApiSettings` in `chrome.storage.local`. The background worker reads that key only when making service requests. It is never synchronized by the extension or written to project files.

## Compatibility guardrails

- Keep all existing runtime message names unless a versioned migration is added.
- Keep the main selection flow on the `/feed` endpoint.
- Keep cursor paging and duplicate protection when appending feed pages.
- Keep the content script order and offscreen script order explicit.
- Do not enable local AI controls without testing model availability, cancellation, and timeout behavior.
- Run `npm run check` and manually verify the unpacked extension after any runtime change.
