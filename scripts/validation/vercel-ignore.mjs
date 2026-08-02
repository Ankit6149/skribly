import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEPLOYABLE_PREFIXES = Object.freeze(['site/', 'api/', 'public/']);
export const DEPLOYABLE_FILES = Object.freeze(
  new Set([
    '.nvmrc',
    'package.json',
    'package-lock.json',
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

export function readChangedPaths(baseSha, headSha = 'HEAD') {
  if (!baseSha || /^0+$/.test(baseSha)) {
    throw new Error('A previous deployment SHA is not available.');
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-only', baseSha, headSha, '--'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

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

  const previousSha = environment.VERCEL_GIT_PREVIOUS_SHA;
  try {
    const changedPaths = readChangedPaths(previousSha);
    const deploy = shouldDeploy(changedPaths);
    printDecision(deploy, changedPaths);
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
