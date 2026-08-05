# Store listing draft

Status: draft only. No listing, assets, or publication action is included in the 0.3.0 private beta.

## Name

Strict Tab Discarder

## Short description

Privately suspend eligible inactive Chrome tabs and restore them only when you choose.

## Full description

Strict Tab Discarder is a focused Chrome 121+ extension. It starts with a 15-minute threshold, offers 15/30/60/120-minute presets, waits five minutes after startup, and processes no more than ten tabs serially per sweep. Alarm timing is approximate when Chrome is busy or sleeping.

Click-to-restore is the default and v1/v2 migration behavior. A suspended tab shows its sanitized original title and complete validated URL on a lightweight packaged page and waits for the URL link or **Restore tab**. An explicit schema-3 native choice remains available.

Active, pinned, audible, and protected tabs remain untouched during automatic sweeps. A protected tab may become inactive but never suspends until **Allow suspension** is selected or the tab closes. **Suspend this tab now** bypasses active/age only and retains every other state, identity, URL, revalidation, pending-navigation, and race safeguard.

Required permissions are exactly `alarms`, `storage`, and `tabs`. Chrome labels `tabs` “Read your browsing history”; the extension does not use the History API or retain a browsing database. It carries one validated URL and sanitized title only in that tab's percent-encoded local fragment and visible UI. Percent encoding is not encryption, and Chrome may retain that placeholder in its address bar/session/history.

There are no optional/host permissions, favicon requests, network calls, telemetry, ads, accounts, content scripts, remote code/configuration, or URL/title logs. Settings and only the latest aggregate sweep summary stay in local extension storage.

Important: unsaved forms cannot be detected. Save important work before automatic suspension.
