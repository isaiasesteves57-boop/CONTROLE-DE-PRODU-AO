/* =====================================================================
   CONTROLE DE PRODUÇÃO — Service Worker (PWA)
   Torna o aplicativo disponível offline e instalável no celular.
   Versione o const "VERSION" quando mudar arquivos (cache invalida).
   ===================================================================== */
const VERSION = "cp-v7";

const CORE = [
  "./",
  "./home.html",
  "./index.html",
  "./admin.html",
  "./operador.html",
  "./manifest.json",
  "./css/app.css",
  "./css/home.css",
  "./css/operador.css",
  "./js/firebase-config.js",
  "./js/utils.js",
  "./js/store.js",
  "./js/app.js",
  "./js/admin-app.js",
  "./js/operador-app.js",
  "./icons/icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && (res.status === 200 || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      if (req.mode === "navigate" && cached) return cached;
      return cached || network;
    }).catch(() => {
      if (req.mode === "navigate") return caches.match("./home.html");
    })
  );
});