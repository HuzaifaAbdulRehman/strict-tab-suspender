# Private-beta release process

## Release checklist

1. Confirm `package.json`, `src/manifest.json`, and `CHANGELOG.md` identify the intended semantic version and that the changelog entry is dated correctly.
2. Run `npm ci`, then `npm run release:verify`. This performs formatting, linting, type checking, unit and integration tests, a clean build/package, strict package verification, Chrome smoke coverage, and generation of the SHA-256 checksum, CycloneDX SBOM, and reviewed contents list.
3. If Chrome is unavailable, run every non-browser check and record the limitation; run `npm run smoke:chrome` on Chrome 121+ before distributing the private beta.
4. Inspect `package/strict-tab-suspender-<version>.zip`, its `.sha256`, `.cdx.json`, and `.contents.txt` files. The archive must contain only reviewed built assets, required permissions exactly `alarms`/`storage`, optional permission exactly `tabs`, no host/optional-host access, and no source, tests, docs, package metadata, or remote URLs/code.
5. Run `npm audit --omit=dev`, `git diff --check`, and confirm `git status --short` shows no tracked or untracked `dist/`, `package/`, Chrome profile, or other generated release artifacts.
6. Complete `docs/TEST-PLAN.md`, including the owner-profile 15-minute click-mode, explicit restore, per-tab protection, restart recovery, multi-window, pinned, audible, and sleep/wake checks. Save test-page work first.
7. Review `README.md`, `PRIVACY.md`, `SECURITY.md`, permission/data-flow docs, and the Web Store drafts against the built artifact.

Private-beta distribution is limited to the reviewed ZIP and its evidence files. Do not tag, publish, create a GitHub Release, or submit to the Chrome Web Store as part of this process.

## Rollback and upgrade

To roll back, stop distributing the affected ZIP and provide a prior reviewed archive only after verifying its checksum. Recover needed suspended addresses before removing/reinstalling because an extension-ID change can make old placeholder origins unavailable. Never reuse an archive filename for changed bytes. Schema, permission, or placeholder-format changes require changelog/privacy/recovery review and a new release gate.
