import { getSettings, saveSettings, type LocalStorageArea } from '../shared/settings.js';
import { STARTUP_GRACE_MS, runSweep, type SweepDependencies, type TabsAdapter } from './sweep.js';
import type { TabSnapshot } from './eligibility.js';

export const ALARM_NAME = 'strict-tab-discarder-sweep';
export const ALARM_PERIOD_MINUTES = 1;

export interface AlarmsAdapter {
  get(name: string): Promise<{ name: string; scheduledTime: number } | undefined>;
  clear(name: string): Promise<boolean>;
  create(name: string, info: { when: number; periodInMinutes: number }): void | Promise<void>;
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

export async function ensureSweepAlarm(
  dependencies: ServiceWorkerDependencies,
  resetExistingForBrowserStartup = false,
): Promise<void> {
  if (dependencies.storage.setAccessLevel !== undefined) {
    await dependencies.storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  }
  const settings = await getSettings(dependencies.storage);
  if (!settings.enabled) {
    await dependencies.alarms.clear(ALARM_NAME);
    return;
  }

  const existingAlarm = await dependencies.alarms.get(ALARM_NAME);
  if (existingAlarm !== undefined && !resetExistingForBrowserStartup) return;
  if (existingAlarm !== undefined) await dependencies.alarms.clear(ALARM_NAME);
  await dependencies.alarms.create(ALARM_NAME, {
    when: dependencies.now() + STARTUP_GRACE_MS,
    periodInMinutes: ALARM_PERIOD_MINUTES,
  });
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
      await ensureSweepAlarm(dependencies, true);
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
    get(name: string): Promise<{ name: string; scheduledTime: number } | undefined>;
    clear(name: string): Promise<boolean>;
    create(name: string, info: { when: number; periodInMinutes: number }): void;
    onAlarm?: ChromeEvents<(alarm: { name: string }) => void>;
  };
  tabs?: {
    query(queryInfo: Record<string, never>): Promise<TabSnapshot[]>;
    get(tabId: number): Promise<TabSnapshot>;
    discard(tabId: number): Promise<TabSnapshot | undefined>;
  };
  runtime?: {
    onInstalled?: ChromeEvents<() => void>;
    onStartup?: ChromeEvents<() => void>;
  };
}

function browserChrome(): ExtensionChrome | undefined {
  return (globalThis as typeof globalThis & { chrome?: ExtensionChrome }).chrome;
}

function browserDependencies(browser: ExtensionChrome): ServiceWorkerDependencies {
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
  };
}

export function registerServiceWorker(browser: ExtensionChrome): ServiceWorkerController {
  const dependencies = browserDependencies(browser);
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

const loadedChrome = browserChrome();

if (
  loadedChrome?.runtime !== undefined &&
  loadedChrome.alarms !== undefined &&
  loadedChrome.storage?.local !== undefined &&
  loadedChrome.tabs !== undefined
) {
  registerServiceWorker(loadedChrome);
}
