# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-07-18

### Added

- Topic, keyword, and publication-date filters.
- Infinite scrolling without duplicates in the current feed.
- Separate Ukrainian and English project documentation.
- Structural and runtime contract checks.
- An extension options page for saving, testing, and removing the API key.
- A custom extension icon in all required Chrome sizes.

### Changed

- Renamed the extension to UkrTube and aligned all internal identifiers.
- Split the background worker, content runtime, offscreen AI runtime, and styles into focused modules.
- Store the API key locally in the current Chrome profile.
- Changed the feed service origin to `https://uatb.bgdn.dev`.
- Made the Ukrainian README the primary project page.
- Changed the main feed to request complete random selections from `/feed`.
- Removed the video-count label above the feed while keeping the action buttons on the right.
- Added one-click filter reset and visible publication-date shortcuts.
- Send keyword filters to the feed service and document the searched fields.

### Fixed

- Recover channel avatars and view counts when the feed catalogue returns empty placeholder values.
- Avoid blocking card rendering on separate YouTube requests for every random ID.
- Normalize pasted API keys and reject hidden Unicode characters before creating request headers.

### Preserved

- The configured `/feed` service contract and cursor paging.
- Current YouTube card rendering and filter settings.
- Hidden experimental local AI behavior.
