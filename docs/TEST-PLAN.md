# Test plan

## Unit tests (Vitest)

- Validate settings defaults and 15/30/60/120-minute preset selection.
- Validate eligibility exclusions for active, pinned, audible, already-discarded, and not-auto-discardable tabs.
- Validate the five-minute startup grace and 10-item serial sweep cap.
- Validate that persisted values contain local settings and the latest aggregate summary only.
- Validate build-package path safety and root-manifest validation.

## Integration tests (Vitest + Puppeteer)

- Load the unpacked build in Chrome 121+.
- Confirm the manifest requests only `alarms` and `storage`, with no host permissions.
- Exercise options persistence and service-worker alarm scheduling without visiting or collecting page data.
- Verify protected tabs are not discarded and eligible tabs are processed serially up to the cap.

## Release gate

Run `npm run verify`, a Chrome 121+ manual smoke test, and inspect the ZIP entries before release. Use a test profile and pages without unsaved work; unsaved-form detection is not possible.
