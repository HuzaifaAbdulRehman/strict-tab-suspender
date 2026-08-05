# Architecture

The Manifest V3 service worker owns alarms, settings, candidate evaluation, final revalidation, suspension strategy, activation-race recovery, and typed UI messages. Popup, options, and suspended pages use vanilla HTML/CSS/TypeScript and packaged assets only.

Every sweep queries tab state, evaluates in memory, refreshes each candidate, rereads settings, and applies no more than ten outcomes serially. Native mode calls `chrome.tabs.discard(id)`. Click mode requires the optional `tabs` permission, validates a credential-free HTTP(S) URL, navigates to a self-contained packaged placeholder, then discards that placeholder only after the inactive page reports ready.

The placeholder fragment contains version `1` and the percent-encoded original URL. It is not copied to extension storage. On activation during parking, an in-memory pending map cancels parking and attempts immediate recovery. Closed tabs, changed state, rejected APIs, worker termination, and missed races fail closed without automatic retries. Once a placeholder is established, activation alone never restores it; only its Restore action validates and opens the original URL.

Per-tab protection re-queries the active tab and sets only `autoDiscardable`. It has no URL/domain allowlist and ends with the tab.

Required permissions are `alarms` and `storage`; optional permission is `tabs`. There are no host permissions, content scripts, network services, remote code, accounts, analytics, or ads. Build and packaging use exact reviewed file and permission allowlists.
