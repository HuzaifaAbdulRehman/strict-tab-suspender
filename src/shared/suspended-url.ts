export const SUSPENDED_PAGE_PATH = 'suspended/index.html';
export const MAX_SUSPENDED_URL_LENGTH = 65_536;

const FALLBACK_TITLE = 'Suspended tab';
const MAX_TITLE_CODE_POINTS = 256;
const CHROME_EXTENSION_ID_LENGTH = 32;
const SUSPENDED_PAGE_BASE_URL_LENGTH =
  'chrome-extension://'.length + CHROME_EXTENSION_ID_LENGTH + 1 + SUSPENDED_PAGE_PATH.length;
const MAX_SUSPENDED_HASH_LENGTH = MAX_SUSPENDED_URL_LENGTH - SUSPENDED_PAGE_BASE_URL_LENGTH;

export interface SuspendedPayload {
  originalUrl: string;
  title: string;
}

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

function sanitizeTitle(value: string): string {
  const normalized = value
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const limited = [...normalized].slice(0, MAX_TITLE_CODE_POINTS).join('');
  return limited === '' ? FALLBACK_TITLE : limited;
}

export function buildSuspendedPageUrl(
  originalUrl: string,
  title: string,
  extensionPageUrl: string,
): string | undefined {
  if (validatedHttpUrl(originalUrl) === undefined) return undefined;

  try {
    const page = new URL(extensionPageUrl);
    const parameters = new URLSearchParams({
      v: '2',
      url: originalUrl,
      title: sanitizeTitle(title),
    });
    page.hash = parameters.toString();
    const value = page.toString();
    return value.length <= MAX_SUSPENDED_URL_LENGTH ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readSuspendedPayloadFromHash(hash: string): SuspendedPayload | undefined {
  if (!hash.startsWith('#') || hash.length > MAX_SUSPENDED_HASH_LENGTH) return undefined;
  try {
    const parameters = new URLSearchParams(hash.slice(1));
    if (parameters.get('v') !== '2') return undefined;
    const originalUrl = parameters.get('url');
    if (originalUrl === null || validatedHttpUrl(originalUrl) === undefined) return undefined;
    return {
      originalUrl,
      title: sanitizeTitle(parameters.get('title') ?? ''),
    };
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
