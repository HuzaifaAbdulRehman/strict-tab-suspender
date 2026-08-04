# Contributing

Use Node.js 20.11+ and install with `npm ci`. Before submitting a pull request, run `npm run verify`.

Write tests first for behavior changes, use TypeScript and vanilla HTML/CSS, and keep runtime dependencies at zero. Commit messages follow Conventional Commits, for example `feat: add eligibility evaluator` or `docs: clarify privacy boundary`.

Changes that affect permissions, retained data, or privacy promises require documentation updates and an ADR. Do not add host permissions, network access, telemetry, content scripts, remote code, accounts, ads, or browsing-data logging.
