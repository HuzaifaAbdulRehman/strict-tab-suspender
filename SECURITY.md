# Security policy

## Supported versions

Security fixes are applied to the current private-beta version (`0.2.0`) and current development branch.

## Reporting a vulnerability

Do not file public issues for vulnerabilities. Contact the maintainer privately with the affected version, reproduction steps, impact, and any suggested mitigation. Do not include browsing data in a report. An acknowledgement and coordinated disclosure timeline will be provided after triage.

## Security boundaries

The extension targets Chrome 121+ and uses Manifest V3. Required permissions are exactly `alarms` and `storage`; the only optional permission is `tabs` for ADR 0002's reviewed manual-restore URL parking. There are no host permissions or network paths. Any expanded permission, URL use, retention, or data flow requires an ADR, privacy review, tests, and explicit maintainer approval.

Treat a suspended placeholder address as sensitive because percent encoding is not encryption. Reports must redact URLs, fragments, query strings, tab titles, and other browsing data.
