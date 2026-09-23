// A interface pode ocultar telas, mas o bloqueio real deve ser aplicado nas regras do Firestore.
//
// ETAPA 3: além do status (ativo/bloqueado), o acesso agora também considera
// a validade do plano (campo `data_vencimento` gravado pelo admin em `users/{uid}`).

function parseDataVencimento(valor) {
  if (!valor) return null;
  // Timestamp do Firestore
  if (typeof valor.toDate === 'function') return valor.toDate();
  // Número (ms desde epoch)
  if (typeof valor === 'number') return new Date(valor);
  // String no formato 'AAAA-MM-DD' (input type="date" do painel admin):
  // considera o fim do dia como limite de validade.
  if (typeof valor === 'string') {
    const d = new Date(valor + 'T23:59:59');
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function consultarAcessoCliente(uid) {
  const snap = await firebase.firestore().collection('users').doc(uid).get();
  const user = snap.exists ? snap.data() : null;
  if (!user) return { permitido: false, motivo: 'Conta não cadastrada.' };
  if (user.role === 'admin') return { permitido: true, usuario: user };

  if (user.status === 'bloqueado') {
    return { permitido: false, motivo: 'Seu acesso foi bloqueado pelo administrador.', usuario: user };
  }
  if (user.status !== 'ativo') {
    return { permitido: false, motivo: 'Acesso aguardando liberação do administrador.', usuario: user };
  }

  const vencimento = parseDataVencimento(user.data_vencimento);
  if (vencimento && vencimento.getTime() < Date.now()) {
    return { permitido: false, motivo: 'Seu período de acesso expirou.', usuario: user };
  }

  // Compatibilidade com o controle manual de mensalidade já existente (Etapa 1/2):
  // só bloqueia se houver um registro de assinatura explicitamente inativo.
  // Contas que usam apenas o novo modelo (status + data_vencimento) não são afetadas.
  const sub = await firebase.firestore().collection('subscriptions').doc(uid).get();
  const assinatura = sub.exists ? sub.data() : null;
  if (assinatura && assinatura.status && assinatura.status !== 'ativa') {
    return { permitido: false, motivo: 'Mensalidade não liberada.', usuario: user, assinatura };
  }

  return { permitido: true, usuario: user, assinatura };
}
