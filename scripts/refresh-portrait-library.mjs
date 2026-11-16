// Intentional network refresh. Ordinary builds remain cacheable and self-hosted.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fetchLibraries,LIBRARIES} from '../vendor/bricktrait/scripts/fetch-ldraw.mjs';
import {importBulk} from './import-rebrickable-bulk.mjs';
import {selectableCatalog} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
const root=resolve(import.meta.dirname,'..'),vendor=resolve(root,'vendor/bricktrait');
export async function refreshPortraitLibrary(){
  const env={...process.env,LDRAW_DIR:resolve(root,'.cache/ldraw'),LDRAW_UNOFFICIAL_DIR:resolve(root,'.cache/ldraw-unofficial')};
  const run=(script,cwd=root)=>{const r=spawnSync(process.execPath,[resolve(cwd,script)],{cwd,env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${script} failed (${r.status})`);};
  await fs.mkdir(resolve(root,'.cache/portrait-coverage'),{recursive:true});
  const parts=JSON.parse(await fs.readFile(resolve(vendor,'static/ldraw/catalog.json'),'utf8').catch(()=>'[]'));
  const sourcePartIds=new Set();
  for(const dir of [env.LDRAW_DIR,env.LDRAW_UNOFFICIAL_DIR])for(const name of await fs.readdir(resolve(dir,'parts')).catch(()=>[]))if(name.endsWith('.dat'))sourcePartIds.add(name.slice(0,-4));
  const baseline={parts:parts.length,selectable:selectableCatalog(parts).length,portraitParts:selectableCatalog(parts).length,previouslyHidden:[]};
  await fs.writeFile(resolve(root,'.cache/portrait-coverage/baseline.json'),JSON.stringify(baseline));
  await fs.writeFile(resolve(root,'.cache/portrait-coverage/before-parts.json'),JSON.stringify(parts));
  await fs.copyFile(resolve(vendor,'preset-catalog.json'),resolve(root,'.cache/portrait-coverage/before-presets.json'));
  await fetchLibraries({refresh:true,libraries:LIBRARIES.map((lib,i)=>({...lib,dest:i?env.LDRAW_UNOFFICIAL_DIR:env.LDRAW_DIR}))});
  run('scripts/build-parts.mjs',vendor);
  const updated=JSON.parse(await fs.readFile(resolve(vendor,'static/ldraw/catalog.json'),'utf8'));
  const oldIds=new Set(parts.map(p=>p.id)),added=updated.filter(p=>!oldIds.has(p.id));
  await fs.writeFile(resolve(root,'.cache/portrait-coverage/change-metrics.json'),JSON.stringify({newlyBundledParts:added.length,newLibraryParts:sourcePartIds.size?added.filter(p=>!sourcePartIds.has(p.id)).length:null,newlyClassifiedParts:sourcePartIds.size?added.filter(p=>sourcePartIds.has(p.id)).length:null,basis:'Before/after source identifiers; existing-source build improvements are counted separately.'}));
  run('scripts/update-theme-catalog.mjs');run('scripts/update-cmf-catalog.mjs');
  await importBulk({refresh:true});
  run('scripts/build-rebrickable-mappings.mjs');
  run('scripts/build-minifigure-presets.mjs');
  run('scripts/build-minifigure-coverage.mjs');
  run('scripts/build-preset-thumbnails.mjs');
  run('scripts/build-portrait-maker.mjs');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await refreshPortraitLibrary();
