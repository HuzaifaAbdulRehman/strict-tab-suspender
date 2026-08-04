# Permissions

The v0.1.0 manifest requests exactly the following permissions:

| Permission | Purpose                                                     | Data boundary                                                                       |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `alarms`   | Schedule the periodic sweep and startup grace timing.       | No browsing data is stored.                                                         |
| `storage`  | Keep local settings and the latest aggregate sweep summary. | No URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity. |

No host permissions are allowed. The extension must not add permissions for network access, content scripts, history, identity/accounts, or any unrelated Chrome API.
