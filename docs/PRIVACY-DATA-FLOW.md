# Privacy data flow

```text
options -> validated settings --------------------> chrome.storage.local
service worker -> latest aggregate sweep summary -> chrome.storage.local

native candidate -> final revalidation -> chrome.tabs.discard(explicit id)

click candidate -> optional tabs permission -> transient validated HTTP(S) URL
                -> percent-encoded local placeholder fragment in the same tab
                -> placeholder ready while inactive -> discard lightweight placeholder
                -> explicit Restore tab action -> original HTTP(S) URL

popup Protect/Allow -> fresh active-tab query -> autoDiscardable flag only
```

URLs, titles, favicons, domains, tab IDs, and per-tab activity are not written to extension storage or transmitted. Click mode's original URL exists transiently in memory and in its self-contained Chrome extension page address. Percent encoding is not encryption; Chrome may expose or retain that address in the address bar, session restore, and history.

There is no extension network flow, host permission, content script, telemetry, or page-content access. Unsaved forms cannot be detected.
