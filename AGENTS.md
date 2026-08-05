# Repository instructions

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+.

- Keep production code TypeScript with vanilla HTML/CSS and zero runtime dependencies.
- Run `npm run verify` before proposing a change complete. Run `npm run release:verify` before release claims.
- Build and package through the Node scripts in `scripts/`; do not add PowerShell-only automation.
- Required manifest permissions must remain exactly `alarms` and `storage`. The only approved optional permission is the optional `tabs` permission documented in ADR 0002.
- Use `tabs` URL access only to create the reviewed click-to-restore placeholder. Use `autoDiscardable` only for the reviewed per-tab protection action. Any other use requires a new ADR, privacy review, tests, and maintainer approval.
- Never introduce host permissions, optional host permissions, history API access, network requests, telemetry, content scripts, remote code, accounts, ads, or browsing-data logs.
- Never persist URLs, titles, favicons, domains, tab IDs, or per-tab activity in extension storage. Click mode may place one validated HTTP(S) original address in that tab's percent-encoded local URL fragment; it must never be logged or transmitted.
- Preserve enabled/15-minute defaults, 15/30/60/120 presets, five-minute startup grace, protected active/pinned/audible/not-auto-discardable tabs, and at most 10 serial suspension outcomes per sweep.
- Preserve immediate candidate revalidation, activation-race recovery, explicit tab IDs, and fail-closed behavior.
- Use Conventional Commits, semantic versioning, Keep a Changelog, and test-first development.
