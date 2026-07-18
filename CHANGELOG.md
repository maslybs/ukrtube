# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-07-18

### Added

- Topic, keyword, and publication-date filters.
- Infinite scrolling without duplicates in the current feed.
- Separate Ukrainian and English project documentation.
- Structural and runtime contract checks.

### Changed

- Renamed the extension to UkrTube and aligned all internal identifiers.
- Split the background worker, content runtime, offscreen AI runtime, and styles into focused modules.
- Moved local API credentials to an ignored override file.
- Changed the main feed to request complete random selections from `/feed`.
- Removed the video-count label above the feed while keeping the action buttons on the right.
- Added one-click filter reset and visible publication-date shortcuts.
- Send keyword filters to the feed service and document the searched fields.

### Fixed

- Recover channel avatars and view counts when the feed catalogue returns empty placeholder values.
- Avoid blocking card rendering on separate YouTube requests for every random ID.

### Preserved

- The configured `/feed` service contract and cursor paging.
- Current YouTube card rendering and filter settings.
- Hidden experimental local AI behavior.
