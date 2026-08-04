import { afterEach, describe, expect, it, vi } from 'vitest';

const alarmName = 'strict-tab-discarder-sweep';

describe('service-worker durable startup grace', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  });

  it('does not reset an existing grace-scheduled alarm on reload and sweeps after five minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const calls: string[] = [];
    let alarm: { name: string; scheduledTime: number } | undefined;
    let onAlarm: ((alarmInfo: { name: string }) => void) | undefined;
    const globalWithChrome = globalThis as typeof globalThis & { chrome?: unknown };
    globalWithChrome.chrome = {
      storage: {
        local: {
          async get() {
            return {
              settings: {
                schemaVersion: 2,
                enabled: true,
                idleMinutes: 15,
                restoreBehavior: 'native',
              },
            };
          },
          async set() {},
        },
        onChanged: { addListener() {} },
      },
      alarms: {
        async get(name: string) {
          calls.push(`get:${name}`);
          return alarm;
        },
        async clear(name: string) {
          calls.push(`clear:${name}`);
          alarm = undefined;
          return true;
        },
        create(name: string, info: { when?: number }) {
          calls.push(`create:${name}:${info.when}`);
          alarm = { name, scheduledTime: info.when! };
        },
        onAlarm: {
          addListener(listener: (alarmInfo: { name: string }) => void) {
            onAlarm = listener;
          },
        },
      },
      tabs: {
        async query() {
          calls.push('query');
          return [{ id: 1, lastAccessed: 1_699_999_000_000 }];
        },
        async get() {
          calls.push('tab-get');
          return { id: 1, lastAccessed: 1_699_999_000_000 };
        },
        async discard() {
          calls.push('discard');
          return { id: 1 };
        },
        async update(id: number, update: Record<string, unknown>) {
          return { id, ...update };
        },
        onActivated: { addListener() {} },
      },
      permissions: { async contains() { return false; } },
      runtime: {
        getURL: (path: string) => `chrome-extension://id/${path}`,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
      },
    };

    await import('../../src/background/service-worker.js');
    await vi.waitFor(() =>
      expect(alarm).toEqual({ name: alarmName, scheduledTime: 1_700_000_300_000 }),
    );

    vi.setSystemTime(1_700_000_300_001);
    vi.resetModules();
    await import('../../src/background/service-worker.js');
    await vi.waitFor(() =>
      expect(calls.filter((call) => call.startsWith('create:'))).toHaveLength(1),
    );

    onAlarm?.({ name: alarmName });
    await vi.waitFor(() => expect(calls).toContain('discard'));
    expect(calls.filter((call) => call === 'clear:strict-tab-discarder-sweep')).toEqual([]);
  });
});
