import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'src');
const outputDirectory = path.join(root, 'dist');

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTypeScriptFiles(entryPath);
      return entry.name.endsWith('.ts') ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function copyStaticFiles(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await mkdir(destinationPath, { recursive: true });
        await copyStaticFiles(sourcePath, destinationPath);
      } else if (!entry.name.endsWith('.ts')) {
        await cp(sourcePath, destinationPath);
      }
    }),
  );
}

export async function buildExtension() {
  await rm(outputDirectory, { recursive: true, force: true });

  try {
    await stat(path.join(sourceDirectory, 'manifest.json'));
  } catch {
    console.log('No extension source is present; foundation build completed without artifacts.');
    return;
  }

  await mkdir(outputDirectory, { recursive: true });
  await copyStaticFiles(sourceDirectory, outputDirectory);
  const entryPoints = await findTypeScriptFiles(sourceDirectory);

  if (entryPoints.length > 0) {
    await build({
      entryPoints,
      outdir: outputDirectory,
      outbase: sourceDirectory,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['chrome121'],
      sourcemap: false,
    });
  }
}

await buildExtension();
