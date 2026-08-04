# Architecture

The Manifest V3 service worker owns alarm scheduling, eligibility evaluation, local settings, and serial discard orchestration. Vanilla HTML/CSS popup and options pages send local extension messages and render only settings plus the latest aggregate sweep summary.

During a sweep, the service worker reads tab state in memory, checks eligibility, refreshes each candidate immediately before discarding it, and discards no more than ten tabs serially. It uses `chrome.tabs.query` and `chrome.tabs.discard` without persisting or logging tab metadata.

Only `alarms` and `storage` are declared in the manifest. The extension has no host permissions, content scripts, remote code, network services, accounts, analytics, or ads. `npm run build` creates `dist/`; `npm run package` creates a deterministic ZIP from the approved built files and generates its checksum, SBOM, and content inventory in `package/`.
