import { describe, expect, it } from 'vitest';

import {
  discardIfStillEligible,
  runSweep,
  type SweepDependencies,
} from '../../src/background/sweep.js';
import type { TabSnapshot } from '../../src/background/eligibility.js';
import type { LocalStorageArea } from '../../src/shared/settings.js';

const now = 1_700_000_000_000;
const oldAccess = now - 15 * 60 * 1000;

function tab(id: number, changes: Partial<TabSnapshot> = {}): TabSnapshot {
  return {
    id,
    active: false,
    pinned: false,
    audible: false,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: oldAccess,
    ...changes,
  };
}

function storageWith(
  settings = {
    schemaVersion: 2 as const,
    enabled: true,
    idleMinutes: 15 as const,
    restoreBehavior: 'native' as const,
  },
) {
  const data: Record<string, unknown> = { settings };
  const storage: LocalStorageArea & {
    data: Record<string, unknown>;
    writes: Record<string, unknown>[];
  } = {
    data,
    writes: [],
    async get() {
      return { ...data };
    },
    async set(values) {
      storage.writes.push(values);
      Object.assign(data, values);
    },
  };
  return storage;
}

function dependencies(
  queried: TabSnapshot[],
  fresh: Map<number, TabSnapshot> = new Map(
    queried.filter((item) => item.id !== undefined).map((item) => [item.id!, item]),
  ),
): SweepDependencies & { calls: string[]; storage: ReturnType<typeof storageWith> } {
  const calls: string[] = [];
  const storage = storageWith();
  return {
    calls,
    storage,
    now: () => now,
    async hasTabsPermission() {
      calls.push('permission');
      return true;
    },
    async park(value) {
      calls.push(`park:${value.id}`);
      return 'discarded';
    },
    tabs: {
      async query() {
        calls.push('query');
        return queried;
      },
      async get(id) {
        calls.push(`get:${id}`);
        const value = fresh.get(id);
        if (value === undefined) throw new Error('closed');
        return value;
      },
      async discard(id) {
        calls.push(`discard:${id}`);
        return tab(id);
      },
    },
  };
}

