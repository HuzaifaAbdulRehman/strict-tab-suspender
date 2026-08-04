# Contributing

Use Node.js 20.19+ (Node 22 recommended) and install with `npm ci`. Before submitting a pull request, run `npm run verify`.

Write tests first for behavior changes, use TypeScript and vanilla HTML/CSS, and keep runtime dependencies at zero. Commit messages follow Conventional Commits, for example `feat: add eligibility evaluator` or `docs: clarify privacy boundary`.

Changes that affect permissions, retained data, URL lifetime, or privacy promises require documentation updates and an ADR. Do not add host permissions, network access, telemetry, content scripts, remote code, accounts, ads, or browsing-data logging. The optional `tabs` permission is limited to ADR 0002's validated click-to-restore parking; per-tab protection may change only `autoDiscardable`.

Permission/privacy changes must update `AGENTS.md`, `PRIVACY.md`, the permission/data-flow docs, Web Store drafts, exact manifest/package allowlists, corruption/race/recovery tests, and the changelog. Never include real browsing data in fixtures or reports.
