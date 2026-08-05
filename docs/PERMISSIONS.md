# Permissions

Strict Tab Discarder 0.2.0 requires exactly:

| Permission | Purpose                                                           | Data boundary                                                        |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `alarms`   | Schedule periodic sweeps and startup grace.                       | No browsing data is retained.                                        |
| `storage`  | Keep validated settings and the latest aggregate summary locally. | No URL, title, domain, favicon, tab ID, or per-tab record is stored. |

Click-to-restore has one optional permission:

| Optional permission | Chrome warning               | Reviewed use                                                                                                                                                              |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`              | “Read your browsing history” | Read only the candidate tab's current URL to build its self-contained local placeholder. It is also checked before every click-mode sweep and immediately before parking. |

The extension does not call the history API. Denial or revocation leaves click mode unavailable; there is no silent native fallback. Returning to native mode saves that choice before requesting removal of `tabs`.

Host permissions, optional host permissions, content scripts, `history`, `scripting`, downloads, identity, sync, notifications, external messaging, and web-accessible resources are rejected. Any expansion requires a new ADR, privacy review, tests, and explicit maintainer approval.
