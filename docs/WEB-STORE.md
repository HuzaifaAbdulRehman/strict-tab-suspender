# Chrome Web Store draft scope

Strict Tab Discarder v0.3.0 is a private beta and is not published to the Chrome Web Store. This document records the publication work that remains outside the repository release process.

## Before any submission

- Provide publisher identity, verified developer account, support contact, category, screenshots, and promotional assets outside this repository task.
- Use only a freshly reviewed 0.3.0 ZIP whose checksum, CycloneDX SBOM, and contents inventory match the release evidence.
- Re-answer the current publisher dashboard privacy questions against the built artifact.

The listing/disclosure must state required permissions exactly `alarms`, `storage`, and `tabs`; no optional or host permissions; Chrome's “Read your browsing history” warning; no History API or browsing database; default click-to-restore and v1/v2 migration; visible complete URL and sanitized bounded title in the percent-encoded packaged fragment; percent encoding is not encryption; no favicon, network, URL/title log, content script, remote code/configuration, accounts, analytics, ads, or telemetry; immediate-action safeguards; per-tab protection semantics; extension-ID recovery risk; unsaved-form limitation; and approximate alarm timing.

Do not submit or publish as part of the private-beta process.
