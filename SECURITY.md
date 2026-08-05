# Security policy

## Supported versions

Security fixes are applied to the current private-beta version (`0.3.0`) and current development branch.

## Reporting a vulnerability

Do not file public issues for vulnerabilities. Contact the maintainer privately with the affected version, reproduction steps, impact, and any suggested mitigation. Do not include browsing data in a report. An acknowledgement and coordinated disclosure timeline will be provided after triage.

## Security boundaries

The extension targets Chrome 121+ and uses Manifest V3. Required permissions are exactly `alarms`, `storage`, and `tabs`; there are no optional or host permissions and no network paths. It does not call the History API. URL, title, domain, or tab identifier data must never be stored, logged, synchronized, transmitted, or sent to telemetry. ADR 0003 permits only the bounded local placeholder and reviewed immediate-action flow. Any expanded permission, URL/title use, retention, or data flow requires an ADR, privacy review, tests, and explicit maintainer approval.

Treat a suspended placeholder address as sensitive because percent encoding is not encryption. Reports must redact URLs, fragments, query strings, tab titles, and other browsing data.
