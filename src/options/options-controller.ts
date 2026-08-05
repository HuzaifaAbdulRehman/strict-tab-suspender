import type { ExtensionMessenger, ExtensionResponse } from '../shared/messages.js';
import type { IdleMinutes, RestoreBehavior, Settings } from '../shared/settings.js';

export const IDLE_MINUTE_PRESETS: readonly IdleMinutes[] = [15, 30, 60, 120];

export interface OptionsView {
  setText(name: 'state' | 'status' | 'protection' | 'warning', value: string): void;
  setIdleMinutes(value: IdleMinutes): void;
  setRestoreBehavior(value: RestoreBehavior): void;
  setBusy(value: boolean): void;
}

export interface OptionalTabsPermission {
  contains(request: { permissions: ['tabs'] }): Promise<boolean>;
  request(request: { permissions: ['tabs'] }): Promise<boolean>;
  remove(request: { permissions: ['tabs'] }): Promise<boolean>;
}

export interface OptionsController {
  load(): Promise<void>;
  save(idleMinutes: number): Promise<void>;
  setRestoreBehavior(value: RestoreBehavior): Promise<void>;
  reset(): Promise<void>;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.enabled === 'boolean' &&
    IDLE_MINUTE_PRESETS.includes(candidate.idleMinutes as IdleMinutes) &&
    (candidate.restoreBehavior === 'native' || candidate.restoreBehavior === 'click')
  );
}

function applySettings(view: OptionsView, response: ExtensionResponse): void {
  if (!isSettings(response.settings)) throw new Error('invalid settings');
  view.setIdleMinutes(response.settings.idleMinutes);
  view.setRestoreBehavior(response.settings.restoreBehavior);
  view.setText('state', response.settings.enabled ? 'On' : 'Paused');
}

function applyStaticGuidance(view: OptionsView): void {
  view.setText(
    'protection',
    'Pinned and audible tabs are always protected and cannot be disabled.',
  );
  view.setText(
    'warning',
    'This extension cannot detect unsaved forms or in-memory work. Save important work first.',
  );
}

export function createOptionsController(
  view: OptionsView,
  messenger: ExtensionMessenger,
  permissions: OptionalTabsPermission = {
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
): OptionsController {
  let latestRequest = 0;

  function startRequest(): number {
    latestRequest += 1;
    return latestRequest;
  }

  function isLatestRequest(request: number): boolean {
    return request === latestRequest;
  }

  return {
    async load() {
      const request = startRequest();
      view.setBusy(true);
      view.setText('status', '');
      applyStaticGuidance(view);
      try {
        const response = await messenger.sendMessage({ type: 'getPopupState' });
        if (!isLatestRequest(request)) return;
        applySettings(view, response);
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to load settings.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async save(idleMinutes) {
      if (!IDLE_MINUTE_PRESETS.includes(idleMinutes as IdleMinutes)) {
        view.setText('status', 'Choose one of the available time limits.');
        return;
      }
      const request = startRequest();
      view.setBusy(true);
      try {
        const response = await messenger.sendMessage({
          type: 'saveSettings',
          idleMinutes: idleMinutes as IdleMinutes,
        });
        if (!isLatestRequest(request)) return;
        applySettings(view, response);
        view.setText('status', 'Settings saved locally.');
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to save settings.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async setRestoreBehavior(restoreBehavior) {
      const request = startRequest();
      view.setBusy(true);
      try {
        if (restoreBehavior === 'click') {
          const granted = await permissions.request({ permissions: ['tabs'] });
          if (!isLatestRequest(request)) return;
          if (!granted) {
            view.setRestoreBehavior('native');
            view.setText('status', 'Permission was not granted. Restore behavior was not changed.');
            return;
          }
        }

        const response = await messenger.sendMessage({
          type: 'setRestoreBehavior',
          restoreBehavior,
        });
        if (!isLatestRequest(request)) return;
        applySettings(view, response);
        if (response.actionError === 'tabs-permission-required') {
          view.setRestoreBehavior('native');
          view.setText('status', 'Permission was not granted. Restore behavior was not changed.');
          return;
        }

        if (restoreBehavior === 'native') {
          const removed = await permissions.remove({ permissions: ['tabs'] });
          if (!isLatestRequest(request)) return;
          view.setText(
            'status',
            removed
              ? 'Native restore behavior saved.'
              : 'Native behavior is saved, but Chrome still retains the tabs permission. Remove it in extension settings.',
          );
          return;
        }
        view.setText('status', 'Click-to-restore behavior saved locally.');
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to change restore behavior.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
    async reset() {
      const request = startRequest();
      view.setBusy(true);
      try {
        const response = await messenger.sendMessage({ type: 'resetSettings' });
        if (!isLatestRequest(request)) return;
        applySettings(view, response);
        const removed = await permissions.remove({ permissions: ['tabs'] });
        if (!isLatestRequest(request)) return;
        view.setText(
          'status',
          removed
            ? 'Settings reset to defaults.'
            : 'Settings reset, but Chrome still retains the tabs permission. Remove it in extension settings.',
        );
      } catch {
        if (!isLatestRequest(request)) return;
        view.setText('status', 'Unable to reset settings.');
      } finally {
        if (isLatestRequest(request)) view.setBusy(false);
      }
    },
  };
}
