/* =====================================================================
   CONTROLE DE PRODUÇÃO — Camada de dados (Store)

   Abstração única para ler/gravar dados. Funciona em 2 modos:

   • LOCAL  — localStorage (padrão, sem configuração). Dados ficam no
              navegador deste aparelho.
   • REMOTO — Firestore, quando o FIREBASE_CONFIG estiver preenchido
              em js/firebase-config.js. Mesma API de programação:
              o resto do código não muda.

   Coleções usadas (módulo 1): config, machines, products, productions.
   ===================================================================== */
(function () {
  const mem = {};        // name -> array em memória
  const subs = {};       // name -> [callbacks]
  const seedMap = {};    // seed por coleção
  let db = null;
  let remoteOn = false;
  const key = n => "cp_" + n;

  try {
    let rawCfg = {};
    try { rawCfg = (typeof FIREBASE_CONFIG !== "undefined") ? FIREBASE_CONFIG : {}; } catch (e) { }
    const c = rawCfg || {};
    if (c.apiKey && String(c.apiKey).trim() && c.apiKey !== "COLE_AQUI" && window.firebase) {
      firebase.initializeApp(c);
      db = firebase.firestore();
      remoteOn = true;
    }
  } catch (e) {
    console.warn("Firebase não inicializado, usando modo local:", e);
    db = null;
    remoteOn = false;
  }

  function readLS(n) {
    try {
      const r = localStorage.getItem(key(n));
      return r ? JSON.parse(r) : null;
    } catch (e) { return null; }
  }
  function writeLS(n, v) {
    try { localStorage.setItem(key(n), JSON.stringify(v)); } catch (e) { }
  }

  function notify(n) {
    const arr = mem[n] || [];
    (subs[n] || []).forEach(cb => {
      try { cb(arr.slice()); } catch (e) { console.warn(e); }
    });
  }

  /* Inicializa uma coleção. 'seed' é usado apenas quando ainda não
     existem dados (primeira execução local ou banco vazio). */
  function init(name, seed) {
    seedMap[name] = seed || [];

    if (remoteOn) {
      /* Usa o cache local imediatamente (dados abrem na hora e o app
         continua útil mesmo offline); o snapshot do Firestore atualiza. */
      const localCached = readLS(name);
      if (localCached !== null) {
        mem[name] = localCached;
        notify(name);
      }
      db.collection(name).onSnapshot(snap => {
        const docs = snap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
        if (snap.empty && seedMap[name].length) {
          const b = db.batch();
          seedMap[name].forEach(it => {
            const copy = JSON.parse(JSON.stringify(it));
            b.set(db.collection(name).doc(copy.id), copy);
          });
          b.commit().then(() => console.log("Seed de '" + name + "' salvo no Firestore."))
                    .catch(e => console.warn("Erro ao salvar seed:", e));
          return; // o próximo snapshot carrega os dados
        }
        mem[name] = docs;
        writeLS(name, docs);
        notify(name);
      }, err => {
        console.warn("Erro no Firestore ('" + name + "'):", err);
      });
      return;
    }

    const local = readLS(name);
    mem[name] = local !== null ? local : seedMap[name];
    if (local === null) writeLS(name, mem[name]);
    notify(name);
  }

  function get(name) {
    return (mem[name] || []).slice();
  }

  function on(name, cb) {
    (subs[name] = subs[name] || []).push(cb);
  }

  async function add(name, item) {
    const withId = Object.assign({}, item, { id: item.id || U.uid() });
    if (remoteOn) {
      await db.collection(name).doc(withId.id).set(JSON.parse(JSON.stringify(withId)));
      return withId;
    }
    mem[name] = (mem[name] || []).concat([withId]);
    writeLS(name, mem[name]);
    notify(name);
    return withId;
  }

  async function update(name, id, patch) {
    if (remoteOn) {
      await db.collection(name).doc(id).update(JSON.parse(JSON.stringify(patch)));
      return;
    }
    mem[name] = (mem[name] || []).map(it => (it.id === id ? Object.assign({}, it, patch) : it));
    writeLS(name, mem[name]);
    notify(name);
  }

  async function remove(name, id) {
    if (remoteOn) {
      await db.collection(name).doc(id).delete();
      return;
    }
    mem[name] = (mem[name] || []).filter(it => it.id !== id);
    writeLS(name, mem[name]);
    notify(name);
  }

  window.ProductionStore = {
    init: init,
    on: on,
    get: get,
    add: add,
    update: update,
    remove: remove,
    isRemote: () => remoteOn
  };
})();