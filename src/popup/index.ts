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
const pauseAction = byId<HTMLButtonElement>('pause-action');
const view: PopupView = {
  setText(name, value) {
    byId(name === 'pauseAction' ? 'pause-action' : name).textContent = value;
  },
  setBusy(value) {
    discardNow.disabled = value;
    pauseAction.disabled = value;
  },
};
const controller = createPopupController(view, messenger(), {
  formatCheckedAt: (checkedAt) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      checkedAt,
    ),
});

discardNow.addEventListener('click', () => void controller.discardNow());
pauseAction.addEventListener('click', () => void controller.toggleAutomation());
void controller.load();