describe('runSweep', () => {
  it('uses parking instead of native discard in click mode', async () => {
    const deps = dependencies([tab(1, { url: 'https://example.test/' })]);
    deps.storage.data.settings = {
      schemaVersion: 2,
      enabled: true,
      idleMinutes: 15,
      restoreBehavior: 'click',
    };

    await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 1 });

    expect(deps.calls).toEqual(['permission', 'query', 'get:1', 'permission', 'park:1']);
    expect(deps.calls).not.toContain('discard:1');
  });

  it('does not silently fall back when tabs permission is absent', async () => {
    const deps = dependencies([tab(1, { url: 'https://example.test/' })]);
    deps.storage.data.settings = {
      schemaVersion: 2,
      enabled: true,
      idleMinutes: 15,
      restoreBehavior: 'click',
    };
    deps.hasTabsPermission = async () => {
      deps.calls.push('permission');
      return false;
    };

    await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 0 });
    expect(deps.calls).toEqual(['permission']);
  });

  it('fails closed when click parking rejects unexpectedly', async () => {
    const deps = dependencies([tab(1, { url: 'https://example.test/' })]);
    deps.storage.data.settings = {
      schemaVersion: 2,
      enabled: true,
      idleMinutes: 15,
      restoreBehavior: 'click',
    };
    deps.park = async () => Promise.reject(new Error('tab closed'));

    await expect(runSweep('manual', deps)).resolves.toMatchObject({
      discardedCount: 0,
      failedCount: 1,
    });
    expect(deps.calls).not.toContain('discard:1');
  });

  it('rechecks optional permission immediately before parking', async () => {
    const deps = dependencies([tab(1, { url: 'https://example.test/' })]);
    deps.storage.data.settings = {
      schemaVersion: 2,
      enabled: true,
      idleMinutes: 15,
      restoreBehavior: 'click',
    };
    let permissionChecks = 0;
    deps.hasTabsPermission = async () => {
      deps.calls.push('permission');
      permissionChecks += 1;
      return permissionChecks === 1;
    };

    await expect(runSweep('manual', deps)).resolves.toMatchObject({
      discardedCount: 0,
      skippedCount: 1,
    });
    expect(deps.calls).toEqual(['permission', 'query', 'get:1', 'permission']);
  });

  it('can convert an already-discarded http tab only in click mode', async () => {
    const deps = dependencies([
      tab(1, { url: 'https://example.test/', discarded: true }),
    ]);
    deps.storage.data.settings = {
      schemaVersion: 2,
      enabled: true,
      idleMinutes: 15,
      restoreBehavior: 'click',
    };

    await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 1 });
    expect(deps.calls).toContain('park:1');
    expect(deps.calls).not.toContain('discard:1');
  });

  it('does not query tabs for a disabled automatic sweep', async () => {
    const deps = dependencies([]);
    deps.storage.data.settings = { schemaVersion: 1, enabled: false, idleMinutes: 15 };

    await expect(runSweep('alarm', deps)).resolves.toEqual({
      checkedAt: now,
      evaluatedCount: 0,
      discardedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(deps.calls).toEqual([]);
  });

  it('queries, filters, refetches, revalidates, and discards in that order', async () => {
    const deps = dependencies(
      [tab(1, { active: true }), tab(2), tab(3)],
      new Map([
        [2, tab(2, { pinned: true })],
        [3, tab(3)],
      ]),
    );

    await expect(runSweep('manual', deps)).resolves.toEqual({
      checkedAt: now,
      evaluatedCount: 3,
      discardedCount: 1,
      skippedCount: 2,
      failedCount: 0,
    });
    expect(deps.calls).toEqual(['query', 'get:2', 'get:3', 'discard:3']);
  });

  it('discards no more than ten tabs and awaits each discard before the next', async () => {
    const queried = Array.from({ length: 12 }, (_, index) => tab(index + 1));
    const deps = dependencies(queried);
    let concurrent = 0;
    let highestConcurrent = 0;
    deps.tabs.discard = async (id) => {
      concurrent += 1;
      highestConcurrent = Math.max(highestConcurrent, concurrent);
      deps.calls.push(`discard:${id}`);
      await Promise.resolve();
      concurrent -= 1;
      return tab(id);
    };

    const summary = await runSweep('manual', deps);

    expect(summary).toEqual({
      checkedAt: now,
      evaluatedCount: 12,
      discardedCount: 10,
      skippedCount: 2,
      failedCount: 0,
    });
    expect(deps.calls.filter((call) => call.startsWith('discard:'))).toEqual(
      Array.from({ length: 10 }, (_, index) => `discard:${index + 1}`),
    );
    expect(highestConcurrent).toBe(1);
  });

  it('allows an explicit manual sweep without depending on automatic alarm timing', async () => {
    const deps = dependencies([tab(1)]);

    await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 1 });
  });

  it('cancels an in-flight automatic discard when automation is paused', async () => {
    const deps = dependencies([tab(1)]);
    let releaseRefresh!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      deps.tabs.get = async (id) => {
        resolve();
        await new Promise<void>((release) => {
          releaseRefresh = release;
        });
        return tab(id);
      };
    });

    const sweep = runSweep('alarm', deps);
    await refreshStarted;
    deps.storage.data.settings = { schemaVersion: 1, enabled: false, idleMinutes: 15 };
    releaseRefresh();

    await expect(sweep).resolves.toMatchObject({ discardedCount: 0, skippedCount: 1 });
    expect(deps.calls.some((call) => call.startsWith('discard:'))).toBe(false);
  });

  it('uses the latest timeout when it changes while the final tab refresh is pending', async () => {
    const deps = dependencies([tab(1)]);
    let releaseRefresh!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      deps.tabs.get = async (id) => {
        resolve();
        await new Promise<void>((release) => {
          releaseRefresh = release;
        });
        return tab(id);
      };
    });

    const sweep = runSweep('manual', deps);
    await refreshStarted;
    deps.storage.data.settings = { schemaVersion: 1, enabled: true, idleMinutes: 120 };
    releaseRefresh();

    await expect(sweep).resolves.toMatchObject({ discardedCount: 0, skippedCount: 1 });
    expect(deps.calls).toEqual(['query']);
  });

  it('records API rejection as failure and writes only the aggregate summary', async () => {
    const deps = dependencies([tab(1), tab(2)]);
    deps.tabs.get = async (id) => {
      if (id === 1) throw new Error('closed');
      return tab(2);
    };
    deps.tabs.discard = async () => {
      throw new Error('rejected');
    };

    await expect(runSweep('manual', deps)).resolves.toEqual({
      checkedAt: now,
      evaluatedCount: 2,
      discardedCount: 0,
      skippedCount: 0,
      failedCount: 2,
    });
    expect(deps.storage.writes).toEqual([
      {
        latestSweepSummary: {
          checkedAt: now,
          evaluatedCount: 2,
          discardedCount: 0,
          skippedCount: 0,
          failedCount: 2,
        },
      },
    ]);
  });

  it('does not count an undefined discard result as a discarded tab', async () => {
    const deps = dependencies([tab(1)]);
    deps.tabs.discard = async () => undefined;

    await expect(runSweep('manual', deps)).resolves.toEqual({
      checkedAt: now,
      evaluatedCount: 1,
      discardedCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
  });

  it('never fetches or discards a tab without an id', async () => {
    const deps = dependencies([]);

    await expect(
      discardIfStillEligible(
        { ...tab(1), id: undefined },
        { schemaVersion: 2, enabled: true, idleMinutes: 15, restoreBehavior: 'native' },
        deps,
      ),
    ).resolves.toBe('skipped');
    expect(deps.calls).toEqual([]);
  });

  it('never reaches discard for any excluded tab state', async () => {
    const exclusions: ReadonlyArray<Partial<TabSnapshot>> = [
      { id: undefined },
      { active: true },
      { pinned: true },
      { audible: true },
      { discarded: true },
      { autoDiscardable: false },
      { lastAccessed: undefined },
      { lastAccessed: now + 1 },
      { lastAccessed: Number.NaN },
      { lastAccessed: oldAccess + 1 },
    ];

    for (const excluded of exclusions) {
      const candidate = { ...tab(1), ...excluded };
      const deps = dependencies([candidate], new Map([[1, candidate]]));
      await runSweep('manual', deps);
      expect(deps.calls.some((call) => call.startsWith('discard:'))).toBe(false);
    }
  });

  it.each(['active', 'audible'] as const)(
    'skips a tab that becomes %s between query and discard',
    async (changedState) => {
      const deps = dependencies([tab(1)], new Map([[1, tab(1, { [changedState]: true })]]));

      await expect(runSweep('manual', deps)).resolves.toMatchObject({
        discardedCount: 0,
        skippedCount: 1,
        failedCount: 0,
      });
      expect(deps.calls).toEqual(['query', 'get:1']);
    },
  );
});
