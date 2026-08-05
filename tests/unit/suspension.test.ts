import { describe, expect, it } from 'vitest';

import { createParkingCoordinator, suspendCurrentTabNow } from '../../src/background/suspension.js';
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
    title: 'Private page',
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
    const parkedUrl = state.calls[0]!.slice('update:7:'.length);
    expect(new URLSearchParams(new URL(parkedUrl).hash.slice(1)).get('title')).toBe('Private page');
    expect(state.calls).not.toContain('discard:7');
  });

  it('immediately restores when activation wins the navigation race', async () => {
    let releaseUpdate!: (value: TabSnapshot) => void;
    let markUpdateStarted!: () => void;
    const updateStarted = new Promise<void>((resolve) => (markUpdateStarted = resolve));
    const updateResult = new Promise<TabSnapshot>((resolve) => (releaseUpdate = resolve));
    const calls: string[] = [];
    let parkedUrl = '';
    let current = tab(7, { active: false, url: original });
    const coordinator = createParkingCoordinator(
      {
        async get(id) {
          calls.push(`get:${id}`);
          return current;
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          if (update.url === original) {
            current = tab(id, { active: true, url: original });
            return current;
          }
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
    current = tab(7, { active: true, url: parkedUrl });
    releaseUpdate(current);

    await expect(parking).resolves.toBe('skipped');
    expect(calls).toContain(`update:7:${original}`);
    expect(calls).not.toContain('discard:7');
  });

  it('cancels an exact pending placeholder when Chrome reports activation during navigation', async () => {
    const calls: string[] = [];
    let current = tab(7);
    const coordinator = createParkingCoordinator(
      {
        async get(id) {
          calls.push(`get:${id}`);
          return current;
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          if (update.url === original) {
            current = tab(id, { active: true, url: original });
          } else {
            current = {
              ...current,
              id,
              active: true,
              url: original,
              pendingUrl: update.url,
            };
          }
          return current;
        },
        async discard() {
          return current;
        },
      },
      extensionPage,
    );

    await expect(coordinator.park(tab(7))).resolves.toBe('skipped');

    expect(current).toEqual(expect.objectContaining({ active: true, url: original }));
    expect(current.pendingUrl).toBeUndefined();
    expect(calls.filter((call) => call === `update:7:${original}`)).toHaveLength(1);
  });

  it('does not overwrite a pre-existing pending navigation during automatic parking', async () => {
    const state = harness(tab(7, { pendingUrl: 'https://destination.test/' }));

    await expect(
      state.coordinator.park(tab(7, { pendingUrl: 'https://destination.test/' })),
    ).resolves.toBe('skipped');

    expect(state.calls).toEqual([]);
  });

  it.each([
    ['changes identity', 'changed-id', true],
    ['navigates elsewhere', 'changed-url', false],
    ['has a different pending navigation', 'changed-pending', false],
    ['becomes pinned', 'pinned', true],
    ['becomes audible', 'audible', true],
    ['becomes protected', 'protected', true],
    ['becomes active', 'active', true],
    ['does not report inactive state', 'missing-active', true],
  ] as const)(
    'fails closed when the automatic update result %s',
    async (_label, mutation, shouldRestoreExactPlaceholder) => {
      const calls: string[] = [];
      let current = tab(7);
      const differentUrl = 'https://changed.test/';
      const differentPendingUrl = 'https://destination.test/';
      const coordinator = createParkingCoordinator(
        {
          async get(id) {
            calls.push(`get:${id}`);
            return current;
          },
          async update(id, update) {
            calls.push(`update:${id}:${update.url}`);
            if (update.url === original) {
              current = tab(id, { url: original });
              return current;
            }
            if (update.url === undefined) throw new Error('missing test URL');

            switch (mutation) {
              case 'changed-id':
                current = tab(id, { url: update.url });
                return tab(id + 1, { url: update.url });
              case 'changed-url':
                current = tab(id, { url: differentUrl });
                return current;
              case 'changed-pending':
                current = tab(id, { url: original, pendingUrl: differentPendingUrl });
                return current;
              case 'pinned':
                current = tab(id, { url: update.url, pinned: true });
                return current;
              case 'audible':
                current = tab(id, { url: update.url, audible: true });
                return current;
              case 'protected':
                current = tab(id, { url: update.url, autoDiscardable: false });
                return current;
              case 'active':
                current = tab(id, { url: update.url, active: true });
                return current;
              case 'missing-active': {
                const withoutActive = tab(id, { url: update.url });
                delete withoutActive.active;
                current = withoutActive;
                return current;
              }
            }
          },
          async discard() {
            return current;
          },
        },
        extensionPage,
      );

      await expect(coordinator.park(tab(7))).resolves.toBe('skipped');

      const restoreCalls = calls.filter((call) => call === `update:7:${original}`);
      expect(restoreCalls).toHaveLength(shouldRestoreExactPlaceholder ? 1 : 0);
      if (shouldRestoreExactPlaceholder) {
        expect(current).toEqual(expect.objectContaining({ id: 7, active: false, url: original }));
        expect(current.pendingUrl).toBeUndefined();
      }
      if (mutation === 'changed-url') expect(current.url).toBe(differentUrl);
      if (mutation === 'changed-pending') {
        expect(current.pendingUrl).toBe(differentPendingUrl);
      }
    },
  );

  it('accepts an inactive exact automatic placeholder while navigation is pending', async () => {
    const calls: string[] = [];
    let current = tab(7);
    const coordinator = createParkingCoordinator(
      {
        async get() {
          return current;
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          current = tab(id, { active: false, url: original, pendingUrl: update.url });
          return current;
        },
        async discard() {
          return current;
        },
      },
      extensionPage,
    );

    await expect(coordinator.park(tab(7))).resolves.toBe('discarded');
    expect(calls.filter((call) => call === `update:7:${original}`)).toEqual([]);
  });

  it('preserves click-mode conversion of an eligible already-discarded tab', async () => {
    const state = harness(tab(7, { discarded: true }));

    await expect(state.coordinator.park(tab(7, { discarded: true }))).resolves.toBe('discarded');

    expect(state.calls[0]).toMatch(/^update:7:chrome-extension:\/\/id\/suspended\/index\.html#/u);
    expect(state.calls.filter((call) => call === `update:7:${original}`)).toEqual([]);
  });

  it.each([
    ['rejects an otherwise valid mixed pair', 'own-pending', 'https://changed.test/'],
    ['preserves a newly pinned committed target', 'pinned-own-pending', 'https://changed.test/'],
    [
      'preserves a newly protected committed target',
      'protected-own-pending',
      'https://changed.test/',
    ],
    ['leaves a different pending destination untouched', 'different-pending', undefined],
    [
      'rejects a committed placeholder with a conflicting pending destination',
      'parked-different-pending',
      undefined,
    ],
    ['does not reload an unsupported committed target', 'unsupported-own-pending', undefined],
    [
      'does not overwrite an unsupported protected target',
      'unsupported-protected-own-pending',
      undefined,
    ],
  ] as const)('%s during automatic parking', async (_label, stateKind, safeRecoveryUrl) => {
    const calls: string[] = [];
    const changedUrl = 'https://changed.test/';
    const unsupportedUrl = 'chrome://settings/';
    const differentPendingUrl = 'https://destination.test/';
    let current = tab(7);
    let parkingUpdateComplete = false;
    const coordinator = createParkingCoordinator(
      {
        async get() {
          return current;
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          if (parkingUpdateComplete) {
            current = { ...current, id, url: update.url };
            delete current.pendingUrl;
            return current;
          }
          if (update.url === undefined) throw new Error('missing test URL');
          parkingUpdateComplete = true;
          const parkedUrl = update.url;
          switch (stateKind) {
            case 'own-pending':
              current = tab(id, { url: changedUrl, pendingUrl: parkedUrl });
              break;
            case 'pinned-own-pending':
              current = tab(id, { url: changedUrl, pendingUrl: parkedUrl, pinned: true });
              break;
            case 'protected-own-pending':
              current = tab(id, {
                url: changedUrl,
                pendingUrl: parkedUrl,
                autoDiscardable: false,
              });
              break;
            case 'different-pending':
              current = tab(id, { url: changedUrl, pendingUrl: differentPendingUrl });
              break;
            case 'parked-different-pending':
              current = tab(id, { url: parkedUrl, pendingUrl: differentPendingUrl });
              break;
            case 'unsupported-own-pending':
              current = tab(id, { url: unsupportedUrl, pendingUrl: parkedUrl });
              break;
            case 'unsupported-protected-own-pending':
              current = tab(id, {
                url: unsupportedUrl,
                pendingUrl: parkedUrl,
                autoDiscardable: false,
              });
              break;
          }
          return current;
        },
        async discard() {
          return current;
        },
      },
      extensionPage,
    );

    await expect(coordinator.park(tab(7))).resolves.toBe('skipped');

    const recoveryCalls = calls.slice(1);
    if (safeRecoveryUrl === undefined) {
      expect(recoveryCalls).toEqual([]);
    } else {
      expect(recoveryCalls).toEqual([`update:7:${safeRecoveryUrl}`]);
      expect(current.url).toBe(safeRecoveryUrl);
      expect(current.pendingUrl).toBeUndefined();
    }
    expect(recoveryCalls).not.toContain(`update:7:${original}`);
    if (stateKind === 'different-pending' || stateKind === 'parked-different-pending') {
      expect(current.pendingUrl).toBe(differentPendingUrl);
    }
    if (stateKind.startsWith('unsupported')) {
      expect(current.url).toBe(unsupportedUrl);
    }
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

describe('immediate current-tab suspension', () => {
  function immediateHarness(
    queried: TabSnapshot[],
    fresh: TabSnapshot | Error,
    parkResult: 'discarded' | 'skipped' | 'failed' = 'discarded',
  ) {
    const calls: string[] = [];
    return {
      calls,
      run: () =>
        suspendCurrentTabNow(
          {
            async query() {
              calls.push('query-active');
              return queried;
            },
            async get(id) {
              calls.push(`get:${id}`);
              if (fresh instanceof Error) throw fresh;
              return fresh;
            },
          },
          {
            async parkCurrent(value) {
              calls.push(`park-current:${value.id}`);
              return parkResult;
            },
          },
        ),
    };
  }

  it('bypasses only active and recent exclusions after query and immediate re-fetch', async () => {
    const current = tab(9, { active: true, lastAccessed: Date.now(), title: 'Fresh title' });
    const state = immediateHarness([current], current);

    await expect(state.run()).resolves.toBe('suspended');
    expect(state.calls).toEqual(['query-active', 'get:9', 'park-current:9']);
  });

  it('suspends an intentionally active tab through the real parking coordinator', async () => {
    const calls: string[] = [];
    let current = tab(9, { active: true, lastAccessed: Date.now() });
    const tabs = {
      async query() {
        calls.push('query-active');
        return [current];
      },
      async get(id: number) {
        calls.push(`get:${id}`);
        return current;
      },
      async update(id: number, update: { url?: string }) {
        calls.push(`update:${id}:${update.url}`);
        current = { ...current, id, url: update.url };
        return current;
      },
      async discard(id: number) {
        calls.push(`discard:${id}`);
        return current;
      },
    };
    const coordinator = createParkingCoordinator(tabs, extensionPage);

    await expect(suspendCurrentTabNow(tabs, coordinator)).resolves.toBe('suspended');

    expect(current.active).toBe(true);
    expect(current.url).toMatch(/^chrome-extension:\/\/id\/suspended\/index\.html#/u);
    expect(calls.filter((call) => call === `update:9:${original}`)).toEqual([]);
  });

  it("accepts Chrome's pending URL while current-tab suspension navigation is uncommitted", async () => {
    const calls: string[] = [];
    let current = tab(9, { active: true, lastAccessed: Date.now() });
    const tabs = {
      async query() {
        calls.push('query-active');
        return [current];
      },
      async get(id: number) {
        calls.push(`get:${id}`);
        return current;
      },
      async update(id: number, update: { url?: string }) {
        calls.push(`update:${id}:${update.url}`);
        if (update.url === original) {
          current = tab(id, { active: true, url: original });
        } else {
          current = {
            ...current,
            id,
            url: original,
            pendingUrl: update.url,
          };
        }
        return current;
      },
      async discard() {
        return current;
      },
    };
    const coordinator = createParkingCoordinator(tabs, extensionPage);

    await expect(suspendCurrentTabNow(tabs, coordinator)).resolves.toBe('suspended');

    expect(current.url).toBe(original);
    expect(current.pendingUrl).toMatch(/^chrome-extension:\/\/id\/suspended\/index\.html#/u);
    expect(calls.filter((call) => call === `update:9:${original}`)).toEqual([]);
  });

  it('fails closed when the selected tab already has a different pending navigation', async () => {
    const queried = tab(9, { active: true });
    const state = immediateHarness(
      [queried],
      tab(9, { active: true, pendingUrl: 'https://destination.test/' }),
    );

    await expect(state.run()).resolves.toBe('failed');
    expect(state.calls).toEqual(['query-active', 'get:9']);
  });

  it.each([
    ['cancels its pending placeholder over a newer safe URL', 'own-pending', true],
    ['leaves a different pending destination untouched', 'different-pending', false],
    [
      'rejects a committed placeholder with a conflicting pending destination',
      'parked-different-pending',
      false,
    ],
    ['does not reload an unsupported committed target', 'unsupported-own-pending', false],
  ] as const)('%s during current-tab parking', async (_label, stateKind, shouldRecoverSafeUrl) => {
    const calls: string[] = [];
    const changedUrl = 'https://changed.test/';
    const unsupportedUrl = 'chrome://settings/';
    const differentPendingUrl = 'https://destination.test/';
    let current = tab(9, { active: true });
    let parkingUpdateComplete = false;
    const tabs = {
      async query() {
        return [current];
      },
      async get() {
        return current;
      },
      async update(id: number, update: { url?: string }) {
        calls.push(`update:${id}:${update.url}`);
        if (parkingUpdateComplete) {
          current = { ...current, id, url: update.url };
          delete current.pendingUrl;
          return current;
        }
        if (update.url === undefined) throw new Error('missing test URL');
        parkingUpdateComplete = true;
        if (stateKind === 'own-pending') {
          current = tab(id, { active: true, url: changedUrl, pendingUrl: update.url });
        } else if (stateKind === 'different-pending') {
          current = tab(id, {
            active: true,
            url: changedUrl,
            pendingUrl: differentPendingUrl,
          });
        } else if (stateKind === 'parked-different-pending') {
          current = tab(id, {
            active: true,
            url: update.url,
            pendingUrl: differentPendingUrl,
          });
        } else {
          current = tab(id, { active: true, url: unsupportedUrl, pendingUrl: update.url });
        }
        return current;
      },
      async discard() {
        return current;
      },
    };
    const coordinator = createParkingCoordinator(tabs, extensionPage);

    await expect(suspendCurrentTabNow(tabs, coordinator)).resolves.toBe('failed');

    const recoveryCalls = calls.slice(1);
    expect(recoveryCalls).toEqual(shouldRecoverSafeUrl ? [`update:9:${changedUrl}`] : []);
    expect(recoveryCalls).not.toContain(`update:9:${original}`);
    if (stateKind !== 'parked-different-pending') {
      expect(current.url).toBe(
        stateKind === 'unsupported-own-pending' ? unsupportedUrl : changedUrl,
      );
    }
    if (stateKind === 'different-pending' || stateKind === 'parked-different-pending') {
      expect(current.pendingUrl).toBe(differentPendingUrl);
    }
  });

  it('does not overwrite a different placeholder URL when current-action activation cancels', async () => {
    let releaseUpdate!: (value: TabSnapshot) => void;
    let markUpdateStarted!: () => void;
    const updateStarted = new Promise<void>((resolve) => (markUpdateStarted = resolve));
    const updateResult = new Promise<TabSnapshot>((resolve) => (releaseUpdate = resolve));
    const calls: string[] = [];
    let parkedUrl = '';
    let current = tab(9, { active: true });
    const differentPlaceholder = `${extensionPage}#v=2&url=https%3A%2F%2Fother.test%2F&title=Other`;
    const coordinator = createParkingCoordinator(
      {
        async get(id) {
          calls.push(`get:${id}`);
          return current;
        },
        async update(id, update) {
          calls.push(`update:${id}:${update.url}`);
          if (update.url === original) {
            current = tab(id, { active: true, url: original });
            return current;
          }
          parkedUrl = update.url ?? '';
          markUpdateStarted();
          return updateResult;
        },
        async discard() {
          return current;
        },
      },
      extensionPage,
    );

    const parking = coordinator.parkCurrent(current);
    await updateStarted;
    current = tab(9, { active: true, url: differentPlaceholder });
    await coordinator.handleActivated(9);
    releaseUpdate(tab(9, { active: true, url: parkedUrl }));

    await expect(parking).resolves.toBe('skipped');
    expect(current.url).toBe(differentPlaceholder);
    expect(calls).not.toContain(`update:9:${original}`);
  });

  it.each([
    ['becomes inactive', { active: false }, original],
    ['changes identity', { id: 10 }, 'parked'],
    ['navigates elsewhere', { url: 'https://changed.test/' }, 'https://changed.test/'],
    ['becomes pinned', { pinned: true }, original],
    ['becomes audible', { audible: true }, original],
    ['becomes discarded', { discarded: true }, original],
    ['becomes protected', { autoDiscardable: false }, original],
  ])(
    'fails closed when the selected tab %s during current-action parking',
    async (_label, updatedChanges, expectedUrl) => {
      let current = tab(9, { active: true });
      let getCalls = 0;
      const tabs = {
        async query() {
          return [current];
        },
        async get() {
          getCalls += 1;
          return current;
        },
        async update(id: number, update: { url?: string }) {
          if (update.url === original) {
            current = { ...current, id, url: original };
            return current;
          }
          current = { ...current, id, url: update.url, ...updatedChanges };
          return current;
        },
        async discard() {
          return current;
        },
      };
      const coordinator = createParkingCoordinator(tabs, extensionPage);

      await expect(suspendCurrentTabNow(tabs, coordinator)).resolves.toBe('failed');

      if (expectedUrl === 'parked') {
        expect(current.url).toMatch(/^chrome-extension:\/\/id\/suspended\/index\.html#/u);
      } else {
        expect(current.url).toBe(expectedUrl);
      }
      expect(getCalls).toBeGreaterThanOrEqual(1);
    },
  );

  it.each([
    ['pinned', { pinned: true }],
    ['audible', { audible: true }],
    ['already discarded', { discarded: true }],
    ['not auto-discardable', { autoDiscardable: false }],
  ])('refuses a protected %s tab', async (_label, changes) => {
    const queried = tab(9, { active: true });
    const state = immediateHarness([queried], tab(9, { active: true, ...changes }));

    await expect(state.run()).resolves.toBe('protected-tab');
    expect(state.calls).toEqual(['query-active', 'get:9']);
  });

  it.each([
    undefined,
    '',
    'chrome://settings',
    'chrome-extension://id/options/index.html',
    'file:///private',
    'https://user:secret@example.test/',
  ])('refuses an unsupported current-tab URL %s', async (url) => {
    const queried = tab(9, { active: true });
    const state = immediateHarness([queried], tab(9, { active: true, url }));

    await expect(state.run()).resolves.toBe('unsupported-tab');
    expect(state.calls).toEqual(['query-active', 'get:9']);
  });

  it('refuses an active query result without a tab ID', async () => {
    const state = immediateHarness([tab(9, { id: undefined, active: true })], new Error('unused'));

    await expect(state.run()).resolves.toBe('unsupported-tab');
    expect(state.calls).toEqual(['query-active']);
  });

  it.each([
    ['closed before re-fetch', new Error('closed')],
    ['inactive before parking', tab(9, { active: false })],
    ['navigated before parking', tab(9, { active: true, url: 'https://changed.test/' })],
    ['wrong tab returned', tab(10, { active: true })],
  ])('fails closed when the current tab is %s', async (_label, fresh) => {
    const state = immediateHarness([tab(9, { active: true })], fresh);

    await expect(state.run()).resolves.toBe('failed');
    expect(state.calls).not.toContain('park-current:9');
  });

  it.each(['skipped', 'failed'] as const)(
    'maps a race-safe parking %s to failed',
    async (result) => {
      const current = tab(9, { active: true });
      const state = immediateHarness([current], current, result);

      await expect(state.run()).resolves.toBe('failed');
    },
  );
});
