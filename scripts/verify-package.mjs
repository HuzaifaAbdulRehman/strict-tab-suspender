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
  const entries = listPackageEntries(archive.files.map((file) => file.path));
  if (!entries.includes('manifest.json')) {
    throw new Error('Package must contain manifest.json at its root.');
  }
  console.log(
    `Verified ${entries.length} extension build file(s) in ${path.basename(archivePath)}.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPackage();
}
