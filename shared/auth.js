// Camada de autenticação para ser chamada pelo aplicativo cliente.
function iniciarAutenticacaoGestor() {
  if (!window.firebase || !firebase.auth) throw new Error('Firebase Auth não carregado.');
  return firebase.auth();
}

async function criarContaCliente(email, senha, nome) {
  const auth = iniciarAutenticacaoGestor();
  const cred = await auth.createUserWithEmailAndPassword(email, senha);
  await firebase.firestore().collection('users').doc(cred.user.uid).set({
    nome: nome || '', email, role: 'cliente', status: 'pendente', criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return cred.user;
}
