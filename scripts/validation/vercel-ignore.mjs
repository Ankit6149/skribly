import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEPLOYABLE_PREFIXES = Object.freeze(['site/', 'api/', 'public/']);
export const DEFAULT_BASE_BRANCH = 'main';
export const BASE_REPOSITORY_URL =
  'https://github.com/Ankit6149/skribly.git';
export const DEPLOYABLE_FILES = Object.freeze(
  new Set([
    '.nvmrc',
    'package.json',
    'package-lock.json',
    'scripts/validation/vercel-ignore.mjs',
    'site/vercel.json',
    'vercel.json',
  ])
);

export function normalizeRepositoryPath(value) {
  return String(value ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

export function isDeployableWebPath(value) {
  const repositoryPath = normalizeRepositoryPath(value);
  if (!repositoryPath) return false;
  if (DEPLOYABLE_FILES.has(repositoryPath)) return true;
  return DEPLOYABLE_PREFIXES.some((prefix) => repositoryPath.startsWith(prefix));
}

export function shouldDeploy(changedPaths) {
  return changedPaths.some(isDeployableWebPath);
}

function executeGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isUsableSha(value) {
  return Boolean(value && !/^0+$/u.test(value));
}

export function resolveDiffBase({
  environment = process.env,
  git = executeGit,
} = {}) {
  const previousSha = environment.VERCEL_GIT_PREVIOUS_SHA;
  if (isUsableSha(previousSha)) {
    return { baseSha: previousSha, reason: '' };
  }

  const commitRef = String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim();
  if (!commitRef) {
    throw new Error(
      'A previous deployment SHA and current Git branch are not available.'
    );
  }

  if (
    commitRef === DEFAULT_BASE_BRANCH ||
    environment.VERCEL_ENV === 'production'
  ) {
    throw new Error(
      'A previous deployment SHA is not available for the production branch.'
    );
  }

  const remoteBaseRef = `refs/remotes/skribli-vercel/${DEFAULT_BASE_BRANCH}`;
  let baseSha;

  try {
    baseSha = git(['rev-parse', '--verify', remoteBaseRef]).trim();
  } catch {
    git([
      'fetch',
      '--no-tags',
      '--depth=1',
      BASE_REPOSITORY_URL,
      `refs/heads/${DEFAULT_BASE_BRANCH}:${remoteBaseRef}`,
    ]);
    baseSha = git(['rev-parse', '--verify', remoteBaseRef]).trim();
  }

  if (!isUsableSha(baseSha)) {
    throw new Error(`Could not resolve origin/${DEFAULT_BASE_BRANCH}.`);
  }

  return {
    baseSha,
    reason:
      `previous deployment SHA unavailable; comparing preview branch to the ` +
      `repository ${DEFAULT_BASE_BRANCH} tree.`,
  };
}

export function readChangedPaths(baseSha, headSha = 'HEAD') {
  if (!isUsableSha(baseSha)) {
    throw new Error('A comparison SHA is not available.');
  }

  const output = executeGit(['diff', '--name-only', baseSha, headSha, '--']);

  return output
    .split(/\r?\n/u)
    .map(normalizeRepositoryPath)
    .filter(Boolean);
}

function printDecision(deploy, changedPaths, reason) {
  if (reason) {
    console.log(`[skribli-vercel] ${reason}`);
  }

  if (changedPaths.length > 0) {
    console.log(`[skribli-vercel] changed: ${changedPaths.join(', ')}`);
  }

  console.log(
    deploy
      ? '[skribli-vercel] deployable web input changed; continue Vercel build.'
      : '[skribli-vercel] no deployable web input changed; skip Vercel build.'
  );
}

export function runIgnoreCommand({
  environment = process.env,
  argv = process.argv.slice(2),
  resolveBase = resolveDiffBase,
  readPaths = readChangedPaths,
} = {}) {
  if (environment.SKRIBLY_FORCE_VERCEL_BUILD === '1') {
    printDecision(true, [], 'SKRIBLY_FORCE_VERCEL_BUILD=1 was provided.');
    return 1;
  }

  const fixtureIndex = argv.indexOf('--paths');
  if (fixtureIndex >= 0) {
    const changedPaths = argv.slice(fixtureIndex + 1);
    const deploy = shouldDeploy(changedPaths);
    printDecision(deploy, changedPaths, 'evaluating explicit path fixture');
    return deploy ? 1 : 0;
  }

  try {
    const { baseSha, reason } = resolveBase({ environment });
    const changedPaths = readPaths(baseSha);
    const deploy = shouldDeploy(changedPaths);
    printDecision(deploy, changedPaths, reason);
    return deploy ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printDecision(true, [], `could not determine a safe diff: ${message}`);
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  process.exitCode = runIgnoreCommand();
}
