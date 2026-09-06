
const CACHE = 'carneiros-2026-v1';
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
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(event.request, clone)).catch(()=>{});
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
