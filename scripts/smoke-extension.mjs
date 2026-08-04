/* global document, chrome */

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
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

export const EXPECTED_POPUP_FOCUS_ORDER = ['pause-action', 'discard-now', 'protect-tab', '', ''];

export function buildSmokeSuspendedUrl(extensionId, originalUrl) {
  return `chrome-extension://${extensionId}/suspended/index.html#v=1&url=${encodeURIComponent(originalUrl)}`;
}

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

export async function extensionId(browser) {
  const worker = await browser.waitForTarget(
    (target) =>
      target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
    { timeout: 10_000 },
  );
  return new URL(worker.url()).host;
}

async function startLocalPageServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Local smoke page</title><p id="restored">restored</p>');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null)
    throw new Error('Local server did not start.');
  return {
    url: `http://127.0.0.1:${address.port}/page`,
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    },
  };
}

function trackExtensionNetwork(page, extensionOrigin, unexpectedRequests) {
  page.on('request', (request) => {
    const initiatorUrl = request.initiator().url;
    if (
      initiatorUrl?.startsWith(extensionOrigin) &&
      ['fetch', 'xhr', 'websocket', 'eventsource'].includes(request.resourceType())
    ) {
      unexpectedRequests.push(request.url());
    }
  });
}

async function testExtension(extensionDirectory, label) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'strict-tab-discarder-smoke-'));
  const localPage = await startLocalPageServer();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findChrome(),
      headless: true,
      pipe: true,
      enableExtensions: [extensionDirectory],
      args: ['--no-first-run'],
      userDataDir: profile,
    });
    const id = await extensionId(browser);
    const extensionOrigin = `chrome-extension://${id}`;
    const workerTarget = browser
      .targets()
      .find(
        (target) => target.type() === 'service_worker' && target.url().startsWith(extensionOrigin),
      );
    const worker = await workerTarget?.worker();
    if (worker === null || worker === undefined)
      throw new Error('Extension worker is unavailable.');
    const unexpectedRequests = [];

    const suspended = await browser.newPage();
    trackExtensionNetwork(suspended, extensionOrigin, unexpectedRequests);
    await suspended.goto(buildSmokeSuspendedUrl(id, localPage.url));
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (!suspended.url().startsWith(`${extensionOrigin}/suspended/index.html#`)) {
      throw new Error('Suspended page restored without an explicit action.');
    }
    await suspended.focus('#restore-tab');
    await suspended.keyboard.press('Enter');
    await suspended.waitForFunction(
      () => document.getElementById('restored')?.textContent === 'restored',
    );
    if (suspended.url() !== localPage.url)
      throw new Error('Restore did not open the original page.');

    const normalTab = await browser.newPage();
    trackExtensionNetwork(normalTab, extensionOrigin, unexpectedRequests);
    await normalTab.goto(localPage.url);
    await normalTab.bringToFront();
    const normalTabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tab?.id;
    });
    if (normalTabId === undefined) throw new Error('Active test tab has no ID.');

    const popup = await browser.newPage();
    trackExtensionNetwork(popup, extensionOrigin, unexpectedRequests);
    await popup.goto(`${extensionOrigin}/popup/index.html`);
    await normalTab.bringToFront();
    await popup.reload();
    await popup.waitForFunction(
      () => !document.querySelector('#protect-tab')?.hasAttribute('disabled'),
    );
    await popup.$eval('#protect-tab', (button) => button.click());
    await popup.waitForFunction(() =>
      document.getElementById('status')?.textContent?.includes('is protected'),
    );
    const protectedState = await worker.evaluate(
      async (tabId) => (await chrome.tabs.get(tabId)).autoDiscardable,
      normalTabId,
    );
    if (protectedState !== false) throw new Error('Protect this tab did not disable auto discard.');

    await popup.$eval('#protect-tab', (button) => button.click());
    await popup.waitForFunction(() =>
      document.getElementById('status')?.textContent?.includes('may be suspended'),
    );
    const allowedState = await worker.evaluate(
      async (tabId) => (await chrome.tabs.get(tabId)).autoDiscardable,
      normalTabId,
    );
    if (allowedState !== true) throw new Error('Allow suspension did not restore auto discard.');

    await popup.bringToFront();
    await popup.evaluate(() => document.body.focus());
    const focusOrder = [];
    for (let index = 0; index < EXPECTED_POPUP_FOCUS_ORDER.length; index += 1) {
      await popup.keyboard.press('Tab');
      focusOrder.push(await popup.evaluate(() => document.activeElement?.id));
    }
    if (focusOrder.join(',') !== EXPECTED_POPUP_FOCUS_ORDER.join(',')) {
      throw new Error(`Unexpected popup keyboard order: ${focusOrder.join(',')}`);
    }

    await popup.click('#discard-now');
    await popup.waitForFunction(() =>
      document.getElementById('status')?.textContent?.startsWith('Sweep complete:'),
    );
    await popup.click('#pause-action');
    await popup.waitForFunction(() => document.getElementById('state')?.textContent === 'Paused');
    await popup.click('#pause-action');
    await popup.waitForFunction(() => document.getElementById('state')?.textContent === 'On');

    const options = await browser.newPage();
    trackExtensionNetwork(options, extensionOrigin, unexpectedRequests);
    await options.goto(`${extensionOrigin}/options/index.html`);
    await options.waitForFunction(() => document.getElementById('state')?.textContent === 'On');
    const nativeSelected = await options.$eval(
      'input[name="restoreBehavior"][value="native"]',
      (input) => input.checked,
    );
    if (!nativeSelected) throw new Error('Native restore must be selected by default.');
    const optionsText = await options.$eval('body', (body) => body.textContent ?? '');
    if (!optionsText.includes('Read your browsing history')) {
      throw new Error('Options permission disclosure is missing.');
    }
    await options.click('input[name="idleMinutes"][value="60"]');
    await options.click('button[type="submit"]');
    await options.waitForFunction(
      () => document.getElementById('status')?.textContent === 'Settings saved locally.',
    );
    await options.click('#open-reset');
    await options.waitForFunction(() => document.getElementById('reset-dialog')?.open === true);
    await options.click('#confirm-reset');
    await options.waitForFunction(
      () => document.getElementById('status')?.textContent === 'Settings reset to defaults.',
    );

    if (unexpectedRequests.length > 0) {
      throw new Error(
        `Extension initiated an unexpected network request (${unexpectedRequests.length}).`,
      );
    }
    console.log(`Chrome smoke passed for ${label}.`);
  } finally {
    await browser?.close();
    await localPage.close();
    await rm(profile, { recursive: true, force: true });
  }
}

export async function main() {
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
