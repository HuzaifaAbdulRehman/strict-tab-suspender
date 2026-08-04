import { evaluateTab, type TabSnapshot } from './eligibility.js';
import {
  getSettings,
  saveLatestSweepSummary,
  type LocalStorageArea,
  type Settings,
  type SweepSummary,
} from '../shared/settings.js';

export type SweepTrigger = 'alarm' | 'manual';
export type DiscardOutcome = 'discarded' | 'skipped' | 'failed';

export interface TabsAdapter {
  query(): Promise<TabSnapshot[]>;
  get(tabId: number): Promise<TabSnapshot>;
  discard(tabId: number): Promise<TabSnapshot | undefined>;
}

export interface SweepDependencies {
  tabs: TabsAdapter;
  storage: LocalStorageArea;
  now: () => number;
  hasTabsPermission(): Promise<boolean>;
  park(tab: TabSnapshot): Promise<DiscardOutcome>;
}

export const MAX_DISCARDS_PER_SWEEP = 10;
export const STARTUP_GRACE_MS = 5 * 60 * 1000;

export async function discardIfStillEligible(
  tab: TabSnapshot,
  settings: Settings,
  dependencies: SweepDependencies,
  requireAutomationEnabled = false,
): Promise<DiscardOutcome> {
  if (tab.id === undefined) return 'skipped';

  let current: TabSnapshot;
  try {
    current = await dependencies.tabs.get(tab.id);
  } catch {
    return 'failed';
  }

  let latestSettings = settings;
  try {
    latestSettings = await getSettings(dependencies.storage);
  } catch {
    return 'failed';
  }
  if (
    !evaluateTab(current, dependencies.now(), latestSettings.idleMinutes, {
      allowAlreadyDiscarded: latestSettings.restoreBehavior === 'click',
    }).eligible
  )
    return 'skipped';
  if (requireAutomationEnabled && !latestSettings.enabled) return 'skipped';

  if (latestSettings.restoreBehavior === 'click') {
    try {
      if (!(await dependencies.hasTabsPermission())) return 'skipped';
    } catch {
      return 'failed';
    }
    try {
      return await dependencies.park(current);
    } catch {
      return 'failed';
    }
  }

  try {
    const discardedTab = await dependencies.tabs.discard(tab.id);
    if (discardedTab === undefined) return 'failed';
    return 'discarded';
  } catch {
    return 'failed';
  }
}

export async function runSweep(
  trigger: SweepTrigger,
  dependencies: SweepDependencies,
): Promise<SweepSummary> {
  const checkedAt = dependencies.now();
  const summary: SweepSummary = {
    checkedAt,
    evaluatedCount: 0,
    discardedCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };
  const settings = await getSettings(dependencies.storage);

  if (!settings.enabled && trigger === 'alarm') {
    await saveLatestSweepSummary(summary, dependencies.storage);
    return summary;
  }
  if (settings.restoreBehavior === 'click') {
    try {
      if (!(await dependencies.hasTabsPermission())) {
        await saveLatestSweepSummary(summary, dependencies.storage);
        return summary;
      }
    } catch {
      summary.failedCount += 1;
      await saveLatestSweepSummary(summary, dependencies.storage);
      return summary;
    }
  }
  const candidates: TabSnapshot[] = [];
  try {
    const tabs = await dependencies.tabs.query();
    for (const tab of tabs) {
      summary.evaluatedCount += 1;
      if (
        evaluateTab(tab, checkedAt, settings.idleMinutes, {
          allowAlreadyDiscarded: settings.restoreBehavior === 'click',
        }).eligible
      )
        candidates.push(tab);
      else summary.skippedCount += 1;
    }
  } catch {
    summary.failedCount += 1;
    await saveLatestSweepSummary(summary, dependencies.storage);
    return summary;
  }

  for (const candidate of candidates) {
    if (summary.discardedCount + summary.failedCount >= MAX_DISCARDS_PER_SWEEP) {
      summary.skippedCount += 1;
      continue;
    }
    const outcome = await discardIfStillEligible(
      candidate,
      settings,
      dependencies,
      trigger === 'alarm',
    );
    if (outcome === 'discarded') summary.discardedCount += 1;
    if (outcome === 'skipped') summary.skippedCount += 1;
    if (outcome === 'failed') summary.failedCount += 1;
  }

  await saveLatestSweepSummary(summary, dependencies.storage);
  return summary;
}
