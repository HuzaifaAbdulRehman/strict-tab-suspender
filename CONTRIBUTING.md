# Contributing

Use Node.js 20.19+ (Node 22 recommended) and install with `npm ci`. Before submitting a pull request, run `npm run verify`.

Write tests first for behavior changes, use TypeScript and vanilla HTML/CSS, and keep runtime dependencies at zero. Commit messages follow Conventional Commits, for example `feat: add eligibility evaluator` or `docs: clarify privacy boundary`.

Changes that affect permissions, retained data, URL/title lifetime, or privacy promises require documentation updates and an ADR. Required permissions must remain exactly `alarms`, `storage`, and `tabs`; no optional or host permissions are approved. Under ADR 0003, URL/title access is limited to the validated, bounded click-to-restore placeholder and the reviewed immediate current-tab action. Per-tab protection may change only Chrome's transient `autoDiscardable` flag. Do not add network access, telemetry, content scripts, History API use, remote code/configuration, accounts, ads, or browsing-data logging.

Permission/privacy changes must update `AGENTS.md`, `PRIVACY.md`, the permission/data-flow docs, Web Store drafts, exact manifest/package allowlists, corruption/race/recovery tests, and the changelog. Never include real browsing data in fixtures or reports.
