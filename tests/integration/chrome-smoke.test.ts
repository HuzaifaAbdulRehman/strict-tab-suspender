import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionPath = path.join(root, 'dist');

function findChromeExecutable(): string | undefined {
  return [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].find((candidate): candidate is string => candidate !== undefined && existsSync(candidate));
}

const chromeExecutable = findChromeExecutable();
const smoke = chromeExecutable === undefined ? it.skip : it;

describe('packaged Chrome extension smoke', () => {
  smoke(
    'supports accessible popup and options keyboard workflows',
    async () => {
      const browser = await puppeteer.launch({
        executablePath: chromeExecutable!,
        headless: true,
        pipe: true,
        enableExtensions: [extensionPath],
        args: ['--no-first-run'],
      });

      try {
        const worker = await browser.waitForTarget(
          (target) =>
            target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
          { timeout: 10_000 },
        );
        const extensionId = new URL(worker.url()).host;
        const popup = await browser.newPage();
        await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
        await popup.waitForFunction(
          () => !document.querySelector<HTMLButtonElement>('#pause-action')?.disabled,
        );

        await popup.keyboard.press('Tab');
        expect(await popup.evaluate(() => document.activeElement?.id)).toBe('pause-action');
        expect(
          await popup.evaluate(
            () => getComputedStyle(document.activeElement as Element).outlineStyle,
          ),
        ).not.toBe('none');
        await popup.keyboard.press('Enter');
        await popup.waitForFunction(
          () => document.querySelector('#state')?.textContent === 'Paused',
        );
        expect(await popup.$eval('#status', (element) => element.getAttribute('aria-live'))).toBe(
          'polite',
        );
        expect(await popup.$eval('#status', (element) => element.textContent)).toBe(
          'Automatic suspension is paused.',
        );

        const options = await browser.newPage();
        await options.goto(`chrome-extension://${extensionId}/options/index.html`);
        await options.waitForFunction(
          () => !document.querySelector<HTMLInputElement>('input[name="idleMinutes"]')?.disabled,
        );
        await options.focus('input[name="idleMinutes"][value="15"]');
        await options.keyboard.press('Tab');
        expect(await options.evaluate(() => document.activeElement?.getAttribute('type'))).toBe(
          'submit',
        );

        await options.focus('input[name="idleMinutes"][value="60"]');
        await options.keyboard.press('Space');
        await options.keyboard.press('Tab');
        await options.keyboard.press('Enter');
        await options.waitForFunction(
          () => document.querySelector('#status')?.textContent === 'Settings saved locally.',
        );
        expect(
          await options.$eval(
            'input[value="60"]',
            (element) => (element as HTMLInputElement).checked,
          ),
        ).toBe(true);
        expect(await options.$eval('#status', (element) => element.getAttribute('aria-live'))).toBe(
          'polite',
        );

        await options.focus('#open-reset');
        await options.keyboard.press('Enter');
        await options.waitForFunction(
          () => document.querySelector<HTMLDialogElement>('#reset-dialog')?.open,
        );
        await options.keyboard.press('Escape');
        await options.waitForFunction(
          () => !document.querySelector<HTMLDialogElement>('#reset-dialog')?.open,
        );
        await options.focus('#open-reset');
        await options.keyboard.press('Enter');
        await options.focus('#confirm-reset');
        await options.keyboard.press('Enter');
        await options.waitForFunction(
          () => document.querySelector('#status')?.textContent === 'Settings reset to defaults.',
        );
        expect(
          await options.$eval(
            'input[value="15"]',
            (element) => (element as HTMLInputElement).checked,
          ),
        ).toBe(true);
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});
