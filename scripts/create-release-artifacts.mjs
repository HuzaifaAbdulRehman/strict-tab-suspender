import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { formatArchiveInventory, formatSha256Sums } from './release-artifacts.mjs';

export async function createReleaseArtifacts({
  archivePath,
  archiveEntries,
  outputDirectory,
  packageMetadata,
}) {
  const archiveName = path.basename(archivePath);
  const baseName = archiveName.endsWith('.zip') ? archiveName.slice(0, -4) : archiveName;
  const checksumPath = path.join(outputDirectory, `${archiveName}.sha256`);
  const contentsPath = path.join(outputDirectory, `${baseName}.contents.txt`);
  const sbomPath = path.join(outputDirectory, `${baseName}.cdx.json`);
  const digest = createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex');

  await writeFile(checksumPath, formatSha256Sums([{ digest, filename: archiveName }]));
  await writeFile(contentsPath, formatArchiveInventory(archiveEntries));
  await writeFile(
    sbomPath,
    `${JSON.stringify(
      {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
          component: {
            type: 'application',
            name: packageMetadata.name,
            version: packageMetadata.version,
            properties: [{ name: 'strict-tab-discarder:runtime-dependencies', value: 'none' }],
          },
        },
        components: [],
      },
      null,
      2,
    )}\n`,
  );

  return { checksumPath, contentsPath, sbomPath };
}
