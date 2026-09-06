/* =====================================================================
   CONTROLE DE PRODUÇÃO — Configuração do Firebase (OPCIONAL)

   COMO ATIVAR O MODO ONLINE (banco compartilhado em qualquer aparelho):

   1. Acesse https://console.firebase.google.com e crie um projeto
      (ex.: "controle-producao").
   2. No menu "Configurações do projeto" → aba "Geral" → "Seus apps",
      clique no ícone da web (</>) para registrar um app web.
   3. Copie o objeto "firebaseConfig" gerado e cole abaixo.
   4. No menu "Build" → "Firestore Database" → "Criar banco de dados"
      (modo teste é mais fácil para começar — restrinja depois).
   5. A PRIMEIRA vez que o app abrir com as chaves preenchidas, ele vai
      criar automaticamente as coleções e registrar as máquinas e
      produtos padrão no banco.

   SEM ESTAS CHAVES o sistema funciona 100% local (localStorage),
   guardando os dados apenas no navegador do aparelho — perfeito para
   testar no começo.

   IMPORTANTE: nunca publique as chaves em repositório público. No
   GitHub Pages o Firebase roda em "modo teste"; para produção de
   verdade, proteja o acesso com regras de segurança.
===================================================================== */
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* Mesmo nome de coleção usado por index.html e admin.html. Não mude
   depois que começar a usar, senão os dados "somem". */
const FIRESTORE_COLLECTIONS = {
  machines: "machines",
  products: "products",
  productions: "productions",
  config: "config"
};