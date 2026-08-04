# Release process

1. Confirm the version follows Semantic Versioning and update `CHANGELOG.md` using Keep a Changelog categories.
2. Run `npm ci` and `npm run verify` on Node 20.11+.
3. Run the Chrome 121+ integration and manual smoke tests described in `docs/TEST-PLAN.md`.
4. Run `npm run package` then `npm run package:verify`; inspect that the ZIP contains only built extension files and a root `manifest.json`.
5. Review `docs/WEB-STORE.md`, `docs/store-listing-draft.md`, and `docs/privacy-disclosure-draft.md`; complete the marked future publishing requirements in the publisher account.
6. Tag the release as `v<version>` and publish only the generated `package/strict-tab-suspender-<version>.zip`.

Never publish a ZIP with repository files, tests, source files, lockfiles, or documentation.
