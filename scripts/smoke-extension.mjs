/* global document */

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import unzipper from 'unzipper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const unpackedDirectory = path.join(root, 'dist');
const packagePath = path.join(
  root,
  'package',
  `strict-tab-suspender-${packageMetadata.version}.zip`,
);

function chromeCandidates(environment = process.env) {
  return [
    environment.CHROME_PATH,
    environment.PUPPETEER_EXECUTABLE_PATH,
    environment.ProgramFiles &&
      path.join(environment.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    environment['ProgramFiles(x86)'] &&
      path.join(environment['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    environment.LOCALAPPDATA &&
      path.join(environment.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((candidate) => candidate !== undefined);
}

function findChrome() {
  const executable = chromeCandidates().find((candidate) => existsSync(candidate));
  if (executable === undefined) {
    throw new Error(
      'Chrome executable not found. Set CHROME_PATH to run the required extension smoke test.',
    );
  }
  return executable;
}

async function extensionId(browser) {
  await new Promise((resolve) => setTimeout(resolve, 750));
  const worker = browser
    .targets()
    .find(
      (target) =>
        target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
    );
  if (worker === undefined) throw new Error('Extension service worker did not start.');
  return new URL(worker.url()).host;
}

async function testExtension(extensionDirectory, label) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'strict-tab-discarder-smoke-'));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findChrome(),
      headless: false,
      pipe: true,
      enableExtensions: [extensionDirectory],
      args: ['--no-first-run'],
      userDataDir: profile,
    });
    const id = await extensionId(browser);
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${id}/popup/index.html`);
    await page.waitForFunction(() => document.getElementById('state')?.textContent === 'On');

    await page.evaluate(() => document.body.focus());
    const focusOrder = [];
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Tab');
      focusOrder.push(await page.evaluate(() => document.activeElement?.id));
    }
    if (focusOrder.join(',') !== 'pause-action,discard-now,,') {
      throw new Error(`Unexpected popup keyboard order: ${focusOrder.join(',')}`);
    }

    await page.click('#discard-now');
    await page.waitForFunction(() =>
      document.getElementById('status')?.textContent?.startsWith('Sweep complete:'),
    );
    await page.click('#pause-action');
    await page.waitForFunction(() => document.getElementById('state')?.textContent === 'Paused');
    await page.click('#pause-action');
    await page.waitForFunction(() => document.getElementById('state')?.textContent === 'On');

    await page.goto(`chrome-extension://${id}/options/index.html`);
    await page.waitForFunction(() => document.getElementById('state')?.textContent === 'On');
    await page.click('input[value="60"]');
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => document.getElementById('status')?.textContent === 'Settings saved locally.',
    );
    await page.click('#open-reset');
    await page.waitForFunction(() => document.getElementById('reset-dialog')?.open === true);
    await page.click('#confirm-reset');
    await page.waitForFunction(
      () => document.getElementById('status')?.textContent === 'Settings reset to defaults.',
    );
    console.log(`Chrome smoke passed for ${label}.`);
  } finally {
    await browser?.close();
    await rm(profile, { recursive: true, force: true });
  }
}

if (!existsSync(path.join(unpackedDirectory, 'manifest.json'))) {
  throw new Error('Unpacked dist/manifest.json is missing. Run npm run build first.');
}
if (!existsSync(packagePath)) {
  throw new Error('Extension package is missing. Run npm run package first.');
}

const extractedDirectory = await mkdtemp(path.join(os.tmpdir(), 'strict-tab-discarder-package-'));
try {
  await (await unzipper.Open.file(packagePath)).extract({ path: extractedDirectory });
  await testExtension(unpackedDirectory, 'unpacked dist');
  await testExtension(extractedDirectory, 'packaged archive');
} finally {
  await rm(extractedDirectory, { recursive: true, force: true });
}
