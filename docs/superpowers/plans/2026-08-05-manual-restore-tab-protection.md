# Manual Restore and Per-Tab Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, permission-gated click-to-restore suspension strategy and a no-permission per-tab protection control, then ship the verified private beta as version 0.2.0.

**Architecture:** The existing service worker remains the orchestration boundary. A pure suspended-URL codec creates self-contained packaged placeholder addresses; the sweep selects either native discard or placeholder parking after final revalidation. Options owns the user-gesture permission request, popup owns the protect/unprotect interaction through typed worker messages, and the packaged suspended page restores only after an explicit button activation.

**Tech Stack:** Chrome 121+ Manifest V3, TypeScript, vanilla HTML/CSS, esbuild, Vitest, Puppeteer, ESLint, Prettier; zero runtime dependencies.

## Global Constraints

- Product name remains **Strict Tab Discarder** and repository remains `strict-tab-suspender`.
- Support Chrome 121+ only.
- Required permissions remain exactly `alarms` and `storage`; the only optional permission is `tabs`.
- Do not add host permissions, content scripts, web-accessible resources, remote code, network requests, telemetry, analytics, accounts, sync, ads, URL/title/domain logs, or an extension-storage URL database.
- Keep CSP packaged-only with `connect-src 'none'`.
- Native restore behavior remains the default after settings migration or corruption.
- Click restore accepts only absolute HTTP(S) URLs without credentials and limits the complete placeholder URL to 65,536 characters.
- Never render the original URL, title, hostname, or favicon in popup, options, or suspended-page UI.
- Preserve enabled-by-default, 15-minute default, 15/30/60/120 presets, five-minute startup grace, ten serial suspensions per sweep, and final tab/settings revalidation.
- Preserve protection for active, pinned, audible, and `autoDiscardable=false` tabs.
- Do not claim unsaved forms can be detected.
- Use TDD, Conventional Commits, semantic versioning, deterministic packaging, and `npm run verify` before completion.

---

## Planned File Structure

### New files

- `src/shared/suspended-url.ts`: pure codec and validation for self-contained suspended-page fragments.
- `src/background/suspension.ts`: click-mode navigation, pending-parking race coordinator, activation recovery, and ready-page discard.
- `src/suspended/index.html`: generic manual-restore page.
- `src/suspended/index.ts`: explicit restore-button controller and ready notification.
- `src/suspended/suspended-controller.ts`: DOM-independent suspended-page behavior for unit tests.
- `src/suspended/styles.css`: accessible packaged-page presentation.
- `tests/unit/suspended-url.test.ts`: codec, scheme, credential, injection, and length tests.
- `tests/unit/suspension.test.ts`: parking, activation race, and ready-message behavior.
- `tests/unit/suspended-controller.test.ts`: explicit-click restoration tests.
- `docs/adr/0002-optional-tabs-for-manual-restore.md`: permission and privacy decision.

### Modified files

- `src/shared/settings.ts`: schema v2 and `restoreBehavior` migration/validation.
- `src/shared/messages.ts`: typed permission, protection, and suspension-page messages/responses.
- `src/background/eligibility.ts`: strategy-aware already-discarded handling and URL snapshot field.
- `src/background/sweep.ts`: native/click strategy selection and permission fail-closed behavior.
- `src/background/service-worker.ts`: optional-permission adapter, popup protection messages, activation listener, and suspension-page-ready validation.
- `src/manifest.json`: version 0.2.0 and `optional_permissions: ["tabs"]`.
- `src/options/*`: restore-behavior controls, disclosure, permission request/removal, and status.
- `src/popup/*`: current-tab protection control and “suspended” aggregate wording.
- `scripts/verify-package.mjs`: exact optional-permission and new-file allowlists.
- `scripts/smoke-extension.mjs`: suspended page, options permission denial-safe state, and protection smoke coverage.
- `tests/unit/*`, `tests/integration/*`: migrations, messages, manifest, package, UI, lifecycle, and regression coverage.
- `AGENTS.md`, `README.md`, `CHANGELOG.md`, `PRIVACY.md`, `SECURITY.md`, `package.json`, `package-lock.json`, and relevant `docs/*`: the reviewed 0.2.0 contract.

---

### Task 1: Migrate Settings to Schema Version 2

**Files:**

- Modify: `src/shared/settings.ts`
- Modify: `tests/unit/settings.test.ts`
- Modify: every existing test fixture that constructs schema-version-1 settings

**Interfaces:**

