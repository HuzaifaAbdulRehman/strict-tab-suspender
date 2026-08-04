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
const expectedPermissions = ['alarms', 'storage'];
const expectedExtensionPageCsp =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'self'; connect-src 'none'";

export function validatePackageManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('Package manifest must use Manifest V3.');
  }
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)) {
    throw new Error('Package manifest permissions must be exactly alarms and storage.');
  }
  if (manifest.host_permissions !== undefined) {
    throw new Error('Package manifest must not declare host permissions.');
  }
  if (manifest.content_scripts !== undefined) {
    throw new Error('Package manifest must not declare content scripts.');
  }
  if (
    manifest.optional_permissions !== undefined ||
    manifest.optional_host_permissions !== undefined
  ) {
    throw new Error('Package manifest must not declare optional permissions.');
  }
  if (manifest.web_accessible_resources !== undefined) {
    throw new Error('Package manifest must not declare web-accessible resources.');
  }
  if (manifest.externally_connectable !== undefined) {
    throw new Error('Package manifest must not declare external connections.');
  }
  if (
    typeof manifest.content_security_policy !== 'object' ||
    manifest.content_security_policy === null ||
    manifest.content_security_policy.extension_pages !== expectedExtensionPageCsp
  ) {
    throw new Error('Package manifest must use the approved extension-page CSP.');
  }
}

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
  const manifestFile = archive.files.find((file) => file.path === 'manifest.json');
  if (manifestFile === undefined) throw new Error('Package manifest.json is missing.');
  validatePackageManifest(JSON.parse((await manifestFile.buffer()).toString('utf8')));

  for (const file of archive.files) {
    if (!/\.(?:css|html|js|json)$/iu.test(file.path)) continue;
    if (/\b(?:https?|wss?):\/\//iu.test((await file.buffer()).toString('utf8'))) {
      throw new Error(`Package contains a remote URL or code reference: ${file.path}`);
    }
  }
  console.log(
    `Verified ${entries.length} extension build file(s) in ${path.basename(archivePath)}.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPackage();
}
