import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALARM_NAME,
  ALARM_PERIOD_MINUTES,
  createServiceWorkerController,
  ensureSweepAlarm,
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
    settings: { schemaVersion: 1, enabled, idleMinutes: 15 },
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
    startedAt: now - 10 * 60 * 1000,
    now: () => now,
    alarms: {
      async clear(name) {
        calls.push(`clear:${name}`);
        return true;
      },
      create(name, info) {
        calls.push(`create:${name}:${info.periodInMinutes}`);
      },
    },
    tabs: {
      async query() {
        calls.push('query');
        return [];
      },
      async get() {
        throw new Error('not reached');
      },
      async discard() {
        throw new Error('not reached');
      },
    },
  };
}

describe('service worker scheduler', () => {
  it('recreates the single repeating sweep alarm when automation is enabled', async () => {
    const deps = dependencies();

    await ensureSweepAlarm(deps);

    expect(ALARM_NAME).toBe('strict-tab-discarder-sweep');
    expect(ALARM_PERIOD_MINUTES).toBe(1);
    expect(deps.calls).toEqual([
      'clear:strict-tab-discarder-sweep',
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
      { settings: { schemaVersion: 1, enabled: false, idleMinutes: 15 } },
      { settings: { schemaVersion: 1, enabled: true, idleMinutes: 15 } },
    ]);
    expect(deps.calls).toEqual([
      'clear:strict-tab-discarder-sweep',
      'clear:strict-tab-discarder-sweep',
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
      'clear:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
      'clear:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
      'clear:strict-tab-discarder-sweep',
      'create:strict-tab-discarder-sweep:1',
    ]);
  });

  it('does not query tabs for an automatic alarm during the five-minute module-start grace', async () => {
    const deps = dependencies();
    deps.startedAt = now - 1;
    const controller = createServiceWorkerController(deps);

    await controller.onAlarm({ name: ALARM_NAME });

    expect(deps.calls).toEqual([]);
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
      const listeners = { installed: 0, startup: 0, changed: 0, alarm: 0 };
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
          async discard() {},
        },
        runtime: {
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
      registerServiceWorker(browser, now);
      return listeners;
    };

    const initialListeners = startWorker();
    const reloadedListeners = startWorker();

    expect(initialListeners).toEqual({ installed: 1, startup: 1, changed: 1, alarm: 1 });
    expect(reloadedListeners).toEqual({ installed: 1, startup: 1, changed: 1, alarm: 1 });
  });
});
