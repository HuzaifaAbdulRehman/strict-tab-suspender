import type { IdleMinutes } from '../shared/settings.js';

export type ExclusionReason =
  | 'active'
  | 'pinned'
  | 'audible'
  | 'already-discarded'
  | 'not-auto-discardable'
  | 'too-recent'
  | 'missing-id'
  | 'startup-grace';

export interface EligibilityDecision {
  eligible: boolean;
  reason?: ExclusionReason;
}

export interface TabSnapshot {
  id?: number | undefined;
  active?: boolean;
  pinned?: boolean;
  audible?: boolean;
  discarded?: boolean;
  autoDiscardable?: boolean;
  lastAccessed?: number | undefined;
}

export interface EligibilityOptions {
  startupGrace?: boolean;
}

const MINUTE_MS = 60 * 1000;

export function evaluateTab(
  tab: TabSnapshot,
  now: number,
  idleMinutes: IdleMinutes,
  options: EligibilityOptions = {},
): EligibilityDecision {
  if (options.startupGrace === true) return { eligible: false, reason: 'startup-grace' };
  if (tab.id === undefined) return { eligible: false, reason: 'missing-id' };
  if (tab.active === true) return { eligible: false, reason: 'active' };
  if (tab.pinned === true) return { eligible: false, reason: 'pinned' };
  if (tab.audible === true) return { eligible: false, reason: 'audible' };
  if (tab.discarded === true) return { eligible: false, reason: 'already-discarded' };
  if (tab.autoDiscardable === false) return { eligible: false, reason: 'not-auto-discardable' };

  const threshold = idleMinutes * MINUTE_MS;
  if (
    typeof tab.lastAccessed !== 'number' ||
    !Number.isFinite(tab.lastAccessed) ||
    tab.lastAccessed > now ||
    now - tab.lastAccessed < threshold
  ) {
    return { eligible: false, reason: 'too-recent' };
  }
  return { eligible: true };
}
