import { describe, expect, it } from 'vitest';

import {
  IDLE_MINUTE_PRESETS,
  createOptionsController,
  type OptionsView,
} from '../../src/options/options-controller.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
    setRestoreBehavior(value) {
      values.restoreBehavior = value;
    },
    setBusy(value) {
      this.busy = value;
    },
  };
}

describe('options controller', () => {
  it('requests tabs permission before saving click behavior', async () => {
    const options = view();
    const calls: unknown[] = [];
    const controller = createOptionsController(
      options,
      {
        async sendMessage(message) {
          calls.push(['message', message]);
          return {
            settings: {
              schemaVersion: 2,
              enabled: true,
              idleMinutes: 15,
              restoreBehavior: 'click',
            },
          };
        },
      },
      {
        async contains() {
          return false;
        },
        async request(request) {
          calls.push(['request', request]);
          return true;
        },
        async remove() {
          return true;
        },
      },
    );

    await controller.setRestoreBehavior('click');

    expect(calls).toEqual([
      ['request', { permissions: ['tabs'] }],
      ['message', { type: 'setRestoreBehavior', restoreBehavior: 'click' }],
    ]);
    expect(options.values.restoreBehavior).toBe('click');
  });

  it('leaves native behavior selected when permission is denied', async () => {
    const options = view();
    const controller = createOptionsController(
      options,
      {
        async sendMessage() {
          throw new Error('not reached');
        },
      },
      {
        async contains() {
          return false;
        },
        async request() {
          return false;
        },
        async remove() {
          return true;
        },
      },
    );

    await controller.setRestoreBehavior('click');

    expect(options.values.restoreBehavior).toBe('native');
    expect(options.values.status).toBe(
      'Permission was not granted. Restore behavior was not changed.',
    );
  });

  it('loads the documented preset and local-only safety guidance', async () => {
    const options = view();
    const controller = createOptionsController(options, {
      async sendMessage() {
        return {
          settings: {
            schemaVersion: 2,
            enabled: false,
            idleMinutes: 60,
            restoreBehavior: 'native',
          },
        };
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
              ? { schemaVersion: 2, enabled: true, idleMinutes: 15, restoreBehavior: 'native' }
              : { schemaVersion: 2, enabled: true, idleMinutes: 120, restoreBehavior: 'native' },
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

  it('keeps a newer saved preset when the initial load resolves afterwards', async () => {
    const options = view();
    const initialState = deferred<{
      settings: {
        schemaVersion: 2;
        enabled: boolean;
        idleMinutes: 15;
        restoreBehavior: 'native';
      };
    }>();
    const controller = createOptionsController(options, {
      async sendMessage(message) {
        if (message.type === 'getPopupState') return initialState.promise;
        return {
          settings: {
            schemaVersion: 2,
            enabled: true,
            idleMinutes: 120,
            restoreBehavior: 'native',
          },
        };
      },
    });

    const loading = controller.load();
    expect(options.busy).toBe(true);
    await controller.save(120);
    initialState.resolve({
      settings: { schemaVersion: 2, enabled: true, idleMinutes: 15, restoreBehavior: 'native' },
    });
    await loading;

    expect(options.values).toMatchObject({
      idleMinutes: '120',
      state: 'On',
      status: 'Settings saved locally.',
    });
    expect(options.busy).toBe(false);
  });

  it('keeps reset defaults when the initial load resolves afterwards', async () => {
    const options = view();
    const initialState = deferred<{
      settings: {
        schemaVersion: 2;
        enabled: boolean;
        idleMinutes: 120;
        restoreBehavior: 'native';
      };
    }>();
    const controller = createOptionsController(options, {
      async sendMessage(message) {
        if (message.type === 'getPopupState') return initialState.promise;
        return {
          settings: { schemaVersion: 2, enabled: true, idleMinutes: 15, restoreBehavior: 'native' },
        };
      },
    });

    const loading = controller.load();
    await controller.reset();
    initialState.resolve({
      settings: { schemaVersion: 2, enabled: false, idleMinutes: 120, restoreBehavior: 'native' },
    });
    await loading;

    expect(options.values).toMatchObject({
      idleMinutes: '15',
      state: 'On',
      status: 'Settings reset to defaults.',
    });
    expect(options.busy).toBe(false);
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
