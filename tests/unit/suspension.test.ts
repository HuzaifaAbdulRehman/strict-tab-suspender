import { describe, expect, it } from 'vitest';

import { createParkingCoordinator } from '../../src/background/suspension.js';
import type { TabSnapshot } from '../../src/background/eligibility.js';

const extensionPage = 'chrome-extension://id/suspended/index.html';
const original = 'https://example.test/private?q=1#two';

function tab(id: number, changes: Partial<TabSnapshot> = {}): TabSnapshot {
  return {
    id,
    active: false,
    pinned: false,
    audible: false,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: 1,
    url: original,
    ...changes,
  };
}

function harness(initial = tab(7)) {
  const calls: string[] = [];
  let current = initial;
  const coordinator = createParkingCoordinator(
    {
      async get(id) {
        calls.push(`get:${id}`);
        return current;
      },
      async update(id, update) {
        calls.push(`update:${id}:${update.url}`);
        current = { ...current, id, url: update.url };
        return current;
      },
      async discard(id) {
        calls.push(`discard:${id}`);
        current = { ...current, discarded: true };
        return current;
      },
    },
    extensionPage,
  );
  return {
    coordinator,
    calls,
    setCurrent(value: TabSnapshot) {
      current = value;
    },
  };
}

describe('click suspension coordinator', () => {
  it('parks an inactive http tab at the packaged page', async () => {
    const state = harness();

    await expect(state.coordinator.park(tab(7))).resolves.toBe('discarded');

    expect(state.calls[0]).toMatch(/^update:7:chrome-extension:\/\/id\/suspended\/index\.html#/u);
    expect(state.calls).not.toContain('discard:7');
  });

  it('immediately restores when activation wins the navigation race', async () => {
    let releaseUpdate!: (value: TabSnapshot) => void;
    let markUpdateStarted!: () => void;
    const updateStarted = new Promise<void>((resolve) => (markUpdateStarted = resolve));
    const updateResult = new Promise<TabSnapshot>((resolve) => (releaseUpdate = resolve));
    const calls: string[] = [];
    let parkedUrl = '';
    const coordinator = createParkingCoordinator(
      {
        async get(id) {
          calls.push(`get:${id}`);
          return tab(id, { active: false, url: original });
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          if (update.url === original) return tab(id, { active: true, url: original });
          if (update.url === undefined) throw new Error('missing test URL');
          parkedUrl = update.url;
          markUpdateStarted();
          return updateResult;
        },
        async discard(id) {
          calls.push(`discard:${id}`);
          return tab(id, { discarded: true });
        },
      },
      extensionPage,
    );

    const parking = coordinator.park(tab(7));
    await updateStarted;
    await coordinator.handleActivated(7);
    releaseUpdate(tab(7, { active: true, url: parkedUrl }));

    await expect(parking).resolves.toBe('skipped');
    expect(calls).toContain(`update:7:${original}`);
    expect(calls).not.toContain('discard:7');
  });

  it('discards only an inactive exact suspended-page sender', async () => {
    const state = harness();
    await state.coordinator.park(tab(7));
    const parkedUrl = state.calls[0]!.slice('update:7:'.length);
    state.setCurrent(tab(7, { url: parkedUrl, active: false }));

    await state.coordinator.handlePageReady(7, parkedUrl);

    expect(state.calls.at(-1)).toBe('discard:7');
  });

  it.each([
    ['active tab', tab(7, { active: true })],
    ['wrong sender', tab(7, { url: original })],
  ])('does not discard for an %s', async (_label, current) => {
    const state = harness(current as TabSnapshot);

    await state.coordinator.handlePageReady(7, original);

    expect(state.calls).not.toContain('discard:7');
  });

  it.each(['javascript:alert(1)', `https://example.test/${'a'.repeat(70_000)}`])(
    'rejects an unsafe or oversized original URL',
    async (url) => {
      const state = harness(tab(7, { url }));
      await expect(state.coordinator.park(tab(7, { url }))).resolves.toBe('skipped');
      expect(state.calls).toEqual([]);
    },
  );

  it('reports a rejected navigation as failed without retrying', async () => {
    const coordinator = createParkingCoordinator(
      {
        async get() {
          throw new Error('not reached');
        },
        async update() {
          throw new Error('closed');
        },
        async discard() {
          throw new Error('not reached');
        },
      },
      extensionPage,
    );

    await expect(coordinator.park(tab(7))).resolves.toBe('failed');
  });
});
