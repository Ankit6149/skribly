// SPDX-License-Identifier: MPL-2.0
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2];
if (!['dev', 'build'].includes(mode) || process.argv.length !== 3) {
  console.error('Usage: node scripts/community/desktop.mjs <dev|build>'); process.exit(1);
}
if (['1', 'true', 'TRUE'].includes(process.env.SKRIBLY_TRIAL_ENFORCED)) {
  console.error('Community cannot use commercial trial enforcement. Use a separate build environment.'); process.exit(1);
}
// Never bundle or publish an installer through this development entrypoint.
const args = ['run', 'tauri', '--', mode, '--features', 'community', '--config', 'src-tauri/tauri.community.conf.json'];
if (mode === 'build') args.push('--no-bundle');
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) {
  console.error('Start this command through npm run community:dev or npm run community:build.'); process.exit(1);
}
const result = spawnSync(process.execPath, [npmCli, ...args], {
  cwd: path.join(root, 'apps/desktop'), stdio:'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
