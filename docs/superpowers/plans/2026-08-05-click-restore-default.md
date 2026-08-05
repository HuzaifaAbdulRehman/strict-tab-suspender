# Click-to-Restore Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the packaged placeholder and explicit Restore action the default suspension behavior, add reliable Settings back navigation, and clarify that protected tabs are never suspended while protected.

**Architecture:** Settings schema version 3 makes `click` the new persisted default while migrating older settings. The manifest makes `tabs` required so background sweeps can always build validated local placeholder URLs without a permission gesture. Options navigation uses a small injected helper that closes an extension-opened Settings tab and falls back to the packaged popup page without adding another Chrome permission.

**Tech Stack:** Chrome Manifest V3, TypeScript, vanilla HTML/CSS, Vitest, esbuild, Puppeteer, Node packaging scripts.

## Global Constraints

- Chrome 121 or newer; Manifest V3; version 0.3.0.
- Production remains TypeScript with vanilla HTML/CSS and zero runtime dependencies.
- Required permissions are exactly `alarms`, `storage`, and `tabs`; no optional or host permissions.
- `tabs` URL access remains limited to reviewed click-to-restore URL parking; `autoDiscardable` remains limited to per-tab protection.
- No content scripts, History API, network requests, telemetry, remote code, accounts, ads, URL logs, or extension-storage URL database.
- Preserve enabled/15-minute defaults, all timeout presets, startup grace, exclusions, revalidation, serial ten-outcome cap, and fail-closed races.

---

### Task 1: Migrate Settings to Click-to-Restore Defaults

**Files:**
- Modify: `tests/unit/settings.test.ts`
- Modify: `src/shared/settings.ts`
- Modify: settings fixtures in `tests/unit/*.test.ts` and `tests/integration/*.test.ts`

**Interfaces:**
- Produces: `Settings { schemaVersion: 3; enabled: boolean; idleMinutes: IdleMinutes; restoreBehavior: RestoreBehavior }`.
- Preserves: `getSettings`, `saveSettings`, and `resetSettings` signatures.

- [ ] **Step 1: Write failing default and migration tests**

```ts
expect(DEFAULT_SETTINGS).toEqual({
  schemaVersion: 3,
  enabled: true,
  idleMinutes: 15,
  restoreBehavior: 'click',
});

await expect(
  getSettings(storageWith({
    settings: { schemaVersion: 2, enabled: false, idleMinutes: 60, restoreBehavior: 'native' },
  })),
).resolves.toEqual({
  schemaVersion: 3,
  enabled: false,
  idleMinutes: 60,
  restoreBehavior: 'click',
});
```

- [ ] **Step 2: Run the settings tests and confirm RED**

Run: `npx vitest run tests/unit/settings.test.ts`

Expected: failures show schema 2/native rather than schema 3/click.

- [ ] **Step 3: Implement schema version 3 normalization**

Set `DEFAULT_SETTINGS.restoreBehavior` to `click`. Recognize valid v1 and v2 settings as migration inputs that preserve `enabled`/`idleMinutes` and produce schema 3/click. Preserve an explicit native/click choice only for valid schema 3 settings. Keep malformed data paused.

- [ ] **Step 4: Update typed fixtures and run affected unit tests**

Run: `npx vitest run tests/unit/settings.test.ts tests/unit/service-worker.test.ts tests/unit/popup-controller.test.ts tests/unit/options-controller.test.ts tests/unit/sweep.test.ts tests/unit/suspension.test.ts`

Expected: all affected tests pass with schema version 3.

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts tests
git commit -m "feat: default to click restore"
```

### Task 2: Make Tabs a Required Reviewed Permission

**Files:**
- Modify: `tests/integration/manifest.test.ts`
- Modify: `tests/unit/verify-package.test.ts`
- Modify: `src/manifest.json`
- Modify: `scripts/verify-package.mjs`
- Modify: `src/options/options-controller.ts`
- Modify: `src/options/index.ts`
- Modify: `tests/unit/options-controller.test.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `tests/unit/service-worker.test.ts`

**Interfaces:**
- Manifest required permissions become `['alarms', 'storage', 'tabs']`.
- Manifest exposes no `optional_permissions` key.
- `createOptionsController(view, messenger)` no longer accepts an optional-permission adapter.

- [ ] **Step 1: Write failing manifest/package contract tests**

