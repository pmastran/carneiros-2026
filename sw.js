const CACHE='placar-eleicoes-sp-v2';
const CORE=['./','./index.html','./manifest.webmanifest','./assets/elections-icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.hostname.includes('supabase.co')){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
  if(e.request.mode==='navigate'||e.request.destination==='document'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',x)).catch(()=>{});return r}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r&&r.ok){const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x)).catch(()=>{})}return r})));
});