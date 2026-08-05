# Private-beta release process

## Release checklist

1. Confirm `package.json`, `package-lock.json`, `src/manifest.json`, and `CHANGELOG.md` identify version 0.3.0 and that the changelog entry is dated correctly.
2. Run `npm ci`, then `npm run release:verify`. This performs formatting, linting, type checking, unit/integration tests, a clean build/package, strict package verification, Chrome smoke coverage, and generation of the SHA-256 checksum, CycloneDX SBOM, and reviewed contents list.
3. If Chrome is unavailable, run every non-browser check and record the limitation; complete both unpacked and packaged Chrome modes before distributing the private beta.
4. Inspect the exact generated files: `package/strict-tab-suspender-0.3.0.zip`, `package/strict-tab-suspender-0.3.0.zip.sha256`, `package/strict-tab-suspender-0.3.0.cdx.json`, and `package/strict-tab-suspender-0.3.0.contents.txt`. The archive must contain only reviewed built assets; required permissions must be exactly `alarms`, `storage`, and `tabs`, with no optional/host permissions, remote URLs/code, source, tests, docs, or package metadata.
5. Run `npm audit --omit=dev`, `git diff --check`, and confirm no tracked or untracked generated `dist/`, `package/`, Chrome profile, or other release artifact is staged.
6. Complete `docs/TEST-PLAN.md`, including click default, explicit restore, complete URL/title visibility, no favicon/network, immediate suspension safeguards, protection, restart recovery, multi-window, pinned, audible, sleep/wake, and Settings Back.
7. Review `README.md`, `PRIVACY.md`, `SECURITY.md`, permission/data-flow docs, ADR 0003, and Web Store drafts against the built artifact.

Private-beta distribution is limited to the reviewed ZIP and its evidence files. Do not tag, publish, create a GitHub Release, or submit to the Chrome Web Store as part of this process.

## Upgrade and rollback

Existing v1/v2 settings migrate to schema 3 with click restore. Installing, upgrading, or re-enabling 0.3.0 may show Chrome's new required `tabs` warning. To roll back the reviewed behavior, stop distributing 0.3.0 and return to the verified 0.2.0 archive after recovering suspended addresses and checking its recorded checksum. An extension-ID change can make old placeholder origins unavailable. Never reuse an archive filename for changed bytes.
