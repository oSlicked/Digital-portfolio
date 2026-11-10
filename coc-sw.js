// Offline support for the CoC planner only. Network first, so updates show right away; falls back to the saved copy offline.
const C='coc-planner-cache-v1';
const MINE=['/coc','/coc.html','/coc.webmanifest','/coc-icon-180.png','/coc-icon-192.png','/coc-icon-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(MINE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  const mine=(u.origin===location.origin&&(u.pathname==='/coc'||u.pathname.startsWith('/coc')))||/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(e.request.method!=='GET'||!mine) return;
  e.respondWith(fetch(e.request).then(r=>{ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return r; })
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('/coc'))));
});
