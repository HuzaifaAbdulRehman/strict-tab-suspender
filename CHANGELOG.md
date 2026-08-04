# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-04

### Added

- Private-beta Manifest V3 extension for Chrome 121+ with local-only settings and aggregate sweep summaries.
- Guarded, serial inactive-tab discarding with the documented defaults, five-minute startup grace, and ten-tab sweep cap.
- Packaged popup and options interfaces, strict archive validation, deterministic ZIP generation, SHA-256 checksums, CycloneDX SBOM, and archive inventory evidence.

### Security

- Restricted the manifest permission surface to `alarms` and `storage`, with no host permissions, remote code, network requests, telemetry, content scripts, accounts, or ads.

This private beta is not published to the Chrome Web Store.
