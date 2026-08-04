import { getSettings, saveSettings, type LocalStorageArea } from '../shared/settings.js';
import { runSweep, type SweepDependencies, type TabsAdapter } from './sweep.js';
import type { TabSnapshot } from './eligibility.js';

export const ALARM_NAME = 'strict-tab-discarder-sweep';
export const ALARM_PERIOD_MINUTES = 1;

export interface AlarmsAdapter {
  clear(name: string): Promise<boolean>;
  create(name: string, info: { periodInMinutes: number }): void | Promise<void>;
}

export interface ServiceWorkerDependencies extends SweepDependencies {
  alarms: AlarmsAdapter;
}

export interface ServiceWorkerController {
  onInstalled(): Promise<void>;
  onStartup(): Promise<void>;
  onStorageChanged(changes: Record<string, unknown>, areaName: string): Promise<void>;
  onAlarm(alarm: { name: string }): Promise<void>;
}

export async function ensureSweepAlarm(dependencies: ServiceWorkerDependencies): Promise<void> {
  if (dependencies.storage.setAccessLevel !== undefined) {
    await dependencies.storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  }
  const settings = await getSettings(dependencies.storage);
  await dependencies.alarms.clear(ALARM_NAME);
  if (settings.enabled) {
    await dependencies.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  }
}

export async function pauseAutomation(dependencies: ServiceWorkerDependencies): Promise<void> {
  await saveSettings({ enabled: false }, dependencies.storage);
  await ensureSweepAlarm(dependencies);
}

export async function resumeAutomation(dependencies: ServiceWorkerDependencies): Promise<void> {
  await saveSettings({ enabled: true }, dependencies.storage);
  await ensureSweepAlarm(dependencies);
}

export function createServiceWorkerController(
  dependencies: ServiceWorkerDependencies,
): ServiceWorkerController {
  return {
    async onInstalled() {
      await ensureSweepAlarm(dependencies);
    },
    async onStartup() {
      await ensureSweepAlarm(dependencies);
    },
    async onStorageChanged(changes, areaName) {
      if (areaName === 'local' && Object.hasOwn(changes, 'settings')) {
        await ensureSweepAlarm(dependencies);
      }
    },
    async onAlarm(alarm) {
      if (alarm.name === ALARM_NAME) await runSweep('alarm', dependencies);
    },
  };
}

interface ChromeEvents<T> {
  addListener(listener: T): void;
}

export interface ExtensionChrome {
  storage?: {
    local?: LocalStorageArea;
    onChanged?: ChromeEvents<(changes: Record<string, unknown>, areaName: string) => void>;
  };
  alarms?: {
    clear(name: string): Promise<boolean>;
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm?: ChromeEvents<(alarm: { name: string }) => void>;
  };
  tabs?: {
    query(queryInfo: Record<string, never>): Promise<TabSnapshot[]>;
    get(tabId: number): Promise<TabSnapshot>;
    discard(tabId: number): Promise<unknown>;
  };
  runtime?: {
    onInstalled?: ChromeEvents<() => void>;
    onStartup?: ChromeEvents<() => void>;
  };
}

function browserChrome(): ExtensionChrome | undefined {
  return (globalThis as typeof globalThis & { chrome?: ExtensionChrome }).chrome;
}

function browserDependencies(
  browser: ExtensionChrome,
  startedAt: number,
): ServiceWorkerDependencies {
  if (
    browser?.storage?.local === undefined ||
    browser.alarms === undefined ||
    browser.tabs === undefined
  ) {
    throw new Error('Chrome extension APIs are unavailable');
  }
  const tabs: TabsAdapter = {
    query: () => browser.tabs!.query({}),
    get: (tabId) => browser.tabs!.get(tabId),
    discard: (tabId) => browser.tabs!.discard(tabId),
  };
  return {
    alarms: browser.alarms,
    storage: browser.storage.local,
    tabs,
    now: Date.now,
    startedAt,
  };
}

export function registerServiceWorker(
  browser: ExtensionChrome,
  startedAt = Date.now(),
): ServiceWorkerController {
  const dependencies = browserDependencies(browser, startedAt);
  const controller = createServiceWorkerController(dependencies);
  browser.runtime?.onInstalled?.addListener(() => void controller.onInstalled());
  browser.runtime?.onStartup?.addListener(() => void controller.onStartup());
  browser.storage?.onChanged?.addListener(
    (changes, areaName) => void controller.onStorageChanged(changes, areaName),
  );
  browser.alarms?.onAlarm?.addListener((alarm) => void controller.onAlarm(alarm));
  void ensureSweepAlarm(dependencies);
  return controller;
}

const moduleStartedAt = Date.now();
const loadedChrome = browserChrome();

if (
  loadedChrome?.runtime !== undefined &&
  loadedChrome.alarms !== undefined &&
  loadedChrome.storage?.local !== undefined &&
  loadedChrome.tabs !== undefined
) {
  registerServiceWorker(loadedChrome, moduleStartedAt);
}
