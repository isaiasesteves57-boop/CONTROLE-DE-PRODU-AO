/* =====================================================================
   CONTROLE DE PRODUÇÃO — Service Worker (PWA)
   Torna o aplicativo disponível offline e instalável no celular.
   Versione o const "VERSION" quando mudar arquivos (cache invalida).
   ===================================================================== */
const VERSION = "cp-v8";

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

  /* Network-first: sempre tenta buscar a versão mais nova primeiro.
     Só usa o cache se estiver offline ou o servidor falhar. Isso evita
     o problema de ficar preso numa versão antiga do app depois de uma
     atualização — antes, o cache era servido primeiro e as mudanças
     publicadas no GitHub podiam demorar indefinidamente para aparecer. */
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && (res.status === 200 || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(cached => cached || (req.mode === "navigate" ? caches.match("./home.html") : undefined))
      )
  );
});