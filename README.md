# Strict Tab Discarder

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+ that suspends eligible inactive tabs to reduce memory pressure.

It has no host permissions, network calls, telemetry, content scripts, remote code, accounts, or ads. Required permissions are `alarms` and `storage`; optional click-to-restore uses `tabs` only after a user grant.

## Behavior

The extension is enabled by default with a 15-minute inactivity threshold. Presets are 15, 30, 60, and 120 minutes. Active, pinned, audible, and not-auto-discardable tabs are protected. It waits five minutes after startup and limits a sweep to 10 serial outcomes.

Native mode uses Chrome's normal reload-on-activation behavior. Optional click mode shows a packaged lightweight page and waits for **Restore tab**. Chrome labels the optional permission “Read your browsing history”; this extension uses it only to put a validated HTTP(S) original address in that tab's percent-encoded placeholder fragment. It does not use the history API, extension storage, or a network service for that address. Percent encoding is not encryption, and Chrome may retain the placeholder in its address bar/session/history.

The popup can protect just the current tab by toggling Chrome's transient `autoDiscardable` flag. Protection ends with the tab and is not a domain allowlist.

> Important: Chrome does not expose a reliable way to identify every unsaved form. Strict Tab Discarder cannot detect unsaved forms, so users should save important work before relying on automatic discarding.

## Interface

The popup shows whether automatic suspension is On or Paused, the inactivity limit, aggregate sweep result, manual sweep, pause/resume, and Protect/Allow actions without showing tab metadata.

Settings controls the timeout and native/click restore behavior, provides the exact optional-permission disclosure, and resets to native defaults after confirmation.

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
