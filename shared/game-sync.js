// Jogos centralizados: o administrador grava em jogosPublicados; clientes apenas leem.
function ouvirJogosPublicados(callback) {
  return firebase.firestore().collection('jogosPublicados')
    .where('status', '==', 'publicado')
    .orderBy('dataOrdem', 'desc')
    .onSnapshot(snapshot => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, error => console.error('Falha na sincronização dos jogos:', error));
}

async function publicarJogoAdmin(jogo) {
  return firebase.firestore().collection('jogosPublicados').add({
    ...jogo,
    status: 'publicado',
    dataOrdem: jogo.dataOrdem || Date.now(),
    publicadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ETAPA 4: publica (ou atualiza) um jogo específico usando o próprio id do jogo como id
// do documento em jogosPublicados. Mantém a publicação idempotente — publicar de novo o
// mesmo jogo atualiza o mesmo documento em vez de criar uma cópia — e faz com que o admin
// que publicou receba o próprio jogo de volta pelo listener em tempo real com o mesmo id,
// sem duplicar a linha no seu próprio app.
async function publicarJogoComId(id, jogo, publicadoPor) {
  return firebase.firestore().collection('jogosPublicados').doc(id).set({
    ...jogo,
    status: 'publicado',
    dataOrdem: jogo.dataOrdem || Date.now(),
    publicadoPor: publicadoPor || null,
    publicadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function despublicarJogo(id) {
  return firebase.firestore().collection('jogosPublicados').doc(id).delete();
}
