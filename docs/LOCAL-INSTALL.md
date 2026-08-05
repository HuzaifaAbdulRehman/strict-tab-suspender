# Local installation

Strict Tab Discarder is a private beta for Chrome 121+. Use pages with no unsaved work during testing.

1. Run `npm ci` and `npm run build` at the repository root.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the stable repository build path `dist/`—not `src/` or the ZIP.
4. Open the popup and Settings to confirm native restore and the 15-minute default.
5. To use **Click to restore**, select it in Settings and review/accept Chrome's optional `tabs` warning. Denial leaves native mode unchanged.

After source changes, rebuild and press **Reload** on `chrome://extensions`. Chrome does not reload an unpacked extension automatically. Moving the unpacked folder can change its extension identity, so keep the path stable while suspended tabs exist.

## Recover a suspended address

Normally press **Restore tab**. If an old placeholder no longer loads after the extension was removed, reinstalled, moved, or assigned a different ID, the original HTTP(S) address may still be present after `url=` in the address-bar fragment.

1. Copy the entire suspended address without visiting any decoder website.
2. If DevTools can open on that page, run `new URLSearchParams(location.hash.slice(1)).get('url')` in the Console.
3. Inspect the result and open it manually only if it begins with `http://` or `https://` and you trust it.

Percent encoding is not encryption. Do not share the suspended address: it may reveal the original address, query parameters, and fragment. A malformed, credential-bearing, non-HTTP(S), or over-limit address is intentionally rejected.

To uninstall, choose **Remove** on `chrome://extensions`. This removes local extension storage, but Chrome may separately retain already-created placeholder addresses in open tabs, session restore, or history. Recover any needed tabs first.

For a private archive, run `npm run package` and `npm run package:verify`; reviewed ZIP, checksum, SBOM, and contents files appear under ignored `package/`.
