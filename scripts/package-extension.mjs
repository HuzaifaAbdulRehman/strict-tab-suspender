import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

import { createReleaseArtifacts } from './create-release-artifacts.mjs';
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

async function listDistributionFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        return listDistributionFiles(path.join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );
  return files.flat();
}

async function createArchive() {
  await rm(packageDirectory, { recursive: true, force: true });
  await mkdir(packageDirectory, { recursive: true });
  const distributionFiles = await listDistributionFiles(distributionDirectory);
  const archiveEntries = listPackageEntries(distributionFiles);
  const archiveFiles = await Promise.all(
    distributionFiles
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map(async (file) => ({
        file,
        contents: await readFile(path.join(distributionDirectory, file)),
      })),
  );

  await new Promise((resolve, reject) => {
    const output = createWriteStream(packagePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const { file, contents } of archiveFiles) {
      archive.append(contents, {
        name: file.replaceAll('\\', '/'),
        date: new Date('1980-01-01T00:00:00.000Z'),
        mode: 0o100644,
      });
    }
    archive.finalize();
  });

  await createReleaseArtifacts({
    archivePath: packagePath,
    archiveEntries,
    outputDirectory: packageDirectory,
    packageMetadata,
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
