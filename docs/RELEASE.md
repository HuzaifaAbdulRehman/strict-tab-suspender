# Release process

1. Confirm the version follows Semantic Versioning and update `CHANGELOG.md` using Keep a Changelog categories.
2. Run `npm ci` and `npm run verify` on Node 20.11+ (the verification includes two cleanly generated ZIPs with identical SHA-256 digests).
3. Run the Chrome 121+ manual smoke tests described in `docs/TEST-PLAN.md` using a dedicated test profile. Automated browser tests are headless and must not open a visible Chrome window.
4. Run `npm run package` then `npm run package:verify`. Review all four generated files in `package/`: the ZIP, `.zip.sha256`, `.contents.txt`, and `.cdx.json` CycloneDX SBOM. Confirm the inventory contains only approved built extension files and a root `manifest.json`, then verify the checksum with a trusted SHA-256 tool.
5. Review `docs/WEB-STORE.md`, `docs/store-listing-draft.md`, and `docs/privacy-disclosure-draft.md`; complete the marked future publishing requirements in the publisher account.
6. After manual approval, tag the release as `v<version>` and attach the generated ZIP, checksum, inventory, and SBOM to the private GitHub release. Web Store publication remains deferred and requires a separate explicit decision.

Never publish a ZIP with repository files, tests, source files, lockfiles, or documentation. CI artifacts are build evidence, not approval to publish or tag a release.
