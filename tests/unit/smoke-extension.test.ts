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

    const smokeScript = await readFile(
      path.join(process.cwd(), 'scripts', 'smoke-extension.mjs'),
      'utf8',
    );
    expect(smokeScript).toContain('headless: true');
    expect(smokeScript).not.toContain('headless: false');
    expect(smokeScript).toContain('browser.waitForTarget');
    expect(smokeScript).toContain('EXPECTED_POPUP_FOCUS_ORDER');
    expect(smokeScript).toContain("'protect-tab'");
    expect(smokeScript).toContain("'suspend-current-tab'");
    expect(smokeScript).toContain("'back-action'");
    expect(smokeScript).toContain('buildSmokeSuspendedUrl');
    expect(smokeScript).toContain('value="click"');
    expect(smokeScript).toContain('expectedOriginalTitle');
    expect(smokeScript).toContain('visibleOriginalUrl');
    expect(smokeScript).toContain('original-url');
    expect(smokeScript).toContain('waitForExtensionWorker');
    expect(smokeScript).toContain('runSmokeStep');
    expect(smokeScript).toContain('clickElement');
    expect(smokeScript).toContain('settings Back fallback');
    expect(smokeScript).toContain('activate suspended tab without restoring');
    expect(smokeScript).toContain("request.resourceType() === 'document'");
    expect(smokeScript).toContain('requestUrl.startsWith(extensionOrigin)');
    expect(smokeScript).toContain('allowedOriginalDocument');
    expect(smokeScript).toContain('request.resourceType()');
    expect(smokeScript).not.toContain('await popup.click(');
    expect(smokeScript).not.toContain('await options.click(');
    expect(smokeScript).not.toContain("backOptions.click('#back-action')");
    expect(smokeScript).not.toContain('Native restore must be selected by default.');
    expect(smokeScript).toContain('Read your browsing history');
    expect(smokeScript).toContain('autoDiscardable');
    expect(smokeScript).not.toContain('setTimeout(resolve, 750)');
  });
});
