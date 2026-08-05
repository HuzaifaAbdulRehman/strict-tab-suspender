import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { formatArchiveInventory } from '../../scripts/release-artifacts.mjs';

describe('release artifacts', () => {
  it('produces a complete, deterministic inventory for the reviewed extension archive', () => {
    expect(formatArchiveInventory(['popup/index.html', 'manifest.json'])).toBe(
      'manifest.json\npopup/index.html\n',
    );
  });

  it('keeps the 0.3.0 release metadata and changelog aligned', async () => {
    const [packageJson, packageLock, manifest, changelog] = await Promise.all([
      readFile(path.resolve('package.json'), 'utf8').then(JSON.parse),
      readFile(path.resolve('package-lock.json'), 'utf8').then(JSON.parse),
      readFile(path.resolve('src/manifest.json'), 'utf8').then(JSON.parse),
      readFile(path.resolve('CHANGELOG.md'), 'utf8'),
    ]);

    expect(packageJson.version).toBe('0.3.0');
    expect(packageLock.version).toBe('0.3.0');
    expect(packageLock.packages[''].version).toBe('0.3.0');
    expect(manifest.version).toBe('0.3.0');
    expect(manifest.permissions).toEqual(['alarms', 'storage', 'tabs']);
    expect(manifest.optional_permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(changelog).toContain('## [0.3.0] - 2026-08-05');
  });
});
