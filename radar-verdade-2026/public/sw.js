const CACHE='radar-verdade-v12';
const ASSETS=['/','/app.css?v=12','/app.js?v=12','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('/')));return}
 if(['/app.js','/app.css','/sw.js'].includes(u.pathname)){e.respondWith(fetch(r).catch(()=>caches.match(r)));return}
 e.respondWith(caches.match(r).then(c=>c||fetch(r)));
});
