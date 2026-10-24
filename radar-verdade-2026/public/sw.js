const CACHE='radar-verdade-v14';
const ASSETS=['/','/app.css?v=14','/app.js?v=14','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/')));return}
 if(['/app.js','/app.css','/sw.js'].includes(url.pathname)){event.respondWith(fetch(request).catch(()=>caches.match(request)));return}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});