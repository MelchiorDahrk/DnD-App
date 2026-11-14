import {LDRAW_ICONS} from './equipment-icons.js';
import {SOUND_FILES} from './sound-assets.js';
const CACHE = 'questlog-app-v34-sheet-actions';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./model.js','./sheet-layout.js','./portrait.js','./portrait-ui.js','./catalog.js','./catalog-ui.js','./default-characters.js','./sheet-scan.js','./sheet-scan-ui.js','./icons.js','./art.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/portrait-adventurer.webp'];
ASSETS.push('./reference-links.js','./reference-pages.js');
ASSETS.push('./sheet-actions.js');
ASSETS.push('./theme.js','./theme.css','./assets/gui/portrait-border.png','./assets/gui/journal-divider.png');
ASSETS.push('./vfx.js','./vfx.css','./feature-catalog.js','./equipment-icons.js','./item-icons.js',...Object.keys(LDRAW_ICONS).map(key=>`./assets/equipment/${key}.webp`));
ASSETS.push('./level-up.js','./level-up-ui.js','./progression-data.js','./progression-options.js');
ASSETS.push('./rest-rules.js','./rest-reference-data.js');
ASSETS.push('./attack-rules.js','./attack-ui.js');
// Both encodings are cached: older mobile Safari can fall back to MP3 offline.
ASSETS.push('./sound.js','./sound-events.js','./sound-assets.js','./assets/sfx/manifest.json','./assets/sfx/CREDITS.md',...SOUND_FILES.map(path=>'./'+path));
ASSETS.push('./portrait-scan.js','./portrait-photo-ui.js');
ASSETS.push('./portrait-image-analysis.js','./portrait-match.js','./portrait-match-worker.js','./portrait-maker/portrait-match-index.json');
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('questlog-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
let paletteCaching=null;
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
