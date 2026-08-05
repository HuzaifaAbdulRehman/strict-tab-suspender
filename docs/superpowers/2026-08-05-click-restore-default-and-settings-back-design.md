# Click-to-Restore Default and Settings Back Design

## Goal

Make Strict Tab Discarder behave like the user's preferred suspender by default: an eligible tab is replaced by a lightweight local placeholder and remains there until the user explicitly selects **Restore tab**. Improve navigation from the full Settings page and make per-tab protection wording unambiguous.

## Product behavior

- New installs, upgrades from schema version 2, corrupt-setting recovery, and **Reset to defaults** use click-to-restore behavior.
- The existing **Open normally** option remains available for users who deliberately prefer Chrome's native automatic reload behavior.
- A protected tab may become inactive, but Strict Tab Discarder never suspends it until the user chooses **Allow suspension** or closes that tab.
- Settings provides a visible, keyboard-accessible Back control. It first attempts to close the extension-opened Settings tab so Chrome returns to the previously selected tab. If Chrome does not permit closing that page, it navigates to the packaged popup screen in the same tab.

## Permission boundary

Click-to-restore requires reading the original HTTP(S) address of any eligible inactive tab. Because this must work without a separate permission gesture, `tabs` moves from `optional_permissions` into required `permissions` beside `alarms` and `storage`.

Chrome may disable an existing unpacked installation after this update until the owner re-enables it and accepts the warning **Read your browsing history**. The extension does not use the History API, store a browsing log, or transmit addresses. Each validated credential-free original address remains only in that tab's percent-encoded packaged placeholder fragment.

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
- Keep the existing warning that unsaved forms and in-memory work cannot be detected.

## Verification

- Unit tests cover version 1 and version 2 migration, version 3 persistence, reset/default behavior, malformed settings, and concurrent writes.
- Options-controller tests prove native selection no longer removes a required permission.
- Manifest and package tests require exactly `alarms`, `storage`, and `tabs`, reject optional permissions, and retain all privacy/security boundaries.
- UI artifact tests cover the Back control, click-default markup, reset copy, and protection explanation.
- Chrome smoke testing confirms click-to-restore is the initial behavior, the placeholder waits for explicit restoration, Back has a safe fallback, protection toggles the intended tab, and both unpacked and packaged builds work.
- Documentation, ADR, privacy, permissions, installation, test, release, and changelog material describe the stronger required warning and version 0.3.0 migration.

## Non-goals

- No domain allowlist, content inspection, unsaved-form detection, browsing log, URL storage, network service, telemetry, or automatic submission.
- No change to the 15-minute timeout, five-minute startup grace, ten-tab batch limit, eligibility exclusions, race protections, or serial suspension behavior.
