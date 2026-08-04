# Architecture

The future Manifest V3 extension will have a service worker for alarms, eligibility evaluation, local settings, and serial discard orchestration. Vanilla HTML/CSS option and popup pages will read and update only local settings and the latest aggregate sweep summary.

The service worker will use `chrome.tabs.query` only to identify eligible tabs and `chrome.tabs.discard` only after safeguards are checked. Tab metadata is evaluated in memory and discarded after each sweep; it is not persisted or logged.

There are no content scripts, remote code, network services, accounts, analytics, or ads. Build output is generated into `dist/`, and `scripts/package-extension.mjs` will ZIP only that output after it contains a manifest.
