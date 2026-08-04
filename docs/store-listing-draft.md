# Store listing draft

Status: draft only. No listing, assets, or publication action is included in the 0.2.0 private beta.

## Name

Strict Tab Discarder

## Short description

Privately suspend eligible inactive Chrome tabs with native or explicit-click restore.

## Full description

Strict Tab Discarder is a focused Chrome 121+ extension. It starts with a 15-minute threshold, offers 15/30/60/120-minute presets, waits five minutes after startup, and processes no more than ten tabs serially per sweep.

Active, pinned, audible, and protected tabs remain untouched. **Protect this tab** is temporary and ends when the tab closes.

Native mode reloads through Chrome when a discarded tab is opened. Optional **Click to restore** shows a local lightweight page and waits for **Restore tab**. Chrome labels its optional `tabs` permission “Read your browsing history”; the extension does not use the history API. It puts a validated original HTTP(S) address only in that tab's percent-encoded local placeholder. Percent encoding is not encryption, and Chrome may retain that placeholder in its address bar/session/history.

There are no host permissions, network calls, telemetry, ads, accounts, content scripts, or URL database. Settings and only the latest aggregate sweep summary stay in local extension storage.

Important: unsaved forms cannot be detected. Save important work before automatic suspension.
