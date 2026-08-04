# ADR 0002: Optional tabs permission for manual restore

- Status: accepted
- Date: 2026-08-05
- Supersedes: ADR 0001 only where it prohibited all URL access and optional permissions

## Context

Chrome's native `tabs.discard()` reloads a discarded page when its tab is activated. Users requested an optional mode that stays lightweight after activation and restores only after an explicit click. Building a durable placeholder requires the original tab URL. A per-tab protect action is also required without creating a domain allowlist.

## Decision

Keep required permissions exactly `alarms` and `storage`. Declare only `tabs` as optional. Chrome warns “Read your browsing history”; the extension does not call the history API.

Native mode remains the default and does not read candidate URLs. Click mode is enabled only after a direct user-gesture permission grant. At sweep start and immediately before parking, permission is rechecked. Denial/revocation fails closed without native fallback.

For an eligible tab, click mode reads the current URL in memory, accepts only absolute HTTP(S) URLs without username/password, and rejects a generated placeholder longer than 65,536 characters. It navigates that tab to `suspended/index.html#v=1&url=<percent-encoded-original>`. The placeholder is packaged, not web-accessible, and makes no network request. It is discarded only after reporting ready while inactive. Restore parses and validates the fragment only after the explicit button/keyboard action.

The fragment is self-contained so browser/service-worker restarts do not require a URL database. Percent encoding is not encryption. The full placeholder can be visible or retained in Chrome's address bar, session restore, and history. It is never written to extension storage, rendered as text, logged, or transmitted.

Per-tab protection freshly queries the active tab and toggles only `autoDiscardable`; it stores no tab ID or URL and ends when the tab closes.

## Race and recovery consequences

Parking cannot atomically assert inactivity during navigation. An in-memory pending record marks activation races; if activation wins, the worker attempts to restore the original immediately. API rejection, closure, state change, or worker termination fails closed without retry. A brief placeholder flicker is possible. Once parking completes, activation does not restore automatically.

Existing placeholders remain restorable after worker/browser restart because their fragment contains the address. Removing/reinstalling/moving an unpacked extension can change its ID and make an old placeholder origin unavailable; recovery instructions explain local decoding. Users must not share placeholder addresses.

The extension still cannot detect unsaved forms. No host permissions, content scripts, page-content access, domain allowlist, history access, network, telemetry, or remote configuration is introduced.

## Governance

Any other use of `tabs`, any new permission, or any change to URL lifetime/visibility requires a new ADR, privacy and store-disclosure updates, package-boundary tests, race/recovery tests, and explicit maintainer approval.
