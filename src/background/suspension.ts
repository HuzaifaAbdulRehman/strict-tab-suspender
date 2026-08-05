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
  parkCurrent(tab: TabSnapshot): Promise<DiscardOutcome>;
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
  exactParkedUrl: string;
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
  parking: Pick<ParkingCoordinator, 'parkCurrent'>,
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
  if (fresh.pendingUrl !== undefined) return 'failed';
  if (
    fresh.pinned === true ||
    fresh.audible === true ||
    fresh.discarded === true ||
    fresh.autoDiscardable === false
  ) {
    return 'protected-tab';
  }

  try {
    return (await parking.parkCurrent(fresh)) === 'discarded' ? 'suspended' : 'failed';
  } catch {
    return 'failed';
  }
}

export function createParkingCoordinator(
  tabs: ParkingTabsAdapter,
  extensionPageUrl: string,
): ParkingCoordinator {
  const pending = new Map<number, PendingParking>();

  function hasValidParkingDestination(
    tab: TabSnapshot,
    originalUrl: string,
    parkedUrl: string,
  ): boolean {
    return (
      (tab.url === parkedUrl && (tab.pendingUrl === undefined || tab.pendingUrl === parkedUrl)) ||
      (tab.url === originalUrl && tab.pendingUrl === parkedUrl)
    );
  }

  async function recoverOwnPlaceholderNavigation(
    tabId: number,
    parkedUrl: string,
    originalUrl: string,
  ): Promise<void> {
    try {
      const current = await tabs.get(tabId);
      if (current.id !== tabId) return;
      if (
        current.url === parkedUrl &&
        (current.pendingUrl === undefined || current.pendingUrl === parkedUrl)
      ) {
        await tabs.update(tabId, { url: originalUrl });
        return;
      }
      if (current.pendingUrl !== parkedUrl || !isSupportedOriginalUrl(current.url)) return;
      await tabs.update(tabId, { url: current.url });
    } catch {
      // The tab may have closed or navigated again. Never retry or overwrite a new address.
    }
  }

  async function park(tab: TabSnapshot, allowIntentionalActive: boolean): Promise<DiscardOutcome> {
    if (tab.id === undefined || tab.url === undefined || tab.pendingUrl !== undefined)
      return 'skipped';
    const parkedUrl = buildSuspendedPageUrl(tab.url, tab.title ?? '', extensionPageUrl);
    if (parkedUrl === undefined) return 'skipped';

    const state: PendingParking = {
      originalUrl: tab.url,
      cancelled: false,
      exactParkedUrl: parkedUrl,
    };
    pending.set(tab.id, state);
    try {
      const updated = await tabs.update(tab.id, { url: parkedUrl });
      if (allowIntentionalActive) {
        const currentActionStayedValid =
          state.cancelled === false &&
          updated.id === tab.id &&
          updated.active === true &&
          hasValidParkingDestination(updated, state.originalUrl, parkedUrl) &&
          updated.pinned !== true &&
          updated.audible !== true &&
          updated.discarded !== true &&
          updated.autoDiscardable !== false;
        if (!currentActionStayedValid) {
          await recoverOwnPlaceholderNavigation(tab.id, parkedUrl, state.originalUrl);
          return 'skipped';
        }
        return 'discarded';
      }
      const automaticParkingStayedValid =
        state.cancelled === false &&
        updated.id === tab.id &&
        updated.active === false &&
        hasValidParkingDestination(updated, state.originalUrl, parkedUrl) &&
        updated.pinned !== true &&
        updated.audible !== true &&
        updated.autoDiscardable !== false;
      if (!automaticParkingStayedValid) {
        await recoverOwnPlaceholderNavigation(tab.id, parkedUrl, state.originalUrl);
        return 'skipped';
      }
      return 'discarded';
    } catch {
      return 'failed';
    } finally {
      pending.delete(tab.id);
    }
  }

  return {
    park(tab) {
      return park(tab, false);
    },

    parkCurrent(tab) {
      return park(tab, true);
    },

    async handleActivated(tabId) {
      const state = pending.get(tabId);
      if (state === undefined) return;
      state.cancelled = true;
      await recoverOwnPlaceholderNavigation(tabId, state.exactParkedUrl, state.originalUrl);
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
