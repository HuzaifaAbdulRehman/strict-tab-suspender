# Manual Restore and Per-Tab Protection Design

**Status:** Approved in conversation on 2026-08-05  
**Target release:** 0.2.0  
**Product:** Strict Tab Discarder  
**Repository:** `strict-tab-suspender`

## Summary

Add two related capabilities without weakening the existing default experience:

1. An optional **Click to restore** suspension mode. Instead of leaving the original page as Chrome's discarded tab, the extension replaces an eligible inactive page with a packaged, lightweight suspension page. Activating the tab loads only that local page. The original website loads only after the user presses **Restore tab**.
2. A **Protect this tab** popup control. Protection sets Chrome's per-tab `autoDiscardable` property to `false`; the existing eligibility engine already treats that state as excluded. The same control can later return the tab to **Allow suspension**.

The existing native-discard mode remains the default and continues to require only `alarms` and `storage`. Click-to-restore requires the optional `tabs` permission because automatic background suspension must read each candidate's URL. Chrome describes this permission to the user as reading browsing history. The extension will explain that warning before requesting permission and will not request host permissions, inspect page contents, or transmit browsing data.

## Goals

- Require an explicit Restore button before a parked website reloads.
- Keep the current native-discard mode available without a new install-time warning.
- Request URL access only when the user explicitly enables click-to-restore mode.
- Make each parked tab self-contained and recoverable across browser restarts and service-worker termination.
- Let the user protect or unprotect the current tab without reading or storing its URL.
- Preserve all current eligibility safeguards, startup grace, race checks, batching, serial execution, and local-only behavior.
- Fail closed: never navigate to an unvalidated URL and never silently fall back to automatic reload when click-to-restore was selected.

## Non-goals

- Permanent domain or website allowlists.
- Reading page contents, detecting forms, or detecting unsaved work.
- Host permissions, content scripts, telemetry, analytics, accounts, sync, remote configuration, or network services.
- Retaining titles, favicons, domains, per-tab activity history, or a list of previously suspended tabs.
- Supporting `file:`, `chrome:`, `chrome-extension:`, `view-source:`, `data:`, `javascript:`, or other non-HTTP(S) pages in click-to-restore mode.
- Reproducing session-management, tab-group restoration, screenshot, or full whitelist features from other suspender products.

## User Experience

### Options page

Add a **Restore behavior** section with two choices:

- **Reload when selected (native discard)** — default; current behavior and current permissions.
- **Show a Restore button first** — click-to-restore mode; requires optional access to tab URLs.

When the user chooses click-to-restore, show a concise explanation before calling `chrome.permissions.request({ permissions: ['tabs'] })` from that user gesture. The setting changes only after permission is granted. If permission is denied, the option remains native discard and an accessible status message explains that no change was made.

When the user returns to native discard, remove the optional `tabs` permission through `chrome.permissions.remove`. Already parked pages remain independently restorable.

### Popup

Add one current-tab control beneath the existing automation controls:

- **Protect this tab** when the active tab is auto-discardable.
- **Allow suspension** when the active tab is protected.

The popup includes a short explanation: protection applies only to this tab and ends when the tab is closed. The control is disabled with a clear message for unsupported Chrome/extension pages or unavailable tab state. It does not expose a URL, title, favicon, or domain.

### Suspended page

The packaged page is deliberately generic and contains:

- Strict Tab Discarder branding.
- “This tab is suspended to save memory.”
- A primary **Restore tab** button, initially focused.
- A privacy note stating that the original address remains local.
- A keyboard-accessible, high-contrast layout with visible focus and a live error region.

Loading, activating, refreshing, or focusing this page must never restore the original website. Restoration occurs only from an explicit click or keyboard activation of the Restore button.

The page does not render the original title, URL, domain, or favicon. It does not contain inline handlers, remote assets, or network-capable code.

## Permissions and Privacy Boundary

Required manifest permissions remain:

- `alarms`
- `storage`

Add:

- `optional_permissions: ["tabs"]`

No host permissions are added. The `tabs` permission is requested only when click-to-restore mode is enabled and can be removed by returning to native mode. Chrome's warning is broader than this product's use: implementation will read only the final revalidated candidate URL needed to construct its local suspension page.

The CSP remains packaged-only with `connect-src 'none'`. Source, tests, build verification, and package verification continue to prohibit network APIs, remote URLs, content scripts, telemetry, and undeclared files.

## Data Model and Migration

Upgrade settings to schema version 2:

```ts
type RestoreBehavior = 'native' | 'click';

interface SettingsV2 {
  schemaVersion: 2;
  enabled: boolean;
  idleMinutes: 15 | 30 | 60 | 120;
  restoreBehavior: RestoreBehavior;
}
```

