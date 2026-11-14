import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
for(const name of ['build-magic-items.mjs','build-legacy-magic-items.mjs']){
  const result=spawnSync(process.execPath,[resolve(import.meta.dirname,name),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
