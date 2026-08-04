# Security policy

## Supported versions

Security fixes are applied to the current development and released version.

## Reporting a vulnerability

Do not file public issues for vulnerabilities. Contact the maintainer privately with the affected version, reproduction steps, impact, and any suggested mitigation. Do not include browsing data in a report. An acknowledgement and coordinated disclosure timeline will be provided after triage.

## Security boundaries

The extension targets Chrome 121+ and uses Manifest V3. Its approved permission surface is only `alarms` and `storage`; additions require an ADR, privacy review, and explicit maintainer approval.
