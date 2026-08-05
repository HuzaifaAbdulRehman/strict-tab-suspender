import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALARM_NAME,
  ALARM_PERIOD_MINUTES,
  createServiceWorkerController,
  ensureSweepAlarm,
  handleExtensionMessage,
  pauseAutomation,
  registerServiceWorker,
  resumeAutomation,
  type ServiceWorkerDependencies,
} from '../../src/background/service-worker.js';
import type { LocalStorageArea } from '../../src/shared/settings.js';

const now = 1_700_000_000_000;

function storageWith(
  enabled = true,
): LocalStorageArea & { data: Record<string, unknown>; writes: Record<string, unknown>[] } {
  const data: Record<string, unknown> = {
    settings: { schemaVersion: 3, enabled, idleMinutes: 15, restoreBehavior: 'native' },
  };
  const writes: Record<string, unknown>[] = [];
  return {
    data,
    writes,
    async get() {
      return { ...data };
    },
    async set(values) {
      writes.push(values);
      Object.assign(data, values);
    },
  };
}

function dependencies(
  enabled = true,
): ServiceWorkerDependencies & { calls: string[]; storage: ReturnType<typeof storageWith> } {
  const calls: string[] = [];
  const storage = storageWith(enabled);
  return {
    calls,
    storage,
    now: () => now,
    async hasTabsPermission() {
      calls.push('permission');
      return true;
    },
    async park(tab) {
      calls.push(`park:${tab.id}`);
      return 'discarded';
    },
    async handleActivated(tabId) {
      calls.push(`activated:${tabId}`);
    },
    async handlePageReady(tabId, senderUrl) {
      calls.push(`ready:${tabId}:${senderUrl}`);
    },
    alarms: {
      async get(name) {
        calls.push(`get:${name}`);
        return undefined;
      },
      async clear(name) {
        calls.push(`clear:${name}`);
        return true;
      },
      create(name, info) {
        calls.push(`create:${name}:${info.periodInMinutes}`);
      },
    },
    tabs: {
      async query(queryInfo) {
        if (queryInfo?.active === true) {
          calls.push('query-active');
          return [{ id: 9, active: true, autoDiscardable: true }];
        }
        calls.push('query');
        return [];
      },
      async get() {
        throw new Error('not reached');
      },
      async discard() {
        throw new Error('not reached');
      },
      async update(id, update) {
        calls.push(`update:${id}:${String(update.autoDiscardable)}`);
        return {
          id,
          active: true,
          autoDiscardable: update.autoDiscardable ?? true,
          ...(update.url === undefined ? {} : { url: update.url }),
        };
      },
    },
  };
}

