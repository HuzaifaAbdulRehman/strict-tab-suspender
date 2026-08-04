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
}

export const MAX_DISCARDS_PER_SWEEP = 10;
export const STARTUP_GRACE_MS = 5 * 60 * 1000;

export async function discardIfStillEligible(
  tab: TabSnapshot,
  settings: Settings,
  dependencies: SweepDependencies,
): Promise<DiscardOutcome> {
  if (tab.id === undefined) return 'skipped';

  let current: TabSnapshot;
  try {
    current = await dependencies.tabs.get(tab.id);
  } catch {
    return 'failed';
  }

  if (!evaluateTab(current, dependencies.now(), settings.idleMinutes).eligible) return 'skipped';

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
  const candidates: TabSnapshot[] = [];
  try {
    const tabs = await dependencies.tabs.query();
    for (const tab of tabs) {
      summary.evaluatedCount += 1;
      if (evaluateTab(tab, checkedAt, settings.idleMinutes).eligible) candidates.push(tab);
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
    const outcome = await discardIfStillEligible(candidate, settings, dependencies);
    if (outcome === 'discarded') summary.discardedCount += 1;
    if (outcome === 'skipped') summary.skippedCount += 1;
    if (outcome === 'failed') summary.failedCount += 1;
  }

  await saveLatestSweepSummary(summary, dependencies.storage);
  return summary;
}
