# Privacy policy

Strict Tab Discarder is private-first. It does not collect, transmit, sell, or share personal data. It has no host or optional permissions, content scripts, network requests, telemetry, analytics, remote code, accounts, remote configuration, or advertising.

Chrome storage contains only validated local settings and the latest aggregate sweep summary. The extension does not store URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity in extension storage.

Required `tabs` permission lets click-to-restore read current tab URL/title metadata. Chrome describes this as “Read your browsing history,” but the extension does not call the History API or retain a browsing-history database.

A validated credential-free HTTP(S) original address and sanitized bounded title are percent-encoded in a `chrome-extension://…/suspended/index.html#…` address so explicit restoration survives service-worker and browser restarts. The placeholder uses the title as its browser tab title and displays the complete original URL as a restore link; no favicon is retrieved. Percent encoding is not encryption. Chrome may retain or expose that suspended address in the address bar, session restore, or browsing history. The extension does not copy URL, title, domain, or tab identifiers into extension storage, log, synchronize, transmit, or send them to telemetry. The complete suspended address is limited to 65,536 characters.

**Suspend this tab now** uses current URL/title metadata only after a fresh active-tab query and exact-ID revalidation. It bypasses only active and idle-age exclusions; pinned, audible, already-discarded, protected/non-auto-discardable, unsupported, changed, closed, and pending-navigation cases remain guarded and fail closed.

Per-tab protection changes only Chrome's transient `autoDiscardable` flag and ends when that tab closes. A tab may become inactive but is never suspended while protected. It does not create a website or domain allowlist.

Chrome does not provide a reliable signal for all unsaved forms. The extension cannot detect unsaved forms; save important work before relying on automatic suspension. Alarm timing is approximate because Chrome may delay service-worker alarms.
