import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const vendor=resolve(import.meta.dirname,'../vendor/bricktrait');
const result=spawnSync(process.execPath,[resolve(vendor,'scripts/build-thumbs.mjs'),'--equipment'],{cwd:vendor,env:process.env,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)throw new Error(`Equipment thumbnail build failed (${result.status}). Run npm run build:portraits first if LDraw is missing.`);
