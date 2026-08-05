import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readManifest(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(root, 'src', 'manifest.json'), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('extension manifest', () => {
  it('uses the strict MV3 minimum-version and permission contract', async () => {
    const manifest = await readManifest();

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: 'Strict Tab Discarder',
      version: '0.3.0',
      minimum_chrome_version: '121',
      permissions: ['alarms', 'storage', 'tabs'],
      background: { service_worker: 'background/service-worker.js', type: 'module' },
    });
    expect(manifest.optional_permissions).toBeUndefined();
  });

  it('forbids remote access and unneeded extension capabilities', async () => {
    const manifest = await readManifest();

    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
    expect(manifest.externally_connectable).toBeUndefined();
    expect(manifest.content_security_policy).toEqual({
      extension_pages:
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'self'; connect-src 'none'",
    });
  });

  it('declares packaged popup, options, and icon entrypoints without expanding permissions', async () => {
    const manifest = await readManifest();

    expect(manifest.action).toEqual({ default_popup: 'popup/index.html' });
    expect(manifest.options_page).toBe('options/index.html');
    expect(manifest.icons).toEqual({
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    });
    expect(manifest.permissions).toEqual(['alarms', 'storage', 'tabs']);
  });
});
