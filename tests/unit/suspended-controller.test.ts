import { describe, expect, it } from 'vitest';

import { createSuspendedController } from '../../src/suspended/suspended-controller.js';

function setup(
  hash = '#v=2&url=https%3A%2F%2Fexample.test%2Fprivate%3Fq%3D1%23two&title=Private%20work',
) {
  const replacements: string[] = [];
  const statuses: string[] = [];
  const payloads: Array<{ originalUrl: string; title: string }> = [];
  let focused = false;
  let readyCalls = 0;
  const controller = createSuspendedController(
    {
      setPayload(payload) {
        payloads.push(payload);
      },
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
    payloads,
    get focused() {
      return focused;
    },
    get readyCalls() {
      return readyCalls;
    },
  };
}

describe('suspended page controller', () => {
  it('shows the sanitized title and complete URL, notifies readiness, and never restores on load', async () => {
    const harness = setup();

    await harness.controller.load();

    expect(harness.replacements).toEqual([]);
    expect(harness.payloads).toEqual([
      { originalUrl: 'https://example.test/private?q=1#two', title: 'Private work' },
    ]);
    expect(harness.focused).toBe(true);
    expect(harness.readyCalls).toBe(1);
  });

  it('uses the same explicit restore path for button and URL-link actions', async () => {
    const harness = setup();

    await harness.controller.restore();
    await harness.controller.restore();

    expect(harness.replacements).toEqual([
      'https://example.test/private?q=1#two',
      'https://example.test/private?q=1#two',
    ]);
  });

  it('fails closed when the stored address is invalid', async () => {
    const harness = setup('#v=2&url=javascript%3Aalert(1)&title=Private');

    await harness.controller.restore();

    expect(harness.replacements).toEqual([]);
    expect(harness.statuses).toContain('This suspended address is invalid and was not opened.');
  });

  it('still focuses restore when readiness notification fails', async () => {
    let focused = false;
    const controller = createSuspendedController(
      { setPayload() {}, setStatus() {}, focusRestore: () => (focused = true) },
      { hash: '', replace() {} },
      async () => Promise.reject(new Error('worker unavailable')),
    );

    await expect(controller.load()).resolves.toBeUndefined();
    expect(focused).toBe(true);
  });
});
