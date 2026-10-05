const CACHE='placar-eleicoes-v7-static';
const STATIC=['./manifest.webmanifest','./assets/elections-icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key.startsWith('placar-eleicoes')&&key!==CACHE).map(key=>caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);

  if(url.hostname.includes('supabase.co')){
    event.respondWith(fetch(event.request));
    return;
  }

  if(event.request.mode==='navigate'||event.request.destination==='document'){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      fetch(event.request).then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>caches.match(event.request))
    );
  }
});