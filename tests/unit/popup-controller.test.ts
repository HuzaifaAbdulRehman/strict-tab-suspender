import { describe, expect, it } from 'vitest';

import { createPopupController, type PopupView } from '../../src/popup/popup-controller.js';

const summary = {
  checkedAt: 1_700_000_000_000,
  evaluatedCount: 4,
  discardedCount: 2,
  skippedCount: 1,
  failedCount: 1,
};

function view(): PopupView & { values: Record<string, string>; busy: boolean } {
  const values: Record<string, string> = {};
  return {
    values,
    busy: false,
    setText(name, value) {
      values[name] = value;
    },
    setBusy(value) {
      this.busy = value;
    },
  };
}

describe('popup controller', () => {
  it('renders an enabled state, configured idle period, and aggregate-only latest summary', async () => {
    const popup = view();
    const controller = createPopupController(
      popup,
      {
        async sendMessage() {
          return { settings: { schemaVersion: 1, enabled: true, idleMinutes: 30 }, summary };
        },
      },
      { formatCheckedAt: () => 'November 14, 2023 at 10:13 PM' },
    );

    await controller.load();

    expect(popup.values).toMatchObject({
      state: 'On',
      pauseAction: 'Pause automatic discarding',
      description: 'Inactive tabs are discarded after about 30 minutes.',
      summary:
        'Last checked: November 14, 2023 at 10:13 PM. Evaluated 4, discarded 2, skipped 1, failed 1.',
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
      'Sweep complete: evaluated 4, discarded 3, skipped 1, failed 0.',
    );
    expect(popup.busy).toBe(false);
  });

  it('pauses and resumes automation through the worker state transition', async () => {
    const popup = view();
    let enabled = true;
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        enabled = message.type === 'pauseAutomation' ? false : true;
        return { settings: { schemaVersion: 1, enabled, idleMinutes: 15 } };
      },
    });

    await controller.toggleAutomation();
    expect(popup.values).toMatchObject({
      state: 'Paused',
      pauseAction: 'Resume automatic discarding',
    });

    await controller.toggleAutomation();
    expect(popup.values).toMatchObject({ state: 'On', pauseAction: 'Pause automatic discarding' });
  });

  it('handles corrupt saved summaries and a failed manual request without exposing tab details', async () => {
    const popup = view();
    const controller = createPopupController(popup, {
      async sendMessage(message) {
        if (message.type === 'getPopupState') {
          return {
            settings: { schemaVersion: 1, enabled: true, idleMinutes: 15 },
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
