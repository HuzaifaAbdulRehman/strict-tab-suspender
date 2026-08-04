# ADR 0001: Keep the permission surface minimal

## Status

Accepted — 2026-08-04

## Context

Strict Tab Discarder needs scheduled work and local settings, but it must protect user privacy and avoid browsing-data collection.

## Decision

Request only `alarms` and `storage` in the Manifest V3 manifest. Do not request host permissions. Do not add history, identity, tabs-persistence, network, content-script, remote-code, telemetry, account, or advertising capabilities.

## Consequences

The product operates entirely locally and cannot provide features that require web-page injection, browsing-history access, or a server. Any proposed permission expansion requires a new ADR, privacy documentation change, and explicit maintainer approval.
