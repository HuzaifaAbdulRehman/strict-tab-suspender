# Architecture

The Manifest V3 service worker owns alarms, settings, candidate evaluation, final revalidation, suspension strategy, activation-race recovery, and typed UI messages. Popup, options, and suspended pages use vanilla HTML/CSS/TypeScript and packaged assets only.

Every sweep queries tab state, evaluates in memory, refreshes each candidate, rereads settings, and applies no more than ten outcomes serially. Native mode calls `chrome.tabs.discard(id)`. Default click mode validates a credential-free HTTP(S) URL and sanitized bounded title, navigates to a self-contained packaged placeholder, then discards that placeholder only after the inactive page reports ready.

The version-2 placeholder fragment contains the percent-encoded original URL and title. It is not copied to extension storage. The page sets its packaged document title to the sanitized original title and shows the complete URL as safe text and link; it does not retrieve a favicon. On activation during automatic parking, an in-memory pending map cancels parking and attempts exact-placeholder recovery. Closed tabs, changed state, rejected APIs, worker termination, and missed races fail closed without automatic retries. Once established, activation alone never restores a placeholder; only the URL link or Restore button validates and opens the original URL.

**Suspend this tab now** re-queries the last-focused active tab and re-fetches its exact ID. It bypasses only active and idle-age exclusions. Pinned, audible, already-discarded, protected/non-auto-discardable, unsupported URL, identity/URL change, closure, pending navigation, and race safeguards remain enforced.

Per-tab protection re-queries the active tab and sets only `autoDiscardable`. A protected tab may become inactive but is never suspended while protected. It has no URL/domain allowlist and ends with the tab.

Required permissions are exactly `alarms`, `storage`, and `tabs`; there are no optional or host permissions. There are no content scripts, History API calls, network services, remote code, accounts, analytics, ads, or remote configuration. URL/title/domain/tab identifiers are not stored, logged, synchronized, transmitted, or sent to telemetry. Build and packaging use exact reviewed file and permission allowlists.
