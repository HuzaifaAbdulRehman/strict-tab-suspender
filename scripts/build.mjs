import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'src');
const outputDirectory = path.join(root, 'dist');
const approvedTypeScriptEntryPoints = new Set([
  'background/eligibility.ts',
  'background/service-worker.ts',
  'background/suspension.ts',
  'background/sweep.ts',
  'options/index.ts',
  'options/options-controller.ts',
  'options/settings-navigation.ts',
  'popup/index.ts',
  'popup/popup-controller.ts',
  'shared/messages.ts',
  'shared/settings.ts',
  'shared/suspended-url.ts',
  'suspended/index.ts',
  'suspended/suspended-controller.ts',
]);

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
  const discoveredEntryPoints = new Set(
    entryPoints.map((entry) => path.relative(sourceDirectory, entry).replaceAll('\\', '/')),
  );
  for (const entry of discoveredEntryPoints) {
    if (!approvedTypeScriptEntryPoints.has(entry)) {
      throw new Error(`Build contains an unapproved TypeScript entry point: ${entry}`);
    }
  }
  for (const entry of approvedTypeScriptEntryPoints) {
    if (!discoveredEntryPoints.has(entry)) {
      throw new Error(`Build is missing an approved TypeScript entry point: ${entry}`);
    }
  }

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
