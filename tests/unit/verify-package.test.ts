import { describe, expect, it } from 'vitest';

import { listPackageEntries } from '../../scripts/verify-package.mjs';

describe('listPackageEntries', () => {
  it('rejects an archive entry outside the extension build output', () => {
    expect(() => listPackageEntries(['manifest.json', '../README.md'])).toThrow(
      'Package contains an unsafe entry: ../README.md',
    );
  });

  it('accepts built extension paths', () => {
    expect(
      listPackageEntries([
        'manifest.json',
        'background/eligibility.js',
        'background/service-worker.js',
        'background/sweep.js',
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png',
        'shared/settings.js',
        'shared/messages.js',
        'popup/index.html',
        'popup/index.js',
        'popup/popup-controller.js',
        'popup/styles.css',
        'options/index.html',
        'options/index.js',
        'options/options-controller.js',
        'options/styles.css',
      ]),
    ).toEqual([
      'manifest.json',
      'background/eligibility.js',
      'background/service-worker.js',
      'background/sweep.js',
      'icons/icon-16.png',
      'icons/icon-32.png',
      'icons/icon-48.png',
      'icons/icon-128.png',
      'shared/settings.js',
      'shared/messages.js',
      'popup/index.html',
      'popup/index.js',
      'popup/popup-controller.js',
      'popup/styles.css',
      'options/index.html',
      'options/index.js',
      'options/options-controller.js',
      'options/styles.css',
    ]);
  });

  it.each([
    'README.md',
    'package-lock.json',
    'src/background/service-worker.ts',
    'tests/unit/x.ts',
    'popup/unreviewed.js',
    'assets/remote-like.svg',
  ])('rejects repository artifact %s', (entry) => {
    expect(() => listPackageEntries(['manifest.json', entry])).toThrow(
      `Package contains an unapproved built extension file: ${entry}`,
    );
  });

  it('requires a root manifest', () => {
    expect(() => listPackageEntries(['background/service-worker.js'])).toThrow(
      'Package must contain manifest.json at its root.',
    );
  });
});
