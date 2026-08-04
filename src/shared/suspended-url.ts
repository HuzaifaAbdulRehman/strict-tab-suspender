export const SUSPENDED_PAGE_PATH = 'suspended/index.html';
export const MAX_SUSPENDED_URL_LENGTH = 65_536;

function validatedHttpUrl(value: string): URL | undefined {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function buildSuspendedPageUrl(
  originalUrl: string,
  extensionPageUrl: string,
): string | undefined {
  if (validatedHttpUrl(originalUrl) === undefined) return undefined;

  try {
    const page = new URL(extensionPageUrl);
    page.hash = `v=1&url=${encodeURIComponent(originalUrl)}`;
    const value = page.toString();
    return value.length <= MAX_SUSPENDED_URL_LENGTH ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readOriginalUrlFromHash(hash: string): string | undefined {
  if (!hash.startsWith('#')) return undefined;
  try {
    const parameters = new URLSearchParams(hash.slice(1));
    if (parameters.get('v') !== '1') return undefined;
    const originalUrl = parameters.get('url');
    if (originalUrl === null || validatedHttpUrl(originalUrl) === undefined) return undefined;
    return originalUrl;
  } catch {
    return undefined;
  }
}

export function isSuspendedPageUrl(value: string, extensionPageUrl: string): boolean {
  try {
    const candidate = new URL(value);
    const expected = new URL(extensionPageUrl);
    return (
      candidate.protocol === expected.protocol &&
      candidate.host === expected.host &&
      candidate.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}
