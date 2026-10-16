// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(file)=>readFile(path.join(root,file),'utf8');
const config=JSON.parse(await read('apps/desktop/src-tauri/tauri.community.conf.json'));
const normal=JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
const source=await read('apps/desktop/src-tauri/src/core/license.rs');
const build=await read('apps/desktop/src-tauri/build.rs');
const runner=await read('scripts/community/desktop.mjs');
const access=await read('apps/desktop/src/features/account/useWorkspaceAccess.ts');
const home=await read('apps/desktop/src/features/account/HomeHost.tsx');
const checks=[
  [config.identifier==='app.skribli.community'&&config.identifier!==normal.identifier,'isolated Community application identifier'],
  [config.mainBinaryName==='skribli-community','distinct Community binary'],
  [config.app.security.csp.includes("connect-src 'self';")&&!config.app.security.csp.includes('supabase'),'no external account endpoints in Community CSP'],
  [source.includes('cfg!(feature = "community")')&&source.includes('mode: LicenseMode::Community'),'native-compiled Community identity'],
  [build.includes('Community builds cannot enable commercial trial enforcement'),'reject mixed commercial enforcement'],
  [runner.includes("args.push('--no-bundle')")&&runner.includes("'--features', 'community'")&&runner.includes('tauri.community.conf.json'),'paired Community feature/config without installer bundling'],
  [access.includes('state.hasNativeStatus')&&home.includes('if (!nativeReady || isCommunity) return;'),'wait for native identity before account initialization'],
];
for(const [pass,name] of checks)if(!pass)throw new Error(`Community contract missing: ${name}`);
console.log(`Community edition contract validated: ${checks.length} source/config boundaries. Native and frontend runtime tests remain separate.`);
