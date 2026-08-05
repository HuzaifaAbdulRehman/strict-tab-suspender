# Permissions

Strict Tab Discarder 0.3.0 requires exactly:

| Permission | Purpose                                                                                                                                               | Data boundary                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `alarms`   | Schedule periodic sweeps and startup grace.                                                                                                           | No browsing data is retained.                                                                            |
| `storage`  | Keep validated settings and the latest aggregate summary locally.                                                                                     | No URL, title, domain, favicon, tab ID, or per-tab record is stored.                                     |
| `tabs`     | Read current tab URL/title metadata for the reviewed click-to-restore placeholder and immediate action; use `autoDiscardable` for per-tab protection. | One validated URL and sanitized title stay in that tab's packaged fragment and visible placeholder only. |

Chrome displays “Read your browsing history” because `tabs` exposes current tab URL/title metadata. The extension does not call the History API and does not retain a browsing-history database. Installing, updating, or re-enabling 0.3.0 may require accepting this warning.

There are no optional permissions, host permissions, or optional host permissions. Content scripts, `history`, `scripting`, downloads, identity, sync, notifications, external messaging, and web-accessible resources are rejected. There is no network, remote code, telemetry, remote configuration, account, analytics, or advertising capability.

Any new permission or broader `tabs` use requires a new ADR, privacy review, tests, and explicit maintainer approval.
