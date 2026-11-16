import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const RENDER_PACKAGES=['three','vite','puppeteer-core'];
export const REFERENCE_RENDER_FILES=[
  'portrait-image-analysis.js',
  'vendor/bricktrait/scripts/thumbs/references.ts',
  'vendor/bricktrait/src/lib/thumb-render.ts',
  'vendor/bricktrait/src/lib/thumbs.ts',
  'vendor/bricktrait/src/lib/scene.ts',
  'vendor/bricktrait/src/lib/ldraw.ts',
  'vendor/bricktrait/static/ldraw/LDConfig.ldr'
];
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const normalizeText=value=>String(value).replace(/\r\n/g,'\n');

// Fingerprint the resolved runtime dependency graph, not the application lockfile.
// Ignore root metadata, unrelated packages, formatting, and deduplication paths.
export function renderDependencies(lock){
  const packages=lock.packages;
  if(!packages)throw new Error('Portrait caching requires a package-lock with resolved packages.');
  function locate(from,name){
    let parent=from;
    while(true){
      const path=parent?`${parent}/node_modules/${name}`:`node_modules/${name}`;
      if(packages[path])return path;
      if(!parent)return null;
      const index=parent.lastIndexOf('/node_modules/');
      parent=index<0?'':parent.slice(0,index);
    }
  }
  const records=new Map(),seen=new Set();
  const identity=(path,name)=>JSON.stringify([name,packages[path].version,packages[path].integrity||packages[path].resolved||'']);
  function visit(path,name){
    const id=identity(path,name);if(seen.has(path))return id;seen.add(path);
    const pkg=packages[path],children=[];
    for(const child of Object.keys({...pkg.dependencies,...pkg.optionalDependencies}).sort()){
      const target=locate(path,child);
      if(!target){if(Object.hasOwn(pkg.optionalDependencies||{},child))continue;throw new Error(`Missing locked portrait dependency: ${name} → ${child}`);}
      children.push(visit(target,child));
    }
    records.set(id,{id,dependencies:[...new Set(children)].sort()});return id;
  }
  const roots=RENDER_PACKAGES.map(name=>{const path=locate('',name);if(!path)throw new Error(`Missing locked portrait renderer: ${name}`);return visit(path,name);});
  return {roots,packages:[...records.values()].sort((a,b)=>a.id.localeCompare(b.id,'en'))};
}
export const renderDependencyFingerprint=lock=>digest(JSON.stringify(renderDependencies(lock)));
export function rendererFingerprint(sources,lock){
  return digest(JSON.stringify({version:1,sources:REFERENCE_RENDER_FILES.map(file=>[file,digest(normalizeText(sources[file]))]),dependencies:renderDependencies(lock)}));
}
export async function readRendererFingerprint(root){
  const [lock,...sources]=await Promise.all([readFile(resolve(root,'package-lock.json'),'utf8'),...REFERENCE_RENDER_FILES.map(file=>readFile(resolve(root,file),'utf8'))]);
  return rendererFingerprint(Object.fromEntries(REFERENCE_RENDER_FILES.map((file,i)=>[file,sources[i]])),JSON.parse(lock));
}
export const referenceSignature=(renderer,geometry)=>digest(renderer+geometry);
export function reusableReference(cached,renderer,geometry,migrations=[]){
  if(cached?.signature===referenceSignature(renderer,geometry))return 'current';
  // A legacy cache is reusable only when its recorded hash matches both the
  // exact current geometry and a proven equivalent renderer/dependency graph.
  if(migrations.some(entry=>entry.inputFingerprint===renderer&&entry.legacyRendererHashes.some(hash=>cached?.signature===referenceSignature(hash,geometry))))return 'legacy';
  return false;
}
