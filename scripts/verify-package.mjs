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
const approvedDirectories = new Set([
  'background',
  'popup',
  'options',
  'assets',
  'icons',
  '_locales',
]);
const approvedExtension = /\.(?:css|gif|html|jpeg|jpg|js|json|mjs|png|svg|ttf|webp|woff|woff2)$/u;

function isApprovedBuiltFile(entry) {
  if (entry === 'manifest.json') return true;

  const [topLevelDirectory] = entry.split('/');
  return (
    topLevelDirectory !== undefined &&
    approvedDirectories.has(topLevelDirectory) &&
    approvedExtension.test(entry)
  );
}

export function listPackageEntries(entries) {
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
    if (!isApprovedBuiltFile(normalized)) {
      throw new Error(`Package contains an unapproved built extension file: ${entry}`);
    }
  }
  if (!entries.includes('manifest.json')) {
    throw new Error('Package must contain manifest.json at its root.');
  }
  return entries;
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
