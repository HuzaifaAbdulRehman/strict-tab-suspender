# Strict Tab Discarder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private-first Chrome 121+ Manifest V3 extension that serially discards eligible inactive tabs using only local settings.

**Architecture:** A service worker owns alarm scheduling, startup grace timing, eligibility evaluation, and serial discards. Popup and options pages are vanilla HTML/CSS clients of a typed local storage layer; tab fields exist only during a sweep and the persisted result is one aggregate summary.

**Tech Stack:** TypeScript, vanilla HTML/CSS, Chrome Manifest V3, esbuild, Vitest, Puppeteer, ESLint, Prettier.

## Global Constraints

- Product name is Strict Tab Discarder and the repository name remains `strict-tab-suspender`.
- Support Chrome 121+ only, with TypeScript and vanilla HTML/CSS and zero runtime dependencies.
- The only manifest permissions are `alarms` and `storage`; do not request host permissions.
- Do not use URL/title/history access, network, telemetry, content scripts, remote code, accounts, or ads.
- Default to enabled with a 15-minute threshold and presets of 15, 30, 60, and 120 minutes.
- Protect active, pinned, audible, already-discarded, and not-auto-discardable tabs.
- Apply a five-minute startup grace period and a maximum of 10 serial discards per sweep.
- Persist local settings and only the latest aggregate sweep summary; never persist URLs, titles, favicons, domains, tab IDs, browsing history, or per-tab activity.
- State clearly in the UI and documentation that unsaved forms cannot be detected.

---

## Planned file structure

- `src/manifest.json`: MV3 metadata, permissions, service worker, popup, and options page declarations.
- `src/shared/settings.ts`: types, defaults, validation, and local storage access.
- `src/background/eligibility.ts`: pure tab eligibility predicate.
- `src/background/sweep.ts`: serial, capped discard execution and aggregate result.
- `src/background/service-worker.ts`: alarm lifecycle and startup grace orchestration.
- `src/popup/*` and `src/options/*`: vanilla UI showing settings, summary, and unsaved-form warning.
- `tests/unit/*`: settings, eligibility, and sweep behavior.
- `tests/integration/*`: Puppeteer smoke coverage of packaged MV3 behavior.

### Task 1: Add the Manifest V3 shell

**Files:**

- Create: `src/manifest.json`
- Create: `src/popup/index.html`
- Create: `src/options/index.html`
- Create: `src/background/service-worker.ts`
- Test: `tests/integration/manifest.test.ts`

**Interfaces:**

- Produces: a manifest with `permissions: ["alarms", "storage"]`, `background.service_worker: "background/service-worker.js"`, and no host permissions.

- [ ] **Step 1: Write the failing integration test**

```ts
it('uses only alarms and storage without host permissions', async () => {
  const manifest = await readManifest();
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['alarms', 'storage']);
  expect(manifest.host_permissions).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/manifest.test.ts`

Expected: FAIL because `src/manifest.json` does not exist.

- [ ] **Step 3: Add the minimal manifest and empty service-worker entrypoint**

```json
{
  "manifest_version": 3,
  "name": "Strict Tab Discarder",
  "version": "0.1.0",
  "minimum_chrome_version": "121",
  "permissions": ["alarms", "storage"],
  "background": { "service_worker": "background/service-worker.js", "type": "module" }
}
```

- [ ] **Step 4: Run the focused test and build**

Run: `npm test -- tests/integration/manifest.test.ts && npm run build`

Expected: PASS and `dist/manifest.json` plus the built service worker exist.

- [ ] **Step 5: Commit**

```bash
git add src tests/integration
git commit -m "feat: add mv3 extension shell"
```

### Task 2: Implement local settings

**Files:**

- Create: `src/shared/settings.ts`
- Test: `tests/unit/settings.test.ts`

**Interfaces:**

