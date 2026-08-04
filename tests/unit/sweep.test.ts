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
  settings = { schemaVersion: 1 as const, enabled: true, idleMinutes: 15 as const },
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
    startedAt: now - 10 * 60 * 1000,
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
      },
    },
  };
}

describe('runSweep', () => {
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

  it('allows an explicit manual sweep during the automatic startup grace', async () => {
    const deps = dependencies([tab(1)]);
    deps.startedAt = now - 1;

    await expect(runSweep('manual', deps)).resolves.toMatchObject({ discardedCount: 1 });
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

  it('never fetches or discards a tab without an id', async () => {
    const deps = dependencies([]);

    await expect(
      discardIfStillEligible(
        { ...tab(1), id: undefined },
        { schemaVersion: 1, enabled: true, idleMinutes: 15 },
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
});
