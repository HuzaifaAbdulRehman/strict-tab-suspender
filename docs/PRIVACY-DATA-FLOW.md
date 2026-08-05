# Privacy data flow

```text
options -> validated schema-3 settings ------------> chrome.storage.local
service worker -> latest aggregate sweep summary --> chrome.storage.local

native candidate -> final revalidation -> chrome.tabs.discard(explicit id)

click candidate -> transient validated credential-free HTTP(S) URL
                + sanitized bounded title
                -> percent-encoded packaged placeholder fragment in the same tab
                -> visible complete-URL restore link + sanitized browser-tab title
                -> placeholder ready while inactive -> discard lightweight placeholder
                -> explicit URL link or Restore tab action -> original HTTP(S) URL

popup Suspend this tab now -> fresh active query -> exact-ID re-fetch
                           -> bypass active/age only -> guarded parking coordinator

popup Protect/Allow -> fresh active-tab query -> autoDiscardable flag only
```

URLs, titles, favicons, domains, tab IDs, and per-tab activity are not written to extension storage, logged, synchronized, transmitted, or sent to telemetry. Click mode's URL/title exist transiently in memory and in its self-contained Chrome extension page address. Percent encoding is not encryption; Chrome may expose or retain that address in the address bar, session restore, and history.

No network request, favicon retrieval, host permission, optional permission, content script, History API, telemetry, remote code, remote configuration, or page-content access exists. Unsaved forms cannot be detected.
