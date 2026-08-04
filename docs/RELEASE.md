# Private-beta release process

## Release checklist

1. Confirm `package.json`, `src/manifest.json`, and `CHANGELOG.md` identify the intended semantic version and that the changelog entry is dated correctly.
2. Run `npm ci`, then `npm run release:verify`. This performs formatting, linting, type checking, unit and integration tests, a clean build/package, strict package verification, Chrome smoke coverage, and generation of the SHA-256 checksum, CycloneDX SBOM, and reviewed contents list.
3. If Chrome is unavailable, run every non-browser check and record the limitation; run `npm run smoke:chrome` on Chrome 121+ before distributing the private beta.
4. Inspect `package/strict-tab-suspender-<version>.zip`, its `.sha256`, `.cdx.json`, and `.contents.txt` files. The archive must contain a root `manifest.json`, built service worker/UI/icons only, exact permissions `alarms` and `storage`, no host access, and no source, tests, docs, package metadata, or remote URLs/code.
5. Run `npm audit --omit=dev`, `git diff --check`, and confirm `git status --short` shows no tracked or untracked `dist/`, `package/`, Chrome profile, or other generated release artifacts.
6. Complete the manual cases in `docs/TEST-PLAN.md`, including multi-window, pinned, audible, sleep/wake, and service-worker restart behavior. Save test-page form work first.
7. Review `README.md`, `PRIVACY.md`, `SECURITY.md`, permission/data-flow docs, and the Web Store drafts against the built artifact.

Private-beta distribution is limited to the reviewed ZIP and its evidence files. Do not tag, publish, create a GitHub Release, or submit to the Chrome Web Store as part of this process.

## Rollback and upgrade

To roll back, stop distributing the affected ZIP, tell beta testers to remove it from `chrome://extensions`, and provide the prior reviewed archive only after its checksum is verified. Do not reuse an archive filename for changed bytes. For an upgrade, retain the manifest's local-only schema compatibility, build the new archive, use **Reload** for unpacked installs or reinstall the approved ZIP, and verify the settings/defaults and latest aggregate summary afterward. A schema or permission change requires explicit review, changelog notes, privacy review, and a new release gate.
