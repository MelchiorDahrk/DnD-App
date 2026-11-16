// Maintenance only: record provable equivalence for caches made by the old
// full-lockfile renderer. Normal builds need neither Git history nor this script.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {REFERENCE_RENDER_FILES,rendererFingerprint,normalizeText} from './lib/portrait-cache.mjs';
const root=resolve(import.meta.dirname,'..'),entries=new Map();
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const commits=process.argv.slice(2);
if(!commits.length)throw new Error('Usage: node scripts/build-portrait-cache-migrations.mjs <trusted commit> ...');
const configFile=REFERENCE_RENDER_FILES.at(-1),config=await readFile(resolve(root,configFile),'utf8');
const nativeSources=Object.fromEntries(await Promise.all(REFERENCE_RENDER_FILES.map(async file=>[file,await readFile(resolve(root,file),'utf8')])));
for(const revision of commits){
  const commit=git('rev-parse',revision).trim(),lock=git('show',`${commit}:package-lock.json`),sources={};
  for(const file of REFERENCE_RENDER_FILES)sources[file]=file===configFile?config:git('show',`${commit}:${file}`);
  const inputFingerprint=rendererFingerprint(sources,JSON.parse(lock));
  const entry=entries.get(inputFingerprint)||{inputFingerprint,commits:[],legacyRendererHashes:[]};
  entry.commits.push(commit);
  // Linux CI and Windows checkouts differ only in tracked text line endings.
  // LDConfig is generated/cache data, so retain its actual bytes in either case.
  const nativeMatches=REFERENCE_RENDER_FILES.every(file=>normalizeText(nativeSources[file])===normalizeText(sources[file]));
  for(const style of ['linux','windows',...(nativeMatches?['native']:[])])for(const windowsLock of [false,true]){
    const hash=createHash('sha256');
    for(const file of REFERENCE_RENDER_FILES){const text=style==='native'?nativeSources[file]:file===configFile?sources[file]:normalizeText(sources[file]).replace(/\n/g,style==='windows'?'\r\n':'\n');hash.update(text);}
    hash.update(normalizeText(lock).replace(/\n/g,windowsLock?'\r\n':'\n'));
    entry.legacyRendererHashes.push(hash.digest('hex'));
  }
  entries.set(inputFingerprint,entry);
}
for(const entry of entries.values())entry.legacyRendererHashes=[...new Set(entry.legacyRendererHashes)].sort();
await writeFile(resolve(root,'scripts/data/portrait-reference-cache-migrations.json'),JSON.stringify({version:1,description:'Legacy renderer hashes derived from trusted Git snapshots. Reuse also requires identical scoped renderer inputs and per-part geometry.',entries:[...entries.values()]},null,2)+'\n');
console.log(`Recorded ${entries.size} renderer input set(s) from ${commits.length} trusted snapshots.`);
