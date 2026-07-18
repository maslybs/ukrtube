# Security Policy

## Reporting a vulnerability

Do not disclose a security issue in a public issue. Use the hosting platform's private vulnerability reporting feature or contact the maintainers through a private channel.

Include the affected version, reproduction steps, expected impact, and any suggested mitigation. Do not include real user data or active credentials.

## Credentials

API keys entered on the options page are stored in `chrome.storage.local` for the current Chrome profile. They are not synchronized by the extension or written to repository files. Never commit real tokens. Credentials used by a browser extension can still be extracted by a person who controls the profile, so the server must enforce narrow permissions, rate limits, monitoring, expiry, and rotation.

If a token is committed or published, revoke and replace it immediately. Removing it from the latest commit is not enough because it may remain in repository history and external caches.