describe('service worker scheduler', () => {
  it('reports optional permission and current-tab protection state', async () => {
    const deps = dependencies();

    await expect(handleExtensionMessage({ type: 'getPopupState' }, deps)).resolves.toMatchObject({
      tabsPermissionGranted: true,
      currentTabProtection: { supported: true, protected: false },
    });
    expect(deps.calls).toContain('query-active');
  });

  it('protects only the freshly queried active tab', async () => {
    const deps = dependencies();

    await expect(
      handleExtensionMessage({ type: 'setCurrentTabProtection', protected: true }, deps),
    ).resolves.toMatchObject({
      currentTabProtection: { supported: true, protected: true },
    });
    expect(deps.calls).toContain('update:9:false');
  });

  it('does not enable click restore when optional tabs permission is absent', async () => {
    const deps = dependencies();
    deps.hasTabsPermission = async () => false;

    await expect(
      handleExtensionMessage({ type: 'setRestoreBehavior', restoreBehavior: 'click' }, deps),
    ).resolves.toMatchObject({
      actionError: 'tabs-permission-required',
      settings: { restoreBehavior: 'native' },
    });
  });

  it('accepts page readiness only with an explicit sender tab and URL', async () => {
    const deps = dependencies();
    const senderUrl = 'chrome-extension://id/suspended/index.html#v=1';

    await handleExtensionMessage({ type: 'suspensionPageReady' }, deps, {
      tab: { id: 7 },
      url: senderUrl,
    });

    expect(deps.calls).toContain(`ready:7:${senderUrl}`);
  });

  it('serves popup actions through local-only worker APIs and returns aggregate state', async () => {
    const deps = dependencies();

    await expect(handleExtensionMessage({ type: 'getPopupState' }, deps)).resolves.toEqual({
      settings: { schemaVersion: 3, enabled: true, idleMinutes: 15, restoreBehavior: 'native' },
      tabsPermissionGranted: true,
      currentTabProtection: { supported: true, protected: false },
    });
    await expect(handleExtensionMessage({ type: 'manualSweep' }, deps)).resolves.toEqual({
      summary: {
        checkedAt: now,
        evaluatedCount: 0,
        discardedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      },
    });
    await expect(handleExtensionMessage({ type: 'pauseAutomation' }, deps)).resolves.toEqual({
      settings: { schemaVersion: 3, enabled: false, idleMinutes: 15, restoreBehavior: 'native' },
    });
    await expect(
      handleExtensionMessage({ type: 'saveSettings', idleMinutes: 60 }, deps),
    ).resolves.toEqual({
      settings: { schemaVersion: 3, enabled: false, idleMinutes: 60, restoreBehavior: 'native' },
    });
    await expect(handleExtensionMessage({ type: 'resetSettings' }, deps)).resolves.toEqual({
      settings: { schemaVersion: 3, enabled: true, idleMinutes: 15, restoreBehavior: 'click' },
    });
    expect(deps.storage.data).toEqual({
      settings: { schemaVersion: 3, enabled: true, idleMinutes: 15, restoreBehavior: 'click' },
      latestSweepSummary: {
        checkedAt: now,
        evaluatedCount: 0,
        discardedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      },
    });
    expect(deps.calls).toEqual(
      expect.arrayContaining([
        `clear:${ALARM_NAME}`,
        `create:${ALARM_NAME}:${ALARM_PERIOD_MINUTES}`,
      ]),
    );
  });

  it('recreates the single repeating sweep alarm when automation is enabled', async () => {
    const deps = dependencies();

    await ensureSweepAlarm(deps);

    expect(ALARM_NAME).toBe('strict-tab-discarder-sweep');
    expect(ALARM_PERIOD_MINUTES).toBe(1);
    expect(deps.calls).toEqual([
      'get:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
    ]);
  });

  it('clears the automatic alarm without recreating it when automation is paused', async () => {
    const deps = dependencies(false);

    await ensureSweepAlarm(deps);

    expect(deps.calls).toEqual(['clear:strict-tab-discarder-sweep']);
  });

  it('restricts local storage to trusted extension contexts when Chrome supports it', async () => {
    const deps = dependencies();
    const accessCalls: string[] = [];
    (
      deps.storage as unknown as { setAccessLevel(info: { accessLevel: string }): Promise<void> }
    ).setAccessLevel = async (info) => {
      accessCalls.push(info.accessLevel);
    };

    await ensureSweepAlarm(deps);

    expect(accessCalls).toEqual(['TRUSTED_CONTEXTS']);
  });

  it('persists pause and resume before updating the alarm', async () => {
    const deps = dependencies();

    await pauseAutomation(deps);
    await resumeAutomation(deps);

    expect(deps.storage.writes).toEqual([
      {
        settings: {
          schemaVersion: 3,
          enabled: false,
          idleMinutes: 15,
          restoreBehavior: 'native',
        },
      },
      {
        settings: {
          schemaVersion: 3,
          enabled: true,
          idleMinutes: 15,
          restoreBehavior: 'native',
        },
      },
    ]);
    expect(deps.calls).toEqual([
      'clear:strict-tab-discarder-sweep',
      'get:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
    ]);
  });

  it('recreates the alarm on install, browser startup, and local settings changes', async () => {
    const deps = dependencies();
    const controller = createServiceWorkerController(deps);

    await controller.onInstalled();
    await controller.onStartup();
    await controller.onStorageChanged({ settings: { newValue: { enabled: false } } }, 'local');

    expect(deps.calls).toEqual([
      'get:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
      'get:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
      'get:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
    ]);
  });

  it('reschedules an existing alarm from a true browser startup to enforce startup grace', async () => {
    const deps = dependencies();
    deps.alarms.get = async () => ({
      name: ALARM_NAME,
      scheduledTime: now + ALARM_PERIOD_MINUTES * 60 * 1000,
    });
    const controller = createServiceWorkerController(deps);

    await controller.onStartup();

    expect(deps.calls).toEqual([
      'clear:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
    ]);
  });

  it('runs an automatic alarm without using module-local startup state', async () => {
    const deps = dependencies();
    const controller = createServiceWorkerController(deps);

    await controller.onAlarm({ name: ALARM_NAME });

    expect(deps.calls).toEqual(['query']);
    expect(deps.storage.data).toMatchObject({
      latestSweepSummary: {
        checkedAt: now,
        evaluatedCount: 0,
        discardedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      },
    });
  });
});

describe('service worker module lifecycle', () => {
  const globalWithChrome = globalThis as typeof globalThis & { chrome?: unknown };
  const originalChrome = globalWithChrome.chrome;

  afterEach(() => {
    globalWithChrome.chrome = originalChrome;
    vi.resetModules();
  });

  it('initializes listener registrations independently on each worker start', async () => {
    const startWorker = () => {
      const listeners = { installed: 0, startup: 0, changed: 0, alarm: 0, activated: 0 };
      const browser = {
        storage: {
          local: {
            async get() {
              return { settings: { schemaVersion: 1, enabled: true, idleMinutes: 15 } };
            },
            async set() {},
          },
          onChanged: {
            addListener: () => {
              listeners.changed += 1;
            },
          },
        },
        alarms: {
          async get() {
            return undefined;
          },
          async clear() {
            return true;
          },
          create() {},
          onAlarm: {
            addListener: () => {
              listeners.alarm += 1;
            },
          },
        },
        tabs: {
          async query() {
            return [];
          },
          async get() {
            throw new Error('not reached');
          },
          async discard() {
            return { id: 1 };
          },
          async update(id: number, update: Record<string, unknown>) {
            return { id, ...update };
          },
          onActivated: {
            addListener: () => {
              listeners.activated += 1;
            },
          },
        },
        permissions: {
          async contains() {
            return false;
          },
        },
        runtime: {
          getURL: (path: string) => `chrome-extension://id/${path}`,
          onInstalled: {
            addListener: () => {
              listeners.installed += 1;
            },
          },
          onStartup: {
            addListener: () => {
              listeners.startup += 1;
            },
          },
        },
      };
      registerServiceWorker(browser);
      return listeners;
    };

    const initialListeners = startWorker();
    const reloadedListeners = startWorker();

    expect(initialListeners).toEqual({
      installed: 1,
      startup: 1,
      changed: 1,
      alarm: 1,
      activated: 1,
    });
    expect(reloadedListeners).toEqual({
      installed: 1,
      startup: 1,
      changed: 1,
      alarm: 1,
      activated: 1,
    });
  });
});
