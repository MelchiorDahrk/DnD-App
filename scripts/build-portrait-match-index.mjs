import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {selectableCatalog,isClassicFantasyPart,isCMFPart,partThemes} from '../vendor/bricktrait/src/lib/fantasy-catalog.js';
import {DESCRIPTOR_VERSION} from '../portrait-image-analysis.js';
import {validateMatchIndex} from '../portrait-match.js';
import {findChromium} from './lib/chromium.mjs';
import {geometryFingerprinter} from './lib/geometry-fingerprint.mjs';
const root=resolve(import.meta.dirname,'..'),vendor=resolve(root,'vendor/bricktrait'),out=resolve(vendor,'static');
export async function referenceFingerprint(parts) {
  const hash=createHash('sha256');
  for(const file of ['portrait-image-analysis.js','scripts/build-portrait-match-index.mjs','vendor/bricktrait/scripts/thumbs/references.ts','vendor/bricktrait/src/lib/thumb-render.ts','vendor/bricktrait/src/lib/thumbs.ts','vendor/bricktrait/src/lib/scene.ts','vendor/bricktrait/src/lib/ldraw.ts','vendor/bricktrait/src/lib/fantasy-catalog.js','vendor/bricktrait/fantasy-catalog.json','vendor/bricktrait/cmf-catalog.json','vendor/bricktrait/theme-catalog.json','vendor/bricktrait/static/ldraw/colors.json','vendor/bricktrait/static/ldraw/core.ldr','vendor/bricktrait/static/ldraw/LDConfig.ldr'])hash.update(await readFile(resolve(root,file)));
  const fingerprint=await geometryFingerprinter(resolve(out,'ldraw'));
  for(const p of parts)if(p.id!=='standard')hash.update(p.id).update(await fingerprint(p.id));
  for(const id of ['3815','3816','3817'])hash.update(await readFile(resolve(out,'ldraw/p',`${id}.ldr`)));
  hash.update(await readFile(resolve(root,'package-lock.json')));
  return hash.digest('hex');
}
export async function referenceRendererFingerprint() {
  const hash=createHash('sha256');
  for(const f of ['portrait-image-analysis.js','vendor/bricktrait/scripts/thumbs/references.ts','vendor/bricktrait/src/lib/thumb-render.ts','vendor/bricktrait/src/lib/thumbs.ts','vendor/bricktrait/src/lib/scene.ts','vendor/bricktrait/src/lib/ldraw.ts','vendor/bricktrait/static/ldraw/LDConfig.ldr','package-lock.json'])hash.update(await readFile(resolve(root,f)));
  return hash.digest('hex');
}
export async function buildPortraitMatchIndex() {
  const catalog=JSON.parse(await readFile(resolve(out,'ldraw/catalog.json'),'utf8'));
  const parts=[...selectableCatalog(catalog),{id:'standard',name:'Standard hips and legs',cat:'legs'}].sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const sourceHash=await referenceFingerprint(parts),file=resolve(out,'portrait-match-index.json');
  let previous;try{previous=validateMatchIndex(JSON.parse(await readFile(file,'utf8')));}catch{/* initial build */}
  if(previous?.sourceHash===sourceHash&&(await Promise.all(parts.map(p=>access(resolve(out,'thumbs',`${p.id}.webp`)).then(()=>true,()=>false)))).every(Boolean)){
    console.log(`Portrait matching index: ${parts.length} references unchanged`);return;
  }
  const rendererHash=await referenceRendererFingerprint();
  const fingerprint=await geometryFingerprinter(resolve(out,'ldraw'));
  const cache=resolve(root,'.cache/portrait-references');await mkdir(cache,{recursive:true});
  const records=new Map(),pending=[];
  for(const part of parts){
    const geometryHash=part.id==='standard'?(await Promise.all(['3815','3816','3817'].map(fingerprint))).join(''):await fingerprint(part.id);
    const signature=createHash('sha256').update(rendererHash+geometryHash).digest('hex');
    const entry={...part,fantasy:isClassicFantasyPart(part),cmf:isCMFPart(part),themes:partThemes(part)};
    let cached;try{cached=JSON.parse(await readFile(resolve(cache,part.id+'.json'),'utf8'));}catch{}
    if(cached?.signature===signature&&await access(resolve(out,'thumbs',part.id+'.webp')).then(()=>true,()=>false))records.set(part.id,{...entry,views:cached.views});
    else pending.push({...entry,signature});
  }
  console.log(`Portrait references: ${records.size} cached, ${pending.length} to render`);
  const executablePath=await findChromium();
  if(pending.length&&!executablePath)throw new Error('Reference generation needs Chromium. Set CHROME_PATH.');
  await mkdir(resolve(out,'thumbs'),{recursive:true});
  const server=await createServer({configFile:false,root:resolve(vendor,'scripts/thumbs'),publicDir:out,logLevel:'warn',server:{port:0,fs:{allow:[root]}}});await server.listen();
  let browser;
  try {
    if(pending.length){
    browser=await puppeteer.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
    let page;
    for(let i=0;i<pending.length;i+=12){
      // Bound the renderer/loader caches during a full catalog rebuild.
      if(i%60===0){await page?.close();page=await browser.newPage();page.setDefaultTimeout(120000);await page.goto(server.resolvedUrls.local[0]);await page.evaluate(()=>window.thumbsReady);}
      const batch=pending.slice(i,i+12),results=await page.evaluate(items=>window.renderPortraitReferences(items),batch);
      for(let j=0;j<batch.length;j++){
        const part=batch[j],result=results[j];
        await mkdir(resolve(out,'thumbs',part.id.includes('/')?'unf':''),{recursive:true});
        await writeFile(resolve(out,'thumbs',`${part.id}.webp`),Buffer.from(result.thumb.split(',')[1],'base64'));
        await writeFile(resolve(cache,part.id+'.json'),JSON.stringify({signature:part.signature,views:result.views}));
        const {signature,...entry}=part;records.set(part.id,{...entry,views:result.views});
      }
      if(i%60===0||i+12>=pending.length)console.log(`Portrait references: ${Math.min(i+12,pending.length)}/${pending.length}`);
    }
    }
    const colors=JSON.parse(await readFile(resolve(out,'ldraw/colors.json'),'utf8')).filter(c=>!c.alpha);
    const index=validateMatchIndex({version:DESCRIPTOR_VERSION,sourceHash,colors,parts:parts.map(p=>records.get(p.id))});
    await writeFile(file,JSON.stringify(index));
    console.log(`Portrait matching index: ${records.size} parts, ${(Buffer.byteLength(JSON.stringify(index))/1024/1024).toFixed(2)} MiB`);
  } finally {await browser?.close();await server.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPortraitMatchIndex();
