import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isDeployableWebPath,
  normalizeRepositoryPath,
  resolveDiffBase,
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
    'scripts/validation/vercel-ignore.mjs',
    'site/vercel.json',
    'vercel.json',
  ];

  for (const file of deployable) {
    assert.equal(isDeployableWebPath(file), true, `${file} must continue the build`);
  }
  assert.equal(shouldDeploy(deployable), true);
});

test('configures the ignored build command at both supported Vercel project roots', async () => {
  const repositoryConfig = JSON.parse(await readFile('vercel.json', 'utf8'));
  const siteConfig = JSON.parse(await readFile('site/vercel.json', 'utf8'));

  assert.equal(
    repositoryConfig.ignoreCommand,
    'node scripts/validation/vercel-ignore.mjs'
  );
  assert.equal(
    siteConfig.ignoreCommand,
    'node ../scripts/validation/vercel-ignore.mjs'
  );
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

test('first preview compares with origin/main when no deployment SHA exists', () => {
  const calls = [];
  const result = resolveDiffBase({
    environment: {
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'fix/first-preview',
    },
    git(args) {
      calls.push(args);
      if (calls.length === 1) {
        throw new Error('remote tracking ref is absent from the clone');
      }
      if (args[0] === 'fetch') return '';
      return '1234567890abcdef1234567890abcdef12345678\n';
    },
  });

  assert.equal(result.baseSha, '1234567890abcdef1234567890abcdef12345678');
  assert.match(result.reason, /comparing preview branch to origin\/main/u);
  assert.deepEqual(calls, [
    ['rev-parse', '--verify', 'refs/remotes/origin/main'],
    [
      'fetch',
      '--no-tags',
      '--depth=1',
      'origin',
      'refs/heads/main:refs/remotes/origin/main',
    ],
    ['rev-parse', '--verify', 'refs/remotes/origin/main'],
  ]);
});

test('first non-web preview uses the base fallback and skips', () => {
  let comparedWith;
  const exitCode = runIgnoreCommand({
    environment: {
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'chore/first-preview',
    },
    argv: [],
    resolveBase: () => ({
      baseSha: '1234567890abcdef1234567890abcdef12345678',
      reason: 'preview fallback',
    }),
    readPaths(baseSha) {
      comparedWith = baseSha;
      return ['.github/workflows/branch-cleanup.yml'];
    },
  });

  assert.equal(comparedWith, '1234567890abcdef1234567890abcdef12345678');
  assert.equal(exitCode, 0);
});

test('first web preview uses the base fallback and deploys', () => {
  assert.equal(
    runIgnoreCommand({
      environment: {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'feat/first-web-preview',
      },
      argv: [],
      resolveBase: () => ({ baseSha: 'base', reason: 'preview fallback' }),
      readPaths: () => ['site/index.html'],
    }),
    1
  );
});

test('force flag and unsafe unknown diffs fail open to a deployment', () => {
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
    'missing previous SHA and branch must not suppress a required deployment'
  );

  assert.equal(
    runIgnoreCommand({
      environment: {
        VERCEL_ENV: 'production',
        VERCEL_GIT_COMMIT_REF: 'main',
      },
      argv: [],
    }),
    1,
    'a first production deployment must fail open when no previous SHA exists'
  );
});
