# Product requirements

## Purpose and UX contract

Strict Tab Discarder reduces memory pressure by suspending eligible inactive Chrome tabs. Chrome 121+ users may keep native reload-on-activation behavior or explicitly grant optional permission for a packaged page that waits for **Restore tab**.

| Setting or rule             | Value                                                    |
| --------------------------- | -------------------------------------------------------- |
| Enabled/default threshold   | Yes / 15 minutes                                         |
| Presets                     | 15 / 30 / 60 / 120 minutes                               |
| Startup grace / sweep limit | 5 minutes / 10 serial outcomes                           |
| Always protected            | Active, pinned, audible, or `autoDiscardable=false` tabs |
| Restore behavior default    | Native                                                   |
| Optional behavior           | Click to restore, permission-gated                       |
| Per-tab action              | Protect this tab / Allow suspension                      |

The popup exposes only aggregate results and generic protection state—never URL, title, domain, or favicon. Per-tab protection is not a persistent website allowlist.

Settings and the latest aggregate summary are local. Click mode temporarily reads one candidate URL and carries it only in that tab's local placeholder fragment. Percent encoding is not encryption, and Chrome may retain that address in its own address bar/session/history surfaces.

## Non-goals and limitations

No host access, page-content inspection, unsaved-form detection, domain allowlist, network service, analytics, sync, session manager, or automatic restore from the placeholder is in scope. Save important work before suspension.
