# Local installation

Strict Tab Discarder 0.3.0 is a private beta for Chrome 121+. Use pages with no unsaved work during testing.

1. Run `npm ci` and `npm run build` at the repository root.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the stable repository build path `dist/`—not `src/` or the ZIP.
4. Review Chrome's required `tabs` warning, “Read your browsing history,” then enable or re-enable the extension. This warning reflects current URL/title metadata access; the extension does not call the History API.
5. Open Settings and confirm click-to-restore and the 15-minute default. A valid schema-3 native choice remains available.

After source changes, rebuild and press **Reload** on `chrome://extensions`. Chrome does not reload an unpacked extension automatically. Moving the unpacked folder can change its extension identity, so keep the path stable while suspended tabs exist.

Existing v1/v2 settings migrate to schema 3 with click-to-restore. Updating from 0.2.0 may disable the extension until you re-enable it and accept the new required-permission warning.

## Recover a suspended address

Normally select the visible complete-URL link or **Restore tab**. If an old placeholder no longer loads after the extension was removed, reinstalled, moved, or assigned a different ID, the original HTTP(S) address may still be present after `url=` in the address-bar fragment.

1. Copy the entire suspended address without visiting any decoder website.
2. If DevTools can open on that page, run `new URLSearchParams(location.hash.slice(1)).get('url')` in the Console.
3. Inspect the result and open it manually only if it begins with `http://` or `https://` and you trust it.

Percent encoding is not encryption. Do not share the suspended address: it may reveal the original address, query parameters, fragment, and title. A malformed, credential-bearing, non-HTTP(S), or over-limit address is intentionally rejected.

To uninstall, choose **Remove** on `chrome://extensions`. This removes local extension storage, but Chrome may separately retain already-created placeholder addresses in open tabs, session restore, or history. Recover any needed tabs first.

For a private archive, run `npm run package` and `npm run package:verify`; reviewed ZIP, checksum, SBOM, and contents files appear under ignored `package/`.
