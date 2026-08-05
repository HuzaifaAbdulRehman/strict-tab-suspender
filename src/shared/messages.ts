import type { IdleMinutes, RestoreBehavior } from './settings.js';

export type ExtensionRequest =
  | { type: 'getPopupState' }
  | { type: 'manualSweep' }
  | { type: 'pauseAutomation' }
  | { type: 'resumeAutomation' }
  | { type: 'saveSettings'; idleMinutes: IdleMinutes }
  | { type: 'setRestoreBehavior'; restoreBehavior: RestoreBehavior }
  | { type: 'setCurrentTabProtection'; protected: boolean }
  | { type: 'suspensionPageReady' }
  | { type: 'resetSettings' };

export interface ExtensionResponse {
  settings?: unknown;
  summary?: unknown;
  tabsPermissionGranted?: boolean;
  currentTabProtection?: { supported: boolean; protected: boolean };
  actionError?: 'tabs-permission-required' | 'unsupported-tab';
}

export interface ExtensionMessenger {
  sendMessage(message: ExtensionRequest): Promise<ExtensionResponse>;
}
