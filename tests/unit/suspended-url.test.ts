import { describe, expect, it } from 'vitest';

import {
  buildSuspendedPageUrl,
  isSuspendedPageUrl,
  MAX_SUSPENDED_URL_LENGTH,
  readSuspendedPayloadFromHash,
} from '../../src/shared/suspended-url.js';

const extensionPage = 'chrome-extension://abcdefghijklmnop/suspended/index.html';

describe('suspended URL codec', () => {
  it('round-trips literal Unicode URL and title values in a version-2 fragment', () => {
    const original = 'https://example.test/پاکستان?q=東京%20大阪#résumé';
    const title = 'بحث 東京 — résumé 🚀';
    const parked = buildSuspendedPageUrl(original, title, extensionPage);

    expect(parked).toBeDefined();
    expect(new URL(parked!).hash).toContain('v=2');
    expect(readSuspendedPayloadFromHash(new URL(parked!).hash)).toEqual({
      originalUrl: original,
      title,
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,private',
    'file:///C:/private.txt',
    'chrome://settings',
    'chrome-extension://abcdefghijklmnop/options/index.html',
    'https://user:secret@example.test/',
    '<script>alert(1)</script>',
  ])('rejects unsafe original address %s', (value) => {
    expect(buildSuspendedPageUrl(value, 'Private title', extensionPage)).toBeUndefined();
  });

  it('sanitizes control characters and whitespace before encoding the title', () => {
    const parked = buildSuspendedPageUrl(
      'https://example.test/',
      '  Alpha\u0000\n\t  Beta\u001f   Gamma  ',
      extensionPage,
    );

    expect(readSuspendedPayloadFromHash(new URL(parked!).hash)).toEqual({
      originalUrl: 'https://example.test/',
      title: 'Alpha Beta Gamma',
    });
  });

  it('strips Unicode format and bidi controls while preserving normal Unicode and emoji', () => {
    const parked = buildSuspendedPageUrl(
      'https://example.test/',
      'Normal العربية 🚀\u202eevil\u2066hidden\u200bend',
      extensionPage,
    );

    expect(readSuspendedPayloadFromHash(new URL(parked!).hash)?.title).toBe(
      'Normal العربية 🚀 evil hidden end',
    );
  });

  it('caps a title at 256 Unicode code points without splitting astral characters', () => {
    const parked = buildSuspendedPageUrl(
      'https://example.test/',
      `${'🚀'.repeat(256)}tail`,
      extensionPage,
    );

    expect(readSuspendedPayloadFromHash(new URL(parked!).hash)?.title).toBe('🚀'.repeat(256));
  });

  it('uses the exact fallback title when sanitization leaves no visible text', () => {
    const parked = buildSuspendedPageUrl('https://example.test/', ' \n\u0000\t ', extensionPage);

    expect(readSuspendedPayloadFromHash(new URL(parked!).hash)?.title).toBe('Suspended tab');
  });

  it('rejects a placeholder longer than 65,536 characters', () => {
    expect(
      buildSuspendedPageUrl(
        `https://example.test/${'a'.repeat(70_000)}`,
        'Large page',
        extensionPage,
      ),
    ).toBeUndefined();
  });

  it('rejects a forged version-2 fragment larger than the complete placeholder limit', () => {
    const forged = `#v=2&url=https%3A%2F%2Fexample.test%2F&title=${'a'.repeat(
      MAX_SUSPENDED_URL_LENGTH,
    )}`;

    expect(readSuspendedPayloadFromHash(forged)).toBeUndefined();
  });

  it('enforces the exact complete URL limit for a production Chrome extension ID', () => {
    const productionPage = `chrome-extension://${'a'.repeat(32)}/suspended/index.html`;
    const fixedHash = '#v=2&url=https%3A%2F%2Fexample.test%2F&title=Boundary';
    const atLimit = `${fixedHash}${'a'.repeat(
      MAX_SUSPENDED_URL_LENGTH - productionPage.length - fixedHash.length,
    )}`;
    const overLimit = `${atLimit}a`;

    expect(`${productionPage}${atLimit}`).toHaveLength(MAX_SUSPENDED_URL_LENGTH);
    expect(readSuspendedPayloadFromHash(atLimit)).toBeDefined();
    expect(readSuspendedPayloadFromHash(overLimit)).toBeUndefined();
  });

  it.each([
    '',
    '#v=1&url=https%3A%2F%2Fexample.test&title=Old',
    '#v=2&url=%E0%A4%A&title=Broken',
    '#v=2&url=https%3A%2F%2Fuser%3Asecret%40example.test&title=Private',
    '#v=2&url=javascript%3Aalert%281%29&title=Private',
  ])('rejects malformed or unsupported hash %s', (hash) => {
    expect(readSuspendedPayloadFromHash(hash)).toBeUndefined();
  });

  it('re-sanitizes decoded title input rather than trusting the fragment', () => {
    expect(
      readSuspendedPayloadFromHash(
        '#v=2&url=https%3A%2F%2Fexample.test%2F&title=%20Unsafe%00%0A%20%20Title%20',
      ),
    ).toEqual({ originalUrl: 'https://example.test/', title: 'Unsafe Title' });
  });

  it('recognizes only the exact packaged suspended page', () => {
    expect(isSuspendedPageUrl(`${extensionPage}#v=2`, extensionPage)).toBe(true);
    expect(
      isSuspendedPageUrl(
        'chrome-extension://abcdefghijklmnop/suspended/index.html.evil#v=2',
        extensionPage,
      ),
    ).toBe(false);
    expect(
      isSuspendedPageUrl(
        'chrome-extension://differentextension/suspended/index.html#v=2',
        extensionPage,
      ),
    ).toBe(false);
  });
});
