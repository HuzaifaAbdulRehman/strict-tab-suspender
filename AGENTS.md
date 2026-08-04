# Repository instructions

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+.

- Keep production code TypeScript with vanilla HTML/CSS and zero runtime dependencies.
- Run `npm run verify` before proposing a change complete. Use `PUPPETEER_SKIP_DOWNLOAD=true` only when browser-based tests are not being run.
- Build and package through the Node scripts in `scripts/`; do not add PowerShell-only automation.
- Never introduce host permissions, URL/title/history access, network requests, telemetry, content scripts, remote code, accounts, or ads.
- The only permitted manifest permissions are `alarms` and `storage`.
- Do not persist URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity. Settings are local only and only the latest aggregate sweep summary may be retained.
- Preserve the product defaults: enabled, 15 minutes, presets 15/30/60/120, five-minute startup grace, and at most 10 serial discards per sweep.
- Use Conventional Commits, semantic versioning, and Keep a Changelog formatting.
