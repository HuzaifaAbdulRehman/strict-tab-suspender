# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-08-05

### Added

- Recognizable packaged placeholders that use a sanitized bounded original title in the tab strip and show the complete validated original URL as an explicit restore link.
- Safeguarded **Suspend this tab now** and Settings Back controls.

### Changed

- Made click-to-restore the default and reset behavior under settings schema 3; valid v1/v2 settings migrate to click restore while explicit schema-3 native choices remain supported.
- Made `tabs` required so automatic suspension can always create the reviewed placeholder. Existing installations may require re-enabling and accepting Chrome's permission warning.
- Clarified that per-tab protection permits inactivity but prevents suspension until explicitly allowed or closed.

### Security

- Limited URL/title data to one validated credential-free HTTP(S) URL and sanitized bounded title in that tab's percent-encoded packaged placeholder fragment and visible UI.
- Kept pinned, audible, already-discarded, protected, supported-URL, exact-ID, revalidation, pending-navigation, and race safeguards for immediate suspension.
- Continued to prohibit optional/host permissions, History API use, content scripts, network access, remote code, telemetry, accounts, ads, remote configuration, and URL/title logs or storage.

## [0.2.0] - 2026-08-05

### Added

- Optional click-to-restore mode that parks eligible HTTP(S) tabs on a packaged lightweight page and restores only after an explicit button or keyboard action.
- Per-tab **Protect this tab** / **Allow suspension** controls backed by Chrome's transient `autoDiscardable` flag.
- Self-contained suspended-address recovery across service-worker and browser restarts, with local recovery instructions.
- Real-Chrome coverage for no-auto-restore behavior, keyboard restore, protection toggles, permission disclosure, packaged/unpacked builds, and unexpected extension network requests.

### Changed

- Migrated local settings to schema version 2 while preserving valid 0.1.x settings as native restore mode.
- Updated popup terminology from discarded to suspended while preserving the aggregate storage field for compatibility.
- Expanded privacy, permission, architecture, recovery, release, and future Web Store documentation for the reviewed optional boundary.

### Security

- Kept required permissions exactly `alarms` and `storage`; added only optional `tabs`, requested from Settings during a direct user action.
- Restricted optional URL handling to credential-free HTTP(S) addresses, a 65,536-character placeholder limit, immediate revalidation, activation-race recovery, and no extension-storage or network URL database.
- Continued to prohibit host permissions, content scripts, history API access, remote code, telemetry, accounts, ads, and network services.

## [0.1.0] - 2026-08-04

### Added

- Private-beta Manifest V3 extension for Chrome 121+ with local-only settings and aggregate sweep summaries.
- Guarded, serial inactive-tab discarding with the documented defaults, five-minute startup grace, and ten-tab sweep cap.
- Packaged popup and options interfaces, strict archive validation, deterministic ZIP generation, SHA-256 checksums, CycloneDX SBOM, and archive inventory evidence.

### Security

- Restricted the manifest permission surface to `alarms` and `storage`, with no host permissions, remote code, network requests, telemetry, content scripts, accounts, or ads.

This private beta is not published to the Chrome Web Store.
