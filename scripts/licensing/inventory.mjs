// SPDX-License-Identifier: MPL-2.0
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
let cargoFile=null, output='artifacts/licensing/inventory.json';
for(let index=0;index<args.length;index+=2){
  const key=args[index],value=args[index+1];
  if(!value||!['--cargo-metadata','--output'].includes(key))throw new Error('Usage: npm run licenses:inventory -- [--cargo-metadata file] [--output file]');
  if(key==='--cargo-metadata')cargoFile=path.resolve(root,value);else output=value;
}
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const npm=Object.entries(lock.packages).filter(([name,value])=>name.includes('node_modules/')&&!value.link).map(([name,value])=>({
  ecosystem:'npm',name:name.slice(name.lastIndexOf('node_modules/')+13),version:value.version,
  license:value.license??null,developmentOnly:Boolean(value.dev),optional:Boolean(value.optional),
}));
let cargo=[];
if(cargoFile){
  const bytes=await readFile(cargoFile);
  // Windows PowerShell 5 redirects native output as UTF-16LE by default.
  const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8';
  const metadata=JSON.parse(bytes.toString(encoding).replace(/^\uFEFF/,''));
  cargo=metadata.packages.filter(value=>value.source).map(value=>({ecosystem:'cargo',name:value.name,version:value.version,license:value.license??null,licenseFileOnly:Boolean(value.license_file)}));
}
const count=(list)=>({packages:list.length,missingLicenseMetadata:list.filter(value=>!value.license).length});
const summary={npm:count(npm),cargo:cargoFile?{status:'provided',...count(cargo)}:{status:'not-generated',packages:0,missingLicenseMetadata:null},review:'Metadata inventory only; compatibility, asset provenance and binary notices need review.'};
const target=path.resolve(root,output);
await mkdir(path.dirname(target),{recursive:true});
await writeFile(target,JSON.stringify({schemaVersion:1,summary,packages:[...npm,...cargo]},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
console.log(`Inventory saved to ${path.relative(root,target)}`);
