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
- Changed the main feed to request a fresh selection from `/random`.
- Removed the video-count label above the feed while keeping the action buttons on the right.
- Added one-click filter reset and visible publication-date shortcuts.
- Clarified that keyword filters search the loaded video metadata locally.

### Fixed

- Recover channel avatars and view counts when the feed catalogue returns empty placeholder values.
- Prevent deterministic `/feed` results from being reused after a page reload.

### Preserved

- The configured `/random` service contract.
- Current YouTube card rendering and filter settings.
- Hidden experimental local AI behavior.
