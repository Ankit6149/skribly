import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repositoryRoot, '.github/workflows/private-test-artifact.yml');
const workflow = await readFile(workflowPath, 'utf8');
const failures = [];

for (const marker of [
  'name: Private Windows Test Artifact',
  'workflow_dispatch:',
  'candidate_ref:',
  'BUILD_PRIVATE_TEST_ARTIFACT',
  "runs-on: windows-latest",
  "node-version: '22.23.1'",
  'npm ci',
  'npm run product-truth:validate',
  'cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml',
  'npm run tauri -- build --bundles nsis,msi',
  'private_test_only = $true',
  'Get-FileHash -Algorithm SHA256',
  'retention-days: 14',
  'actions/upload-artifact@v7',
]) {
  if (!workflow.includes(marker)) failures.push(`Private test workflow is missing: ${marker}`);
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
