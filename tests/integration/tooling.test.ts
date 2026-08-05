import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('integration tooling', () => {
  it('documents the required-tabs click-restore privacy and recovery contracts', async () => {
    const [
      agents,
      contributing,
      permissions,
      privacy,
      localInstall,
      product,
      dataFlow,
      security,
      adr,
      privacyDraft,
      release,
    ] = await Promise.all([
      readFile(path.resolve('AGENTS.md'), 'utf8'),
      readFile(path.resolve('CONTRIBUTING.md'), 'utf8'),
      readFile(path.resolve('docs/PERMISSIONS.md'), 'utf8'),
      readFile(path.resolve('PRIVACY.md'), 'utf8'),
      readFile(path.resolve('docs/LOCAL-INSTALL.md'), 'utf8'),
      readFile(path.resolve('docs/PRODUCT.md'), 'utf8'),
      readFile(path.resolve('docs/PRIVACY-DATA-FLOW.md'), 'utf8'),
      readFile(path.resolve('SECURITY.md'), 'utf8'),
      readFile(path.resolve('docs/adr/0003-required-tabs-default-restore.md'), 'utf8'),
      readFile(path.resolve('docs/privacy-disclosure-draft.md'), 'utf8'),
      readFile(path.resolve('docs/RELEASE.md'), 'utf8'),
    ]);

    expect(agents).toContain(
      'Required manifest permissions must remain exactly `alarms`, `storage`, and `tabs`',
    );
    expect(contributing).toContain(
      'Required permissions must remain exactly `alarms`, `storage`, and `tabs`',
    );
    expect(contributing).toContain('ADR 0003');
    expect(contributing).toContain('reviewed immediate current-tab action');
    expect(contributing).not.toContain('optional `tabs` permission');
    expect(permissions).toContain('Read your browsing history');
    expect(permissions).toContain('does not call the History API');
    expect(privacy).toContain('Percent encoding is not encryption');
    expect(privacy).toContain('complete original URL');
    expect(privacy).toContain('sanitized');
    expect(localInstall).toContain('Recover a suspended address');
    expect(localInstall).toContain('re-enable');
    expect(product).toContain('Click to restore');
    expect(product).toContain('Suspend this tab now');
    expect(product).toContain('never suspended while protected');
    expect(dataFlow).toContain('sanitized bounded title');
    expect(dataFlow).toContain('No network request');
    expect(security).toContain('URL, title, domain, or tab identifier');
    expect(adr).toContain('Owner approval');
    expect(adr).toContain('Rollback to 0.2.0');
    expect(privacyDraft).toContain(
      'URL/title metadata is used only for reviewed placeholder creation and immediate suspension',
    );
    expect(privacyDraft).toContain(
      "Per-tab protection separately changes only Chrome's transient `autoDiscardable` flag",
    );
    expect(release).toContain('package/strict-tab-suspender-0.3.0.zip.sha256');
    expect(release).toContain('package/strict-tab-suspender-0.3.0.cdx.json');
    expect(release).toContain('package/strict-tab-suspender-0.3.0.contents.txt');
    expect(release).not.toContain('its `.sha256`, `.cdx.json`, and `.contents.txt`');
  });

  it('makes Puppeteer available for Chrome integration coverage', () => {
    expect(puppeteer.launch).toBeTypeOf('function');
  });
});
