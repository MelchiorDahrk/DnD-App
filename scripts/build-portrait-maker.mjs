import {access,mkdir,cp,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkFantasyCatalog} from './check-fantasy-catalog.mjs';
import {EQUIPMENT_ICONS,equipmentIconParts} from '../equipment-icons.js';

const root=resolve(import.meta.dirname,'..');
const vendor=resolve(root,'vendor/bricktrait');
const exists=async path=>access(path).then(()=>true,()=>false);
const env={...process.env,LDRAW_DIR:resolve(root,'.cache/ldraw'),LDRAW_UNOFFICIAL_DIR:resolve(root,'.cache/ldraw-unofficial')};
function run(script, ...args) {
  const result=spawnSync(process.execPath,[resolve(vendor,'scripts',script),...args],{cwd:vendor,env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Bricktrait ${script} failed (${result.status}).`);
}

export async function buildPortraitMaker() {
  // Generated LDraw data is cached between builds; all runtime assets are self-hosted.
  const iconParts=[...new Set(Object.values(EQUIPMENT_ICONS).flatMap(entry=>equipmentIconParts(entry).map(part=>part.id)))];
  const partsKey=createHash('sha256').update(await readFile(resolve(vendor,'scripts/build-parts.mjs'))).digest('hex');
  if(await readFile(resolve(vendor,'static/ldraw/.questlog-parts-complete'),'utf8').catch(()=>'')!==partsKey ||
    !(await Promise.all(iconParts.map(id=>exists(resolve(vendor,'static/ldraw/p',`${id}.ldr`))))).every(Boolean)) {
    await mkdir(resolve(root,'.cache'),{recursive:true});
    run('fetch-ldraw.mjs');
    run('build-parts.mjs');
  }
  checkFantasyCatalog();
  run('build-thumbs.mjs','--equipment');
  const {build}=await import('vite');
  await build({configFile:resolve(vendor,'vite.config.js')});
  await cp(resolve(vendor,'LICENSE'),resolve(root,'portrait-maker/LICENSE'));
  await cp(resolve(vendor,'fantasy-catalog.json'),resolve(root,'portrait-maker/fantasy-catalog.json'));
  await cp(resolve(vendor,'cmf-catalog.json'),resolve(root,'portrait-maker/cmf-catalog.json'));
  await cp(resolve(vendor,'theme-catalog.json'),resolve(root,'portrait-maker/theme-catalog.json'));
  for(const [name,file] of [['three','three/LICENSE'],['svelte','svelte/LICENSE.md'],['fflate','fflate/LICENSE'],['archivo','@fontsource-variable/archivo/LICENSE'],['ibm-plex-mono','@fontsource/ibm-plex-mono/LICENSE']]) {
    await mkdir(resolve(root,'portrait-maker/licenses'),{recursive:true});
    await cp(resolve(root,'node_modules',file),resolve(root,'portrait-maker/licenses',`${name}.txt`));
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPortraitMaker();