- Produces: `RestoreBehavior = 'native' | 'click'`.
- Produces: `Settings { schemaVersion: 2; enabled; idleMinutes; restoreBehavior }`.
- Produces: `saveSettings(update: Partial<Pick<Settings, 'enabled' | 'idleMinutes' | 'restoreBehavior'>>): Promise<Settings>`.
- Preserves: serialized write queue and fail-closed corruption behavior.

- [ ] **Step 1: Write failing migration and validation tests**

```ts
it('migrates valid v1 settings to native restore behavior', async () => {
  const storage = storageWith({
    settings: { schemaVersion: 1, enabled: false, idleMinutes: 60 },
  });
  await expect(getSettings(storage)).resolves.toEqual({
    schemaVersion: 2,
    enabled: false,
    idleMinutes: 60,
    restoreBehavior: 'native',
  });
});

it('rejects an unknown restore behavior', async () => {
  await expect(
    saveSettings({ restoreBehavior: 'automatic' as never }, storageWith()),
  ).rejects.toThrow('restoreBehavior must be native or click');
});
```

- [ ] **Step 2: Run the focused test and verify red state**

Run: `npm test -- tests/unit/settings.test.ts`

Expected: FAIL because settings still use schema version 1 and have no `restoreBehavior`.

- [ ] **Step 3: Implement schema-v2 normalization and writes**

```ts
export type RestoreBehavior = 'native' | 'click';

export interface Settings {
  schemaVersion: 2;
  enabled: boolean;
  idleMinutes: IdleMinutes;
  restoreBehavior: RestoreBehavior;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  enabled: true,
  idleMinutes: 15,
  restoreBehavior: 'native',
};
```

Recognize only valid v1 and v2 objects. Normalize valid v1 to v2/native. Keep corrupted stored settings paused with the other documented defaults. Validate every partial update before entering the write queue.

- [ ] **Step 4: Update fixtures mechanically and run all settings/controller tests**

Run: `npm test -- tests/unit/settings.test.ts tests/unit/popup-controller.test.ts tests/unit/options-controller.test.ts tests/unit/sweep.test.ts tests/unit/service-worker.test.ts tests/unit/service-worker-lifecycle.test.ts`

Expected: PASS with every response using `schemaVersion: 2` and an explicit restore behavior.

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts tests/unit
git commit -m "feat: migrate restore behavior settings"
```

---

### Task 2: Add the Self-Contained Suspended URL Codec

**Files:**

- Create: `src/shared/suspended-url.ts`
- Create: `tests/unit/suspended-url.test.ts`

**Interfaces:**

- Produces: `SUSPENDED_PAGE_PATH = 'suspended/index.html'`.
- Produces: `buildSuspendedPageUrl(originalUrl: string, extensionPageUrl: string): string | undefined`.
- Produces: `readOriginalUrlFromHash(hash: string): string | undefined`.
- Produces: `isSuspendedPageUrl(value: string, extensionPageUrl: string): boolean`.

- [ ] **Step 1: Write failing codec tests**

```ts
it('round-trips an https URL with Unicode, query, and fragment', () => {
  const original = 'https://example.test/پاکستان?q=a%20b#chapter-2';
  const parked = buildSuspendedPageUrl(original, extensionPage);
  expect(parked).toBeDefined();
  expect(readOriginalUrlFromHash(new URL(parked!).hash)).toBe(original);
});

it.each([
  'javascript:alert(1)',
  'data:text/html,private',
  'file:///C:/private.txt',
  'chrome://settings',
  'https://user:secret@example.test/',
])('rejects unsafe original address %s', (value) => {
  expect(buildSuspendedPageUrl(value, extensionPage)).toBeUndefined();
});

