import { describe, expect, it } from 'vitest';

import {
  IDLE_MINUTE_PRESETS,
  createOptionsController,
  type OptionsView,
} from '../../src/options/options-controller.js';

function view(): OptionsView & { values: Record<string, string>; busy: boolean } {
  const values: Record<string, string> = {};
  return {
    values,
    busy: false,
    setText(name, value) {
      values[name] = value;
    },
    setIdleMinutes(value) {
      values.idleMinutes = String(value);
    },
    setBusy(value) {
      this.busy = value;
    },
  };
}

describe('options controller', () => {
  it('loads the documented preset and local-only safety guidance', async () => {
    const options = view();
    const controller = createOptionsController(options, {
      async sendMessage() {
        return { settings: { schemaVersion: 1, enabled: false, idleMinutes: 60 } };
      },
    });

    await controller.load();

    expect(IDLE_MINUTE_PRESETS).toEqual([15, 30, 60, 120]);
    expect(options.values).toMatchObject({
      idleMinutes: '60',
      state: 'Paused',
      status: '',
      protection: 'Pinned and audible tabs are always protected and cannot be disabled.',
      warning:
        'This extension cannot detect unsaved forms or in-memory work. Save important work first.',
    });
  });

  it('saves an allowed preset and reset restores the documented defaults through worker APIs', async () => {
    const options = view();
    const sent: unknown[] = [];
    const controller = createOptionsController(options, {
      async sendMessage(message) {
        sent.push(message);
        return {
          settings:
            message.type === 'resetSettings'
              ? { schemaVersion: 1, enabled: true, idleMinutes: 15 }
              : { schemaVersion: 1, enabled: true, idleMinutes: 120 },
        };
      },
    });

    await controller.save(120);
    await controller.reset();

    expect(sent).toEqual([{ type: 'saveSettings', idleMinutes: 120 }, { type: 'resetSettings' }]);
    expect(options.values).toMatchObject({
      idleMinutes: '15',
      state: 'On',
      status: 'Settings reset to defaults.',
    });
  });

  it('rejects a non-preset value before it reaches the worker', async () => {
    const options = view();
    const controller = createOptionsController(options, {
      async sendMessage() {
        throw new Error('not reached');
      },
    });

    await controller.save(16);

    expect(options.values.status).toBe('Choose one of the available time limits.');
  });
});
