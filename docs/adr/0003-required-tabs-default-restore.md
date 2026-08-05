# ADR 0003: Required tabs permission and default click restore

- Status: accepted
- Date: 2026-08-05
- Owner approval: Huzaifa Abdul Rehman explicitly approved the required permission and reviewed behavior on 2026-08-05.
- Supersedes: ADR 0002 only for permission optionality, restore default/migration, and reviewed URL/title visibility. ADR 0002's remaining safety and recovery constraints continue to apply.

## Context

The owner wants automatic suspension to show a recognizable lightweight placeholder that remains until an explicit restore action. That default requires URL/title metadata without a later settings gesture. The owner also requested a guarded immediate current-tab action and visible original context.

Chrome describes `tabs` access as “Read your browsing history” because it exposes current tab URL/title metadata. The extension does not call the History API and does not retain a browsing-history database.

## Decision

Required permissions are exactly `alarms`, `storage`, and `tabs`; no optional or host permissions are declared. Click-to-restore is the default/reset behavior under schema 3. Valid v1/v2 settings migrate to schema 3 with click restore; an explicit valid schema-3 native choice remains supported. Installing, upgrading, or re-enabling 0.3.0 may show the required-permission warning.

For a reviewed candidate, the extension accepts only a credential-free HTTP(S) original URL and a title sanitized of control/format characters, whitespace-normalized, bounded to 256 Unicode code points, and given the fallback `Suspended tab`. The version-2 percent-encoded packaged fragment is limited so the complete production placeholder never exceeds 65,536 characters. Percent encoding is not encryption.

The visible packaged placeholder uses the sanitized original title as its browser tab title and the complete validated URL as an explicit restore link. The link and Restore button share the same validated explicit restore path. No favicon is retrieved. URL/title data exist only transiently in memory and in that tab's fragment/visible UI; they are never stored in extension storage, logged, synchronized, transmitted, or sent to telemetry.

**Suspend this tab now** bypasses only active and idle-age exclusions. It retains pinned, audible, already-discarded, protected/non-auto-discardable, supported-URL, exact-ID, immediate revalidation, pending-navigation, and activation/race safeguards. Per-tab protection may allow inactivity but prevents suspension until explicitly allowed or the tab closes; it is not a permanent domain allowlist.

No History API, network, host permission, content script, remote code/configuration, account, analytics, advertising, browsing log, or telemetry is introduced. The extension still cannot detect unsaved forms, and alarm timing remains approximate.

## Consequences

The stronger required permission creates a visible Chrome warning and can require existing owners to re-enable the extension. Chrome may expose or retain a placeholder in the address bar, tab strip, session restore, and history. Privacy, package, migration, race, recovery, Chrome smoke, and store-disclosure tests are release gates.

## Rollback to 0.2.0

Stop distributing 0.3.0, recover needed suspended addresses, verify the recorded checksum of the reviewed 0.2.0 archive, and install that artifact. Rolling back restores ADR 0002's optional/native behavior but may require settings migration handling; extension-ID changes can make old placeholder origins unavailable.
