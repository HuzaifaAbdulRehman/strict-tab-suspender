import { describe, expect, it } from 'vitest';

import { createSuspendedController } from '../../src/suspended/suspended-controller.js';

function setup(hash = '#v=1&url=https%3A%2F%2Fexample.test%2Fprivate%3Fq%3D1%23two') {
  const replacements: string[] = [];
  const statuses: string[] = [];
  let focused = false;
  let readyCalls = 0;
  const controller = createSuspendedController(
    {
      setStatus(message) {
        statuses.push(message);
      },
      focusRestore() {
        focused = true;
      },
    },
    {
      hash,
      replace(url) {
        replacements.push(url);
      },
    },
    async () => {
      readyCalls += 1;
    },
  );
  return {
    controller,
    replacements,
    statuses,
    get focused() {
      return focused;
    },
    get readyCalls() {
      return readyCalls;
    },
  };
}

describe('suspended page controller', () => {
  it('notifies readiness and never restores during load', async () => {
    const harness = setup();

    await harness.controller.load();

    expect(harness.replacements).toEqual([]);
    expect(harness.focused).toBe(true);
    expect(harness.readyCalls).toBe(1);
  });

  it('restores only after the explicit action', async () => {
    const harness = setup();

    await harness.controller.restore();

    expect(harness.replacements).toEqual(['https://example.test/private?q=1#two']);
  });

  it('fails closed when the stored address is invalid', async () => {
    const harness = setup('#v=1&url=javascript%3Aalert(1)');

    await harness.controller.restore();

    expect(harness.replacements).toEqual([]);
    expect(harness.statuses).toContain('This suspended address is invalid and was not opened.');
  });

  it('still focuses restore when readiness notification fails', async () => {
    let focused = false;
    const controller = createSuspendedController(
      { setStatus() {}, focusRestore: () => (focused = true) },
      { hash: '', replace() {} },
      async () => Promise.reject(new Error('worker unavailable')),
    );

    await expect(controller.load()).resolves.toBeUndefined();
    expect(focused).toBe(true);
  });
});
