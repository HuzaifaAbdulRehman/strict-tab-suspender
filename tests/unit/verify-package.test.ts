import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  listPackageEntries,
  validatePackageManifest,
  verifyPackage,
} from '../../scripts/verify-package.mjs';

const approvedEntries = [
  'background/eligibility.js',
  'background/service-worker.js',
  'background/suspension.js',
  'background/sweep.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'options/index.html',
  'options/index.js',
  'options/options-controller.js',
  'options/settings-navigation.js',
  'options/styles.css',
  'popup/index.html',
  'popup/index.js',
  'popup/popup-controller.js',
  'popup/styles.css',
  'shared/messages.js',
  'shared/settings.js',
  'shared/suspended-url.js',
  'suspended/index.html',
  'suspended/index.js',
  'suspended/styles.css',
  'suspended/suspended-controller.js',
];
const temporaryDirectories: string[] = [];
const require = createRequire(import.meta.url);

interface ArchiveWriter {
  append(contents: string, options: { name: string }): void;
  finalize(): void;
  on(event: 'error', listener: (error: Error) => void): void;
  pipe(destination: NodeJS.WritableStream): void;
}

const createArchive = require('archiver') as (format: 'zip') => ArchiveWriter;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

async function writePackageWithManifest(manifest: Record<string, unknown>): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'strict-tab-discarder-package-test-'));
  temporaryDirectories.push(directory);
  const archivePath = path.join(directory, 'extension.zip');
  await new Promise<void>((resolve, reject) => {
    const archive = createArchive('zip');
    const output = createWriteStream(archivePath);
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
    for (const entry of approvedEntries) archive.append('', { name: entry });
    void archive.finalize();
  });
  return archivePath;
}

describe('listPackageEntries', () => {
  it('rejects any optional permissions', () => {
    expect(() =>
      validatePackageManifest({
        manifest_version: 3,
        permissions: ['alarms', 'storage', 'tabs'],
        optional_permissions: ['tabs'],
      }),
    ).toThrow('Package manifest must not declare optional permissions.');
  });
  it('rejects an archive entry outside the extension build output', () => {
    expect(() => listPackageEntries(['manifest.json', '../README.md'])).toThrow(
      'Package contains an unsafe entry: ../README.md',
    );
  });

  it('accepts built extension paths', () => {
    expect(listPackageEntries(['manifest.json', ...approvedEntries])).toEqual([
      'manifest.json',
      ...approvedEntries,
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

  it('rejects package manifests that expand the private permission contract', () => {
    expect(() =>
      validatePackageManifest({
        manifest_version: 3,
        permissions: ['alarms', 'storage', 'tabs'],
        host_permissions: ['https://example.test/*'],
      }),
    ).toThrow('Package manifest must not declare host permissions.');
  });

  it('rejects a ZIP whose packaged manifest weakens the extension-page CSP', async () => {
    const archivePath = await writePackageWithManifest({
      manifest_version: 3,
      permissions: ['alarms', 'storage', 'tabs'],
      content_security_policy: {
        extension_pages:
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'self'; connect-src https:",
      },
    });

    await expect(verifyPackage(archivePath)).rejects.toThrow(
      'Package manifest must use the approved extension-page CSP.',
    );
  });
});