Migration from schema version 1 preserves `enabled` and `idleMinutes` and sets `restoreBehavior` to `native`. Corrupt or unknown settings fall back conservatively to the documented defaults.

Per-tab protection is not duplicated in extension storage. Chrome's `autoDiscardable` property is authoritative. No URL/title/domain allowlist is introduced.

The latest aggregate sweep summary remains the only operational summary retained. Its existing `discardedCount` field means “successfully memory-reduced tabs” in either mode; user-facing copy will use “suspended” rather than claiming every result came directly from `tabs.discard()`.

## Self-Contained Suspended Address

Each parked tab navigates to a packaged page whose fragment contains a versioned, percent-encoded payload:

```text
chrome-extension://<extension-id>/suspended/index.html#v=1&url=<encoded-http-or-https-url>
```

Reasons for a self-contained fragment instead of an opaque storage token:

- It survives service-worker termination and browser restart.
- It avoids a persistent extension-maintained database of browsing URLs.
- It prevents orphaned placeholders if storage writes race or are cleared.
- The fragment is not included in network requests, and extension CSP forbids connections.

The codec must round-trip Unicode and URL fragments exactly. It accepts only absolute `http:` and `https:` URLs, rejects credentials if Chrome exposes them, rejects malformed encodings, limits the complete generated placeholder URL to 65,536 characters, and never interprets payload text as HTML. Oversized or unsupported pages are skipped in click-to-restore mode and reported only as aggregate skipped/failed counts; they are not silently native-discarded.

Percent encoding is not encryption. A technically knowledgeable person with access to the browser profile can recover the original address from the placeholder fragment, and the encoded value may appear in Chrome's address bar, session-restore data, and history. The options-page consent and privacy documentation must state this plainly. The suspension page itself does not decode the address until restoration is requested and never renders it into the document.

Restoration decodes and validates the payload again, then uses `window.location.replace(originalUrl)`. Validation failure leaves the user on the local page and displays a recovery-safe error. No automatic navigation or retry occurs.

## Suspension Flow

The current query, eligibility, batch-limit, and serial orchestration remain. The final operation becomes strategy-based:

```text
query candidates
  -> evaluate
  -> final tabs.get revalidation
  -> re-read current settings and optional-permission state
  -> native strategy: tabs.discard(tabId)
  -> click strategy: validate latest URL and tabs.update(tabId, placeholderUrl)
```

Click strategy details:

1. Re-fetch and re-evaluate the tab immediately before navigation.
2. Confirm click mode is still enabled and optional `tabs` permission is still granted.
3. Validate the latest URL and build the local placeholder URL.
4. Navigate that explicit tab ID to the placeholder.
5. When the placeholder loads in an inactive tab, it sends a `suspensionPageReady` message.
6. The service worker verifies the sender tab is inactive and still points to this extension's exact suspension page, then calls `tabs.discard(sender.tab.id)` to unload even the lightweight placeholder.

If the final placeholder discard races with activation or fails, the original heavy page has still been replaced by the lightweight packaged page, so safety and manual restoration semantics remain intact. There are no immediate retries.

Chrome does not provide an atomic “navigate only if still inactive” operation. To minimize the final activation race, the service worker maintains an in-memory parking-operation record, listens for `tabs.onActivated`, checks the `tabs.update()` result, and immediately restores the validated original URL if the tab becomes active before parking completes. This exceptional recovery can cause a reload/flicker, but it prevents an actively selected page from being left unexpectedly parked. The limitation and recovery path are covered by deterministic race tests and real-Chrome testing.

Native mode continues to skip already-discarded tabs. Click mode may convert an already-discarded eligible HTTP(S) tab into the local placeholder without loading the original website, subject to real-Chrome verification. This prevents Chrome Memory Saver from bypassing manual restoration. If Chrome cannot perform that conversion without loading the original page, the implementation must skip the tab rather than activate or reload it.

The manual **Discard eligible tabs now** action uses the same selected strategy, protections, revalidation, and ten-tab batch limit as automatic sweeps.

## Permission Loss and Recovery

- If `tabs` permission is missing while settings still say click mode, automatic and manual sweeps do not park new tabs. The options and popup report that permission must be restored; there is no fallback to native behavior.
- Existing suspension pages restore themselves without service-worker or `tabs` permission access.
- Extension and browser restarts do not trigger restoration.
- Removing or changing the unpacked extension ID can make packaged suspension pages unavailable. `LOCAL-INSTALL.md` and a new recovery section will explain how to recover the percent-encoded original URL from the suspended address before reinstalling or changing the extension path.
- Incognito remains unsupported in v1/v0.2 unless separately reviewed.

## Per-Tab Protection Flow

The popup queries the current active tab and reads only its ID and `autoDiscardable` flag. It then calls:

```ts
chrome.tabs.update(tabId, { autoDiscardable: false }); // Protect
chrome.tabs.update(tabId, { autoDiscardable: true }); // Allow suspension
```

