# Privacy policy

Strict Tab Discarder is private-first. It does not collect, transmit, sell, or share personal data. It has no host permissions, content scripts, network requests, telemetry, analytics, remote code, accounts, or advertising.

Chrome storage contains only validated local settings and the latest aggregate sweep summary. The extension does not store URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity in extension storage.

Native mode does not need URL access. Optional click-to-restore mode asks for Chrome's `tabs` permission, which Chrome describes as “Read your browsing history.” The extension uses it only to read a candidate tab's current HTTP(S) address, validate it, and put it in that tab's packaged suspended-page fragment. It does not use the history API.

The original address is percent-encoded in a `chrome-extension://…/suspended/index.html#…` address so the Restore button survives service-worker and browser restarts. Percent encoding is not encryption. Chrome may retain or expose that suspended address in the address bar, session restore, or browsing history. The extension does not copy it into extension storage, display it in its UI, log it, or transmit it. Only HTTP(S) addresses without embedded credentials are accepted, and the complete suspended address is limited to 65,536 characters.

Per-tab protection changes only Chrome's transient `autoDiscardable` flag and ends when that tab closes. It does not create a website or domain allowlist.

Chrome does not provide a reliable signal for all unsaved forms. The extension cannot detect unsaved forms; save important work before relying on automatic suspension.