```ts
expect(manifest.permissions).toEqual(['alarms', 'storage', 'tabs']);
expect(manifest.optional_permissions).toBeUndefined();
expect(() =>
  validatePackageManifest({ ...validManifest, optional_permissions: ['tabs'] }),
).toThrow('Package manifest must not declare optional permissions.');
```

- [ ] **Step 2: Write failing options tests for required permission behavior**

```ts
await controller.setRestoreBehavior('native');
expect(sent).toEqual([{ type: 'setRestoreBehavior', restoreBehavior: 'native' }]);
expect(view.values.status).toBe('Open-normally behavior saved locally.');
```

The test must prove no `chrome.permissions.request/remove` adapter is called or required.

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `npx vitest run tests/integration/manifest.test.ts tests/unit/verify-package.test.ts tests/unit/options-controller.test.ts tests/unit/service-worker.test.ts`

Expected: current optional-permission assertions and permission-request flows fail.

- [ ] **Step 4: Implement the required permission contract**

Move `tabs` into `permissions`, remove `optional_permissions`, require the exact manifest order in package validation, and reject any optional permissions. Remove permission request/removal code from the options controller and entrypoint. Because `tabs` is guaranteed, simplify the worker's click-mode guard without expanding URL use; retain fail-closed behavior for API errors.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/integration/manifest.test.ts tests/unit/verify-package.test.ts tests/unit/options-controller.test.ts tests/unit/service-worker.test.ts`

Expected: all focused tests pass.

```bash
git add src/manifest.json scripts/verify-package.mjs src/options src/background/service-worker.ts tests
git commit -m "feat: require tabs for default restore"
```

### Task 3: Add Settings Back Navigation and Clear Protection Copy

**Files:**
- Create: `src/options/settings-navigation.ts`
- Create: `tests/unit/settings-navigation.test.ts`
- Modify: `src/options/index.html`
- Modify: `src/options/index.ts`
- Modify: `src/options/styles.css`
- Modify: `src/popup/index.html`
- Modify: `src/popup/popup-controller.ts`
- Modify: `tests/unit/popup-controller.test.ts`
- Modify: `tests/integration/ui-artifacts.test.ts`
- Modify: `scripts/build.mjs`
- Modify: `scripts/verify-package.mjs`

**Interfaces:**
- Produces: `returnFromSettings(port: SettingsNavigationPort): void`.

```ts
export interface SettingsNavigationPort {
  close(): void;
  navigateToPopup(): void;
  scheduleFallback(callback: () => void): void;
}
```

- [ ] **Step 1: Write failing navigation and UI tests**

```ts
it('attempts close before scheduling the packaged popup fallback', () => {
  const calls: string[] = [];
  returnFromSettings({
    close: () => calls.push('close'),
    navigateToPopup: () => calls.push('popup'),
    scheduleFallback: (callback) => { calls.push('schedule'); callback(); },
  });
  expect(calls).toEqual(['close', 'schedule', 'popup']);
});
```

Artifact tests must require `id="back-action"`, accessible Back text, click radio checked by default, reset copy mentioning click-to-restore, and the exact protection explanation: “This tab may become inactive, but it will never be suspended while protected.”

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/unit/settings-navigation.test.ts tests/unit/popup-controller.test.ts tests/integration/ui-artifacts.test.ts`

Expected: missing navigation module/control and old copy fail.

- [ ] **Step 3: Implement navigation and UI behavior**

Add a semantic Back button before the brand header. Wire it to `returnFromSettings` with `window.close()`, `setTimeout(..., 0)`, and fallback `window.location.assign('../popup/index.html')`. Style the control for light/dark modes and visible focus. Change static restore selection to click, update reset/disclosure copy for required permission, and clarify protection in popup and options copy.

- [ ] **Step 4: Add the new module to reviewed build/package allowlists**

Bundle `options/settings-navigation.ts` to `options/settings-navigation.js`, include it in the exact package inventory, and keep every existing remote-code/network/binary rejection.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/unit/settings-navigation.test.ts tests/unit/popup-controller.test.ts tests/integration/ui-artifacts.test.ts tests/unit/verify-package.test.ts`

Expected: all focused tests pass.

```bash
git add src/options src/popup scripts tests
git commit -m "feat: add settings back navigation"
```

### Task 4: Update Real-Chrome Coverage

**Files:**
- Modify: `scripts/smoke-extension.mjs`
- Modify: `tests/unit/smoke-extension.test.ts`

**Interfaces:**
- Chrome smoke expects click-to-restore selected by default.
- Chrome smoke exercises the Back fallback without depending on animation-frame polling in a background tab.

