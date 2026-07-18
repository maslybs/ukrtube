# Security Policy

## Reporting a vulnerability

Do not disclose a security issue in a public issue. Use the hosting platform's private vulnerability reporting feature or contact the maintainers through a private channel.

Include the affected version, reproduction steps, expected impact, and any suggested mitigation. Do not include real user data or active credentials.

## Credentials

`src/config.local.js` is intentionally ignored by Git. Never commit real tokens. Credentials embedded in a browser extension can be extracted by users, so the server must enforce narrow permissions, rate limits, monitoring, expiry, and rotation.

If a token is committed or published, revoke and replace it immediately. Removing it from the latest commit is not enough because it may remain in repository history and external caches.
