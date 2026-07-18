# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-07-18

### Added

- Server-side topic, keyword, and publication-date filters.
- Cursor-based infinite scrolling.
- Separate Ukrainian and English project documentation.
- Structural and runtime contract checks.

### Changed

- Renamed the extension to UkrTube and aligned all internal identifiers.
- Split the background worker, content runtime, offscreen AI runtime, and styles into focused modules.
- Moved local API credentials to an ignored override file.

### Fixed

- Recover channel avatars and view counts when the feed catalogue returns empty placeholder values.

### Preserved

- Existing feed messages and server query parameters.
- Current YouTube card rendering and filter settings.
- Hidden experimental local AI behavior.
