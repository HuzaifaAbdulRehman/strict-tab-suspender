# Strict Tab Discarder

Strict Tab Discarder is a private-first Chrome Manifest V3 extension for Chrome 121+ that will discard eligible inactive tabs to reduce memory pressure.

It is intentionally narrow: there are no host permissions, network calls, telemetry, content scripts, remote code, accounts, or ads. The only manifest permissions are `alarms` and `storage`.

## Planned behavior

The extension is enabled by default with a 15-minute inactivity threshold. Available presets are 15, 30, 60, and 120 minutes. Active, pinned, audible, already-discarded, and not-auto-discardable tabs are protected. It waits five minutes after startup before automation and limits a sweep to 10 serial discards.

Settings stay locally in Chrome storage. The only retained operational result is the latest aggregate sweep summary; URLs, titles, favicons, domains, tab IDs, and browsing history are never stored.

> Important: Chrome does not expose a reliable way to identify every unsaved form. Strict Tab Discarder cannot detect unsaved forms, so users should save important work before relying on automatic discarding.

## Development

Requires Node.js 20.11+ and Chrome 121+.

```sh
npm ci
npm run verify
```

See [local installation](docs/LOCAL-INSTALL.md), [architecture](docs/ARCHITECTURE.md), and [privacy](PRIVACY.md). This foundation does not yet contain extension engine or UI code, so build and package commands intentionally defer artifact creation until a manifest is implemented.

## License

MIT © 2026 Huzaifa Abdul Rehman. See [LICENSE](LICENSE).
