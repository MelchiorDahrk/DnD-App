const CACHE = 'questlog-app-v5-default-party';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./model.js','./default-characters.js','./sheet-scan.js','./sheet-scan-ui.js','./icons.js','./art.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('questlog-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||new URL(event.request.url).pathname.includes('/api/'))return;
  // Navigation and source use the network when possible, with a complete offline fallback.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&response.type==='basic') {const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
