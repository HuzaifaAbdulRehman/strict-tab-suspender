import { createSuspendedController, type SuspendedView } from './suspended-controller.js';

interface RuntimeApi {
  sendMessage(message: { type: 'suspensionPageReady' }): Promise<unknown>;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${id} element.`);
  return element as T;
}

const restoreButton = byId<HTMLButtonElement>('restore-tab');
const originalUrl = byId<HTMLAnchorElement>('original-url');
const status = byId<HTMLParagraphElement>('status');
const view: SuspendedView = {
  setPayload(payload) {
    document.title = payload.title;
    originalUrl.textContent = payload.originalUrl;
    originalUrl.href = payload.originalUrl;
  },
  setStatus(message) {
    status.textContent = message;
  },
  focusRestore() {
    restoreButton.focus();
  },
};
const controller = createSuspendedController(
  view,
  {
    get hash() {
      return globalThis.location.hash;
    },
    replace(url) {
      globalThis.location.replace(url);
    },
  },
  async () => {
    const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeApi } }).chrome
      ?.runtime;
    if (runtime === undefined) throw new Error('Chrome extension APIs are unavailable.');
    await runtime.sendMessage({ type: 'suspensionPageReady' });
  },
);

restoreButton.addEventListener('click', () => void controller.restore());
originalUrl.addEventListener('click', (event) => {
  event.preventDefault();
  void controller.restore();
});
void controller.load();
