# Privacy data flow

```text
Local options UI ── settings only ──> chrome.storage.local
                                       │
Service worker <── settings + latest aggregate summary
      │
      ├── evaluates Chrome tab state in memory
      ├── discards up to 10 eligible tabs serially
      └── writes only the latest aggregate sweep summary
```

Tab state is transient: active, pinned, audible, discarded, and auto-discardable flags are used only to make the current decision. URLs, titles, favicons, domains, tab IDs, browsing history, and per-tab activity are neither stored nor transmitted. There is no network data flow.

Chrome does not offer reliable visibility into every unsaved form. This extension cannot detect unsaved forms.
