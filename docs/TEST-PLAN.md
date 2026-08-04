# Test plan

## Automated coverage

- `npm run verify` runs format checking, linting, type checking, unit tests, integration tests, a clean build, packaging, and strict package validation.
- `npm run smoke:chrome` loads both `dist/` and the generated ZIP into Chrome headlessly, then exercises popup controls, options persistence, reset confirmation, and extension startup.
- `npm run package` emits the ZIP plus a SHA-256 checksum, CycloneDX SBOM, and sorted archive inventory in `package/`.

## Manual Chrome 121+ cases

Use a throwaway profile and test pages with no unsaved form data.

- Open tabs in two browser windows; confirm only eligible inactive tabs are considered and no more than ten are discarded per sweep.
- Keep one tab pinned and one audible; confirm both remain protected.
- Pause/resume automation and change every preset (15, 30, 60, and 120 minutes); reload the extension and confirm settings persist locally.
- Put the device to sleep and wake it after the threshold; confirm a later alarm sweep remains guarded and no unexpected mass discard occurs.
- Stop/restart the extension service worker from `chrome://extensions`, then confirm the startup grace period and alarm scheduling recover.
- Trigger a manual sweep, reset settings through the options dialog, and confirm the UI exposes only aggregate results.

## Release gate

Follow `docs/RELEASE.md`. Inspect the final archive list and evidence files, verify the checksum, and record any environment where Chrome smoke could not run. Unsaved-form detection is not available.
