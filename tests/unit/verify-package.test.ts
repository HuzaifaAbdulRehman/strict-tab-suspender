import { describe, expect, it } from 'vitest';

import { listPackageEntries } from '../../scripts/verify-package.mjs';

describe('listPackageEntries', () => {
  it('rejects an archive entry outside the extension build output', () => {
    expect(() => listPackageEntries(['manifest.json', '../README.md'])).toThrow(
      'Package contains an unsafe entry: ../README.md',
    );
  });

  it('accepts built extension paths', () => {
    expect(listPackageEntries(['manifest.json', 'background/service-worker.js'])).toEqual([
      'manifest.json',
      'background/service-worker.js',
    ]);
  });
});
