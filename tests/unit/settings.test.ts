import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getSettings,
  resetSettings,
  saveSettings,
  type LocalStorageArea,
} from '../../src/shared/settings.js';

function storageWith(
  initial: Record<string, unknown> = {},
): LocalStorageArea & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    async get() {
      return { ...data };
    },
    async set(values) {
      Object.assign(data, values);
    },
  };
}

describe('settings', () => {
  it('uses the documented defaults when no settings have been saved', async () => {
    const storage = storageWith();
    await expect(getSettings(storage)).resolves.toEqual({
      schemaVersion: 1,
      enabled: true,
      idleMinutes: 15,
    });
    expect(DEFAULT_SETTINGS).toEqual({ schemaVersion: 1, enabled: true, idleMinutes: 15 });
  });

  it('merges a valid partial save without persisting caller metadata', async () => {
    const storage = storageWith();

    await saveSettings({ idleMinutes: 60, ignored: 'metadata' } as never, storage);

    expect(storage.data).toEqual({
      settings: { schemaVersion: 1, enabled: true, idleMinutes: 60 },
    });
  });

  it('serializes concurrent pause and timeout updates so neither field is lost', async () => {
    const data: Record<string, unknown> = {
      settings: { schemaVersion: 1, enabled: true, idleMinutes: 15 },
    };
    let releaseWrites!: () => void;
    let markFirstWrite!: () => void;
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWrite = resolve;
    });
    const writesReleased = new Promise<void>((resolve) => {
      releaseWrites = resolve;
    });
    const storage: LocalStorageArea = {
      async get() {
        return { ...data };
      },
      async set(values) {
        markFirstWrite();
        await writesReleased;
        Object.assign(data, values);
      },
    };
    const saves = Promise.all([
      saveSettings({ enabled: false }, storage),
      saveSettings({ idleMinutes: 60 }, storage),
    ]);
    await firstWriteStarted;
    releaseWrites();

    await expect(saves).resolves.toEqual([
      { schemaVersion: 1, enabled: false, idleMinutes: 15 },
      { schemaVersion: 1, enabled: false, idleMinutes: 60 },
    ]);
    expect(data.settings).toEqual({ schemaVersion: 1, enabled: false, idleMinutes: 60 });
  });

  it('rejects a non-preset idle period before writing it', async () => {
    const storage = storageWith();

    await expect(saveSettings({ idleMinutes: 16 } as never, storage)).rejects.toThrow(
      'idleMinutes must be one of 15, 30, 60, or 120',
    );
    expect(storage.data).toEqual({});
  });

  it('normalizes malformed stored settings conservatively', async () => {
    const storage = storageWith({
      settings: { schemaVersion: 99, enabled: 'yes', idleMinutes: 16, title: 'private tab' },
    });

    await expect(getSettings(storage)).resolves.toEqual({
      schemaVersion: 1,
      enabled: false,
      idleMinutes: 15,
    });
  });

  it('strips unknown metadata from otherwise valid stored settings', async () => {
    const storage = storageWith({
      settings: {
        schemaVersion: 1,
        enabled: true,
        idleMinutes: 30,
        title: 'must not persist',
      },
    });

    await expect(getSettings(storage)).resolves.toEqual({
      schemaVersion: 1,
      enabled: true,
      idleMinutes: 30,
    });
  });

  it('resets to the documented default settings', async () => {
    const storage = storageWith({
      settings: { schemaVersion: 1, enabled: false, idleMinutes: 120 },
    });

    await resetSettings(storage);

    expect(storage.data).toEqual({
      settings: { schemaVersion: 1, enabled: true, idleMinutes: 15 },
    });
  });
});
