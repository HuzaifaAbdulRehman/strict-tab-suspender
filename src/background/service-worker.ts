import {
  getSettings,
  resetSettings,
  saveSettings,
  type LocalStorageArea,
  type SweepSummary,
} from '../shared/settings.js';
import { STARTUP_GRACE_MS, runSweep, type SweepDependencies, type TabsAdapter } from './sweep.js';
import type { TabSnapshot } from './eligibility.js';
import type { ExtensionRequest, ExtensionResponse } from '../shared/messages.js';

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

function isSweepSummary(value: unknown): value is SweepSummary {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ['checkedAt', 'evaluatedCount', 'discardedCount', 'skippedCount', 'failedCount'].every(
    (key) => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]),
  );
}

export async function handleExtensionMessage(
  message: ExtensionRequest,
  dependencies: ServiceWorkerDependencies,
): Promise<ExtensionResponse> {
  if (message.type === 'getPopupState') {
    const stored = await dependencies.storage.get();
    const summary = stored.latestSweepSummary;
    return {
      settings: await getSettings(dependencies.storage),
      ...(isSweepSummary(summary) ? { summary } : {}),
    };
  }
  if (message.type === 'manualSweep') return { summary: await runSweep('manual', dependencies) };
  if (message.type === 'pauseAutomation') {
    await pauseAutomation(dependencies);
    return { settings: await getSettings(dependencies.storage) };
  }
  if (message.type === 'resumeAutomation') {
    await resumeAutomation(dependencies);
    return { settings: await getSettings(dependencies.storage) };
  }
  if (message.type === 'saveSettings') {
    const settings = await saveSettings({ idleMinutes: message.idleMinutes }, dependencies.storage);
    await ensureSweepAlarm(dependencies);
    return { settings };
  }
  const settings = await resetSettings(dependencies.storage);
  await ensureSweepAlarm(dependencies);
  return { settings };
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

function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'getPopupState' ||
    candidate.type === 'manualSweep' ||
    candidate.type === 'pauseAutomation' ||
    candidate.type === 'resumeAutomation' ||
    candidate.type === 'resetSettings' ||
    (candidate.type === 'saveSettings' &&
      (candidate.idleMinutes === 15 ||
        candidate.idleMinutes === 30 ||
        candidate.idleMinutes === 60 ||
        candidate.idleMinutes === 120))
  );
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
    onMessage?: ChromeEvents<
      (
        message: unknown,
        sender: unknown,
        sendResponse: (response: ExtensionResponse) => void,
      ) => boolean | void
    >;
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
  browser.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!isExtensionRequest(message)) return;
    void handleExtensionMessage(message, dependencies)
      .then(sendResponse)
      .catch(() => sendResponse({}));
    return true;
  });
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
