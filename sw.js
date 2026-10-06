const V='cp-control-prest-v5',F=['./','index.html','app.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F)));self.skipWaiting()});
// Solo borra cachés propios (cp-control-prest-* y los viejos crz-*), nunca los de otras apps del mismo dominio
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&(x.startsWith('cp-control-prest-')||x.startsWith('crz-'))).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin!==location.origin||e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request,{cacheName:V})))});
