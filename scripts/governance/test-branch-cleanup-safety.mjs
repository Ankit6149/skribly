import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'skribli-branch-cleanup-'));
const remote = path.join(fixtureRoot, 'origin.git');
const working = path.join(fixtureRoot, 'working');
const updater = path.join(fixtureRoot, 'updater');
const identity = { GIT_AUTHOR_NAME: 'Skribli test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Skribli test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };

function git(cwd, args, options = {}) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...identity, GIT_TERMINAL_PROMPT: '0' },
    ...options,
  });
}

function runGit(cwd, args, options = {}) {
  const result = git(cwd, args, options);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

try {
  runGit(fixtureRoot, ['init', '--bare', '--initial-branch=main', remote]);
  runGit(fixtureRoot, ['init', '--initial-branch=main', working]);
  runGit(working, ['config', 'user.name', identity.GIT_AUTHOR_NAME]);
  runGit(working, ['config', 'user.email', identity.GIT_AUTHOR_EMAIL]);
  runGit(working, ['remote', 'add', 'origin', remote]);

  writeFileSync(path.join(working, 'README.txt'), 'root\n');
  runGit(working, ['add', 'README.txt']);
  runGit(working, ['commit', '-m', 'root']);
  runGit(working, ['push', '-u', 'origin', 'main']);

  runGit(working, ['checkout', '-b', 'merged-topic']);
  writeFileSync(path.join(working, 'merged.txt'), 'merged\n');
  runGit(working, ['add', 'merged.txt']);
  runGit(working, ['commit', '-m', 'merged topic']);
  const mergedSha = runGit(working, ['rev-parse', 'HEAD']);
  runGit(working, ['checkout', 'main']);
  runGit(working, ['merge', '--no-ff', 'merged-topic', '-m', 'merge topic']);

  runGit(working, ['checkout', '-b', 'open-pr-base']);
  writeFileSync(path.join(working, 'pr-base.txt'), 'base\n');
  runGit(working, ['add', 'pr-base.txt']);
  runGit(working, ['commit', '-m', 'open pr base']);
  runGit(working, ['checkout', 'main']);
  runGit(working, ['merge', '--no-ff', 'open-pr-base', '-m', 'merge pr base']);

  runGit(working, ['checkout', '-b', 'unmerged-topic']);
  writeFileSync(path.join(working, 'unmerged.txt'), 'not merged\n');
  runGit(working, ['add', 'unmerged.txt']);
  runGit(working, ['commit', '-m', 'unmerged topic']);

  runGit(working, ['checkout', 'main']);
  runGit(working, ['checkout', '-b', 'race-topic']);
  writeFileSync(path.join(working, 'race.txt'), 'reviewed head\n');
  runGit(working, ['add', 'race.txt']);
  runGit(working, ['commit', '-m', 'reviewed race head']);
  const inspectedRaceSha = runGit(working, ['rev-parse', 'HEAD']);
  runGit(working, ['checkout', 'main']);
  runGit(working, ['merge', '--no-ff', 'race-topic', '-m', 'merge race topic']);
  runGit(working, ['push', 'origin', 'main', 'merged-topic', 'open-pr-base', 'unmerged-topic', 'race-topic']);
  runGit(working, ['fetch', 'origin']);

  const refs = new Set(runGit(working, ['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin']).split('\n'));
  if (!refs.has('merged-topic') || !refs.has('open-pr-base') || !refs.has('unmerged-topic')) {
    throw new Error('The synthetic remote did not contain the expected branch fixtures.');
  }
  const mergedCheck = git(working, ['merge-base', '--is-ancestor', mergedSha, 'origin/main']);
  if (mergedCheck.status !== 0) throw new Error('A fully merged branch head was not recognized as an ancestor of main.');
  const unmergedCheck = git(working, ['merge-base', '--is-ancestor', 'origin/unmerged-topic', 'origin/main']);
  if (unmergedCheck.status === 0) throw new Error('An unmerged branch was incorrectly recognized as merged.');

  const openPrRefs = new Set(['open-pr-base']);
  const isMergedAndUnreferenced = (branch, sha) => {
    if (openPrRefs.has(branch)) return false;
    return git(working, ['merge-base', '--is-ancestor', sha, 'origin/main']).status === 0;
  };
  if (isMergedAndUnreferenced('open-pr-base', 'origin/open-pr-base')) {
    throw new Error('A branch used as an open pull-request base was selected for deletion.');
  }
  if (isMergedAndUnreferenced('unmerged-topic', 'origin/unmerged-topic')) {
    throw new Error('An unmerged branch was selected for deletion.');
  }
  if (!isMergedAndUnreferenced('merged-topic', mergedSha)) {
    throw new Error('An unchanged, merged, unreferenced branch was not selected for deletion.');
  }

  runGit(fixtureRoot, ['clone', '--branch', 'race-topic', remote, updater]);
  runGit(updater, ['config', 'user.name', identity.GIT_AUTHOR_NAME]);
  runGit(updater, ['config', 'user.email', identity.GIT_AUTHOR_EMAIL]);
  writeFileSync(path.join(updater, 'race.txt'), 'advanced after inspection\n');
  runGit(updater, ['add', 'race.txt']);
  runGit(updater, ['commit', '-m', 'advance after inspection']);
  const advancedRaceSha = runGit(updater, ['rev-parse', 'HEAD']);
  runGit(updater, ['push', 'origin', 'race-topic']);

  const staleLease = git(working, [
    'push',
    `--force-with-lease=refs/heads/race-topic:${inspectedRaceSha}`,
    'origin',
    ':refs/heads/race-topic',
  ]);
  if (staleLease.status === 0) throw new Error('A stale expected-SHA deletion lease unexpectedly succeeded.');
  const remoteRaceSha = runGit(working, ['ls-remote', 'origin', 'refs/heads/race-topic']).split('\t')[0];
  if (remoteRaceSha !== advancedRaceSha) throw new Error('Stale lease failure did not preserve the advanced remote head.');

  const mergedDelete = git(working, [
    'push',
    `--force-with-lease=refs/heads/merged-topic:${mergedSha}`,
    'origin',
    ':refs/heads/merged-topic',
  ]);
  if (mergedDelete.status !== 0) throw new Error(`Expected unchanged merged head could not be deleted: ${mergedDelete.stderr}`);
  const deletedRef = runGit(working, ['ls-remote', 'origin', 'refs/heads/merged-topic']);
  if (deletedRef !== '') throw new Error('The unchanged merged branch ref still exists after its leased deletion.');

  const workflow = readFileSync(path.resolve('.github/workflows/branch-cleanup.yml'), 'utf8');
  if (!workflow.includes('grep -Fqx -- "$branch" "$protected_refs"')) {
    throw new Error('Workflow does not protect branches used by open pull requests.');
  }
  console.log('Branch cleanup fixture passed: merged-only, open-PR preservation, and stale expected-SHA lease.');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
