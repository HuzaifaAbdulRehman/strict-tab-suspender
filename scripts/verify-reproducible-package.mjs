import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const archivePath = path.join(root, 'package', `strict-tab-suspender-${metadata.version}.zip`);

function buildPackage() {
  const result = spawnSync(process.execPath, ['scripts/package-extension.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

async function digest() {
  return createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex');
}

buildPackage();
const first = await digest();
buildPackage();
const second = await digest();
if (first !== second) throw new Error(`Package is not reproducible: ${first} != ${second}`);
console.log(`Verified reproducible package SHA-256: ${first}`);
