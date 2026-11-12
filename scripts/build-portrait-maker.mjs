import {access,mkdir,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=resolve(import.meta.dirname,'..');
const vendor=resolve(root,'vendor/bricktrait');
const exists=async path=>access(path).then(()=>true,()=>false);
const env={...process.env,LDRAW_DIR:resolve(root,'.cache/ldraw'),LDRAW_UNOFFICIAL_DIR:resolve(root,'.cache/ldraw-unofficial')};
function run(script) {
  const result=spawnSync(process.execPath,[resolve(vendor,'scripts',script)],{cwd:vendor,env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Bricktrait ${script} failed (${result.status}).`);
}

export async function buildPortraitMaker() {
  // Generated LDraw data is cached between builds; all runtime assets are self-hosted.
  if(!await exists(resolve(vendor,'static/ldraw/.questlog-parts-complete'))) {
    await mkdir(resolve(root,'.cache'),{recursive:true});
    run('fetch-ldraw.mjs');
    run('build-parts.mjs');
  }
  const {build}=await import('vite');
  await build({configFile:resolve(vendor,'vite.config.js')});
  await cp(resolve(vendor,'LICENSE'),resolve(root,'portrait-maker/LICENSE'));
  for(const [name,file] of [['three','three/LICENSE'],['svelte','svelte/LICENSE.md'],['fflate','fflate/LICENSE'],['archivo','@fontsource-variable/archivo/LICENSE'],['ibm-plex-mono','@fontsource/ibm-plex-mono/LICENSE']]) {
    await mkdir(resolve(root,'portrait-maker/licenses'),{recursive:true});
    await cp(resolve(root,'node_modules',file),resolve(root,'portrait-maker/licenses',`${name}.txt`));
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPortraitMaker();
