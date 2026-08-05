# Web Store privacy disclosure draft

Status: draft only. The 0.2.0 private beta is not published to the Chrome Web Store.

Strict Tab Discarder does not collect, share, sell, or transmit user data. Local extension storage contains only validated settings and the latest aggregate sweep summary. It has no host permissions, network requests, telemetry, analytics, content scripts, remote code, accounts, or advertising.

Required permissions are `alarms` and `storage`. Optional click-to-restore requests `tabs`, which Chrome describes as “Read your browsing history.” The extension does not use the history API. It uses URL access only to validate a credential-free HTTP(S) candidate and place the original address in that same tab's packaged suspended-page fragment.

The fragment is percent-encoded, not encrypted, and can appear in Chrome's address bar, session restore, or history. It is not written to extension storage, rendered in the extension UI, logged, or transmitted. Per-tab protection changes only `autoDiscardable` and stores no website allowlist.

Before submission, re-answer the publisher dashboard's current data-use questions against the reviewed ZIP and hosted privacy policy. Account-specific submission is outside repository release work.
