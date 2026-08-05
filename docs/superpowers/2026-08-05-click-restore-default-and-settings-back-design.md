# Click-to-Restore Default and Settings Back Design

## Goal

Make Strict Tab Discarder behave like the user's preferred suspender by default: an eligible tab is replaced by a lightweight local placeholder and remains there until the user explicitly selects **Restore tab**. Improve navigation from the full Settings page and make per-tab protection wording unambiguous.

## Product behavior

- New installs, upgrades from schema version 2, corrupt-setting recovery, and **Reset to defaults** use click-to-restore behavior.
- The existing **Open normally** option remains available for users who deliberately prefer Chrome's native automatic reload behavior.
- A protected tab may become inactive, but Strict Tab Discarder never suspends it until the user chooses **Allow suspension** or closes that tab.
- Each placeholder displays the complete original URL as an explicit restore link and uses the sanitized original page title as the Chrome tab title. A missing/invalid title falls back to **Suspended tab**.
- The popup provides **Suspend this tab now**. It bypasses only the active-tab and inactivity-threshold exclusions, while still refusing pinned, audible, protected (`autoDiscardable=false`), unsupported-scheme, missing-ID, and extension/Chrome tabs. It re-fetches and revalidates immediately before parking.
- Settings provides a visible, keyboard-accessible Back control. It first attempts to close the extension-opened Settings tab so Chrome returns to the previously selected tab. If Chrome does not permit closing that page, it navigates to the packaged popup screen in the same tab.

## Permission boundary

Click-to-restore requires reading the original HTTP(S) address of any eligible inactive tab. Because this must work without a separate permission gesture, `tabs` moves from `optional_permissions` into required `permissions` beside `alarms` and `storage`.

Chrome may disable an existing unpacked installation after this update until the owner re-enables it and accepts the warning **Read your browsing history**. The extension does not use the History API, store a browsing log, or transmit addresses or titles. Each validated credential-free original address and sanitized length-limited title remains only in that tab's percent-encoded packaged placeholder fragment. The visible title and URL can appear in Chrome's address bar, tab strip, session restore, and history.

The manifest retains no host permissions, content scripts, networking, telemetry, external messaging, or remote code.

## Settings and migration

- Introduce settings schema version 3.
- Version 3 defaults to `restoreBehavior: "click"`.
- Valid version 2 settings migrate to version 3 while preserving `enabled` and `idleMinutes` and setting `restoreBehavior` to `click`, including users whose version 2 value was `native`.
- Valid version 3 settings preserve an explicit later choice of `native` or `click`.
- Version 1 settings migrate directly to version 3 with click-to-restore.
- Malformed data continues to fail closed by pausing automation while using otherwise safe version 3 defaults.
- Switching to native behavior no longer attempts to remove `tabs`, because it is now a required permission.

## UI changes

- Add a Back button before the Settings brand header with a clear arrow icon, text label, visible focus treatment, and an accessible name.
- Mark **Click to restore** as the initially checked/default option in static markup so the loading state does not flash the wrong selection.
- Update the reset dialog to state that it restores automatic suspension, the 15-minute timeout, and click-to-restore.
- Replace protection guidance with language that distinguishes inactivity from suspension.
- Add **Suspend this tab now** beside the current-tab controls, with an accessible failure message when the current tab is protected or unsupported.
- Show the original URL as a safe text link on the placeholder; setting its `href` and restoring it both use the same validated decoded payload.
- Keep the existing warning that unsaved forms and in-memory work cannot be detected.

## Verification

- Unit tests cover version 1 and version 2 migration, version 3 persistence, reset/default behavior, malformed settings, and concurrent writes.
- Codec/controller tests cover URL/title round trips, title sanitization and bounds, safe link rendering, invalid payloads, and explicit link/button restoration.
- Worker/popup tests prove immediate current-tab suspension bypasses only active/age rules and still respects pinned, audible, protected, unsupported, missing-ID, and race checks.
- Options-controller tests prove native selection no longer removes a required permission.
- Manifest and package tests require exactly `alarms`, `storage`, and `tabs`, reject optional permissions, and retain all privacy/security boundaries.
- UI artifact tests cover the Back control, click-default markup, reset copy, and protection explanation.
- Chrome smoke testing confirms click-to-restore is the initial behavior, title and full URL appear locally, the placeholder waits for explicit restoration, immediate current-tab suspension works, Back has a safe fallback, protection toggles the intended tab, and both unpacked and packaged builds work.
- Documentation, ADR, privacy, permissions, installation, test, release, and changelog material describe the stronger required warning and version 0.3.0 migration.

## Non-goals

- No favicon retrieval, domain allowlist, content inspection, unsaved-form detection, browsing log, URL/title storage outside the tab fragment, network service, telemetry, or automatic submission.
- No change to the 15-minute timeout, five-minute startup grace, ten-tab batch limit, eligibility exclusions, race protections, or serial suspension behavior.
