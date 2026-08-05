import type { TabSnapshot } from './eligibility.js';
import type { DiscardOutcome } from './sweep.js';
import { buildSuspendedPageUrl, isSuspendedPageUrl } from '../shared/suspended-url.js';

export interface ParkingTabsAdapter {
  get(tabId: number): Promise<TabSnapshot>;
  update(tabId: number, update: { url?: string; autoDiscardable?: boolean }): Promise<TabSnapshot>;
  discard(tabId: number): Promise<TabSnapshot | undefined>;
}

export interface ParkingCoordinator {
  park(tab: TabSnapshot): Promise<DiscardOutcome>;
  handleActivated(tabId: number): Promise<void>;
  handlePageReady(tabId: number, senderUrl: string): Promise<void>;
}

export type CurrentTabAction = 'suspended' | 'unsupported-tab' | 'protected-tab' | 'failed';

export interface ImmediateSuspensionTabsAdapter {
  query(queryInfo: { active: true; lastFocusedWindow: true }): Promise<TabSnapshot[]>;
  get(tabId: number): Promise<TabSnapshot>;
}

interface PendingParking {
  originalUrl: string;
  cancelled: boolean;
}

function isSupportedOriginalUrl(value: string | undefined): value is string {
  if (value === undefined) return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

export async function suspendCurrentTabNow(
  tabs: ImmediateSuspensionTabsAdapter,
  park: (tab: TabSnapshot) => Promise<DiscardOutcome>,
): Promise<CurrentTabAction> {
  let queried: TabSnapshot;
  try {
    const activeTabs = await tabs.query({ active: true, lastFocusedWindow: true });
    const candidate = activeTabs[0];
    if (candidate?.id === undefined) return 'unsupported-tab';
    queried = candidate;
  } catch {
    return 'failed';
  }

  let fresh: TabSnapshot;
  try {
    fresh = await tabs.get(queried.id!);
  } catch {
    return 'failed';
  }

  if (!isSupportedOriginalUrl(fresh.url)) return 'unsupported-tab';
  if (fresh.id !== queried.id || fresh.active !== true || fresh.url !== queried.url)
    return 'failed';
  if (
    fresh.pinned === true ||
    fresh.audible === true ||
    fresh.discarded === true ||
    fresh.autoDiscardable === false
  ) {
    return 'protected-tab';
  }

  try {
    return (await park(fresh)) === 'discarded' ? 'suspended' : 'failed';
  } catch {
    return 'failed';
  }
}

export function createParkingCoordinator(
  tabs: ParkingTabsAdapter,
  extensionPageUrl: string,
): ParkingCoordinator {
  const pending = new Map<number, PendingParking>();

  async function restoreIfParked(tabId: number, originalUrl: string): Promise<void> {
    try {
      const current = await tabs.get(tabId);
      if (current.url !== undefined && isSuspendedPageUrl(current.url, extensionPageUrl)) {
        await tabs.update(tabId, { url: originalUrl });
      }
    } catch {
      // The tab may have closed or changed again. Never retry automatically.
    }
  }

  return {
    async park(tab) {
      if (tab.id === undefined || tab.url === undefined) return 'skipped';
      const parkedUrl = buildSuspendedPageUrl(tab.url, tab.title ?? '', extensionPageUrl);
      if (parkedUrl === undefined) return 'skipped';

      const state: PendingParking = { originalUrl: tab.url, cancelled: false };
      pending.set(tab.id, state);
      try {
        const updated = await tabs.update(tab.id, { url: parkedUrl });
        if (state.cancelled || updated.active === true) {
          if (updated.url !== undefined && isSuspendedPageUrl(updated.url, extensionPageUrl)) {
            try {
              await tabs.update(tab.id, { url: state.originalUrl });
            } catch {
              // The explicit restore page remains safe and usable if recovery loses the race.
            }
          }
          return 'skipped';
        }
        return 'discarded';
      } catch {
        return 'failed';
      } finally {
        pending.delete(tab.id);
      }
    },

    async handleActivated(tabId) {
      const state = pending.get(tabId);
      if (state === undefined) return;
      state.cancelled = true;
      await restoreIfParked(tabId, state.originalUrl);
    },

    async handlePageReady(tabId, senderUrl) {
      if (!isSuspendedPageUrl(senderUrl, extensionPageUrl)) return;
      try {
        const current = await tabs.get(tabId);
        if (
          current.active === true ||
          current.url !== senderUrl ||
          !isSuspendedPageUrl(current.url, extensionPageUrl)
        ) {
          return;
        }
        await tabs.discard(tabId);
      } catch {
        // Closed tabs and rejected discard calls are expected races.
      }
    },
  };
}
