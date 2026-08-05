# Product requirements

## Purpose and UX contract

Strict Tab Discarder reduces memory pressure by suspending eligible inactive Chrome tabs. Chrome 121+ users get a packaged page that waits for explicit restoration by default; a valid schema-3 native choice remains supported.

| Setting or rule                          | Value                                                      |
| ---------------------------------------- | ---------------------------------------------------------- |
| Enabled/default threshold                | Yes / 15 minutes                                           |
| Presets                                  | 15 / 30 / 60 / 120 minutes                                 |
| Startup grace / sweep limit              | 5 minutes / 10 serial outcomes                             |
| Always protected                         | Active, pinned, audible, or `autoDiscardable=false` tabs   |
| Restore behavior default/reset/migration | Click to restore                                           |
| Alternative                              | Explicit schema-3 native choice                            |
| Per-tab actions                          | Suspend this tab now / Protect this tab / Allow suspension |

The placeholder uses a sanitized bounded original title as the browser tab title and displays the complete validated original URL as an explicit restore link. It does not retrieve a favicon or restore merely because it becomes active.

**Suspend this tab now** bypasses only active and idle-age exclusions. Pinned, audible, already-discarded, protected/non-auto-discardable, unsupported, changed, missing-ID, closed, pending-navigation, revalidation, and race safeguards remain.

The popup exposes only aggregate results and generic protection state. This tab may become inactive, but it is never suspended while protected. Protection ends when explicitly allowed or the tab closes; it is not a permanent website/domain allowlist.

Settings and the latest aggregate summary are local. Click mode carries one validated credential-free URL and sanitized title only in that tab's percent-encoded packaged fragment and visible UI. Chrome may retain the fragment in its own address bar/session/history surfaces, but the extension never stores, logs, synchronizes, transmits, or sends URL/title/domain/tab identifiers to telemetry.

## Non-goals and limitations

No host/optional permission, page-content inspection, History API, unsaved-form detection, favicon retrieval, domain allowlist, network service, analytics, sync, remote code/configuration, session manager, or automatic restore from the placeholder is in scope. Alarm timing is approximate. Save important work before suspension.
