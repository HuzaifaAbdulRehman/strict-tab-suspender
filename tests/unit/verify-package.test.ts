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
        'background/service-worker.js',
        'options/index.html',
        'icons/icon-128.png',
      ]),
    ).toEqual([
      'manifest.json',
      'background/service-worker.js',
      'options/index.html',
      'icons/icon-128.png',
    ]);
  });

  it.each([
    'README.md',
    'package-lock.json',
    'src/background/service-worker.ts',
    'tests/unit/x.ts',
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
