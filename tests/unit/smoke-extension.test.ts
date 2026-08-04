import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Chrome smoke command', () => {
  it('requires a Chrome-backed smoke command after building and packaging the extension', async () => {
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.smoke).toContain('npm run build');
    expect(packageJson.scripts.smoke).toContain('npm run package');
    expect(packageJson.scripts.smoke).toContain('smoke:chrome');
    expect(packageJson.scripts['smoke:chrome']).toBe('node scripts/smoke-extension.mjs');
  });
});
