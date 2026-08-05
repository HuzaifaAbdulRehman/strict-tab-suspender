import { describe, expect, it } from 'vitest';

import {
  buildSuspendedPageUrl,
  isSuspendedPageUrl,
  readOriginalUrlFromHash,
} from '../../src/shared/suspended-url.js';

const extensionPage = 'chrome-extension://abcdefghijklmnop/suspended/index.html';

describe('suspended URL codec', () => {
  it('round-trips an https URL with Unicode, query, and fragment', () => {
    const original = 'https://example.test/پاکستان?q=a%20b#chapter-2';
    const parked = buildSuspendedPageUrl(original, extensionPage);

    expect(parked).toBeDefined();
    expect(readOriginalUrlFromHash(new URL(parked!).hash)).toBe(original);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,private',
    'file:///C:/private.txt',
    'chrome://settings',
    'https://user:secret@example.test/',
    '<script>alert(1)</script>',
  ])('rejects unsafe original address %s', (value) => {
    expect(buildSuspendedPageUrl(value, extensionPage)).toBeUndefined();
  });

  it('rejects a placeholder longer than 65,536 characters', () => {
    expect(
      buildSuspendedPageUrl(`https://example.test/${'a'.repeat(70_000)}`, extensionPage),
    ).toBeUndefined();
  });

  it.each(['', '#v=2&url=https%3A%2F%2Fexample.test', '#v=1&url=%E0%A4%A'])(
    'rejects malformed or unsupported hash %s',
    (hash) => {
      expect(readOriginalUrlFromHash(hash)).toBeUndefined();
    },
  );

  it('recognizes only the exact packaged suspended page', () => {
    expect(isSuspendedPageUrl(`${extensionPage}#v=1`, extensionPage)).toBe(true);
    expect(
      isSuspendedPageUrl(
        'chrome-extension://abcdefghijklmnop/suspended/index.html.evil#v=1',
        extensionPage,
      ),
    ).toBe(false);
    expect(
      isSuspendedPageUrl(
        'chrome-extension://differentextension/suspended/index.html#v=1',
        extensionPage,
      ),
    ).toBe(false);
  });
});
