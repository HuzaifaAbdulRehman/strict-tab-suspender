export type IdleMinutes = 15 | 30 | 60 | 120;
export type RestoreBehavior = 'native' | 'click';

export interface Settings {
  schemaVersion: 3;
  enabled: boolean;
  idleMinutes: IdleMinutes;
  restoreBehavior: RestoreBehavior;
}

export interface SweepSummary {
  checkedAt: number;
  evaluatedCount: number;
  discardedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface LocalStorageArea {
  get(): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  setAccessLevel?(access: { accessLevel: 'TRUSTED_CONTEXTS' }): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 3,
  enabled: true,
  idleMinutes: 15,
  restoreBehavior: 'click',
};

export const SETTINGS_STORAGE_KEY = 'settings';
export const LATEST_SUMMARY_STORAGE_KEY = 'latestSweepSummary';
const settingsWriteQueues = new WeakMap<LocalStorageArea, Promise<unknown>>();

function defaultStorage(): LocalStorageArea {
  const browser = (
    globalThis as typeof globalThis & {
      chrome?: { storage?: { local?: LocalStorageArea } };
    }
  ).chrome;
  if (browser?.storage?.local === undefined) throw new Error('chrome.storage.local is unavailable');
  return browser.storage.local;
}

function isIdleMinutes(value: unknown): value is IdleMinutes {
  return value === 15 || value === 30 || value === 60 || value === 120;
}

function isRestoreBehavior(value: unknown): value is RestoreBehavior {
  return value === 'native' || value === 'click';
}

function isV1Settings(
  value: unknown,
): value is { schemaVersion: 1; enabled: boolean; idleMinutes: IdleMinutes } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.enabled === 'boolean' &&
    isIdleMinutes(candidate.idleMinutes)
  );
}

function isV2Settings(value: unknown): value is {
  schemaVersion: 2;
  enabled: boolean;
  idleMinutes: IdleMinutes;
  restoreBehavior: RestoreBehavior;
} {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.enabled === 'boolean' &&
    isIdleMinutes(candidate.idleMinutes) &&
    isRestoreBehavior(candidate.restoreBehavior)
  );
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 3 &&
    typeof candidate.enabled === 'boolean' &&
    isIdleMinutes(candidate.idleMinutes) &&
    isRestoreBehavior(candidate.restoreBehavior)
  );
}

function normalizeSettings(value: unknown): Settings {
  if (value === undefined) return { ...DEFAULT_SETTINGS };
  if (isV1Settings(value)) {
    return {
      schemaVersion: 3,
      enabled: value.enabled,
      idleMinutes: value.idleMinutes,
      restoreBehavior: 'click',
    };
  }
  if (isV2Settings(value)) {
    return {
      schemaVersion: 3,
      enabled: value.enabled,
      idleMinutes: value.idleMinutes,
      restoreBehavior: 'click',
    };
  }
  if (isSettings(value)) {
    return {
      schemaVersion: 3,
      enabled: value.enabled,
      idleMinutes: value.idleMinutes,
      restoreBehavior: value.restoreBehavior,
    };
  }
  return { ...DEFAULT_SETTINGS, enabled: false };
}

async function serializeSettingsWrite<T>(
  storage: LocalStorageArea,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = settingsWriteQueues.get(storage) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(operation);
  settingsWriteQueues.set(storage, queued);
  try {
    return await queued;
  } finally {
    if (settingsWriteQueues.get(storage) === queued) settingsWriteQueues.delete(storage);
  }
}

export async function getSettings(storage: LocalStorageArea = defaultStorage()): Promise<Settings> {
  const data = await storage.get();
  return normalizeSettings(data[SETTINGS_STORAGE_KEY]);
}

export async function saveSettings(
  update: Partial<Pick<Settings, 'enabled' | 'idleMinutes' | 'restoreBehavior'>>,
  storage: LocalStorageArea = defaultStorage(),
): Promise<Settings> {
  if (update.enabled !== undefined && typeof update.enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }
  if (update.idleMinutes !== undefined && !isIdleMinutes(update.idleMinutes)) {
    throw new TypeError('idleMinutes must be one of 15, 30, 60, or 120');
  }
  if (update.restoreBehavior !== undefined && !isRestoreBehavior(update.restoreBehavior)) {
    throw new TypeError('restoreBehavior must be native or click');
  }

  return serializeSettingsWrite(storage, async () => {
    const existing = await getSettings(storage);
    const settings: Settings = {
      schemaVersion: 3,
      enabled: update.enabled ?? existing.enabled,
      idleMinutes: update.idleMinutes ?? existing.idleMinutes,
      restoreBehavior: update.restoreBehavior ?? existing.restoreBehavior,
    };
    await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
    return settings;
  });
}

export async function resetSettings(
  storage: LocalStorageArea = defaultStorage(),
): Promise<Settings> {
  return serializeSettingsWrite(storage, async () => {
    const settings = { ...DEFAULT_SETTINGS };
    await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
    return settings;
  });
}

export async function saveLatestSweepSummary(
  summary: SweepSummary,
  storage: LocalStorageArea = defaultStorage(),
): Promise<void> {
  await storage.set({ [LATEST_SUMMARY_STORAGE_KEY]: summary });
}
