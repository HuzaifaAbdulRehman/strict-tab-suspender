import { describe, expect, it } from 'vitest';

import { evaluateTab, type TabSnapshot } from '../../src/background/eligibility.js';

const now = 1_700_000_000_000;
const fifteenMinutes = 15 * 60 * 1000;
const eligibleTab: TabSnapshot = {
  id: 7,
  active: false,
  pinned: false,
  audible: false,
  discarded: false,
  autoDiscardable: true,
  lastAccessed: now - fifteenMinutes,
};

describe('evaluateTab', () => {
  it('allows an already-discarded tab only when click-mode conversion is requested', () => {
    expect(evaluateTab({ ...eligibleTab, discarded: true }, now, 15)).toEqual({
      eligible: false,
      reason: 'already-discarded',
    });
    expect(
      evaluateTab({ ...eligibleTab, discarded: true }, now, 15, { allowAlreadyDiscarded: true }),
    ).toEqual({ eligible: true });
  });
  it('accepts a tab at the exact fifteen-minute idle boundary', () => {
    expect(evaluateTab(eligibleTab, now, 15)).toEqual({ eligible: true });
  });

  it.each([
    ['active', { active: true }, 'active'],
    ['pinned', { pinned: true }, 'pinned'],
    ['audible', { audible: true }, 'audible'],
    ['already discarded', { discarded: true }, 'already-discarded'],
    ['not auto-discardable', { autoDiscardable: false }, 'not-auto-discardable'],
    ['missing id', { id: undefined }, 'missing-id'],
    ['too recent', { lastAccessed: now - fifteenMinutes + 1 }, 'too-recent'],
    ['future last accessed', { lastAccessed: now + 1 }, 'too-recent'],
    ['negative last accessed', { lastAccessed: -1 }, 'too-recent'],
    ['invalid last accessed', { lastAccessed: Number.NaN }, 'too-recent'],
  ] as const)('excludes %s tabs', (_name, patch, reason) => {
    expect(evaluateTab({ ...eligibleTab, ...patch }, now, 15)).toEqual({
      eligible: false,
      reason,
    });
  });

  it('excludes every protected state in combinations', () => {
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
      { lastAccessed: now - fifteenMinutes + 1 },
    ];

    for (let mask = 1; mask < 1 << exclusions.length; mask += 1) {
      const tab = { ...eligibleTab };
      for (let index = 0; index < exclusions.length; index += 1) {
        if ((mask & (1 << index)) !== 0) Object.assign(tab, exclusions[index]);
      }
      expect(evaluateTab(tab, now, 15).eligible).toBe(false);
    }
  });

  it('reports startup grace without considering tab activity', () => {
    expect(evaluateTab(eligibleTab, now, 15, { startupGrace: true })).toEqual({
      eligible: false,
      reason: 'startup-grace',
    });
  });
});
