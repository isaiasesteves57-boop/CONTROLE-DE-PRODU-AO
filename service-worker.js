/* ===== Service Worker — Apontamento de Produção =====
   Estratégia: REDE PRIMEIRO (network-first).
   · Online  -> sempre busca a versão mais nova do GitHub Pages (ignora o cache HTTP) e guarda uma cópia.
   · Offline -> usa a cópia guardada, então o app continua abrindo no chão de fábrica.
   Por isso NÃO é mais preciso mexer neste arquivo a cada deploy: index.html, app.js e style.css
   sempre chegam atualizados. Mude CACHE_VERSION só para forçar a limpeza total do cache. */
const CACHE_VERSION = 'v7-2026-09-30-edit-pedidos';
const CACHE_NAME = 'apontamento-' + CACHE_VERSION;
const ARQUIVOS = [
  './', './index.html', './style.css', './app.js', './import-data.js',
  './manifest.json', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    /* Um por um: se algum arquivo faltar (ex.: import-data.js 404), os outros entram mesmo assim
       e a instalação NÃO falha (com cache.addAll, um único 404 cancelava a atualização inteira). */
    await Promise.allSettled(ARQUIVOS.map(u => cache.add(new Request(u, {cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async ()=>{
    const chaves = await caches.keys();
    const antigas = chaves.filter(k => k !== CACHE_NAME);
    await Promise.all(antigas.map(k => caches.delete(k)));
    await self.clients.claim();
    /* Se havia versão antiga instalada, recarrega as abas abertas UMA vez para já mostrarem a nova. */
    if(antigas.length){
      const abas = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      abas.forEach(c => { try{ c.navigate(c.url); }catch(_){} });
    }
  })());
});

self.addEventListener('message', (e)=>{ if(e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // Firebase, CDNs etc. passam direto

  e.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    try{
      const resp = await fetch(url.href, {cache:'no-cache'});   // revalida sempre com o servidor
      if(resp && resp.status === 200) cache.put(req, resp.clone());
      return resp;
    }catch(_){
      const guardado = await cache.match(req, {ignoreSearch:true});
      if(guardado) return guardado;
      if(req.mode === 'navigate'){
        const inicio = await cache.match('./index.html') || await cache.match('./');
        if(inicio) return inicio;
      }
      return new Response('Sem conexão e sem cópia guardada.', {status:503, statusText:'Offline'});
    }
  })());
});
