# Contributing

Thank you for helping improve UkrTube.

## Before you start

1. Open an issue for a large behavior or architecture change.
2. Keep the extension compatible with Manifest V3.
3. Do not commit `src/config.local.js`, tokens, cookies, or private user data.
4. Preserve the current feed behavior unless the change explicitly updates it.

## Local workflow

1. Run `npm install`.
2. Create `src/config.local.js` from `src/config.js` and add a development token.
3. Make a focused change.
4. Run `npm run format`.
5. Run `npm run check`.
6. Load the unpacked extension and manually check the YouTube home page in both light and dark themes.

## Change checklist

- The Ukrainian tab appears and the native feed returns after leaving it.
- Refresh and infinite scrolling work without duplicate cards.
- Topic, keyword, preset date, and custom date filters still work.
- Settings survive a page reload.
- No credential or generated file is included.
- Documentation matches any visible behavior change.

Keep pull requests small enough to review and explain the reason for every behavior change.
