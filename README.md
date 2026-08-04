# Strict Tab Discarder

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+ that discards eligible inactive tabs to reduce memory pressure.

It is intentionally narrow: there are no host permissions, network calls, telemetry, content scripts, remote code, accounts, or ads. The only manifest permissions are `alarms` and `storage`.

## Behavior

The extension is enabled by default with a 15-minute inactivity threshold. Available presets are 15, 30, 60, and 120 minutes. Active, pinned, audible, already-discarded, and not-auto-discardable tabs are protected. It waits five minutes after startup before automation and limits a sweep to 10 serial discards.

Settings stay locally in Chrome storage. The only retained operational result is the latest aggregate sweep summary; URLs, titles, favicons, domains, tab IDs, and browsing history are never stored.

> Important: Chrome does not expose a reliable way to identify every unsaved form. Strict Tab Discarder cannot detect unsaved forms, so users should save important work before relying on automatic discarding.

## Interface

The compact extension popup shows whether automatic discarding is On or Paused, the current inactivity limit, the latest aggregate sweep result, and actions to run a sweep or pause/resume automation. It links only to the packaged local settings/privacy page.

The settings page offers the 15, 30, 60, and 120 minute presets, resets to defaults after confirmation, and explains timing, privacy, reload behavior, protected pinned/audible tabs, and the unsaved-work limitation.

## Development

Requires Node.js 20.11+ and Chrome 121+.

```sh
npm ci
npm run verify
```

See [local installation](docs/LOCAL-INSTALL.md), [architecture](docs/ARCHITECTURE.md), and [privacy](PRIVACY.md). Build output is written to `dist/`; `npm run package` creates a deterministic ZIP plus its SHA-256 checksum, reviewed contents inventory, and CycloneDX SBOM.

For the private-beta release gate, run `npm run release:verify` on a Chrome 121+ environment. This repository does not publish to the Chrome Web Store.

## License

MIT (c) 2026 Huzaifa Abdul Rehman. See [LICENSE](LICENSE).
