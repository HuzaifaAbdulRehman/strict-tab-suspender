import type { ExtensionMessenger, ExtensionResponse } from '../shared/messages.js';
import type { Settings, SweepSummary } from '../shared/settings.js';

export interface PopupView {
  setText(
    name:
      | 'state'
      | 'pauseAction'
      | 'description'
      | 'summary'
      | 'status'
      | 'protectionAction'
      | 'protectionDescription',
    value: string,
  ): void;
  setBusy(value: boolean): void;
  setProtectionAvailable(value: boolean): void;
}

export interface PopupController {
  load(): Promise<void>;
  discardNow(): Promise<void>;
  suspendCurrentTab(): Promise<void>;
  toggleAutomation(): Promise<void>;
  toggleProtection(): Promise<void>;
}

export interface PopupControllerOptions {
  formatCheckedAt?(checkedAt: number): string;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 3 &&
    typeof candidate.enabled === 'boolean' &&
    (candidate.idleMinutes === 15 ||
      candidate.idleMinutes === 30 ||
      candidate.idleMinutes === 60 ||
      candidate.idleMinutes === 120) &&
    (candidate.restoreBehavior === 'native' || candidate.restoreBehavior === 'click')
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
  return `Last checked: ${formatCheckedAt(value.checkedAt)}. Evaluated ${value.evaluatedCount}, suspended ${value.discardedCount}, skipped ${value.skippedCount}, failed ${value.failedCount}.`;
}

function applySettings(view: PopupView, settings: unknown): Settings | undefined {
  if (!isSettings(settings)) return undefined;
  view.setText('state', settings.enabled ? 'On' : 'Paused');
  view.setText(
    'pauseAction',
    settings.enabled ? 'Pause automatic suspension' : 'Resume automatic suspension',
  );
  view.setText(
    'description',
    `Inactive tabs are suspended after about ${settings.idleMinutes} minutes.`,
  );
  return settings;
}

export function createPopupController(
  view: PopupView,
  messenger: ExtensionMessenger,
  options: PopupControllerOptions = {},
): PopupController {
  let settings: Settings | undefined;
  let protection: { supported: boolean; protected: boolean } | undefined;
  let latestRequest = 0;
  const formatCheckedAt = options.formatCheckedAt;

  function startRequest(): number {
    latestRequest += 1;
    return latestRequest;
  }

  function isLatestRequest(request: number): boolean {
    return request === latestRequest;
  }

  function applyResponse(response: ExtensionResponse): void {
    const loadedSettings = applySettings(view, response.settings);
    if (loadedSettings !== undefined) settings = loadedSettings;
    const value = response.currentTabProtection;
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof value.supported === 'boolean' &&
      typeof value.protected === 'boolean'
    ) {
      protection = value;
      view.setProtectionAvailable(value.supported);
      view.setText('protectionAction', value.protected ? 'Allow suspension' : 'Protect this tab');
      view.setText(
        'protectionDescription',
        value.supported
          ? 'This tab may become inactive, but it will never be suspended while protected. Protection ends when you choose Allow suspension or close the tab.'
          : 'Protection is unavailable for this tab.',
      );
    } else {
      protection = undefined;
      view.setProtectionAvailable(false);
      view.setText('protectionDescription', 'Protection is unavailable for this tab.');
    }
  }

  return {
    async load() {
      const request = startRequest();
      view.setBusy(true);
      view.setText('status', '');
      try {
        const response = await messenger.sendMessage({ type: 'getPopupState' });
        if (!isLatestRequest(request)) return;
        applyResponse(response);
        view.setText('summary', formatSummary(response.summary, formatCheckedAt));
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('summary', 'No sweep has been recorded yet.');
        view.setText('status', 'Unable to load extension status.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async discardNow() {
      const request = startRequest();
      view.setBusy(true);
      view.setText('status', 'Checking eligible tabs…');
      try {
        const response = await messenger.sendMessage({ type: 'manualSweep' });
        if (!isLatestRequest(request)) return;
        if (!isSummary(response.summary)) throw new Error('invalid summary');
        view.setText(
          'status',
          `Sweep complete: evaluated ${response.summary.evaluatedCount}, suspended ${response.summary.discardedCount}, skipped ${response.summary.skippedCount}, failed ${response.summary.failedCount}.`,
        );
        view.setText('summary', formatSummary(response.summary, formatCheckedAt));
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'The sweep could not be completed. No tab details were saved.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async suspendCurrentTab() {
      const request = startRequest();
      view.setBusy(true);
      view.setText('status', 'Suspending this tab…');
      try {
        const response = await messenger.sendMessage({ type: 'suspendCurrentTab' });
        if (!isLatestRequest(request)) return;
        const statuses = {
          suspended: 'This tab is now suspended.',
          'unsupported-tab': 'This tab cannot be suspended.',
          'protected-tab': 'This tab is protected and was not suspended.',
          failed: 'Unable to suspend this tab.',
        } as const;
        const action = response.currentTabAction;
        view.setText(
          'status',
          action === 'suspended' ||
            action === 'unsupported-tab' ||
            action === 'protected-tab' ||
            action === 'failed'
            ? statuses[action]
            : statuses.failed,
        );
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to suspend this tab.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async toggleAutomation() {
      const request = startRequest();
      view.setBusy(true);
      try {
        const response = await messenger.sendMessage({
          type: settings?.enabled === false ? 'resumeAutomation' : 'pauseAutomation',
        });
        if (!isLatestRequest(request)) return;
        applyResponse(response);
        view.setText(
          'status',
          settings?.enabled ? 'Automatic suspension is on.' : 'Automatic suspension is paused.',
        );
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to update automatic suspension.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async toggleProtection() {
      const request = startRequest();
      view.setBusy(true);
      try {
        const response = await messenger.sendMessage({
          type: 'setCurrentTabProtection',
          protected: protection?.protected !== true,
        });
        if (!isLatestRequest(request)) return;
        applyResponse(response);
        if (response.actionError === 'unsupported-tab') {
          view.setText('status', 'Protection is unavailable for this tab.');
          return;
        }
        view.setText(
          'status',
          protection?.protected
            ? 'This tab is protected from automatic suspension.'
            : 'This tab may be suspended when it becomes eligible.',
        );
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to change protection for this tab.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
  };
}