- [ ] **Step 1: Write the failing smoke contract assertions**

Update the smoke test source contract to require `value="click"` as the initial checked behavior and `back-action` coverage, and remove the native-default assertion.

- [ ] **Step 2: Run the smoke unit test and confirm RED**

Run: `npx vitest run tests/unit/smoke-extension.test.ts`

Expected: current script still asserts native is selected.

- [ ] **Step 3: Update the Puppeteer workflow**

Assert the click radio is selected on first load. Test Back using a controlled fallback page so closing behavior does not lose the remaining smoke sequence. Preserve the explicit two-second no-auto-restore assertion, keyboard Restore, real `autoDiscardable` toggles, mutation polling for background popup state, no-network tracking, and both unpacked/package runs.

- [ ] **Step 4: Run Chrome smoke and commit**

Run: `npm run build && npm run package && npm run package:verify && npm run smoke:chrome`

Expected: unpacked and packaged Chrome smoke passes.

```bash
git add scripts/smoke-extension.mjs tests/unit/smoke-extension.test.ts
git commit -m "test: verify click restore defaults"
```

### Task 5: Document and Verify Version 0.3.0

**Files:**
- Create: `docs/adr/0003-required-tabs-default-restore.md`
- Modify: `AGENTS.md`, `README.md`, `PRIVACY.md`, `SECURITY.md`, `CHANGELOG.md`
- Modify: `docs/ARCHITECTURE.md`, `docs/PERMISSIONS.md`, `docs/PRIVACY-DATA-FLOW.md`, `docs/LOCAL-INSTALL.md`, `docs/PRODUCT.md`, `docs/TEST-PLAN.md`, `docs/RELEASE.md`, `docs/WEB-STORE.md`, `docs/privacy-disclosure-draft.md`, `docs/store-listing-draft.md`
- Modify: `package.json`, `package-lock.json`, `src/manifest.json`
- Verify generated: `dist/`, `package/strict-tab-suspender-0.3.0.zip` and integrity artifacts

**Interfaces:**
- Produces version `0.3.0` consistently across package metadata, manifest, documentation and artifacts.

- [ ] **Step 1: Write failing tooling/documentation assertions**

Require policy documents to state required `tabs`, click default, local placeholder URL handling, Chrome warning, protected-tab semantics, migration/re-enable behavior, and prohibition on History API/network/URL logs.

- [ ] **Step 2: Run tooling tests and confirm RED**

Run: `npx vitest run tests/integration/tooling.test.ts tests/unit/release-artifacts.test.ts`

Expected: old optional-permission and 0.2.0 wording fails.

- [ ] **Step 3: Write ADR 0003 and update policy/product/release documents**

ADR 0003 supersedes ADR 0002 only for optionality/default/migration. It records the owner's explicit approval, required warning, narrow URL use, placeholder visibility, no encryption claim, no History API, no transmission, no browsing log, no host access, and rollback to 0.2.0.

- [ ] **Step 4: Bump version without creating a Git tag**

Run: `npm version 0.3.0 --no-git-tag-version`

Update `src/manifest.json` to `0.3.0` and add a dated Keep a Changelog entry.

- [ ] **Step 5: Run the complete verification gates**

Run: `npm run verify`

Run: `npm run release:verify`

Expected: formatting, lint, types, unit/integration tests, exact package validation, reproducibility and both real-Chrome runs pass. Record the new SHA-256.

- [ ] **Step 6: Inspect final diff and commit**

```bash
git diff --check
git status --short
git diff --stat refs/remotes/github/main...HEAD
git add AGENTS.md README.md PRIVACY.md SECURITY.md CHANGELOG.md docs package.json package-lock.json src/manifest.json tests
git commit -m "chore: prepare 0.3.0 private beta"
```

Do not publish, tag, merge, delete a branch, or create a Web Store submission without a separate explicit request.

## Completion Checklist

- [ ] Default, reset and v1/v2 migration select click-to-restore under schema 3.
- [ ] Explicit schema 3 native choice remains supported.
- [ ] Required manifest permissions are exactly `alarms`, `storage`, `tabs`; optional and host permissions are absent.
- [ ] Settings Back works by close-first/fallback navigation and is keyboard accessible.
- [ ] Protection copy distinguishes inactivity from suspension.
- [ ] No URL/title/domain/tab data is logged, transmitted, or stored in extension storage.
- [ ] Unpacked and packaged Chrome smoke tests pass.
- [ ] Version 0.3.0 package, checksum, SBOM and inventory are reproducible.