it('rejects a placeholder longer than 65,536 characters', () => {
  expect(
    buildSuspendedPageUrl(`https://example.test/${'a'.repeat(70_000)}`, extensionPage),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused test and verify red state**

Run: `npm test -- tests/unit/suspended-url.test.ts`

Expected: FAIL because `src/shared/suspended-url.ts` does not exist.

- [ ] **Step 3: Implement strict encoding and validation**

```ts
export const SUSPENDED_PAGE_PATH = 'suspended/index.html';
export const MAX_SUSPENDED_URL_LENGTH = 65_536;

function validatedHttpUrl(value: string): URL | undefined {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== ''
    )
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
```

Build `#v=1&url=${encodeURIComponent(originalUrl)}` only from a validated URL. Parse with `URLSearchParams`, require exactly version `1`, validate again after decoding, and compare suspension-page URLs by extension origin plus exact pathname rather than substring matching.

- [ ] **Step 4: Run codec tests, typecheck, and lint**

Run: `npm test -- tests/unit/suspended-url.test.ts && npm run typecheck && npm run lint`

Expected: PASS; malformed percent sequences, HTML strings, nested fragments, credentials, and unsupported schemes all fail closed.

- [ ] **Step 5: Commit**

```bash
git add src/shared/suspended-url.ts tests/unit/suspended-url.test.ts
git commit -m "feat: add safe suspended url codec"
```

---

### Task 3: Build the Explicit-Click Suspended Page

**Files:**

- Create: `src/suspended/index.html`
- Create: `src/suspended/index.ts`
- Create: `src/suspended/suspended-controller.ts`
- Create: `src/suspended/styles.css`
- Create: `tests/unit/suspended-controller.test.ts`
- Modify: `tests/integration/ui-artifacts.test.ts`

**Interfaces:**

- Consumes: `readOriginalUrlFromHash()`.
- Produces: `SuspendedView { setStatus(message); focusRestore() }`.
- Produces: `LocationPort { hash: string; replace(url: string): void }`.
- Produces: `createSuspendedController(view, location, notifyReady)` with `load()` and `restore()`.

- [ ] **Step 1: Write failing controller tests proving no automatic restoration**

```ts
it('notifies readiness and never restores during load', async () => {
  const replacements: string[] = [];
  const controller = createSuspendedController(
    view,
    {
      hash: validHash,
      replace: (url) => replacements.push(url),
    },
    async () => undefined,
  );

  await controller.load();
  expect(replacements).toEqual([]);
  expect(view.focused).toBe(true);
});

it('restores only after the explicit action', async () => {
  await controller.restore();
  expect(replacements).toEqual(['https://example.test/private?q=1#two']);
});
```

- [ ] **Step 2: Run focused tests and verify red state**

Run: `npm test -- tests/unit/suspended-controller.test.ts tests/integration/ui-artifacts.test.ts`

Expected: FAIL because suspended-page files do not exist.

- [ ] **Step 3: Implement controller and packaged UI**

The HTML contains a single primary button with `id="restore-tab"`, an `aria-live="polite"` status region, generic copy, no URL display element, no inline event handlers, and no remote references. `load()` sends `{ type: 'suspensionPageReady' }`, focuses the button, and does not parse the hash. `restore()` parses and validates only after activation, then calls `location.replace(url)` or announces “This suspended address is invalid and was not opened.”

```ts
restoreButton.addEventListener('click', () => void controller.restore());
void controller.load();
```

- [ ] **Step 4: Assert static privacy/accessibility boundaries and run tests**

Add checks that suspended HTML contains Restore, focus/status semantics, no original-data placeholders, no `http://`/`https://`, and no `on*=` handlers.

Run: `npm test -- tests/unit/suspended-controller.test.ts && npm run test:integration -- tests/integration/ui-artifacts.test.ts && npm run build`

Expected: PASS and `dist/suspended/` contains HTML, JS/controller bundles, and CSS.

- [ ] **Step 5: Commit**

```bash
git add src/suspended tests/unit/suspended-controller.test.ts tests/integration/ui-artifacts.test.ts
git commit -m "feat: add explicit restore page"
```

---

### Task 4: Implement Click-Mode Parking and Activation-Race Recovery

**Files:**

- Create: `src/background/suspension.ts`
- Create: `tests/unit/suspension.test.ts`
- Modify: `src/background/eligibility.ts`
- Modify: `tests/unit/eligibility.test.ts`

**Interfaces:**

- Adds to `TabSnapshot`: `url?: string`.
- Adds to `EligibilityOptions`: `allowAlreadyDiscarded?: boolean`.
- Produces: `ParkingTabsAdapter { get; update; discard }`.
- Produces: `createParkingCoordinator(tabs, extensionPageUrl)` with:
  - `park(tab: TabSnapshot): Promise<DiscardOutcome>`
  - `handleActivated(tabId: number): Promise<void>`
  - `handlePageReady(tabId: number, senderUrl: string): Promise<void>`

- [ ] **Step 1: Write failing parking and race tests**

```ts
it('parks an inactive http tab at the packaged page', async () => {
  await expect(coordinator.park(tab(7, { url: 'https://example.test/a' }))).resolves.toBe(
    'discarded',
  );
  expect(calls[0]).toMatch(/^update:7:chrome-extension:\/\/id\/suspended\/index.html#/u);
});

it('immediately restores when activation wins the navigation race', async () => {
  const parking = coordinator.park(tab(7, { url: original }));
  await updateStarted;
  await coordinator.handleActivated(7);
  releaseUpdate({ ...tab(7), active: true, url: parkedUrl });
  await expect(parking).resolves.toBe('skipped');
  expect(calls).toContain(`update:7:${original}`);
  expect(calls).not.toContain('discard:7');
});

it('discards only an inactive exact suspended-page sender', async () => {
  await coordinator.handlePageReady(7, parkedUrl);
  expect(calls.at(-1)).toBe('discard:7');
});
```

- [ ] **Step 2: Run focused tests and verify red state**

Run: `npm test -- tests/unit/suspension.test.ts tests/unit/eligibility.test.ts`

Expected: FAIL because the coordinator and strategy-aware eligibility do not exist.

- [ ] **Step 3: Implement the coordinator with an in-memory pending map**

```ts
interface PendingParking {
  originalUrl: string;
  cancelled: boolean;
}
const pending = new Map<number, PendingParking>();
```

`park()` validates the URL, records pending state before `tabs.update`, inspects the returned tab, and restores with `tabs.update(tabId, { url: originalUrl })` if cancellation/activation is observed. `handleActivated()` marks pending state cancelled and restores if the placeholder has already replaced the original. `handlePageReady()` re-fetches the tab, requires inactive state and exact extension-page URL, then discards with the explicit ID. Every API rejection returns/acts fail-closed with no immediate retry and no logging of URLs.

- [ ] **Step 4: Implement already-discarded eligibility only for click mode**

Keep `already-discarded` exclusion unless `allowAlreadyDiscarded === true`. Protected states are checked first. Add a coordinator test showing a discarded HTTP tab navigates only to the local page; if the mocked adapter reports original-page activation/loading, return skipped and restore nothing automatically.

- [ ] **Step 5: Run unit suite and commit**

Run: `npm test -- tests/unit/suspension.test.ts tests/unit/eligibility.test.ts && npm run typecheck && npm run lint`

Expected: PASS for close, activation, invalid URL, oversize URL, wrong sender, active sender, update rejection, discard rejection, and already-discarded paths.

```bash
git add src/background/suspension.ts src/background/eligibility.ts tests/unit/suspension.test.ts tests/unit/eligibility.test.ts
git commit -m "feat: add race-safe click suspension"
```

---

### Task 5: Route Sweeps Through Native or Click Strategy

**Files:**

- Modify: `src/background/sweep.ts`
- Modify: `tests/unit/sweep.test.ts`

**Interfaces:**

- Adds to `SweepDependencies`: `hasTabsPermission(): Promise<boolean>` and `park(tab: TabSnapshot): Promise<DiscardOutcome>`.
- Preserves: `runSweep(trigger, dependencies): Promise<SweepSummary>` and ten serial outcomes.
- Changes user meaning of `discardedCount` to successful memory-reduced/suspended outcomes while retaining the persisted field name for compatibility.

- [ ] **Step 1: Write failing strategy-selection tests**

```ts
it('uses parking instead of native discard in click mode', async () => {
  deps.storage.data.settings = settings({ restoreBehavior: 'click' });
  deps.hasTabsPermission = async () => true;
  await runSweep('manual', deps);
  expect(deps.calls).toEqual(['permission', 'query', 'get:1', 'permission', 'park:1']);
});

it('does not silently fall back when tabs permission is absent', async () => {
  deps.storage.data.settings = settings({ restoreBehavior: 'click' });
  deps.hasTabsPermission = async () => false;
  await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 0 });
  expect(deps.calls).toEqual(['permission']);
});
```

- [ ] **Step 2: Run sweep tests and verify red state**

Run: `npm test -- tests/unit/sweep.test.ts`

Expected: FAIL because every eligible tab currently reaches native `discard()`.

- [ ] **Step 3: Implement permission and strategy checks**

At sweep start and immediately after final `tabs.get`, re-read settings. In click mode, require `hasTabsPermission()` at both boundaries, pass `allowAlreadyDiscarded: true` to eligibility, and call `park(current)`. In native mode, preserve current eligibility and `tabs.discard(current.id)`. Never call either operation without an explicit ID.

- [ ] **Step 4: Expand race/property coverage and run sweep tests**

Cover permission revocation, restore-behavior change during refresh, activation/protection during refresh, already-discarded click candidate, unsupported URL, batch cap shared by both modes, and strict serial parking.

Run: `npm test -- tests/unit/sweep.test.ts`

Expected: PASS and storage writes still contain only the aggregate summary/settings.

- [ ] **Step 5: Commit**

```bash
git add src/background/sweep.ts tests/unit/sweep.test.ts
git commit -m "feat: route sweeps by restore behavior"
```

---

### Task 6: Extend Worker Messages, Permission State, and Tab Protection

**Files:**

- Modify: `src/shared/messages.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `tests/unit/service-worker.test.ts`
- Modify: `tests/unit/service-worker-lifecycle.test.ts`

**Interfaces:**

- Adds requests:
  - `{ type: 'setRestoreBehavior'; restoreBehavior: RestoreBehavior }`
  - `{ type: 'setCurrentTabProtection'; protected: boolean }`
  - `{ type: 'suspensionPageReady' }`
- Adds response fields:
  - `tabsPermissionGranted?: boolean`
  - `currentTabProtection?: { supported: boolean; protected: boolean }`
  - `actionError?: 'tabs-permission-required' | 'unsupported-tab'`
- Extends Chrome adapter with `permissions.contains`, `tabs.update`, `tabs.onActivated`, sender tab/url fields, and filtered active-tab query.

- [ ] **Step 1: Write failing worker tests**

```ts
it('reports optional permission and current-tab protection state', async () => {
  await expect(
    handleExtensionMessage({ type: 'getPopupState' }, deps, sender),
  ).resolves.toMatchObject({
    tabsPermissionGranted: true,
    currentTabProtection: { supported: true, protected: false },
  });
});

it('protects only the freshly queried active tab', async () => {
  await handleExtensionMessage({ type: 'setCurrentTabProtection', protected: true }, deps, sender);
  expect(calls).toContainEqual(['update', 9, { autoDiscardable: false }]);
});
```

- [ ] **Step 2: Run worker tests and verify red state**

Run: `npm test -- tests/unit/service-worker.test.ts tests/unit/service-worker-lifecycle.test.ts`

Expected: FAIL because messages, optional permission, sender validation, and activation listeners are absent.

- [ ] **Step 3: Implement typed adapters and handlers**

`getPopupState` queries `{ active: true, lastFocusedWindow: true }` and returns only supported/protected booleans. Protection re-queries at action time, requires an explicit ID, rejects extension/Chrome pages where the API state is unavailable, and updates only `autoDiscardable`.

`setRestoreBehavior('click')` refuses to save unless `permissions.contains({ permissions: ['tabs'] })` is true. Permission prompting remains in options, not the worker. `suspensionPageReady` is accepted only when sender URL matches the exact packaged suspended page and sender has an explicit tab ID.

- [ ] **Step 4: Register lifecycle listeners and verify termination safety**

Wire `tabs.onActivated` to the parking coordinator and pass it into sweep dependencies. Add lifecycle tests where the worker/controller is recreated after navigation; the self-contained suspended page must still restore, and missing in-memory pending state must never cause an automatic original navigation.

Run: `npm test -- tests/unit/service-worker.test.ts tests/unit/service-worker-lifecycle.test.ts tests/unit/suspension.test.ts`

Expected: PASS with listeners registered synchronously at module load.

- [ ] **Step 5: Commit**

```bash
git add src/shared/messages.ts src/background/service-worker.ts tests/unit/service-worker.test.ts tests/unit/service-worker-lifecycle.test.ts
git commit -m "feat: add permission and tab protection worker flows"
```

---

### Task 7: Add Permission-Gated Restore Behavior to Options

**Files:**

- Modify: `src/options/index.html`
- Modify: `src/options/styles.css`
- Modify: `src/options/index.ts`
- Modify: `src/options/options-controller.ts`
- Modify: `tests/unit/options-controller.test.ts`
- Modify: `tests/integration/ui-artifacts.test.ts`

**Interfaces:**

- Adds `OptionalTabsPermission { contains(); request(); remove() }` to controller dependencies.
- Adds `OptionsView.setRestoreBehavior(value)` and status/disclosure rendering.
- Adds `OptionsController.setRestoreBehavior(value): Promise<void>`.

- [ ] **Step 1: Write failing permission-flow tests**

```ts
it('requests tabs permission before saving click behavior', async () => {
  await controller.setRestoreBehavior('click');
  expect(calls).toEqual([
    ['request', { permissions: ['tabs'] }],
    ['message', { type: 'setRestoreBehavior', restoreBehavior: 'click' }],
  ]);
});

it('leaves native behavior selected when permission is denied', async () => {
  permission.request = async () => false;
  await controller.setRestoreBehavior('click');
  expect(view.values.restoreBehavior).toBe('native');
  expect(view.values.status).toBe('Permission was not granted. Restore behavior was not changed.');
});
```

- [ ] **Step 2: Run options tests and verify red state**

Run: `npm test -- tests/unit/options-controller.test.ts tests/integration/ui-artifacts.test.ts`

Expected: FAIL because the options page has no restore behavior controls or permission adapter.

- [ ] **Step 3: Implement the user-gesture permission flow**

Add a fieldset with native/click radios and plain disclosure containing Chrome's “Read your browsing history” wording, local-only use, percent-encoding visibility, no encryption claim, and unsaved-form warning. Invoke `controller.setRestoreBehavior()` directly from the radio `change` event so `chrome.permissions.request()` begins inside the user gesture.

Switching to native sends the settings message, then removes the optional permission. If removal fails, keep native behavior saved and report that Chrome still retains permission so the user can remove it through extension settings.

- [ ] **Step 4: Run options, artifact, accessibility, and race tests**

Cover permission already granted, denial, removal success/failure, concurrent initial load, corrupt response, reset returning native, and keyboard radio operation.

Run: `npm test -- tests/unit/options-controller.test.ts && npm run test:integration -- tests/integration/ui-artifacts.test.ts && npm run typecheck`

Expected: PASS without inline handlers or host/remote references.

- [ ] **Step 5: Commit**

```bash
git add src/options tests/unit/options-controller.test.ts tests/integration/ui-artifacts.test.ts
git commit -m "feat: add manual restore permission controls"
```

---

### Task 8: Add Protect/Allow Suspension to Popup

**Files:**

- Modify: `src/popup/index.html`
- Modify: `src/popup/styles.css`
- Modify: `src/popup/index.ts`
- Modify: `src/popup/popup-controller.ts`
- Modify: `tests/unit/popup-controller.test.ts`
- Modify: `tests/integration/ui-artifacts.test.ts`

**Interfaces:**

- Extends `PopupView.setText()` with `protectionAction` and `protectionDescription`.
- Adds `PopupView.setProtectionAvailable(value: boolean)`.
- Adds `PopupController.toggleProtection(): Promise<void>`.

- [ ] **Step 1: Write failing popup tests**

```ts
it('renders and toggles current-tab protection without tab metadata', async () => {
  await controller.load();
  expect(view.values.protectionAction).toBe('Protect this tab');
  await controller.toggleProtection();
  expect(sent.at(-1)).toEqual({ type: 'setCurrentTabProtection', protected: true });
  expect(view.values.protectionAction).toBe('Allow suspension');
});

it('disables protection for unsupported tabs', async () => {
  messenger.response.currentTabProtection = { supported: false, protected: false };
  await controller.load();
  expect(view.protectionAvailable).toBe(false);
});
```

- [ ] **Step 2: Run popup tests and verify red state**

Run: `npm test -- tests/unit/popup-controller.test.ts tests/integration/ui-artifacts.test.ts`

Expected: FAIL because popup protection state/action do not exist.

- [ ] **Step 3: Implement accessible popup control and suspended wording**

Add a `type="button"` protection control, explain “Protection applies only to this tab and ends when the tab is closed,” and never show URL/title/domain. Change aggregate/user action copy from “discarded” to “suspended” while retaining response field `discardedCount` internally.

- [ ] **Step 4: Run popup race, failure, and accessibility tests**

Cover current-tab switching before update (worker re-query), API rejection, unsupported tab, stale load response, busy state, keyboard focus order, and no tab data in error messages.

Run: `npm test -- tests/unit/popup-controller.test.ts && npm run test:integration -- tests/integration/ui-artifacts.test.ts`

Expected: PASS with popup actions ordered pause, suspend now, protect, settings, privacy.

- [ ] **Step 5: Commit**

```bash
git add src/popup tests/unit/popup-controller.test.ts tests/integration/ui-artifacts.test.ts
git commit -m "feat: add per-tab protection control"
```

---

### Task 9: Update Manifest and Harden Build/Package Verification

**Files:**

- Modify: `src/manifest.json`
- Modify: `scripts/verify-package.mjs`
- Modify: `tests/integration/manifest.test.ts`
- Modify: `tests/unit/verify-package.test.ts`
- Modify: `tests/unit/release-artifacts.test.ts` if inventory fixtures require it

**Interfaces:**

- Produces manifest version `0.2.0` with required `['alarms', 'storage']` and optional `['tabs']` only.
- Produces exact package allowlist including `background/suspension.js`, `shared/suspended-url.js`, and `suspended/*`.

- [ ] **Step 1: Write failing manifest/package-boundary tests**

```ts
expect(manifest.permissions).toEqual(['alarms', 'storage']);
expect(manifest.optional_permissions).toEqual(['tabs']);
expect(manifest.host_permissions).toBeUndefined();

expect(() =>
  validatePackageManifest({
    ...approvedManifest,
    optional_permissions: ['tabs', 'history'],
  }),
).toThrow('Package optional permissions must be exactly tabs.');
```

- [ ] **Step 2: Run boundary tests and verify red state**

Run: `npm test -- tests/integration/manifest.test.ts tests/unit/verify-package.test.ts`

Expected: FAIL because optional permissions and new approved files are currently forbidden.

- [ ] **Step 3: Update exact allowlists and version**

Set manifest version to `0.2.0`; declare `optional_permissions: ['tabs']`; leave host permissions absent and CSP unchanged. Add only reviewed new build paths to both verifier and tests. Continue rejecting every undeclared binary, network string, content script, host permission, optional host permission, web-accessible resource, and external connection.

- [ ] **Step 4: Build/package and run boundary tests**

Run: `npm test -- tests/integration/manifest.test.ts tests/unit/verify-package.test.ts && npm run build && npm run package && npm run package:verify`

Expected: PASS; the ZIP contains only the exact 0.2.0 extension assets.

- [ ] **Step 5: Commit**

```bash
git add src/manifest.json scripts/verify-package.mjs tests/integration/manifest.test.ts tests/unit/verify-package.test.ts tests/unit/release-artifacts.test.ts
git commit -m "build: allow reviewed manual restore assets"
```

---

### Task 10: Expand Real-Chrome Smoke and Manual Acceptance

**Files:**

- Modify: `scripts/smoke-extension.mjs`
- Modify: `tests/unit/smoke-extension.test.ts`
- Modify: `docs/TEST-PLAN.md`

**Interfaces:**

- Produces automated Chrome coverage for the packaged and unpacked builds.
- Produces a recorded manual 15-minute acceptance checklist for behavior that Chrome does not expose with a writable `lastAccessed` test API.

- [ ] **Step 1: Write failing smoke-helper tests**

Add helper-unit assertions for the expected popup focus order including `protect-tab`, a suspended-page URL builder used only by the smoke runner, and manifest extension-ID discovery.

Run: `npm test -- tests/unit/smoke-extension.test.ts`

Expected: FAIL until smoke expectations include the new page and control.

- [ ] **Step 2: Extend the real-Chrome script**

For both `dist/` and extracted ZIP:

1. Open a generic suspended page whose fragment targets a local HTTP test page.
2. Wait two seconds and assert the page remains `chrome-extension://.../suspended/index.html`.
3. Trigger the Restore button by keyboard and assert navigation reaches the HTTP test page.
4. Open a normal test tab, open popup, activate **Protect this tab**, and verify through `chrome.tabs.get()` in the extension context that `autoDiscardable === false`.
5. Activate **Allow suspension** and verify `autoDiscardable === true`.
6. Verify options show native mode by default and the exact permission disclosure.
7. Assert no extension-origin network requests occurred.

- [ ] **Step 3: Add manual automatic-sweep acceptance**

Document this exact owner-profile check:

1. Reload the unpacked `dist/` extension at a stable path.
2. Enable **Show a Restore button first** and grant optional `tabs` permission.
3. Open two ordinary HTTP(S) tabs, leave one inactive for at least 15 minutes plus one alarm interval, and keep the other active.
4. Confirm the inactive tab becomes the generic local suspended page and the active tab remains untouched.
5. Activate the suspended tab and confirm the original site does not load.
6. Press Restore and confirm the original site loads.
7. Protect a fresh inactive tab, wait through another eligible sweep, and confirm it is untouched.
8. Restart Chrome and confirm an existing suspended page still requires Restore.

- [ ] **Step 4: Run real-Chrome smoke**

Run: `npm run build && npm run package && npm run package:verify && npm run smoke:chrome`

Expected: “Chrome smoke passed” for unpacked dist and packaged archive.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-extension.mjs tests/unit/smoke-extension.test.ts docs/TEST-PLAN.md
git commit -m "test: verify manual restore in Chrome"
```

---

### Task 11: Update Privacy, Architecture, Recovery, and Contributor Contracts

**Files:**

- Create: `docs/adr/0002-optional-tabs-for-manual-restore.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `SECURITY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/PRODUCT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PERMISSIONS.md`
- Modify: `docs/PRIVACY-DATA-FLOW.md`
- Modify: `docs/LOCAL-INSTALL.md`
- Modify: `docs/RELEASE.md`
- Modify: `docs/WEB-STORE.md`
- Modify: `docs/privacy-disclosure-draft.md`
- Modify: `docs/store-listing-draft.md`
- Modify: `tests/integration/tooling.test.ts`

**Interfaces:**

- Produces an enforceable repository contract allowing optional `tabs` only for manual restore.
- Produces recovery instructions for percent-encoded suspended addresses.

- [ ] **Step 1: Write failing documentation-contract assertions**

```ts
expect(agents).toContain('optional `tabs` permission');
expect(permissions).toContain('Read your browsing history');
expect(privacy).toContain('Percent encoding is not encryption');
expect(localInstall).toContain('Recover a suspended address');
```

- [ ] **Step 2: Run documentation tests and verify red state**

Run: `npm run test:integration -- tests/integration/tooling.test.ts`

Expected: FAIL because current policy categorically prohibits all URL access and optional permissions.

- [ ] **Step 3: Write ADR 0002 and update every affected contract**

ADR 0002 supersedes ADR 0001 only for the explicit optional click-mode boundary. State required/optional permissions, exact data use, address-bar/session/history visibility, no encryption claim, no transmission, removal flow, supported schemes, payload limit, race limitation, worker/browser recovery, extension-ID recovery risk, and unsaved-form limitation.

Update `AGENTS.md` so future changes still prohibit host permissions/network/content scripts and prohibit any use of `tabs` beyond the reviewed URL parking/protection flows without a new ADR.

- [ ] **Step 4: Run documentation, privacy-string, and package scans**

Run: `npm run test:integration -- tests/integration/tooling.test.ts tests/integration/ui-artifacts.test.ts && npm run package:verify`

Expected: PASS with consistent language and no remote URL introduced into packaged files. Documentation links remain outside the extension ZIP.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md PRIVACY.md SECURITY.md CONTRIBUTING.md docs tests/integration/tooling.test.ts
git commit -m "docs: document optional manual restore boundary"
```

---

### Task 12: Version, Verify, Package, and Publish the 0.2.0 Branch

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Regenerate ignored/local artifacts: `dist/`, `package/strict-tab-suspender-0.2.0.zip`, checksum, SBOM, inventory

**Interfaces:**

- Produces version-consistent source and deterministic private-beta artifacts.
- Produces a pushed `feat/manual-restore-tab-protection` branch only after all automated gates pass.

- [ ] **Step 1: Bump package metadata without creating a tag**

Run: `npm version 0.2.0 --no-git-tag-version`

Expected: `package.json` and `package-lock.json` both report `0.2.0`; manifest already reports `0.2.0`.

- [ ] **Step 2: Finalize changelog**

Move the reviewed manual-restore, optional-permission, per-tab-protection, privacy, recovery, and testing entries into `## [0.2.0] - 2026-08-05`. Do not claim Web Store publication.

- [ ] **Step 3: Run the complete automated release gate from a clean source state**

Run: `npm run verify && npm run release:verify`

Expected: formatting, lint, typecheck, unit tests, integration tests, build, package, package verification, reproducibility, and real-Chrome smoke all pass.

- [ ] **Step 4: Inspect release integrity**

Run:

```bash
git status --short
git diff --check
git diff --stat main...HEAD
```

Expected: only reviewed source/documentation/version changes are tracked; generated `dist/`, package ZIP, temporary Chrome profiles, and caches remain ignored; no whitespace errors.

- [ ] **Step 5: Commit release metadata**

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: prepare 0.2.0 private beta"
```

- [ ] **Step 6: Re-run verification on the final commit and push**

Run: `npm run verify && npm run release:verify`

Expected: all gates pass again on committed source.

Run: `git push -u origin feat/manual-restore-tab-protection`

Expected: GitHub receives the tested feature branch. Do not merge to `main`, create a tag, or publish a GitHub Release until the owner completes the documented 15-minute manual acceptance on the installed profile.

---

## Final Review Checklist

- [ ] Required permissions are exactly `alarms` and `storage`.
- [ ] Optional permissions are exactly `tabs`.
- [ ] No host permissions, content scripts, network access, telemetry, or URL database exist.
- [ ] Native mode behaves exactly as version 0.1.x.
- [ ] Click mode never restores on activation alone.
- [ ] Restore requires explicit button/keyboard activation and validates HTTP(S) again.
- [ ] Optional permission denial/revocation never triggers native fallback.
- [ ] Activation during parking follows the documented immediate-recovery path.
- [ ] Existing placeholders remain restorable after worker/browser restart and permission removal.
- [ ] Protect/unprotect uses only the freshly queried explicit tab ID and `autoDiscardable`.
- [ ] Popup/options/suspended UI never render browsing metadata.
- [ ] Full automated verification passes on the final commit.
- [ ] Only the verified feature branch is pushed before owner-profile acceptance.
