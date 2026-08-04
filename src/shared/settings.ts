export type IdleMinutes = 15 | 30 | 60 | 120;

export interface Settings {
  schemaVersion: 1;
  enabled: boolean;
  idleMinutes: IdleMinutes;
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
  schemaVersion: 1,
  enabled: true,
  idleMinutes: 15,
};

export const SETTINGS_STORAGE_KEY = 'settings';
export const LATEST_SUMMARY_STORAGE_KEY = 'latestSweepSummary';

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

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.enabled === 'boolean' &&
    isIdleMinutes(candidate.idleMinutes)
  );
}

function normalizeSettings(value: unknown): Settings {
  if (value === undefined) return { ...DEFAULT_SETTINGS };
  if (isSettings(value)) {
    return {
      schemaVersion: 1,
      enabled: value.enabled,
      idleMinutes: value.idleMinutes,
    };
  }
  return { ...DEFAULT_SETTINGS, enabled: false };
}

export async function getSettings(storage: LocalStorageArea = defaultStorage()): Promise<Settings> {
  const data = await storage.get();
  return normalizeSettings(data[SETTINGS_STORAGE_KEY]);
}

export async function saveSettings(
  update: Partial<Pick<Settings, 'enabled' | 'idleMinutes'>>,
  storage: LocalStorageArea = defaultStorage(),
): Promise<Settings> {
  if (update.enabled !== undefined && typeof update.enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }
  if (update.idleMinutes !== undefined && !isIdleMinutes(update.idleMinutes)) {
    throw new TypeError('idleMinutes must be one of 15, 30, 60, or 120');
  }

  const existing = await getSettings(storage);
  const settings: Settings = {
    schemaVersion: 1,
    enabled: update.enabled ?? existing.enabled,
    idleMinutes: update.idleMinutes ?? existing.idleMinutes,
  };
  await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
  return settings;
}

export async function resetSettings(
  storage: LocalStorageArea = defaultStorage(),
): Promise<Settings> {
  const settings = { ...DEFAULT_SETTINGS };
  await storage.set({ [SETTINGS_STORAGE_KEY]: settings });
  return settings;
}

export async function saveLatestSweepSummary(
  summary: SweepSummary,
  storage: LocalStorageArea = defaultStorage(),
): Promise<void> {
  await storage.set({ [LATEST_SUMMARY_STORAGE_KEY]: summary });
}
