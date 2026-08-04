import type { ExtensionMessenger, ExtensionResponse } from '../shared/messages.js';
import type { IdleMinutes, Settings } from '../shared/settings.js';

export const IDLE_MINUTE_PRESETS: readonly IdleMinutes[] = [15, 30, 60, 120];

export interface OptionsView {
  setText(name: 'state' | 'status' | 'protection' | 'warning', value: string): void;
  setIdleMinutes(value: IdleMinutes): void;
  setBusy(value: boolean): void;
}

export interface OptionsController {
  load(): Promise<void>;
  save(idleMinutes: number): Promise<void>;
  reset(): Promise<void>;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.enabled === 'boolean' &&
    IDLE_MINUTE_PRESETS.includes(candidate.idleMinutes as IdleMinutes)
  );
}

function applySettings(view: OptionsView, response: ExtensionResponse): void {
  if (!isSettings(response.settings)) throw new Error('invalid settings');
  view.setIdleMinutes(response.settings.idleMinutes);
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
): OptionsController {
  return {
    async load() {
      view.setText('status', '');
      applyStaticGuidance(view);
      try {
        applySettings(view, await messenger.sendMessage({ type: 'getPopupState' }));
      } catch {
        view.setText('status', 'Unable to load settings.');
      }
    },
    async save(idleMinutes) {
      if (!IDLE_MINUTE_PRESETS.includes(idleMinutes as IdleMinutes)) {
        view.setText('status', 'Choose one of the available time limits.');
        return;
      }
      view.setBusy(true);
      try {
        applySettings(
          view,
          await messenger.sendMessage({
            type: 'saveSettings',
            idleMinutes: idleMinutes as IdleMinutes,
          }),
        );
        view.setText('status', 'Settings saved locally.');
      } catch {
        view.setText('status', 'Unable to save settings.');
      } finally {
        view.setBusy(false);
      }
    },
    async reset() {
      view.setBusy(true);
      try {
        applySettings(view, await messenger.sendMessage({ type: 'resetSettings' }));
        view.setText('status', 'Settings reset to defaults.');
      } catch {
        view.setText('status', 'Unable to reset settings.');
      } finally {
        view.setBusy(false);
      }
    },
  };
}
