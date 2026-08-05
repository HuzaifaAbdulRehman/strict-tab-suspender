# Strict Tab Discarder

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+ that suspends eligible inactive tabs to reduce memory pressure.

It has no host or optional permissions, network calls, telemetry, content scripts, remote code, accounts, or ads. Required permissions are exactly `alarms`, `storage`, and `tabs`.

## Behavior

The extension is enabled by default with a 15-minute inactivity threshold. Presets are 15, 30, 60, and 120 minutes. Active, pinned, audible, and not-auto-discardable tabs are protected. It waits five minutes after startup and limits each sweep to 10 serial outcomes. Alarm timing is approximate when Chrome is busy or sleeping.

Click-to-restore is the default, reset, and v1/v2 migration behavior. It shows a packaged lightweight page and waits for **Restore tab**; an explicit schema-3 native choice remains supported. The placeholder uses a sanitized original page title as its browser tab title and shows the complete original URL as a clickable restore link. No favicon is retrieved.

Chrome labels required `tabs` access “Read your browsing history” because it exposes current tab URL/title metadata. This extension does not call the History API or retain a browsing-history database. A validated credential-free HTTP(S) URL and sanitized bounded title exist only in that tab's percent-encoded placeholder fragment and visible UI. They are not stored, logged, synchronized, transmitted, or sent to telemetry. Percent encoding is not encryption, and Chrome may retain the placeholder in its address bar, session restore, or history.

The popup can protect just the current tab by toggling Chrome's transient `autoDiscardable` flag. A protected tab may become inactive but is never suspended while protected; protection ends with the tab and is not a domain allowlist. **Suspend this tab now** bypasses only active/idle-age checks and still refuses pinned, audible, already-discarded, protected, unsupported, changed, or closed tabs after immediate revalidation.

> Important: Chrome does not expose a reliable way to identify every unsaved form. Strict Tab Discarder cannot detect unsaved forms, so users should save important work before relying on automatic suspension.

## Interface

The popup shows whether automatic suspension is On or Paused, the inactivity limit, aggregate sweep result, manual sweep, immediate suspension, pause/resume, and Protect/Allow actions without retaining tab metadata.

Settings controls the timeout and native/click restore behavior, provides the required-permission disclosure, and resets to automatic suspension, 15 minutes, and click-to-restore after confirmation.

## Development

Requires Node.js 20.19+ (Node 22 recommended) and Chrome 121+.

```sh
npm ci
npm run verify
```

See [local installation](docs/LOCAL-INSTALL.md), [architecture](docs/ARCHITECTURE.md), and [privacy](PRIVACY.md). Build output is written to `dist/`; `npm run package` creates a deterministic ZIP plus its SHA-256 checksum, reviewed contents inventory, and CycloneDX SBOM.

For the private-beta release gate, run `npm run release:verify` on a Chrome 121+ environment. This repository does not publish to the Chrome Web Store.

## License

MIT (c) 2026 Huzaifa Abdul Rehman. See [LICENSE](LICENSE).
