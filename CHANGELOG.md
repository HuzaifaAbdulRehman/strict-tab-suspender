# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-04

### Added

- Repository foundation, privacy documentation, release process, and verification tooling.
- Manifest V3 service-worker core with local-only settings, guarded eligibility checks, capped serial
  discards, aggregate sweep summaries, and alarm lifecycle management.
- Popup and options interfaces with local-only controls, aggregate sweep status, protected-tab guidance,
  privacy/limitations copy, reset confirmation, and packaged product icons.
- Deterministic extension ZIP generation with a SHA-256 checksum, reviewed archive inventory, and
  CycloneDX SBOM declaring the extension's zero runtime dependencies.
