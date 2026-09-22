// Sala ao vivo (ETAPA 4): chat em tempo real entre clientes ativos e o administrador.
// Segue o mesmo padrão dos demais módulos: funções globais simples, sem estado próprio,
// consumidas diretamente pelo app cliente e pelo painel admin.

const SALA_AO_VIVO_LIMITE_MENSAGENS = 200;
const SALA_AO_VIVO_TAMANHO_MAXIMO_TEXTO = 500;

// Escuta as últimas mensagens da sala, em ordem cronológica (mais antiga primeiro).
function ouvirSalaAoVivo(callback) {
  return firebase.firestore().collection('salaAoVivo')
    .orderBy('criadoEm', 'desc')
    .limit(SALA_AO_VIVO_LIMITE_MENSAGENS)
    .onSnapshot(snapshot => {
      const mensagens = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      callback(mensagens);
    }, error => console.error('Falha na sincronização da sala ao vivo:', error));
}

// uid/nome/role são do autor da mensagem (gravados junto para exibição rápida,
// sem precisar consultar users/{uid} para cada mensagem recebida).
async function enviarMensagemSala(uid, nome, role, texto) {
  const limpo = String(texto || '').trim().slice(0, SALA_AO_VIVO_TAMANHO_MAXIMO_TEXTO);
  if (!uid || !limpo) return null;
  return firebase.firestore().collection('salaAoVivo').add({
    uid,
    nome: nome || 'Sem nome',
    role: role === 'admin' ? 'admin' : 'cliente',
    texto: limpo,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Exclusão de uma mensagem: o autor pode apagar a própria mensagem; o admin pode
// apagar qualquer uma (moderação). A permissão real é garantida pelas regras do Firestore.
async function excluirMensagemSala(mensagemId) {
  return firebase.firestore().collection('salaAoVivo').doc(mensagemId).delete();
}
