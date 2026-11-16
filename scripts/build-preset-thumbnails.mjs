import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {findChromium} from './lib/chromium.mjs';
import {geometryFingerprinter} from './lib/geometry-fingerprint.mjs';
const root=resolve(import.meta.dirname,'..'),vendor=resolve(root,'vendor/bricktrait');
const out=resolve(vendor,'presets/thumbnails');
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function buildPresetThumbnails(){
  const {presets}=JSON.parse(await fs.readFile(resolve(vendor,'preset-catalog.json'),'utf8'));
  await fs.mkdir(out,{recursive:true});
  const manifestFile=resolve(out,'manifest.json');
  const previous=JSON.parse(await fs.readFile(manifestFile,'utf8').catch(()=>'{}'));
  const inputs=['src/lib/ldraw.ts','src/lib/portrait-scene.ts','src/lib/portrait-glow.ts','src/lib/scene.ts','src/lib/lighting.ts','src/lib/materials.ts','scripts/preset-thumbs/main.ts','static/ldraw/core.ldr','static/ldraw/LDConfig.ldr'];
  const rendererVersion=hash(Buffer.concat(await Promise.all(inputs.map(f=>fs.readFile(resolve(vendor,f))))));
  const fingerprint=await geometryFingerprinter(resolve(vendor,'static/ldraw'));
  const partHashes=new Map();
  for(const p of presets)for(const part of Object.values(p.figure))if(part?.id&&part.id!=='standard'&&!partHashes.has(part.id))partHashes.set(part.id,await fingerprint(part.id));
  const manifest=Object.fromEntries(presets.map(p=>[p.id,hash(rendererVersion+JSON.stringify(p.figure)+Object.values(p.figure).map(part=>partHashes.get(part?.id)||'').join(''))]));
  const todo=presets.filter(p=>previous[p.id]!==manifest[p.id]||!existsSync(resolve(out,p.id+'.webp')));
  if(todo.length){
    const chrome=await findChromium();
    if(!chrome)throw new Error('Preset thumbnails need Chromium once during catalog refresh. Set CHROME_PATH. Checked-in thumbnails make ordinary builds independent of this step.');
    const server=await createServer({configFile:false,root:resolve(vendor,'scripts/preset-thumbs'),publicDir:resolve(vendor,'static'),logLevel:'error',server:{port:0}});
    let browser;
    try{
      await server.listen();browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
      const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]);await page.evaluate(()=>window.presetThumbsReady);
      for(const [i,p] of todo.entries()){
        const url=await page.evaluate(f=>window.renderPresetThumb(f),p.figure);
        if(!url.startsWith('data:image/webp;base64,'))throw new Error(`Invalid thumbnail for ${p.id}`);
        await fs.writeFile(resolve(out,p.id+'.webp'),Buffer.from(url.split(',')[1],'base64'));
        // Save completed work after every image; interruption never loses progress.
        previous[p.id]=manifest[p.id];await fs.writeFile(manifestFile,JSON.stringify(previous,null,2)+'\n');
        if(i%20===0)console.log(`Preset thumbnails ${i+1}/${todo.length}`);
      }
    }finally{await browser?.close();await server.close();}
  }
  await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  const target=resolve(vendor,'static/preset-thumbs');await fs.mkdir(target,{recursive:true});
  for(const p of presets)await fs.copyFile(resolve(out,p.id+'.webp'),resolve(target,p.id+'.webp'));
  console.log(`${presets.length} preset thumbnails ready (${todo.length} rendered)`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPresetThumbnails();
