// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./inventory.mjs',import.meta.url));
test('reads Windows Cargo metadata and reports missing licences without approving them',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'skribli-license-inventory-'));
  assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));
  try {
    const metadata=path.join(dir,'cargo.json'), output=path.join(dir,'inventory.json');
    const data=JSON.stringify({packages:[{name:'synthetic-dep',version:'1',source:'registry+synthetic',license:null,license_file:'COPYING'},{name:'local',version:'1',source:null,license:null}]});
    await writeFile(metadata,Buffer.from('\uFEFF'+data,'utf16le'));
    const result=spawnSync(process.execPath,[script,'--cargo-metadata',metadata,'--output',output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const report=JSON.parse(await readFile(output,'utf8'));
    assert.equal(report.summary.cargo.packages,1);
    assert.equal(report.summary.cargo.missingLicenseMetadata,1);
    assert.equal(report.packages.find(p=>p.name==='synthetic-dep').licenseFileOnly,true);
    assert.match(report.summary.review,/Metadata inventory only/);
    assert.equal(report.packages.some(p=>p.name==='@skribly/desktop'),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});
