# Local installation

The build creates a complete unpacked extension in `dist/`:

1. Run `npm ci` and `npm run build`.
2. Open `chrome://extensions` in Chrome 121+.
3. Enable Developer mode.
4. Select **Load unpacked** and choose the repository's `dist` directory.
5. Use a test profile and save important work first; the extension cannot detect unsaved forms.

Use `npm run package` to create the Web Store ZIP and `npm run package:verify` to validate that it has a root `manifest.json` and safe entry paths.
