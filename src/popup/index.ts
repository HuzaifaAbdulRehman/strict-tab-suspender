import { createPopupController, type PopupView } from './popup-controller.js';
import type {
  ExtensionMessenger,
  ExtensionRequest,
  ExtensionResponse,
} from '../shared/messages.js';

interface RuntimeApi {
  sendMessage(message: ExtensionRequest): Promise<ExtensionResponse>;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${id} element.`);
  return element as T;
}

function messenger(): ExtensionMessenger {
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeApi } }).chrome
    ?.runtime;
  return {
    sendMessage(message) {
      if (runtime === undefined)
        return Promise.reject(new Error('Chrome extension APIs are unavailable.'));
      return runtime.sendMessage(message);
    },
  };
}

const discardNow = byId<HTMLButtonElement>('discard-now');
const suspendCurrentTab = byId<HTMLButtonElement>('suspend-current-tab');
const pauseAction = byId<HTMLButtonElement>('pause-action');
const protectionAction = byId<HTMLButtonElement>('protect-tab');
let busy = true;
let protectionAvailable = false;

function syncDisabledState(): void {
  discardNow.disabled = busy;
  suspendCurrentTab.disabled = busy;
  pauseAction.disabled = busy;
  protectionAction.disabled = busy || !protectionAvailable;
}

const view: PopupView = {
  setText(name, value) {
    const id =
      name === 'pauseAction'
        ? 'pause-action'
        : name === 'protectionAction'
          ? 'protect-tab'
          : name === 'protectionDescription'
            ? 'protection-description'
            : name;
    byId(id).textContent = value;
  },
  setBusy(value) {
    busy = value;
    syncDisabledState();
  },
  setProtectionAvailable(value) {
    protectionAvailable = value;
    syncDisabledState();
  },
};
const controller = createPopupController(view, messenger(), {
  formatCheckedAt: (checkedAt) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      checkedAt,
    ),
});

discardNow.addEventListener('click', () => void controller.discardNow());
suspendCurrentTab.addEventListener('click', () => void controller.suspendCurrentTab());
pauseAction.addEventListener('click', () => void controller.toggleAutomation());
protectionAction.addEventListener('click', () => void controller.toggleProtection());
void controller.load();
