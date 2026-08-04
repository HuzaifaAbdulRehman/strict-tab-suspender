import type { ExtensionMessenger, ExtensionResponse } from '../shared/messages.js';
import type { Settings, SweepSummary } from '../shared/settings.js';

export interface PopupView {
  setText(
    name: 'state' | 'pauseAction' | 'description' | 'summary' | 'status',
    value: string,
  ): void;
  setBusy(value: boolean): void;
}

export interface PopupController {
  load(): Promise<void>;
  discardNow(): Promise<void>;
  toggleAutomation(): Promise<void>;
}

export interface PopupControllerOptions {
  formatCheckedAt?(checkedAt: number): string;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.enabled === 'boolean' &&
    (candidate.idleMinutes === 15 ||
      candidate.idleMinutes === 30 ||
      candidate.idleMinutes === 60 ||
      candidate.idleMinutes === 120)
  );
}

function isSummary(value: unknown): value is SweepSummary {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ['checkedAt', 'evaluatedCount', 'discardedCount', 'skippedCount', 'failedCount'].every(
    (key) => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]),
  );
}

export function formatSummary(
  value: unknown,
  formatCheckedAt: (checkedAt: number) => string = (checkedAt) =>
    new Date(checkedAt).toLocaleString(),
): string {
  if (!isSummary(value)) return 'No sweep has been recorded yet.';
  return `Last checked: ${formatCheckedAt(value.checkedAt)}. Evaluated ${value.evaluatedCount}, discarded ${value.discardedCount}, skipped ${value.skippedCount}, failed ${value.failedCount}.`;
}

function applySettings(view: PopupView, settings: unknown): Settings | undefined {
  if (!isSettings(settings)) return undefined;
  view.setText('state', settings.enabled ? 'On' : 'Paused');
  view.setText(
    'pauseAction',
    settings.enabled ? 'Pause automatic discarding' : 'Resume automatic discarding',
  );
  view.setText(
    'description',
    `Inactive tabs are discarded after about ${settings.idleMinutes} minutes.`,
  );
  return settings;
}

export function createPopupController(
  view: PopupView,
  messenger: ExtensionMessenger,
  options: PopupControllerOptions = {},
): PopupController {
  let settings: Settings | undefined;
  const formatCheckedAt = options.formatCheckedAt;

  function applyResponse(response: ExtensionResponse): void {
    const loadedSettings = applySettings(view, response.settings);
    if (loadedSettings !== undefined) settings = loadedSettings;
  }

  return {
    async load() {
      view.setText('status', '');
      try {
        const response = await messenger.sendMessage({ type: 'getPopupState' });
        applyResponse(response);
        view.setText('summary', formatSummary(response.summary, formatCheckedAt));
      } catch {
        view.setText('summary', 'No sweep has been recorded yet.');
        view.setText('status', 'Unable to load extension status.');
      }
    },
    async discardNow() {
      view.setBusy(true);
      view.setText('status', 'Checking eligible tabs…');
      try {
        const response = await messenger.sendMessage({ type: 'manualSweep' });
        if (!isSummary(response.summary)) throw new Error('invalid summary');
        view.setText(
          'status',
          `Sweep complete: evaluated ${response.summary.evaluatedCount}, discarded ${response.summary.discardedCount}, skipped ${response.summary.skippedCount}, failed ${response.summary.failedCount}.`,
        );
        view.setText('summary', formatSummary(response.summary, formatCheckedAt));
      } catch {
        view.setText('status', 'The sweep could not be completed. No tab details were saved.');
      } finally {
        view.setBusy(false);
      }
    },
    async toggleAutomation() {
      view.setBusy(true);
      try {
        const response = await messenger.sendMessage({
          type: settings?.enabled === false ? 'resumeAutomation' : 'pauseAutomation',
        });
        applyResponse(response);
        view.setText(
          'status',
          settings?.enabled ? 'Automatic discarding is on.' : 'Automatic discarding is paused.',
        );
      } catch {
        view.setText('status', 'Unable to update automatic discarding.');
      } finally {
        view.setBusy(false);
      }
    },
  };
}
