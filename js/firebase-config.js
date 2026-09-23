/* =====================================================================
   GESTOR D TRADER — Configuração do Firebase

   Projeto Firebase único e definitivo do Gestor d Trader: é o mesmo
   projeto do antigo Controle de Produção (producao-a3ed1-ba5a3),
   decisão registrada na Etapa 1 — os dados de produção (máquinas,
   produtos, OPs) não são mais usados, mas o projeto em si foi
   reaproveitado, então as chaves abaixo continuam as mesmas.

   SEM ESTAS CHAVES o sistema funciona 100% local (localStorage),
   guardando os dados apenas no navegador do aparelho.

   IMPORTANTE: nunca publique as chaves em repositório público sem as
   regras de segurança (firestore.rules) publicadas no Console do
   Firebase — são elas que realmente protegem os dados, não o
   segredo da chave.
===================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDboSgv72Pm6kbAyzN72s5CvHnisQxjGts",
  authDomain: "producao-a3ed1.firebaseapp.com",
  projectId: "producao-a3ed1",
  storageBucket: "producao-a3ed1.firebasestorage.app",
  messagingSenderId: "839752522892",
  appId: "1:839752522892:web:1f96a1d5e50b4aa3252fa9"
};

/* Coleções realmente usadas pelo Gestor d Trader hoje. Não mude estes
   nomes depois que o app já estiver em uso, senão os dados "somem"
   (o app passaria a ler/escrever em outro lugar do banco).

   • admins       — admins/{uid}: só leitura do próprio documento;
                     quem é admin é decidido manualmente no Console.
   • clientes     — clientes/{uid}: cadastro/status de cada cliente.
   • dados        — dados/{uid}: perfil particular de cada cliente
                     (ciclos, entradas, resultados, estratégias, jogos
                     do dia importados, preferências...). Um documento
                     por usuário, lido/gravado direto em gestor-app.js.
   • jogosPublicados — "Jogos do Dia" compartilhado: o admin publica,
                     todo cliente ativo recebe em tempo real. Usado
                     pelo store.js (ProductionStore / JogosDoDia). */
const FIRESTORE_COLLECTIONS = {
  admins: "admins",
  clientes: "clientes",
  dados: "dados",
  jogosPublicados: "jogosPublicados"
};
