import { describe, expect, it } from 'vitest';

import { returnFromSettings } from '../../src/options/settings-navigation.js';

describe('settings navigation', () => {
  it('orders close, fallback scheduling, and packaged-popup navigation', () => {
    const calls: string[] = [];
    let fallback: (() => void) | undefined;

    returnFromSettings({
      close() {
        calls.push('close');
      },
      navigateToPopup() {
        calls.push('navigate');
      },
      scheduleFallback(callback) {
        calls.push('schedule');
        fallback = callback;
      },
    });

    expect(calls).toEqual(['close', 'schedule']);
    fallback?.();
    expect(calls).toEqual(['close', 'schedule', 'navigate']);
  });
});
