import { describe, expect, it } from 'vitest';

import { createPopupController, type PopupView } from '../../src/popup/popup-controller.js';

const summary = {
  checkedAt: 1_700_000_000_000,
  evaluatedCount: 4,
  discardedCount: 2,
  skippedCount: 1,
  failedCount: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function view(): PopupView & {
  values: Record<string, string>;
  busy: boolean;
  protectionAvailable: boolean;
} {
  const values: Record<string, string> = {};
  return {
    values,
    busy: false,
    protectionAvailable: true,
    setText(name, value) {
      values[name] = value;
    },
    setBusy(value) {
      this.busy = value;
    },
    setProtectionAvailable(value) {
      this.protectionAvailable = value;
    },
  };
}

describe('popup controller', () => {
  it('renders and toggles current-tab protection without tab metadata', async () => {
    const popup = view();
    const sent: unknown[] = [];
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        sent.push(message);
        if (message.type === 'getPopupState') {
          return {
            settings: {
              schemaVersion: 2,
              enabled: true,
              idleMinutes: 15,
              restoreBehavior: 'native',
            },
            currentTabProtection: { supported: true, protected: false },
          };
        }
        return { currentTabProtection: { supported: true, protected: true } };
      },
    });

    await controller.load();
    expect(popup.values.protectionAction).toBe('Protect this tab');
    await controller.toggleProtection();

    expect(sent.at(-1)).toEqual({ type: 'setCurrentTabProtection', protected: true });
    expect(popup.values.protectionAction).toBe('Allow suspension');
    expect(popup.values.protectionDescription).not.toMatch(/example|https|title|domain/iu);
  });

  it('disables protection for unsupported tabs', async () => {
    const popup = view();
    const controller = createPopupController(popup, {
      async sendMessage() {
        return {
          settings: {
            schemaVersion: 2,
            enabled: true,
            idleMinutes: 15,
            restoreBehavior: 'native',
          },
          currentTabProtection: { supported: false, protected: false },
        };
      },
    });

    await controller.load();

    expect(popup.protectionAvailable).toBe(false);
  });

  it('renders an enabled state, configured idle period, and aggregate-only latest summary', async () => {
    const popup = view();
    const controller = createPopupController(
      popup,
      {
        async sendMessage() {
          return {
            settings: {
              schemaVersion: 2,
              enabled: true,
              idleMinutes: 30,
              restoreBehavior: 'native',
            },
            summary,
          };
        },
      },
      { formatCheckedAt: () => 'November 14, 2023 at 10:13 PM' },
    );

    await controller.load();

    expect(popup.values).toMatchObject({
      state: 'On',
      pauseAction: 'Pause automatic suspension',
      description: 'Inactive tabs are suspended after about 30 minutes.',
      summary:
        'Last checked: November 14, 2023 at 10:13 PM. Evaluated 4, suspended 2, skipped 1, failed 1.',
      status: '',
    });
  });

  it('runs a manual sweep and announces only its aggregate result', async () => {
    const popup = view();
    const sent: unknown[] = [];
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        sent.push(message);
        return { summary: { ...summary, discardedCount: 3, failedCount: 0 } };
      },
    });

    await controller.discardNow();

    expect(sent).toEqual([{ type: 'manualSweep' }]);
    expect(popup.values.status).toBe(
      'Sweep complete: evaluated 4, suspended 3, skipped 1, failed 0.',
    );
    expect(popup.busy).toBe(false);
  });

  it('pauses and resumes automation through the worker state transition', async () => {
    const popup = view();
    let enabled = true;
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        enabled = message.type === 'pauseAutomation' ? false : true;
        return {
          settings: { schemaVersion: 2, enabled, idleMinutes: 15, restoreBehavior: 'native' },
        };
      },
    });

    await controller.toggleAutomation();
    expect(popup.values).toMatchObject({
      state: 'Paused',
      pauseAction: 'Resume automatic suspension',
    });

    await controller.toggleAutomation();
    expect(popup.values).toMatchObject({ state: 'On', pauseAction: 'Pause automatic suspension' });
  });

  it('keeps a newer pause result when the initial load resolves afterwards', async () => {
    const popup = view();
    const initialState = deferred<{
      settings: {
        schemaVersion: 2;
        enabled: boolean;
        idleMinutes: 15;
        restoreBehavior: 'native';
      };
    }>();
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        if (message.type === 'getPopupState') return initialState.promise;
        return {
          settings: {
            schemaVersion: 2,
            enabled: false,
            idleMinutes: 15,
            restoreBehavior: 'native',
          },
        };
      },
    });

    const loading = controller.load();
    expect(popup.busy).toBe(true);
    await controller.toggleAutomation();
    initialState.resolve({
      settings: { schemaVersion: 2, enabled: true, idleMinutes: 15, restoreBehavior: 'native' },
    });
    await loading;

    expect(popup.values).toMatchObject({
      state: 'Paused',
      pauseAction: 'Resume automatic suspension',
      status: 'Automatic suspension is paused.',
    });
    expect(popup.busy).toBe(false);
  });

  it('handles corrupt saved summaries and a failed manual request without exposing tab details', async () => {
    const popup = view();
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        if (message.type === 'getPopupState') {
          return {
            settings: {
              schemaVersion: 2,
              enabled: true,
              idleMinutes: 15,
              restoreBehavior: 'native',
            },
            summary: { checkedAt: 'private title', discardedCount: 1 },
          };
        }
        throw new Error('sensitive tab title');
      },
    });

    await controller.load();
    await controller.discardNow();

    expect(popup.values.summary).toBe('No sweep has been recorded yet.');
    expect(popup.values.status).toBe(
      'The sweep could not be completed. No tab details were saved.',
    );
  });
});
