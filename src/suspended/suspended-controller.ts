import { readOriginalUrlFromHash } from '../shared/suspended-url.js';

export interface SuspendedView {
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
      try {
        await notifyReady();
      } catch {
        // Restoration remains available even when the worker is asleep or unavailable.
      }
      view.focusRestore();
    },
    async restore() {
      const originalUrl = readOriginalUrlFromHash(location.hash);
      if (originalUrl === undefined) {
        view.setStatus('This suspended address is invalid and was not opened.');
        return;
      }
      location.replace(originalUrl);
    },
  };
}
