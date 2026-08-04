# Local installation

Strict Tab Discarder is a private beta for Chrome 121+. Use a separate test profile and save important work before enabling it: Chrome does not expose every unsaved form, and this extension cannot detect unsaved work.

1. Run `npm ci` and `npm run build` at the repository root.
2. Open `chrome://extensions`, enable **Developer mode**, then select **Load unpacked**.
3. Choose the repository's built directory: `dist/` (not `src/` and not the ZIP in `package/`).
4. Pin the extension if desired, then open its popup or **Extension options** to confirm the default 15-minute setting.

After changing source code, run `npm run build` and press the extension's **Reload** button on `chrome://extensions`; Chrome does not automatically reload an unpacked extension. Settings remain in the selected Chrome profile. To remove the beta, choose **Remove** on `chrome://extensions`; this removes the extension and its local extension storage for that profile.

For a distributable private-beta archive, run `npm run package`, then `npm run package:verify`. The archive, SHA-256 file, CycloneDX SBOM, and reviewed contents list are generated under `package/` and are intentionally ignored by Git.
