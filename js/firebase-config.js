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
  apiKey: "AIzaSyDboSgv72Pm6kbAyzN72s5CvHnisQxjGts",
  authDomain: "producao-a3ed1.firebaseapp.com",
  projectId: "producao-a3ed1",
  storageBucket: "producao-a3ed1.firebasestorage.app",
  messagingSenderId: "839752522892",
  appId: "1:839752522892:web:1f96a1d5e50b4aa3252fa9"
};

/* Coleções usadas. Não mude depois que começar a usar, senão os dados
   "somem". O store.js usa esses nomes nos S.init/S.add/S.update. */
const FIRESTORE_COLLECTIONS = {
  machines: "machines",
  products: "products",
  productions: "productions",
  config: "config",
  employees: "employees",
  orders: "orders",
  productionOrders: "productionOrders"
};