No new permission is needed for this operation. The eligibility engine continues to return `not-auto-discardable` for protected tabs. Both automatic and manual sweeps must honor the flag during candidate selection and final revalidation.

Protection is intentionally per-tab, not per-site. It does not create a domain allowlist and is not promised to survive closing and recreating the tab. The extension must not persist tab IDs.

## Error Handling

Normal races include closing, activating, pinning, making audible, protecting, navigating, or changing settings/permissions while a sweep is running. Every race fails closed and contributes only to aggregate counts.

Specific rules:

- Never call `discard()` or `update()` without an explicit tab ID.
- Never park a finally revalidated active, pinned, audible, not-auto-discardable, too-recent, unsupported, or missing-ID tab. Already-discarded tabs are eligible only for the verified click-mode conversion described above.
- Never restore from an invalid or unsupported URL payload.
- Never inject original URL data into HTML or logs.
- Never log or persist tab metadata.
- Permission denial/revocation is a normal state, not an exception loop.
- Service-worker termination at any async boundary must not orphan a tab or cause automatic restoration.

## Testing Strategy

### Unit tests

- Settings v1-to-v2 migration, corruption, unknown keys, and conservative defaults.
- URL codec round trips, nested fragments/queries, Unicode, percent sequences, length boundary, malformed encodings, unsupported schemes, credentials, and injection strings.
- Strategy selection and exact final revalidation ordering.
- No native fallback when click mode lacks permission.
- Protected tabs never reach navigation or discard calls.
- Protect/unprotect controller state and failure messages.
- Suspended-page restore requires an explicit activation and uses validated `location.replace`.
- No URL/title/domain appears in rendered UI, storage writes, logs, or sweep summaries.

### Integration tests

- Optional permission grant, denial, removal, and external revocation.
- Query -> evaluate -> re-fetch -> permission/settings check -> navigate ordering.
- Activation, closure, navigation, pinning, audio, protection, and permission races.
- Activation during the non-atomic final navigation gap triggers immediate original-URL recovery and never discards the active placeholder.
- Already-discarded click-mode conversion either parks without loading the original page or safely skips when Chrome cannot guarantee that behavior.
- Placeholder-ready message verifies exact sender tab/page before discard.
- Manifest allowlist permits only required `alarms`/`storage` and optional `tabs`.
- CSP and package verification continue to reject network access, host permissions, content scripts, remote code, and unapproved artifacts.

### Real-Chrome tests

- Native mode retains current automatic reload-on-activation behavior.
- Click mode activates only the local suspended page and does not restore until the Restore button is pressed.
- Restore works after service-worker termination, extension reload, and Chrome restart with a stable unpacked extension ID.
- Protected tabs survive both automatic and manual sweeps; unprotected tabs become eligible again.
- Multiple windows, batch limit, startup grace, pause/resume, and audible/pinned safeguards remain intact.
- Permission revocation stops new parking without restoring or breaking existing placeholders.
- No extension-origin network requests occur.
- Keyboard-only restoration and popup/options accessibility pass.

## Documentation and Release Changes

- Add ADR 0002 approving optional URL access for click-to-restore mode.
- Update `AGENTS.md`, `README.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `PERMISSIONS.md`, `PRIVACY.md`, `PRIVACY-DATA-FLOW.md`, `SECURITY.md`, `TEST-PLAN.md`, `LOCAL-INSTALL.md`, release/store drafts, and permission checks.
- Clearly document Chrome's browsing-history warning and the exact narrower use.
- Clearly document the unchanged unsaved-form limitation and the additional risk that placeholder navigation unloads the original document.
- Add suspended-tab recovery instructions.
- Record the change under `0.2.0` in `CHANGELOG.md` and package a private beta only after all release gates pass.

## Acceptance Criteria

- Native mode works with only `alarms` and `storage` and behaves exactly as v0.1.x.
- Enabling click mode requests optional `tabs` permission from an explanatory user gesture.
- In click mode, activating a suspended tab never loads its original website before explicit Restore activation.
- Original addresses are never transmitted, logged, rendered by the suspension-page UI, or stored in extension storage. The consent flow discloses that the percent-encoded address remains recoverable from the local placeholder URL and may appear in Chrome address/session/history data.
- Only validated HTTP(S) addresses can be restored.
- Existing suspended pages remain restorable across worker/browser restarts and permission removal.
- Protecting a tab makes it ineligible immediately; allowing suspension reverses that state.
- Protected, finally revalidated active, pinned, audible, unsupported, and changed-state tabs are never intentionally parked or discarded; the documented activation-race recovery restores immediately if activation wins the final navigation race.
- All automated, real-Chrome, privacy, package, and manual acceptance tests pass before release 0.2.0.
