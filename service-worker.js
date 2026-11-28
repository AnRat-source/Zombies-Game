const CACHE='cityfall-static-v5';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./assets/style.css','./assets/game.js','./assets/polygon-mesh.js','./assets/wasm-sim.js','./assets/nyc-road-data.js','./assets/app-install.js','./assets/icons/cityfall-siege-192.png','./assets/icons/cityfall-siege-512.png','./assets/icons/cityfall-siege-180.png','./assets/icons/cityfall-siege.ico','./wasm/pkg/cityfall_wasm_bg.wasm'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
  const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
 }).catch(()=>caches.match('./index.html'))));
});
