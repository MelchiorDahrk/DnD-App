import {LDRAW_ICONS} from './equipment-icons.js';
import {SOUND_FILES} from './sound-assets.js';
import {CONDITION_ICON_FILES} from './icons.js';
import {DEFAULT_PORTRAIT_IDS} from './portrait-defaults.js';
const CACHE = 'questlog-app-v62-character-background';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./model.js','./sheet-layout.js','./portrait.js','./portrait-ui.js','./catalog.js','./catalog-ui.js','./default-characters.js','./icons.js','./art.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/portrait-adventurer.webp'];
ASSETS.push('./reference-links.js','./reference-pages.js');
ASSETS.push('./portrait-defaults.js','./portrait-default-data.js',...DEFAULT_PORTRAIT_IDS.map(id=>`./portrait-maker/preset-thumbs/${id}.webp`));
ASSETS.push('./published-feat-data.js','./content-sources.js');
ASSETS.push('./magic-item-data.js');
ASSETS.push('./legacy-magic-item-data.js','./magic-item-icon-names.js');
ASSETS.push('./sheet-actions.js');
ASSETS.push('./condition-usage.js',...Object.values(CONDITION_ICON_FILES));
ASSETS.push('./inventory-rules.js','./inventory.js','./armor-class.js');
ASSETS.push('./theme.js','./theme.css','./assets/gui/portrait-border.png','./assets/gui/journal-divider.png');
ASSETS.push('./vfx.js','./vfx.css','./feature-catalog.js','./equipment-icons.js','./item-icons.js',...Object.keys(LDRAW_ICONS).map(key=>`./assets/equipment/${key}.webp`));
ASSETS.push('./level-up.js','./level-up-ui.js','./progression-data.js','./progression-options.js');
ASSETS.push('./rest-rules.js','./rest-reference-data.js');
ASSETS.push('./attack-rules.js','./attack-ui.js');
ASSETS.push('./dice-roller.js','./dice-roller.css','./dice-engine/dice-engine.js');
// Both encodings are cached: older mobile Safari can fall back to MP3 offline.
ASSETS.push('./sound.js','./sound-events.js','./sound-assets.js','./assets/sfx/manifest.json','./assets/sfx/CREDITS.md',...SOUND_FILES.map(path=>'./'+path));
ASSETS.push('./portrait-scan.js','./portrait-photo-ui.js');
ASSETS.push('./portrait-image-analysis.js','./portrait-match.js','./portrait-match-worker.js','./portrait-maker/portrait-match-index.json');
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('questlog-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
let paletteCaching=null;
const collectionCaching=new Map();
self.addEventListener('message',event=>{
  if(!['questlog:cache-minifigure-presets','questlog:cache-minifigure-parts'].includes(event.data?.type))return;
  const all=event.data.type==='questlog:cache-minifigure-parts',key=all?'parts':'presets';
  const reply=data=>event.source?.postMessage({type:`questlog:minifigure-${key}-cache`,...data});
  if(!collectionCaching.has(key))collectionCaching.set(key,(async()=>{
    const cache=await caches.open(CACHE);
    const catalogURL=new URL('./portrait-maker/preset-catalog.json',self.location.href);
    const response=await fetch(catalogURL);if(!response.ok)throw new Error('Catalog unavailable');
    await cache.put(catalogURL,response.clone());const {presets}=await response.json();
    const parts=new Set(['3815','3816','3817','3818','3819','3820']);
    for(const preset of presets)for(const part of Object.values(preset.figure))if(part?.id&&part.id!=='standard')parts.add(part.id);
    let palette=[];
    if(all){
      const response=await fetch(new URL('./portrait-maker/ldraw/catalog.json',self.location.href));if(!response.ok)throw new Error('Parts catalog unavailable');
      palette=(await response.json()).filter(p=>!['body','equipment'].includes(p.cat)&&!p.attachmentOnly);
      for(const part of palette)parts.add(part.id);
    }
    const dependencyURL=new URL('./portrait-maker/ldraw/dependencies.json',self.location.href);
    const dependencyResponse=await fetch(dependencyURL);if(!dependencyResponse.ok)throw new Error('Dependencies unavailable');
    await cache.put(dependencyURL,dependencyResponse.clone());const dependencies=await dependencyResponse.json();
    const shared=[...new Set([...parts].flatMap(id=>dependencies[id]||[]))];
    const shellURL=new URL('./portrait-maker/index.html',self.location.href);
    const shell=await fetch(shellURL);if(!shell.ok)throw new Error('Editor unavailable');
    await cache.put(shellURL,shell.clone());await cache.put(new URL('./portrait-maker/',self.location.href),shell.clone());
    const html=await shell.text();
    const assets=[...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>new URL(m[1],shellURL).href);
    const paths=[...assets,...presets.map(p=>`./portrait-maker/${p.thumbnail}`),...palette.map(p=>`./portrait-maker/thumbs/${encodeURIComponent(p.id)}.webp`),...(all?['./portrait-maker/thumbs/standard.webp']:[]),...['catalog.json','colors.json','LDConfig.ldr','core.ldr',...shared,...[...parts].map(id=>`p/${encodeURIComponent(id)}.ldr`)].map(f=>`./portrait-maker/ldraw/${f}`)];
    let done=0;reply({done,total:paths.length});
    for(let i=0;i<paths.length;i+=4){
      await Promise.all(paths.slice(i,i+4).map(async path=>{const url=new URL(path,self.location.href);if(!await cache.match(url))await cache.add(url);}));
      done=Math.min(i+4,paths.length);reply({done,total:paths.length});
    }
    return paths.length;
  })().finally(()=>{collectionCaching.delete(key);}));
  event.waitUntil(collectionCaching.get(key).then(total=>reply({done:total,total,complete:true})).catch(()=>reply({error:'The collection could not finish downloading. Reconnect and retry.'})));
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='questlog:cache-portrait-palette')return;
  const reply=data=>event.source?.postMessage({type:'questlog:portrait-palette-cache',...data});
  if(!paletteCaching)paletteCaching=(async()=>{
    const cache=await caches.open(CACHE),url=new URL('./portrait-maker/portrait-match-index.json',self.location.href);
    const response=await cache.match(url)||await fetch(url);
    if(!response.ok)throw new Error('Matching data could not be cached.');
    const index=await response.json();let done=0;
    // Cache compressed static pictures only; never load them into image memory.
    for(let start=0;start<index.parts.length;start+=6){
      await Promise.all(index.parts.slice(start,start+6).map(async p=>{
        const path=new URL(`./portrait-maker/thumbs/${encodeURIComponent(p.id)}.webp`,self.location.href);
        if(!await cache.match(path))await cache.add(path);
      }));
      done=Math.min(index.parts.length,start+6);reply({done,total:index.parts.length});
    }
    return index.parts.length;
  })().finally(()=>{paletteCaching=null;});
  event.waitUntil(paletteCaching.then(total=>reply({done:total,total,complete:true})).catch(()=>reply({error:'Some palette assets could not be cached. Reconnect and try again.'})));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||new URL(event.request.url).pathname.includes('/api/'))return;
  // Navigation and source use the network when possible, with a complete offline fallback.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&response.type==='basic') {const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'&&!new URL(event.request.url).pathname.includes('/portrait-maker/')?await caches.match('./index.html'):Response.error())));
});
