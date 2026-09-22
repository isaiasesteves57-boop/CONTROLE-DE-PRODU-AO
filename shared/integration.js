/* Camada inicial de integração do Gestor d Trader.
   O núcleo do Gestor 2026 foi preservado. */
(function(){
  function bloqueio(msg){
    if(document.getElementById('gdt-access-overlay')) return;
    const el=document.createElement('div'); el.id='gdt-access-overlay';
    el.style='position:fixed;inset:0;background:#101410;color:#eee;z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Arial';
    el.innerHTML='<div><h2>Gestor d Trader</h2><p>'+msg+'</p><button onclick="firebase.auth().signOut().then(()=>location.reload())" style="padding:10px 16px">Sair</button></div>';
    document.body.appendChild(el);
  }
  if(!window.firebase || !firebase.auth || !firebase.firestore) return;
  firebase.auth().onAuthStateChanged(async user=>{
    if(!user) return;
    try{
      const result=await consultarAcessoCliente(user.uid);
      if(!result.permitido) bloqueio(result.motivo || 'Acesso não autorizado.');
      else if(window.ouvirJogosPublicados) window.gdtUnsubscribe=ouvirJogosPublicados(jogos=>window.dispatchEvent(new CustomEvent('gdt:jogos',{detail:jogos})));
    }catch(e){ console.error('Gestor d Trader: falha na validação',e); }
  });
})();
