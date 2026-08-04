import { createOptionsController, type OptionsView } from './options-controller.js';
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

const form = byId<HTMLFormElement>('settings-form');
const saveButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
const resetButton = byId<HTMLButtonElement>('open-reset');
const dialog = byId<HTMLDialogElement>('reset-dialog');
const confirmReset = byId<HTMLButtonElement>('confirm-reset');
const cancelReset = byId<HTMLButtonElement>('cancel-reset');
const messenger: ExtensionMessenger = {
  sendMessage(message) {
    const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeApi } }).chrome
      ?.runtime;
    return runtime === undefined
      ? Promise.reject(new Error('Chrome extension APIs are unavailable.'))
      : runtime.sendMessage(message);
  },
};
const view: OptionsView = {
  setText(name, value) {
    byId(name).textContent = value;
  },
  setIdleMinutes(value) {
    const input = form.querySelector<HTMLInputElement>(
      `input[name="idleMinutes"][value="${value}"]`,
    );
    if (input !== null) input.checked = true;
  },
  setBusy(value) {
    if (saveButton !== null) saveButton.disabled = value;
    resetButton.disabled = value;
    confirmReset.disabled = value;
  },
};
const controller = createOptionsController(view, messenger);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const selected = form.querySelector<HTMLInputElement>('input[name="idleMinutes"]:checked');
  if (selected !== null) void controller.save(Number(selected.value));
});
resetButton.addEventListener('click', () => dialog.showModal());
cancelReset.addEventListener('click', () => dialog.close());
confirmReset.addEventListener('click', () => {
  dialog.close();
  void controller.reset();
});
void controller.load();
