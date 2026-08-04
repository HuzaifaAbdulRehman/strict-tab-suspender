import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('integration tooling', () => {
  it('keeps optional manual-restore privacy and recovery contracts explicit', async () => {
    const [agents, permissions, privacy, localInstall] = await Promise.all([
      readFile(path.resolve('AGENTS.md'), 'utf8'),
      readFile(path.resolve('docs/PERMISSIONS.md'), 'utf8'),
      readFile(path.resolve('PRIVACY.md'), 'utf8'),
      readFile(path.resolve('docs/LOCAL-INSTALL.md'), 'utf8'),
    ]);

    expect(agents).toContain('optional `tabs` permission');
    expect(permissions).toContain('Read your browsing history');
    expect(privacy).toContain('Percent encoding is not encryption');
    expect(localInstall).toContain('Recover a suspended address');
  });

  it('makes Puppeteer available for Chrome integration coverage', () => {
    expect(puppeteer.launch).toBeTypeOf('function');
  });
});
