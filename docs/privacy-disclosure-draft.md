# Web Store privacy disclosure draft

Status: draft only. The 0.3.0 private beta is not published to the Chrome Web Store.

Strict Tab Discarder does not collect, share, sell, or transmit user data. Local extension storage contains only validated settings and the latest aggregate sweep summary. It has no host or optional permissions, network requests, telemetry, analytics, content scripts, remote code/configuration, accounts, or advertising.

Required permissions are exactly `alarms`, `storage`, and `tabs`. Chrome describes `tabs` as “Read your browsing history” because it exposes current tab URL/title metadata. The extension does not call the History API or retain a browsing database. URL/title metadata is used only for reviewed placeholder creation and immediate suspension. Per-tab protection separately changes only Chrome's transient `autoDiscardable` flag and does not consume URL/title metadata.

One validated credential-free HTTP(S) URL and sanitized bounded title may exist in that tab's percent-encoded packaged fragment and visible placeholder. The complete URL is an explicit restore link and the title appears in the browser tab; no favicon is retrieved. Percent encoding is not encryption, and Chrome may expose or retain the fragment in its address bar, session restore, or history. URL/title/domain/tab identifiers are not written to extension storage, logged, synchronized, transmitted, or sent to telemetry.

Before submission, re-answer the publisher dashboard's current data-use questions against the reviewed ZIP and hosted privacy policy. Account-specific submission is outside repository release work.
