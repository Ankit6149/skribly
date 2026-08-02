import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

const failures = [];
const readme = await read('README.md');
const cargoManifest = await read('apps/desktop/src-tauri/Cargo.toml');

const requiredReadmeClaims = [
  'Skribli hides only after the latest non-empty draft is durably saved.',
  'The current build does **not** leave a floating dot, attached tab, permanent toolbar, or full-screen interactive overlay',
  'macOS support;',
  'Skribli is **not currently available for download**.',
];

for (const claim of requiredReadmeClaims) {
  if (!readme.includes(claim)) {
    failures.push(`README.md is missing required current-product claim: ${claim}`);
  }
}

const retiredReadmeClaims = [
  'Close it into a small attached note tab.',
  'The transparent overlay must remain click-through everywhere except the exact note or editor bounds.',
  'empty overlay space does not capture mouse input',
  'Native `RegisterHotKey`, WinEvent hooks, per-monitor DPI handling, and selective `WM_NCHITTEST` click-through',
];

for (const claim of retiredReadmeClaims) {
  if (readme.includes(claim)) {
    failures.push(`README.md contains retired product behavior: ${claim}`);
  }
}

const expectedCargoDescription = 'description = "Local-first contextual typed notes for Windows"';
if (!cargoManifest.includes(expectedCargoDescription)) {
  failures.push(`Cargo package description must be: ${expectedCargoDescription}`);
}

if (/^description\s*=.*macOS/im.test(cargoManifest)) {
  failures.push('Cargo package description must not claim current macOS support.');
}

if (failures.length > 0) {
  console.error('Product truth validation failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Product truth validation passed.');
