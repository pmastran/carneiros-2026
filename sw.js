const CACHE = 'carneiros-2026-v2';
const CORE = ['./','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isPage = event.request.mode === 'navigate' || event.request.destination === 'document';
  if (isPage) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'}).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put('./index.html', clone)).catch(()=>{});
        return resp;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(event.request, clone)).catch(()=>{});
      return resp;
    }))
  );
});
