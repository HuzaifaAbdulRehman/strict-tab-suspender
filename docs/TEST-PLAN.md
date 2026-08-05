# Test plan

## Automated coverage

- `npm run verify` runs format checking, linting, type checking, unit tests, integration tests, a clean build, packaging, strict package validation, and reproducibility checks.
- `npm run smoke:chrome` loads both `dist/` and the generated ZIP into Chrome headlessly and exercises click-default settings, immediate suspension, recognizable placeholders, inactive-to-active no-restore behavior, keyboard restoration, protection, Settings Back fallback, and no external extension request including favicon/image requests.
- `npm run package` emits the ZIP plus a SHA-256 checksum, CycloneDX SBOM, and sorted archive inventory in `package/`.

## Manual Chrome 121+ cases

Use a throwaway profile and pages with no unsaved form data.

- Accept the required `tabs` warning, then confirm the manifest has exactly `alarms`, `storage`, and `tabs`, with no optional/host permissions.
- Open tabs in two windows; confirm active, pinned, audible, and protected tabs remain untouched and no sweep exceeds ten serial outcomes.
- Confirm native mode skips already-discarded tabs, while click mode may convert an eligible already-discarded HTTP(S) tab only through the verified path that never reloads the original page.
- Confirm click-to-restore is the new/reset/migrated default, and an explicit schema-3 native choice persists.
- Confirm the placeholder's browser-tab title is the sanitized original title, its complete URL link is visible/clickable, no favicon/network request occurs, and activation alone does not restore it.
- Exercise **Suspend this tab now** and confirm it bypasses active/age only while all other state, exact-ID, supported-URL, pending-navigation, and race checks remain.
- Protect a tab, leave it inactive, and confirm it never suspends until **Allow suspension** is selected or the tab closes.
- Pause/resume, test all presets, sleep/wake, terminate the service worker, restart Chrome, use Settings Back, and confirm persisted state/startup grace/alarm scheduling recover.
- Confirm UI and stored data expose only validated settings and the latest aggregate summary, with no URL/title/domain/tab log.

## Release gate

Follow `docs/RELEASE.md`. Inspect the final archive list, SBOM, checksum, and both Chrome modes. Unsaved-form detection is unavailable and alarm timing is approximate.
