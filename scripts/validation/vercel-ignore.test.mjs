import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDeployableWebPath,
  normalizeRepositoryPath,
  runIgnoreCommand,
  shouldDeploy,
} from './vercel-ignore.mjs';

test('normalizes Windows and relative repository paths', () => {
  assert.equal(normalizeRepositoryPath('.\\site\\index.html'), 'site/index.html');
  assert.equal(normalizeRepositoryPath('./api/license.js'), 'api/license.js');
  assert.equal(normalizeRepositoryPath('  README.md  '), 'README.md');
});

test('deploys for website, API, public, and deployment configuration inputs', () => {
  const deployable = [
    'site/index.html',
    'site/assets/skribly-icon.svg',
    'api/verify-license.mjs',
    'public/robots.txt',
    'package.json',
    'package-lock.json',
    '.nvmrc',
    'vercel.json',
  ];

  for (const file of deployable) {
    assert.equal(isDeployableWebPath(file), true, `${file} must continue the build`);
  }
  assert.equal(shouldDeploy(deployable), true);
});

test('skips Rust, desktop, native acceptance, and unrelated documentation changes', () => {
  const ignored = [
    'apps/desktop/src-tauri/src/lib.rs',
    'apps/desktop/src/features/skribs/SkribComposer.tsx',
    'docs/04-operations/WIN_EVENT_ACCEPTANCE.md',
    'scripts/validation/storage-acceptance.ps1',
    'README.md',
    '.github/workflows/ci.yml',
  ];

  for (const file of ignored) {
    assert.equal(isDeployableWebPath(file), false, `${file} must not consume a preview`);
  }
  assert.equal(shouldDeploy(ignored), false);
});

test('prefix matching does not accept lookalike paths', () => {
  assert.equal(isDeployableWebPath('website/index.html'), false);
  assert.equal(isDeployableWebPath('site-notes/design.md'), false);
  assert.equal(isDeployableWebPath('packages/example/package.json'), false);
});

test('explicit path fixtures use Vercel exit semantics', () => {
  assert.equal(
    runIgnoreCommand({
      environment: {},
      argv: ['--paths', 'apps/desktop/src-tauri/src/lib.rs', 'README.md'],
    }),
    0,
    'exit 0 tells Vercel to skip the build'
  );

  assert.equal(
    runIgnoreCommand({
      environment: {},
      argv: ['--paths', 'site/index.html'],
    }),
    1,
    'exit 1 tells Vercel to continue the build'
  );
});

test('force flag and unknown diff both fail open to a deployment', () => {
  assert.equal(
    runIgnoreCommand({
      environment: { SKRIBLY_FORCE_VERCEL_BUILD: '1' },
      argv: [],
    }),
    1
  );

  assert.equal(
    runIgnoreCommand({
      environment: {},
      argv: [],
    }),
    1,
    'missing previous SHA must never suppress a potentially required deployment'
  );
});
