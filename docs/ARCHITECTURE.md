# Architecture

## Runtime overview

The extension has three isolated runtime areas:

1. **Content runtime** adds the Ukrainian tab, owns feed state, renders cards, and sends typed messages.
2. **Background worker** calls the feed service, reads public YouTube metadata for legacy message handlers, and controls the offscreen document.
3. **Offscreen runtime** contains the experimental local language and classification model.

The normal version 1.3.0 path is:

```text
YouTube tab click
  -> content controller
  -> GET_FILTERED_FEED message
  -> background feed API
  -> /feed endpoint
  -> cards rendered by the content view
```

## Content modules

- `state.js`: constants, categories, date presets, and mutable feed state.
- `platform.js`: YouTube page detection, theme detection, Chrome storage, messaging, and native-feed visibility.
- `filters.js`: filter state and filter-panel controls.
- `view.js`: section layout, messages, skeletons, metadata formatting, and video cards.
- `ai-filter.js`: delayed filter reloads and the hidden local AI classification flow.
- `controller.js`: feed requests, activation, infinite scrolling, and single-page navigation.

These files are classic content scripts because Manifest V3 does not load declared content scripts as ES modules. They run in the same Chrome isolated world. Their order in `manifest.json` is therefore part of the runtime contract.

## Background modules

- `service-worker.js`: configuration loading and module startup order.
- `utils.js`: input normalization and YouTube response parsing helpers.
- `metadata.js`: legacy per-video metadata loading.
- `feed-api.js`: random IDs and filtered feed requests.
- `offscreen-bridge.js`: offscreen document lifecycle.
- `messaging.js`: public runtime message contract.

## Offscreen modules

- `model-config.js`: model input options and constrained response schema.
- `runtime-state.js`: active sessions, translators, timeout state, and common helpers.
- `language.js`: language detection and optional translation.
- `session.js`: local model session lifecycle.
- `classifier.js`: prompt construction and normalized results.
- `messaging.js`: offscreen message contract and status reporting.

## Configuration

`src/config.js` is safe to commit and contains a placeholder token. `src/config.local.js` overrides it on a developer machine and is ignored by Git. The override preserves local operation without publishing a credential.

## Compatibility guardrails

- Keep all existing runtime message names unless a versioned migration is added.
- Keep `/feed` query parameter names aligned with the server contract.
- Keep the content script order and offscreen script order explicit.
- Do not enable local AI controls without testing model availability, cancellation, and timeout behavior.
- Run `npm run check` and manually verify the unpacked extension after any runtime change.
