// Lets the app open without a connection so the offline SMS fallback still works. API calls are never cached.
const C="safeher-v5";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["/"])).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/")||u.pathname.startsWith("/track"))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("/"))))});
