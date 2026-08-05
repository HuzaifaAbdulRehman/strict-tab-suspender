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

export const EXPECTED_POPUP_FOCUS_ORDER = [
  'pause-action',
  'discard-now',
  'suspend-current-tab',
  'protect-tab',
  '',
  '',
];

export function buildSmokeSuspendedUrl(extensionId, originalUrl, title) {
  const page = new URL(`chrome-extension://${extensionId}/suspended/index.html`);
  page.hash = new URLSearchParams({ v: '2', url: originalUrl, title }).toString();
  return page.toString();
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

export async function waitForExtensionWorker(browser, extensionId) {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === 'service_worker' &&
      target.url().startsWith(`chrome-extension://${extensionId}/`),
    { timeout: 10_000 },
  );
  const worker = await workerTarget.worker();
  if (worker === null) throw new Error('Extension worker is unavailable.');
  return worker;
}

async function startLocalPageServer() {
  const expectedOriginalTitle = 'Local smoke page title';
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(
      `<!doctype html><title>${expectedOriginalTitle}</title><p id="restored">restored</p>`,
    );
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
    expectedOriginalTitle,
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

async function runSmokeStep(label, step, action) {
  console.log(`[${label}] ${step}`);
  try {
    return await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[${label}] ${step} failed: ${detail}`, { cause: error });
  }
}

async function clickElement(page, selector) {
  await page.$eval(selector, (element) => {
    if (typeof element.click !== 'function') throw new Error('Element is not clickable.');
    element.click();
  });
}

async function activateTabForPopupAction(worker, tabId) {
  const activeTabId = await worker.evaluate(async (targetTabId) => {
    await chrome.tabs.update(targetTabId, { active: true });
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return activeTab?.id;
  }, tabId);
  if (activeTabId !== tabId) throw new Error('Could not activate the tab used by the popup test.');
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
    const worker = await waitForExtensionWorker(browser, id);
    const unexpectedRequests = [];

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
      { polling: 'mutation' },
    );
    await runSmokeStep(label, 'protect current tab', async () => {
      await activateTabForPopupAction(worker, normalTabId);
      await clickElement(popup, '#protect-tab');
      await popup.waitForFunction(
        () =>
          document.getElementById('status')?.textContent?.includes('is protected') === true &&
          !document.getElementById('protect-tab')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });
    const protectedState = await worker.evaluate(
      async (tabId) => (await chrome.tabs.get(tabId)).autoDiscardable,
      normalTabId,
    );
    if (protectedState !== false) throw new Error('Protect this tab did not disable auto discard.');

    await runSmokeStep(label, 'allow current tab suspension', async () => {
      await activateTabForPopupAction(worker, normalTabId);
      await clickElement(popup, '#protect-tab');
      await popup.waitForFunction(
        () =>
          document.getElementById('status')?.textContent?.includes('may be suspended') === true &&
          !document.getElementById('protect-tab')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });
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

    await runSmokeStep(label, 'suspend current tab', async () => {
      await activateTabForPopupAction(worker, normalTabId);
      await clickElement(popup, '#suspend-current-tab');
      await popup.waitForFunction(
        () =>
          document.getElementById('status')?.textContent !== 'Suspending this tabâ€¦' &&
          !document.getElementById('suspend-current-tab')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });
    const suspensionStatus = await popup.$eval('#status', (status) => status.textContent);
    if (suspensionStatus !== 'This tab is now suspended.') {
      throw new Error(`Suspend this tab now failed: ${suspensionStatus}`);
    }
    const expectedSuspendedUrl = buildSmokeSuspendedUrl(
      id,
      localPage.url,
      localPage.expectedOriginalTitle,
    );
    await normalTab.waitForFunction(
      (expectedUrl) => globalThis.location.href === expectedUrl,
      {},
      expectedSuspendedUrl,
    );
    if (normalTab.url() !== expectedSuspendedUrl) {
      throw new Error('Suspend this tab now parked a different tab or payload.');
    }
    const visibleOriginalUrl = await normalTab.$eval('#original-url', (link) => ({
      text: link.textContent,
      href: link.href,
    }));
    if (visibleOriginalUrl.text !== localPage.url || visibleOriginalUrl.href !== localPage.url) {
      throw new Error('Suspended placeholder did not expose the complete original URL.');
    }
    if ((await normalTab.title()) !== localPage.expectedOriginalTitle) {
      throw new Error('Suspended browser tab did not preserve the sanitized original title.');
    }
    await normalTab.bringToFront();
    await normalTab.waitForFunction(() => document.hasFocus());
    if (normalTab.url() !== expectedSuspendedUrl) {
      throw new Error('Suspended page restored merely because it was activated.');
    }
    await normalTab.focus('#restore-tab');
    await normalTab.keyboard.press('Enter');
    await normalTab.waitForFunction(
      () => document.getElementById('restored')?.textContent === 'restored',
    );
    if (normalTab.url() !== localPage.url)
      throw new Error('Keyboard Restore did not open the original page.');

    await runSmokeStep(label, 'manual sweep', async () => {
      await clickElement(popup, '#discard-now');
      await popup.waitForFunction(
        () =>
          document.getElementById('status')?.textContent?.startsWith('Sweep complete:') === true &&
          !document.getElementById('pause-action')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });
    await runSmokeStep(label, 'pause automation', async () => {
      await clickElement(popup, '#pause-action');
      await popup.waitForFunction(
        () =>
          document.getElementById('state')?.textContent === 'Paused' &&
          !document.getElementById('pause-action')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });
    await runSmokeStep(label, 'resume automation', async () => {
      await clickElement(popup, '#pause-action');
      await popup.waitForFunction(
        () =>
          document.getElementById('state')?.textContent === 'On' &&
          !document.getElementById('pause-action')?.hasAttribute('disabled'),
        { polling: 'mutation' },
      );
    });

    const options = await browser.newPage();
    trackExtensionNetwork(options, extensionOrigin, unexpectedRequests);
    await options.goto(`${extensionOrigin}/options/index.html`);
    await options.waitForFunction(() => document.getElementById('state')?.textContent === 'On');
    const clickSelected = await options.$eval(
      'input[name="restoreBehavior"][value="click"]',
      (input) => input.checked,
    );
    if (!clickSelected) throw new Error('Click to restore must be selected by default.');
    const optionsText = await options.$eval('body', (body) => body.textContent ?? '');
    if (!optionsText.includes('Read your browsing history')) {
      throw new Error('Options permission disclosure is missing.');
    }
    await runSmokeStep(label, 'save options', async () => {
      await clickElement(options, 'input[name="idleMinutes"][value="60"]');
      await clickElement(options, 'button[type="submit"]');
      await options.waitForFunction(
        () => document.getElementById('status')?.textContent === 'Settings saved locally.',
      );
    });
    await runSmokeStep(label, 'reset options', async () => {
      await clickElement(options, '#open-reset');
      await options.waitForFunction(() => document.getElementById('reset-dialog')?.open === true);
      await clickElement(options, '#confirm-reset');
      await options.waitForFunction(
        () => document.getElementById('status')?.textContent === 'Settings reset to defaults.',
      );
    });

    const backOptions = await browser.newPage();
    await backOptions.evaluateOnNewDocument(() => {
      globalThis.close = () => undefined;
    });
    trackExtensionNetwork(backOptions, extensionOrigin, unexpectedRequests);
    await backOptions.goto(`${extensionOrigin}/options/index.html`);
    await backOptions.waitForFunction(
      () => !document.getElementById('back-action')?.hasAttribute('disabled'),
    );
    await backOptions.bringToFront();
    await runSmokeStep(label, 'settings Back fallback', async () => {
      await Promise.all([
        backOptions.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        clickElement(backOptions, '#back-action'),
      ]);
    });
    if (backOptions.url() !== `${extensionOrigin}/popup/index.html`) {
      throw new Error('Settings Back did not use the packaged popup fallback.');
    }

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
