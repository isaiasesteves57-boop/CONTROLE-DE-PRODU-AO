/* =====================================================================
   GESTOR D TRADER — Camada de dados (Store)

   Abstração única para ler/gravar dados. Funciona em 2 modos:

   • LOCAL  — localStorage (padrão, sem configuração). Dados ficam no
              navegador deste aparelho.
   • REMOTO — Firestore, quando o FIREBASE_CONFIG estiver preenchido
              em js/firebase-config.js. Mesma API de programação:
              o resto do código não muda.

   MÓDULO ESPORTIVO — as coleções do antigo Controle de Produção
   (machines, products, productions, employees, orders) foram
   substituídas. Hoje este Store é usado para:

   • jogosPublicados — "Jogos do Dia" (Etapa 4): coleção compartilhada.
     O admin cadastra/edita/remove com ProductionStore.add/update/remove;
     todo cliente ativo (e o admin) recebe as mudanças em tempo real via
     ProductionStore.on/get, graças ao onSnapshot já implementado abaixo.
     Ver também o objeto JogosDoDia no fim deste arquivo (mesma coisa,
     com nomes já prontos para não precisar repetir a string
     "jogosPublicados" no resto do código).

   Estratégias, entradas e resultados (ciclos, ent, historico, operações
   etc.) NÃO passam por este Store: são dados particulares de cada
   cliente e já sincronizam em tempo real com o Firestore por outro
   caminho — um único documento por usuário em dados/{uid} (protegido
   nas firestore.rules para que só o dono e o admin possam ler/escrever),
   lido e gravado diretamente em gestor-app.js. Isso é intencional: este
   Store trabalha com coleções "achatadas" (uma coleção = vários
   documentos, todos no mesmo formato), enquanto os dados do cliente
   formam um perfil único por usuário — por isso vivem num documento só.

   As coleções antigas (machines, products, productions, employees,
   orders, productionOrders, ops, config) continuam bloqueadas nas
   firestore.rules e não são mais referenciadas por nenhum código deste
   projeto.
   ===================================================================== */
(function () {
  const mem = {};        // name -> array em memória
  const subs = {};       // name -> [callbacks]
  const seedMap = {};    // seed por coleção
  let db = null;
  let remoteOn = false;
  const key = n => "cp_" + n;

  try {
    if (window.firebase && firebase.apps && firebase.apps.length) {
      /* O app já inicializou o Firebase antes de carregar este arquivo
         (é o caso do Gestor d Trader: index.html chama firebase.initializeApp
         antes do <script src="./js/store.js">). Reaproveita a mesma instância
         em vez de chamar initializeApp de novo, o que lançaria erro
         ("Firebase App named '[DEFAULT]' already exists") e faria este
         Store cair silenciosamente para o modo local. */
      db = firebase.firestore();
      remoteOn = true;
    } else {
      let rawCfg = {};
      try { rawCfg = (typeof FIREBASE_CONFIG !== "undefined") ? FIREBASE_CONFIG : {}; } catch (e) { }
      const c = rawCfg || {};
      if (c.apiKey && String(c.apiKey).trim() && c.apiKey !== "COLE_AQUI" && window.firebase) {
        firebase.initializeApp(c);
        db = firebase.firestore();
        remoteOn = true;
      }
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
      await db.collection(name).doc(id).set(JSON.parse(JSON.stringify(patch)), { merge: true });
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

  /* Atalho documentado para o módulo esportivo, usando sempre a coleção
     "jogosPublicados". Faz exatamente o que ProductionStore.*("jogosPublicados", ...)
     já fazia — só evita repetir o nome da coleção pelo código e deixa
     claro, para quem ler o projeto depois, qual é a única coleção
     compartilhada ("Jogos do Dia") deste Store. */
  const COL_JOGOS_DO_DIA = "jogosPublicados";
  window.JogosDoDia = {
    iniciar: (seed) => init(COL_JOGOS_DO_DIA, seed || []),
    obter: () => get(COL_JOGOS_DO_DIA),
    aoAtualizar: (cb) => on(COL_JOGOS_DO_DIA, cb),
    publicar: (jogo) => add(COL_JOGOS_DO_DIA, jogo),
    atualizar: (id, patch) => update(COL_JOGOS_DO_DIA, id, patch),
    remover: (id) => remove(COL_JOGOS_DO_DIA, id)
  };
})();