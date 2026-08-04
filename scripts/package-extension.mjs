import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

import { listPackageEntries } from './verify-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distributionDirectory = path.join(root, 'dist');
const packageDirectory = path.join(root, 'package');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const packagePath = path.join(
  packageDirectory,
  `strict-tab-suspender-${packageMetadata.version}.zip`,
);

async function hasManifest() {
  try {
    await stat(path.join(distributionDirectory, 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

async function createArchive() {
  await rm(packageDirectory, { recursive: true, force: true });
  await mkdir(packageDirectory, { recursive: true });
  const entries = await readdir(distributionDirectory, { recursive: true });
  listPackageEntries(entries.filter((entry) => !entry.endsWith(path.sep)));

  await new Promise((resolve, reject) => {
    const output = createWriteStream(packagePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(distributionDirectory, false);
    archive.finalize();
  });
}

if (await hasManifest()) {
  await createArchive();
  console.log(`Created ${path.relative(root, packagePath)}.`);
} else {
  console.log(
    'No built extension manifest is present; package creation is deferred until implementation.',
  );
}
