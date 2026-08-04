import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import unzipper from 'unzipper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const packagePath = path.join(
  root,
  'package',
  `strict-tab-suspender-${packageMetadata.version}.zip`,
);
const expectedPackageEntries = new Set([
  'manifest.json',
  'background/eligibility.js',
  'background/service-worker.js',
  'background/sweep.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'options/index.html',
  'options/index.js',
  'options/options-controller.js',
  'options/styles.css',
  'popup/index.html',
  'popup/index.js',
  'popup/popup-controller.js',
  'popup/styles.css',
  'shared/messages.js',
  'shared/settings.js',
]);

export function listPackageEntries(entries) {
  const normalizedEntries = entries.map((entry) => entry.replaceAll('\\', '/'));
  if (!normalizedEntries.includes('manifest.json')) {
    throw new Error('Package must contain manifest.json at its root.');
  }

  const seen = new Set();
  for (const entry of entries) {
    const normalized = entry.replaceAll('\\', '/');
    if (
      normalized.startsWith('/') ||
      normalized.includes('../') ||
      normalized === '..' ||
      path.isAbsolute(entry)
    ) {
      throw new Error(`Package contains an unsafe entry: ${entry}`);
    }
    if (!expectedPackageEntries.has(normalized)) {
      throw new Error(`Package contains an unapproved built extension file: ${entry}`);
    }
    if (seen.has(normalized)) throw new Error(`Package contains a duplicate entry: ${entry}`);
    seen.add(normalized);
  }
  for (const expectedEntry of expectedPackageEntries) {
    if (!seen.has(expectedEntry)) {
      throw new Error(`Package is missing an expected built extension file: ${expectedEntry}`);
    }
  }
  return normalizedEntries;
}

export async function verifyPackage(archivePath = packagePath) {
  if (!existsSync(archivePath)) {
    console.log(
      'No extension package is present; package verification is deferred until implementation.',
    );
    return;
  }

  const archive = await unzipper.Open.file(archivePath);
  const entries = listPackageEntries(
    archive.files.filter((file) => !file.path.endsWith('/')).map((file) => file.path),
  );
  console.log(
    `Verified ${entries.length} extension build file(s) in ${path.basename(archivePath)}.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPackage();
}
