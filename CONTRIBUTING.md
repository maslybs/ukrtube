# Contributing

Thank you for helping improve UkrTube.

## Before you start

1. Open an issue for a large behavior or architecture change.
2. Keep the extension compatible with Manifest V3.
3. Do not commit tokens, cookies, or private user data.
4. Preserve the current feed behavior unless the change explicitly updates it.

## Local workflow

1. Run `npm install`.
2. Load the unpacked extension and add a development API key through its options page.
3. Make a focused change.
4. Run `npm run format`.
5. Run `npm run check`.
6. Manually check the YouTube home page and the options page in both light and dark themes.

## Change checklist

- The Ukrainian tab appears and the native feed returns after leaving it.
- Refresh and infinite scrolling work without duplicate cards.
- Topic, keyword, preset date, and custom date filters still work.
- Settings survive a page reload.
- Saving, testing, and removing the API key work from the options page.
- No credential or generated file is included.
- Documentation matches any visible behavior change.

Keep pull requests small enough to review and explain the reason for every behavior change.
