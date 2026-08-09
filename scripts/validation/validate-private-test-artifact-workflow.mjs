import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repositoryRoot, '.github/workflows/private-test-artifact.yml');
const workflow = await readFile(workflowPath, 'utf8');
const ciWorkflow = await readFile(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const tauriConfigPath = path.join(repositoryRoot, 'apps/desktop/src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, 'utf8'));
const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const cargoToml = await readFile(path.join(repositoryRoot, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8');
const tray = await readFile(
  path.join(repositoryRoot, 'apps/desktop/src-tauri/src/desktop/tray.rs'),
  'utf8',
);
const acceptance = await readFile(
  path.join(repositoryRoot, 'docs/04-operations/PRIVATE_WINDOWS_TEST_ACCEPTANCE.md'),
  'utf8',
);
const failures = [];

const canonicalAssets = new Map([
  ['apps/desktop/src-tauri/icons/32x32.png', ['0ee08c6749701f7e8185d85e3b45e7cfb6366f181cc3f1f88c63414a85e1c316', 32, 32]],
  ['apps/desktop/src-tauri/icons/128x128.png', ['7cd58de2adf28da6c53064b85fc7d04fbe4e52d8617c57103848fd02e2a45b18', 128, 128]],
  ['apps/desktop/src-tauri/icons/128x128@2x.png', ['f5250655bd77f1d95978374823f4ef77dcf1bddd5bd20d5b59611c15ba92c642', 256, 256]],
  ['apps/desktop/src-tauri/icons/icon.png', ['693ca11ed1368a2854e19b914031f3c4104e2d75187d499a6a05fbeab142959a', 512, 512]],
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeTextAsset(buffer) {
  return Buffer.from(buffer.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function readPngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, signature.length).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    return null;
  }
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const marker of [
  'name: Private Windows Test Artifact',
  'workflow_dispatch:',
  'candidate_ref:',
  'BUILD_PRIVATE_TEST_ARTIFACT',
  "runs-on: windows-latest",
  'id: candidate',
  '$resolvedSha = (git rev-parse HEAD).Trim().ToLowerInvariant()',
  '"sha=$resolvedSha" >> $env:GITHUB_OUTPUT',
  "node-version: '22.23.1'",
  'npm ci',
  'npm run product-truth:validate',
  'name: Validate native application contracts\n        env:\n          SKRIBLY_TRIAL_ENFORCED: "0"',
  'cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml',
  'name: Validate trial-enforced native configuration',
  'cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml',
  'npm run tauri -- build --bundles nsis,msi',
  './scripts/validation/verify-windows-installer-branding.ps1',
  'private_test_only = $true',
  'commit_sha = $env:RESOLVED_SHA',
  'canonical_icon_sha256',
  'branding-evidence.json',
  'Get-FileHash -Algorithm SHA256',
  'retention-days: 14',
  'actions/upload-artifact@v7',
]) {
  if (!workflow.includes(marker)) failures.push(`Private test workflow is missing: ${marker}`);
}

if (workflow.includes("commit_sha = '${{ github.sha }}'")) {
  failures.push('The artifact manifest must use the resolved checked-out SHA, not github.sha.');
}

if (rootPackage.scripts?.tauri !== 'npm --workspace @skribly/desktop run tauri --') {
  failures.push('The root tauri script must forward build arguments to the desktop workspace.');
}

for (const marker of [
  'Parse Windows installer-branding gate',
  "[scriptblock]::Create($script)",
]) {
  if (!ciWorkflow.includes(marker)) failures.push(`Windows CI is missing: ${marker}`);
}

if (tauriConfig.productName !== 'Skribli') {
  failures.push('The Tauri product name must remain Skribli for installer and shell branding.');
}

const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];
if (!cargoVersion || cargoVersion !== tauriConfig.version) {
  failures.push('Cargo.toml and tauri.conf.json application versions must match.');
}

const bundleIcons = new Set(tauriConfig.bundle?.icon ?? []);
for (const requiredIcon of ['icons/32x32.png', 'icons/128x128.png', 'icons/128x128@2x.png', 'icons/icon.ico']) {
  if (!bundleIcons.has(requiredIcon)) failures.push(`Tauri bundle icon list is missing: ${requiredIcon}`);
}

for (const property of ['installerIcon', 'uninstallerIcon']) {
  if (tauriConfig.bundle?.windows?.nsis?.[property] !== 'icons/icon.ico') {
    failures.push(`NSIS ${property} must explicitly use icons/icon.ico.`);
  }
}

if (!tray.includes('tauri::include_image!("icons/icon.png")')) {
  failures.push('The Windows tray must embed the canonical Skribli icon.png asset.');
}

for (const [relativePath, [expectedHash, expectedWidth, expectedHeight]] of canonicalAssets) {
  const buffer = await readFile(path.join(repositoryRoot, relativePath));
  if (sha256(buffer) !== expectedHash) failures.push(`Canonical Skribli asset changed unexpectedly: ${relativePath}`);
  const dimensions = readPngDimensions(buffer);
  if (!dimensions || dimensions[0] !== expectedWidth || dimensions[1] !== expectedHeight) {
    failures.push(`${relativePath} must be a ${expectedWidth}x${expectedHeight} PNG.`);
  }
}

const icoPath = path.join(repositoryRoot, 'apps/desktop/src-tauri/icons/icon.ico');
const ico = await readFile(icoPath);
if (sha256(ico) !== '93f924af38f85262f8027ee847f56eeca603c0e3081f443f05f3e2aefdf7b3f6') {
  failures.push('The canonical Skribli Windows icon.ico hash changed unexpectedly.');
}
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
  failures.push('The canonical Windows icon is not a valid ICO file.');
} else {
  const iconCount = ico.readUInt16LE(4);
  const dimensions = [];
  for (let index = 0; index < iconCount; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > ico.length) {
      failures.push('The canonical Windows icon directory is truncated.');
      break;
    }
    const width = ico[offset] === 0 ? 256 : ico[offset];
    const height = ico[offset + 1] === 0 ? 256 : ico[offset + 1];
    const bytes = ico.readUInt32LE(offset + 8);
    const imageOffset = ico.readUInt32LE(offset + 12);
    if (width !== height || bytes === 0 || imageOffset + bytes > ico.length) {
      failures.push(`The canonical Windows icon contains an invalid ${width}x${height} entry.`);
    }
    dimensions.push(width);
  }
  const expectedDimensions = [16, 24, 32, 48, 64, 256];
  if (dimensions.sort((a, b) => a - b).join(',') !== expectedDimensions.join(',')) {
    failures.push(`The canonical Windows icon must contain ${expectedDimensions.join(', ')}px layers.`);
  }
}

const canonicalVector = await readFile(
  path.join(repositoryRoot, 'assets/branding/skribly-app-icon.svg'),
);
const siteVector = await readFile(path.join(repositoryRoot, 'site/assets/skribly-note-mark-v2.svg'));
const normalizedCanonicalVector = normalizeTextAsset(canonicalVector);
const normalizedSiteVector = normalizeTextAsset(siteVector);
if (
  sha256(normalizedCanonicalVector) !==
  '2bc8f2532e617189630b654834247eed72c4c028a0bb4e2a31bdbd74590cf425'
) {
  failures.push('The canonical blank folded-note SVG changed unexpectedly.');
}
if (!normalizedCanonicalVector.equals(normalizedSiteVector)) {
  failures.push('The application and website must use the same canonical Skribli SVG.');
}

for (const marker of [
  'No Tauri logo may appear',
  'NSIS installer',
  'MSI installer',
  'installed executable',
  'Start menu',
  'taskbar',
  'tray icon',
  'uninstaller',
  'Add or Remove Programs',
  'manifest.json',
  'Get-FileHash',
]) {
  if (!acceptance.includes(marker)) failures.push(`Private Windows acceptance runbook is missing: ${marker}`);
}

for (const forbidden of [
  'softprops/action-gh-release',
  'gh release',
  'create-release',
  'actions/create-release',
  'git tag',
  'site/api/download',
  'npm publish',
  'deploy-pages',
]) {
  if (workflow.toLowerCase().includes(forbidden.toLowerCase())) {
    failures.push(`Private test workflow must not publish publicly: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error('Private test-artifact workflow validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Private test-artifact workflow validation passed.');
