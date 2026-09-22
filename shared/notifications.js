function ouvirMensagens(uid, callback) {
  return firebase.firestore().collection('mensagens')
    .where('ativa', '==', true)
    .onSnapshot(snapshot => {
      const mensagens = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => !m.destinatarioUid || m.destinatarioUid === uid);
      callback(mensagens);
    });
}
