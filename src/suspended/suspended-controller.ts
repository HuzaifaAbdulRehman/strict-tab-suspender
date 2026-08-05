import { readSuspendedPayloadFromHash, type SuspendedPayload } from '../shared/suspended-url.js';

export interface SuspendedView {
  setPayload(payload: SuspendedPayload): void;
  setStatus(message: string): void;
  focusRestore(): void;
}

export interface LocationPort {
  hash: string;
  replace(url: string): void;
}

export interface SuspendedController {
  load(): Promise<void>;
  restore(): Promise<void>;
}

export function createSuspendedController(
  view: SuspendedView,
  location: LocationPort,
  notifyReady: () => Promise<void>,
): SuspendedController {
  return {
    async load() {
      const payload = readSuspendedPayloadFromHash(location.hash);
      if (payload === undefined) {
        view.setStatus('This suspended address is invalid and was not opened.');
        view.focusRestore();
        return;
      }
      view.setPayload(payload);
      try {
        await notifyReady();
      } catch {
        // Restoration remains available even when the worker is asleep or unavailable.
      }
      view.focusRestore();
    },
    async restore() {
      const payload = readSuspendedPayloadFromHash(location.hash);
      if (payload === undefined) {
        view.setStatus('This suspended address is invalid and was not opened.');
        return;
      }
      location.replace(payload.originalUrl);
    },
  };
}