- Produces: `Settings`, `DEFAULT_SETTINGS`, `readSettings(): Promise<Settings>`, and `writeSettings(settings: Settings): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
it('defaults to enabled and a fifteen-minute preset', async () => {
  expect(DEFAULT_SETTINGS).toEqual({ enabled: true, thresholdMinutes: 15 });
  await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/settings.test.ts`

Expected: FAIL because `DEFAULT_SETTINGS` and `readSettings` do not exist.

- [ ] **Step 3: Add the minimal typed storage layer**

```ts
export type ThresholdMinutes = 15 | 30 | 60 | 120;
export interface Settings {
  enabled: boolean;
  thresholdMinutes: ThresholdMinutes;
}
export const DEFAULT_SETTINGS: Settings = { enabled: true, thresholdMinutes: 15 };
```

Read and write only `enabled` and `thresholdMinutes` through `chrome.storage.local`; reject values outside the four presets.

- [ ] **Step 4: Run focused unit tests**

Run: `npm test -- tests/unit/settings.test.ts`

Expected: PASS, including rejection of a non-preset threshold.

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts tests/unit/settings.test.ts
git commit -m "feat: add local discard settings"
```

### Task 3: Implement eligibility and aggregate sweep data

**Files:**

- Create: `src/background/eligibility.ts`
- Create: `src/shared/summary.ts`
- Test: `tests/unit/eligibility.test.ts`

**Interfaces:**

- Consumes: `Settings` from `src/shared/settings.ts`.
- Produces: `isEligibleForDiscard(tab: chrome.tabs.Tab, now: number, thresholdMinutes: ThresholdMinutes): boolean` and `SweepSummary { completedAt: number; discardedCount: number }`.

- [ ] **Step 1: Write failing eligibility tests**

```ts
it.each(['active', 'pinned', 'audible', 'discarded', 'autoDiscardable'])(
  'rejects protected tab state %s',
  (state) => expect(isEligibleForDiscard(tabWith(state), now, 15)).toBe(false),
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/eligibility.test.ts`

Expected: FAIL because the predicate does not exist.

- [ ] **Step 3: Implement only the predicate and aggregate type**

Use current tab state in memory. Return `false` for active, pinned, audible, discarded, or `autoDiscardable === false`. Do not log or persist any tab fields.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/eligibility.test.ts`

Expected: PASS for every protected state and an eligible inactive tab.

- [ ] **Step 5: Commit**

```bash
git add src/background/eligibility.ts src/shared/summary.ts tests/unit/eligibility.test.ts
git commit -m "feat: add protected-tab eligibility rules"
```

### Task 4: Execute capped serial sweeps

**Files:**

- Create: `src/background/sweep.ts`
- Test: `tests/unit/sweep.test.ts`

**Interfaces:**

- Consumes: `isEligibleForDiscard` and `SweepSummary`.
- Produces: `runSweep(now: number, settings: Settings): Promise<SweepSummary>`.

- [ ] **Step 1: Write the failing test**

```ts
it('discards at most ten eligible tabs serially', async () => {
  const summary = await runSweep(now, { enabled: true, thresholdMinutes: 15 });
  expect(discardCalls).toHaveLength(10);
  expect(summary.discardedCount).toBe(10);
  expect(discardCalls).toEqual([...discardCalls].sort((a, b) => a - b));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/sweep.test.ts`

Expected: FAIL because `runSweep` does not exist.

- [ ] **Step 3: Implement serial execution**

Query once, filter with the pure predicate, then use a `for...of` loop over the first 10 eligible tabs and await each `chrome.tabs.discard(tab.id)` before continuing. Persist only `{ completedAt, discardedCount }` as the latest summary.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/sweep.test.ts`

Expected: PASS for disabled settings, protected tabs, serial order, cap, and aggregate-only persistence.

- [ ] **Step 5: Commit**

```bash
git add src/background/sweep.ts tests/unit/sweep.test.ts
git commit -m "feat: add capped serial tab sweep"
```

### Task 5: Schedule alarms and startup grace

**Files:**

- Modify: `src/background/service-worker.ts`
- Test: `tests/unit/service-worker.test.ts`

**Interfaces:**

- Consumes: `readSettings` and `runSweep`.
- Produces: an alarm handler that waits five minutes after startup and respects `settings.enabled`.

- [ ] **Step 1: Write the failing test**

```ts
it('does not run a sweep during the five-minute startup grace period', async () => {
  await handleAlarm({ name: 'strict-tab-discarder-sweep' });
  expect(runSweep).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/service-worker.test.ts`

Expected: FAIL because `handleAlarm` does not exist.

- [ ] **Step 3: Implement minimal scheduling**

Create one named alarm after five startup minutes, recreate it when settings change, and skip sweeps when disabled. Do not create any network, history, or content-script behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/service-worker.test.ts`

Expected: PASS for grace period, enabled state, and one alarm name.

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.ts tests/unit/service-worker.test.ts
git commit -m "feat: schedule guarded discard sweeps"
```

### Task 6: Build the vanilla options and popup UI

**Files:**

- Create: `src/options/index.ts`, `src/options/index.html`, `src/options/styles.css`
- Create: `src/popup/index.ts`, `src/popup/index.html`, `src/popup/styles.css`
- Test: `tests/integration/ui.test.ts`

**Interfaces:**

- Consumes: `readSettings`, `writeSettings`, and latest `SweepSummary`.
- Produces: controls for enabled state and the four threshold presets, and text that says unsaved forms cannot be detected.

- [ ] **Step 1: Write the failing Puppeteer test**

```ts
it('shows all four presets and the unsaved-form warning', async () => {
  await expect(page.locator('text=15 minutes')).toBeVisible();
  await expect(page.locator('text=30 minutes')).toBeVisible();
  await expect(page.locator('text=60 minutes')).toBeVisible();
  await expect(page.locator('text=120 minutes')).toBeVisible();
  await expect(page.locator('text=cannot detect unsaved forms')).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- tests/integration/ui.test.ts`

Expected: FAIL because the pages and controls do not exist.

- [ ] **Step 3: Implement minimal accessible vanilla controls**

Render a checkbox for enabled state, a select or radio group constrained to the four presets, latest aggregate summary text, and the explicit unsaved-form warning. Do not display or save per-tab data.

- [ ] **Step 4: Run integration test, build, and package verification**

Run: `npm run test:integration -- tests/integration/ui.test.ts && npm run build && npm run package && npm run package:verify`

Expected: PASS and the ZIP contains only built extension files with root `manifest.json`.

- [ ] **Step 5: Commit**

```bash
git add src/options src/popup tests/integration/ui.test.ts
git commit -m "feat: add local settings interface"
```

### Task 7: Complete release validation and documentation

**Files:**

- Modify: `README.md`, `CHANGELOG.md`, `docs/TEST-PLAN.md`, `docs/LOCAL-INSTALL.md`
- Test: `tests/integration/manifest.test.ts`

**Interfaces:**

- Consumes: the packaged ZIP and published source documentation.
- Produces: a release-ready package and consistent user documentation.

- [ ] **Step 1: Write failing package-content assertion**

```ts
it('packages only built extension entries', async () => {
  const entries = await packageEntries();
  expect(entries).toContain('manifest.json');
  expect(entries.some((entry) => entry.startsWith('src/') || entry === 'package.json')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/manifest.test.ts`

Expected: FAIL until the completed extension is built and packaged.

- [ ] **Step 3: Update release documentation and package artifact**

Document actual controls and test commands; update the Unreleased changelog; build `dist`; create the ZIP; and confirm no source, tests, repository documents, lockfiles, or package metadata enter the archive.

- [ ] **Step 4: Run full verification**

Run: `npm run verify && npm run package && npm run package:verify`

Expected: PASS with formatting, lint, typecheck, unit/integration tests, build, and package verification all green.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md docs tests
git commit -m "docs: finalize release validation guidance"
```
