# Product requirements

## Purpose

Strict Tab Discarder reduces memory pressure by automatically discarding only eligible inactive Chrome tabs. It is a private-first MV3 extension for Chrome 121+.

## Defaults and safeguards

| Setting or rule              | Value                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| Enabled by default           | Yes                                                                 |
| Default inactivity threshold | 15 minutes                                                          |
| Presets                      | 15 / 30 / 60 / 120 minutes                                          |
| Startup grace period         | 5 minutes                                                           |
| Sweep limit                  | 10 serial discards                                                  |
| Protected tabs               | Active, pinned, audible, already discarded, or not auto-discardable |

Settings are local only. The extension retains only the latest aggregate sweep summary. It never records URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity.

## Known limitation

Chrome cannot reliably expose every unsaved form state. The extension cannot detect unsaved forms and must tell users to save important work before automatic discarding.
