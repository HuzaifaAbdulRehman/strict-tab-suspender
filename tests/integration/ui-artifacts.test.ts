import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(root, 'src', relativePath), 'utf8');
}

describe('user interface artifacts', () => {
  it('provides an accessible compact popup with local actions and safety copy', async () => {
    const popup = await readSource('popup/index.html');

    expect(popup).toContain('Strict Tab Discarder');
    expect(popup).toContain('Inactive tabs are suspended after about');
    expect(popup).toContain('Suspend eligible tabs now');
    expect(popup).toMatch(/id="suspend-current-tab"[^>]*>\s*Suspend this tab now/u);
    expect(popup).toContain('Protect this tab');
    expect(popup).toContain(
      'This tab may become inactive, but it will never be suspended while protected.',
    );
    expect(popup).toMatch(/Suspended tabs remain visible[\s\S]*click mode waits for Restore/u);
    expect(popup).toMatch(/cannot detect unsaved forms or\s+in-memory work/u);
    expect(popup).toMatch(/id="status"[^>]*aria-live="polite"/u);
    expect(popup).toMatch(/<button[^>]*type="button"/u);
    expect(popup).toMatch(/<nav[^>]*aria-label=/u);
    expect(popup).toMatch(/href="\.\.\/options\/index\.html"/u);
    expect(popup).toMatch(/href="\.\.\/options\/index\.html#privacy"/u);
    expect(popup).not.toMatch(/\bon\w+\s*=/iu);
    expect(popup).not.toMatch(/https?:\/\//iu);
  });

  it('provides all settings presets, reset confirmation, and non-optional protection guidance', async () => {
    const options = await readSource('options/index.html');

    for (const minutes of [15, 30, 60, 120]) {
      expect(options).toContain(`value="${minutes}"`);
      expect(options).toMatch(new RegExp(`${minutes}\\s+minutes`, 'u'));
    }
    expect(options).toContain(
      'Pinned and audible tabs are always protected and cannot be disabled.',
    );
    expect(options).toContain('cannot detect unsaved forms or in-memory work');
    expect(options).toContain('name="restoreBehavior" value="native"');
    expect(options).toMatch(/name="restoreBehavior" value="click" checked/u);
    expect(options).toMatch(
      /id="back-action"[^>]*type="button"[^>]*aria-label="Back to extension popup"[^>]*>\s*<span[^>]*>←<\/span>\s*Back/u,
    );
    expect(options).toContain('Read your browsing history');
    expect(options).toContain('It is not encrypted');
    expect(options).toContain('not saved in extension storage or sent over the network');
    expect(options).toContain('<dialog');
    expect(options).toMatch(/automatic suspension[\s\S]*15 minutes[\s\S]*click-to-restore/iu);
    expect(options).toContain('<fieldset>');
    expect(options).toMatch(/<label>\s*<input type="radio"/u);
    expect(options).toMatch(/<button[^>]*type="submit"/u);
    expect(options).toMatch(/id="status"[^>]*aria-live="polite"/u);
    expect(options).not.toMatch(/\bon\w+\s*=/iu);
    expect(options).not.toMatch(/https?:\/\//iu);
  });

  it('provides an accessible restore page with a safe full-URL link', async () => {
    const suspended = await readSource('suspended/index.html');

    expect(suspended).toContain('This tab is suspended');
    expect(suspended).toContain('Restore tab');
    expect(suspended).toMatch(/id="restore-tab"[^>]*type="button"/u);
    expect(suspended).toMatch(/<a[^>]*id="original-url"/u);
    expect(suspended).toMatch(/id="status"[^>]*aria-live="polite"/u);
    expect(suspended).not.toMatch(/\b(favicon|domain)-(?:value|display)\b/iu);
    expect(suspended).not.toMatch(/\bon\w+\s*=/iu);
    expect(suspended).not.toMatch(/https?:\/\//iu);
  });

  it('ships original checked-in icons at every declared size', async () => {
    for (const size of [16, 32, 48, 128]) {
      const icon = path.join(root, 'src', 'icons', `icon-${size}.png`);
      const data = await readFile(icon);
      expect(data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(data.readUInt32BE(16)).toBe(size);
      expect(data.readUInt32BE(20)).toBe(size);
      await expect(stat(icon)).resolves.toMatchObject({ size: expect.any(Number) });
    }
  });
});
