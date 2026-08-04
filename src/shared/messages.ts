import type { IdleMinutes } from './settings.js';

export type ExtensionRequest =
  | { type: 'getPopupState' }
  | { type: 'manualSweep' }
  | { type: 'pauseAutomation' }
  | { type: 'resumeAutomation' }
  | { type: 'saveSettings'; idleMinutes: IdleMinutes }
  | { type: 'resetSettings' };

export interface ExtensionResponse {
  settings?: unknown;
  summary?: unknown;
}

export interface ExtensionMessenger {
  sendMessage(message: ExtensionRequest): Promise<ExtensionResponse>;
}
