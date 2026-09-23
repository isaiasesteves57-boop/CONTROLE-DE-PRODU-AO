const CACHE = "gestor-banca-v13.2.4";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS))
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (evento) => {
  if (evento.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html"))
        )
    );
    return;
  }
  evento.respondWith(
    caches.match(evento.request).then((resp) => {
      const buscaRede = fetch(evento.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(evento.request, clone));
          }
          return res;
        })
        .catch(() => resp);
      return resp || buscaRede;
    })
  );
});
