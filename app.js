/* ===== Apontamento de Produção Industrial - app.js =====
   Armazenamento: localStorage (estrutura pronta para trocar por
   Firebase/Supabase depois - ver funções DB.get/DB.set). */

const DB = {
  get(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def; }catch(e){ return def; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

const hoje = () => new Date().toISOString().slice(0,10);

/* ---------- HELPERS (OP / apontamento) ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2 = n => String(n).padStart(2,'0');
/* "2026-09-28" -> "28/09/2026" (sem passar por Date, evita erro de fuso) */
function fmtDataISO(s){ const m = String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
function fmtDataHora(iso){
  const d = new Date(iso); if(isNaN(d)) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const semAcento = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const semZeros  = s => String(s||'').replace(/^0+/,'') || '0';          // "0001" -> "1"
const normOP    = s => String(s||'').toLowerCase().replace(/[^0-9a-z]/g,''); // compara OP ignorando pontos/traços
const mesmaOP   = (a,b) => normOP(a) !== '' && normOP(a) === normOP(b);

/* ---------- SEED (dados iniciais, só roda se estiver vazio) ---------- */
function seed(){
  if(!DB.get('produtos')){
    DB.set('produtos',[
      {id:1,nome:'Agenda',codigo:'',ativo:true},
      {id:2,nome:'Caderno',codigo:'',ativo:true},
      {id:3,nome:'Capa',codigo:'',ativo:true},
      {id:4,nome:'Bloco',codigo:'',ativo:true},
    ]);
  }
  if(!DB.get('modelos')){
    DB.set('modelos',[
      {id:1,produtoId:1,nome:'Agenda Clássica'},
      {id:2,produtoId:1,nome:'Agenda Média'},
      {id:3,produtoId:1,nome:'Agenda Executiva'},
      {id:4,produtoId:2,nome:'Universitário'},
      {id:5,produtoId:2,nome:'Executivo'},
      {id:6,produtoId:2,nome:'Brochura'},
    ]);
  }
  if(!DB.get('folhas')){
    DB.set('folhas',[
      {id:1,produtoId:2,qtd:'80 folhas'},
      {id:2,produtoId:2,qtd:'140 folhas'},
      {id:3,produtoId:2,qtd:'160 folhas'},
      {id:4,produtoId:2,qtd:'200 folhas'},
    ]);
  }
  if(!DB.get('furacoes')) DB.set('furacoes',['Espiral','Fichário','Smart','Wire-o']);
  if(!DB.get('acabamentos')) DB.set('acabamentos',['Escanteado','Arredondado','Reto','Especial']);
  if(!DB.get('pedidos')) DB.set('pedidos',[]);
  if(!DB.get('apontamentos')) DB.set('apontamentos',[]);
  if(!DB.get('seqPedido')) DB.set('seqPedido',0);

  /* Migração OP (roda uma única vez). Só ACRESCENTA campos vazios; nada existente é reescrito.
     pedido.numero_op (opcional) · apontamento.numeroOp / origem ('Manual'|'Áudio') / criadoEm */
  if(!DB.get('schemaOP',false)){
    const ps = DB.get('pedidos',[]);
    ps.forEach(p=>{ if(p.numero_op === undefined) p.numero_op = ''; });
    DB.set('pedidos', ps);
    const as = DB.get('apontamentos',[]);
    as.forEach(a=>{
      if(a.numeroOp === undefined) a.numeroOp = '';
      if(a.origem   === undefined) a.origem   = 'Manual';
    });
    DB.set('apontamentos', as);
    DB.set('schemaOP', true);
  }

  /* Migração ETAPAS (roda uma única vez). Pedidos antigos viram tipoProcesso 'reto'
     (comportamento igual ao de antes: finaliza assim que a produção bate a quantidade).
     Apontamentos antigos sem etapa contam como 'furacao'. Cria o histórico inicial. */
  if(!DB.get('schemaEtapas',false)){
    const ps = DB.get('pedidos',[]);
    ps.forEach(p=>{
      if(p.tipoProcesso === undefined) p.tipoProcesso = 'reto';
      if(!Array.isArray(p.historico)){
        p.historico = [{data:p.data||hoje(), hora:'', usuario:'', operacao:'Entrada do pedido', quantidade:p.quantidade}];
      }
    });
    DB.set('pedidos', ps);
    const as = DB.get('apontamentos',[]);
    as.forEach(a=>{ if(a.etapa === undefined) a.etapa = 'furacao'; });
    DB.set('apontamentos', as);
    DB.set('schemaEtapas', true);
  }

  /* Migração ESCANTEIO (roda uma única vez): pedidos com Acabamento "Escanteado" que ficaram
     "concluídos" só pela furação voltam para "aberto" e passam a aceitar lançamento de escanteamento.
     Não apaga nem altera apontamentos. */
  if(!DB.get('schemaEscanteio',false)){
    const ps = DB.get('pedidos',[]);
    ps.forEach(p=>{
      if(ehEscanteado(p) && p.tipoProcesso !== 'escanteado') p.tipoProcesso = 'escanteado';
      if(p.status === 'concluido' && !statusPedido(p).pronto) p.status = 'aberto';
    });
    DB.set('pedidos', ps);
    DB.set('schemaEscanteio', true);
  }
}
seed();

/* ---------- NAVEGAÇÃO ---------- */
document.getElementById('hoje').textContent = new Date().toLocaleDateString('pt-BR');
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('view-'+t.dataset.tab).classList.add('active');
    if(t.dataset.tab==='dashboard') renderDashboard();
    if(t.dataset.tab==='pedidos') renderPedidos();
    if(t.dataset.tab==='apontamento') renderApontamentoView();
    if(t.dataset.tab==='estoque') renderEstoque();
    if(t.dataset.tab==='registros') renderRegistros();
  };
});
document.querySelectorAll('.ctab').forEach(t=>{
  t.onclick=()=>{
    document.querySelectorAll('.ctab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.cad-view').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('cad-'+t.dataset.c).classList.add('active');
    renderCadastros();
  };
});

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2200);
}

/* ---------- HELPERS DE SELECT ---------- */
function fillProdutoSelects(){
  const produtos = DB.get('produtos',[]).filter(p=>p.ativo);
  document.querySelectorAll('#pProduto,#aProduto,#eProduto,#cProduto,#cmProduto,#cfProduto').forEach(sel=>{
    const cur = sel.value;
    sel.innerHTML = produtos.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
    if(cur) sel.value = cur;
  });
}
function fillModeloSelect(prodSelId, modeloSelId){
  const pid = Number(document.getElementById(prodSelId).value);
  const modelos = DB.get('modelos',[]).filter(m=>m.produtoId===pid);
  document.getElementById(modeloSelId).innerHTML = modelos.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
}
function fillFolhasSelect(){
  const pid = Number(document.getElementById('pProduto').value);
  const folhas = DB.get('folhas',[]).filter(f=>f.produtoId===pid);
  document.getElementById('pFolhas').innerHTML = '<option value="">--</option>'+folhas.map(f=>`<option value="${f.qtd}">${f.qtd}</option>`).join('');
}
function fillListasSimples(){
  document.getElementById('pFuracao').innerHTML = DB.get('furacoes',[]).map(f=>`<option>${f}</option>`).join('');
  document.getElementById('pAcabamento').onchange = ()=>{ if(/escant/i.test(document.getElementById('pAcabamento').value)) document.getElementById('pTipoProcesso').value = 'escanteado'; };
  document.getElementById('pAcabamento').innerHTML = DB.get('acabamentos',[]).map(f=>`<option>${f}</option>`).join('');
}
document.getElementById('pProduto')?.addEventListener('change',()=>{fillModeloSelect('pProduto','pModelo');fillFolhasSelect();});
document.getElementById('aProduto')?.addEventListener('change',()=>{fillModeloSelect('aProduto','aModelo');atualizarEstoqueDisponivel();});
document.getElementById('cmProduto')?.addEventListener('change',()=>{});
document.getElementById('eProduto')?.addEventListener('change',()=>{fillModeloSelect('eProduto','eModelo');});
document.getElementById('cProduto')?.addEventListener('change',()=>{fillModeloSelect('cProduto','cModelo');renderConsultaEstoque();});
document.getElementById('cModelo')?.addEventListener('change',renderConsultaEstoque);
document.getElementById('ePallets')?.addEventListener('input',atualizarQuantidadeEntradaAuto);
document.getElementById('ePorPallet')?.addEventListener('input',atualizarQuantidadeEntradaAuto);
document.getElementById('aModelo')?.addEventListener('change',atualizarEstoqueDisponivel);
document.getElementById('aOrigemMaterial')?.addEventListener('change',atualizarOrigemApontamento);

function initForms(){
  fillProdutoSelects();
  fillModeloSelect('pProduto','pModelo');
  fillFolhasSelect();
  fillListasSimples();
  fillModeloSelect('aProduto','aModelo');
  if(document.getElementById('eProduto')){
    document.getElementById('eData').value = hoje();
    fillModeloSelect('eProduto','eModelo');
  }
  if(document.getElementById('cProduto')){
    fillProdutoSelects();
    fillModeloSelect('cProduto','cModelo');
  }
  document.getElementById('pData').value = hoje();
  document.getElementById('aData').value = hoje();
  document.getElementById('aUsuario').value = usuarioAtual();
  if(document.getElementById('aOrigemMaterial')) document.getElementById('aOrigemMaterial').value='pedido';
  atualizarOrigemApontamento();
  atualizarEtapaSelect(null);
  atualizarOrigemApontamento();
  renderPedidoSelectApontamento();
}
initForms();

/* ---------- ESTOQUE / MATERIAL PARA PRODUZIR ---------- */
function getEntradasEstoque(){ return DB.get('estoqueEntradas',[]); }
function consumoEstoque(produtoId, modeloId){
  // Todo material efetivamente furado consome estoque, independentemente de
  // estar vinculado a um pedido ou ser uma produção sem pedido.
  // Escanteamento é uma etapa posterior e não deve consumir o material novamente.
  return DB.get('apontamentos',[])
    .filter(a=>(a.etapa||'furacao')==='furacao' && Number(a.produtoId)===Number(produtoId) && Number(a.modeloId)===Number(modeloId))
    .reduce((s,a)=>s+Number(a.produzido||0),0);
}
function entradaEstoqueTotal(produtoId, modeloId){
  return getEntradasEstoque()
    .filter(e=>Number(e.produtoId)===Number(produtoId) && Number(e.modeloId)===Number(modeloId))
    .reduce((s,e)=>s+Number(e.quantidade||0),0);
}
function saldoEstoque(produtoId, modeloId){ return Math.max(entradaEstoqueTotal(produtoId,modeloId)-consumoEstoque(produtoId,modeloId),0); }
function atualizarEstoqueDisponivel(){
  const out=document.getElementById('aEstoqueDisponivel'); if(!out) return;
  const pid=Number(document.getElementById('aProduto')?.value), mid=Number(document.getElementById('aModelo')?.value);
  // O estoque é sempre a fonte física, tanto para produção com pedido quanto sem pedido.
  out.value = pid&&mid ? saldoEstoque(pid,mid).toLocaleString('pt-BR') : '-';
}
function atualizarOrigemApontamento(){
  // O estoque é sempre a fonte física do material. Este seletor apenas define
  // se a produção está vinculada a um pedido ou se é uma produção sem pedido.
  const origem=document.getElementById('aOrigemMaterial')?.value||'pedido';
  const pedido=document.getElementById('aPedido');
  const op=document.getElementById('aOP');
  const semPedido=origem==='estoque';
  if(pedido){ pedido.disabled=semPedido; if(semPedido) pedido.value=''; }
  if(op){ op.disabled=semPedido; if(semPedido) op.value=''; }
  atualizarEstoqueDisponivel();
  atualizarCalculo();
}
function atualizarQuantidadeEntradaAuto(){
  const pallets=Number(document.getElementById('ePallets')?.value)||0;
  const porPallet=Number(document.getElementById('ePorPallet')?.value)||0;
  const out=document.getElementById('eQuantidade');
  if(!out) return;
  if(pallets>0 && porPallet>0){
    out.value = String(pallets*porPallet);
    out.dataset.auto='true';
  }
}
function registrarEntradaEstoque(){
  const produtoId=Number(document.getElementById('eProduto')?.value);
  const modeloId=Number(document.getElementById('eModelo')?.value);
  const pallets=Number(document.getElementById('ePallets')?.value)||0;
  const porPallet=Number(document.getElementById('ePorPallet')?.value)||0;
  // A quantidade total é preenchida automaticamente quando há pallets completos,
  // mas permanece editável para casos de pallet incompleto.
  const quantidade=Number(document.getElementById('eQuantidade')?.value)||0;
  if(!produtoId||!modeloId||!quantidade||quantidade<1) return toast('Informe produto, modelo e quantidade recebida');
  const entradas=getEntradasEstoque();
  entradas.push({
    id:Date.now(), produtoId, modeloId, quantidade, pallets, porPallet,
    data:document.getElementById('eData')?.value||hoje(),
    origem:document.getElementById('eOrigem')?.value.trim()||'',
    obs:document.getElementById('eObs')?.value.trim()||'', criadoEm:new Date().toISOString()
  });
  DB.set('estoqueEntradas',entradas);
  ['ePallets','ePorPallet','eQuantidade','eOrigem','eObs'].forEach(id=>{ const el=document.getElementById(id); if(el) { el.value=''; delete el.dataset.auto; } });
  renderEstoque(); atualizarEstoqueDisponivel(); renderConsultaEstoque(); toast(`Entrada de ${quantidade.toLocaleString('pt-BR')} registrada no estoque`);
}
function renderConsultaEstoque(){
  const resumo=document.getElementById('consultaEstoqueResumo');
  const detalhes=document.getElementById('consultaEstoqueDetalhes');
  const pid=Number(document.getElementById('cProduto')?.value);
  const mid=Number(document.getElementById('cModelo')?.value);
  if(!resumo||!detalhes) return;
  if(!pid||!mid){
    resumo.innerHTML='';
    detalhes.innerHTML='<p class="meta">Selecione um produto e um modelo para consultar o estoque.</p>';
    return;
  }
  const entradas=getEntradasEstoque().filter(e=>Number(e.produtoId)===pid && Number(e.modeloId)===mid);
  const usos=DB.get('apontamentos',[]).filter(a=>(a.etapa||'furacao')==='furacao' && Number(a.produtoId)===pid && Number(a.modeloId)===mid).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')) || Number(b.id||0)-Number(a.id||0));
  const recebido=entradas.reduce((s,e)=>s+Number(e.quantidade||0),0);
  const usado=usos.reduce((s,a)=>s+Number(a.produzido||0),0);
  const saldo=Math.max(recebido-usado,0);
  resumo.innerHTML=`<div class="card"><b>${recebido.toLocaleString('pt-BR')}</b><span>Total recebido</span></div><div class="card"><b>${usado.toLocaleString('pt-BR')}</b><span>Total já usado</span></div><div class="card"><b>${saldo.toLocaleString('pt-BR')}</b><span>Saldo em estoque</span></div>`;
  const nome=`${esc(nomeProduto(pid))} — ${esc(nomeModelo(mid))}`;
  const entradasHtml=entradas.slice().reverse().map(e=>`<div class="item"><div class="row"><h4>📥 Entrada</h4><span class="tag">+${Number(e.quantidade||0).toLocaleString('pt-BR')}</span></div><div class="meta">${fmtDataISO(e.data)}${e.pallets?` · ${e.pallets} pallet(s)`:''}${e.porPallet?` · ${Number(e.porPallet).toLocaleString('pt-BR')} por pallet`:''}</div>${e.origem?`<div class="meta">Origem: ${esc(e.origem)}</div>`:''}${e.obs?`<div class="meta">${esc(e.obs)}</div>`:''}</div>`).join('') || '<p class="meta">Nenhuma entrada registrada para este material.</p>';
  const usosHtml=usos.map(a=>{
    const ped=DB.get('pedidos',[]).find(p=>Number(p.id)===Number(a.pedidoId));
    const origem=a.origemMaterial==='Estoque'?'Produção sem pedido':'Produção vinculada a pedido';
    return `<div class="item"><div class="row"><h4>📤 Uso na produção</h4><span class="tag">-${Number(a.produzido||0).toLocaleString('pt-BR')}</span></div><div class="meta">${fmtDataISO(a.data)} · ${origem}${ped?.numero?` · Pedido ${esc(ped.numero)}`:''}${a.numeroOp?` · OP ${esc(a.numeroOp)}`:''}</div><div class="meta">Quantidade produzida: <b>${Number(a.produzido||0).toLocaleString('pt-BR')}</b>${Number(a.defeito||0)?` · Defeitos: ${Number(a.defeito).toLocaleString('pt-BR')}`:''}</div></div>`;
  }).join('') || '<p class="meta">Nenhuma produção consumiu este material ainda.</p>';
  detalhes.innerHTML=`<h3>📦 ${nome}</h3><div class="progress"><div style="width:${recebido?Math.min(100,(usado/recebido)*100):0}%"></div></div><p class="meta">Consumo acumulado: ${recebido?Math.min(100,(usado/recebido)*100).toFixed(1):'0'}%</p><h3>📥 Entradas</h3><div class="lista-pedidos">${entradasHtml}</div><h3>📤 O que já foi usado</h3><div class="lista-pedidos">${usosHtml}</div><div class="item estoque-saldo-final"><div class="row"><h4>📦 Ainda existe em estoque</h4><span class="tag">${saldo.toLocaleString('pt-BR')} unidades</span></div><div class="meta">${recebido.toLocaleString('pt-BR')} recebidas − ${usado.toLocaleString('pt-BR')} usadas = <b>${saldo.toLocaleString('pt-BR')} disponíveis</b></div></div>`;
}
function renderEstoque(){
  const entradas=getEntradasEstoque();
  const combos={};
  entradas.forEach(e=>{
    const key=`${e.produtoId}|${e.modeloId}`;
    if(!combos[key]) combos[key]={produtoId:e.produtoId,modeloId:e.modeloId,entrada:0};
    combos[key].entrada+=Number(e.quantidade||0);
  });
  // Inclui também modelos que já aparecem em produções do estoque, mesmo que a entrada original tenha sido removida de um backup antigo.
  DB.get('apontamentos',[]).filter(a=>a.origemMaterial==='Estoque').forEach(a=>{
    const key=`${a.produtoId}|${a.modeloId}`;
    if(!combos[key]) combos[key]={produtoId:a.produtoId,modeloId:a.modeloId,entrada:0};
  });
  const arr=Object.values(combos).map(x=>({...x,consumido:consumoEstoque(x.produtoId,x.modeloId),saldo:saldoEstoque(x.produtoId,x.modeloId)}))
    .sort((a,b)=>a.produtoId-b.produtoId || a.modeloId-b.modeloId);
  const totalEntrada=arr.reduce((s,x)=>s+x.entrada,0), totalConsumo=arr.reduce((s,x)=>s+x.consumido,0), totalSaldo=arr.reduce((s,x)=>s+x.saldo,0);
  const resumo=document.getElementById('resumoEstoque');
  if(resumo) resumo.innerHTML=`<div class="card"><b>${totalEntrada.toLocaleString('pt-BR')}</b><span>Total recebido</span></div><div class="card"><b>${totalConsumo.toLocaleString('pt-BR')}</b><span>Total produzido / consumido</span></div><div class="card"><b>${totalSaldo.toLocaleString('pt-BR')}</b><span>Material disponível</span></div>`;
  const lista=document.getElementById('listaEstoque');
  if(lista) lista.innerHTML=arr.map(x=>`<div class="item"><div class="row"><h4>${esc(nomeProduto(x.produtoId))} — ${esc(nomeModelo(x.modeloId))}</h4><span class="tag">${x.saldo.toLocaleString('pt-BR')} disponíveis</span></div><div class="meta">Recebido: ${x.entrada.toLocaleString('pt-BR')} · Produzido / consumido: ${x.consumido.toLocaleString('pt-BR')} · Saldo: <b>${x.saldo.toLocaleString('pt-BR')}</b></div><div class="progress"><div style="width:${x.entrada?Math.min(100,(x.consumido/x.entrada)*100):0}%"></div></div></div>`).join('') || '<p class="meta">Nenhum material recebido no estoque ainda.</p>';
  const hist=document.getElementById('historicoEstoque');
  if(hist) hist.innerHTML=entradas.slice().reverse().map(e=>`<div class="item"><div class="row"><h4>${esc(nomeProduto(e.produtoId))} — ${esc(nomeModelo(e.modeloId))}</h4><span class="tag">+${Number(e.quantidade||0).toLocaleString('pt-BR')}</span></div><div class="meta">Entrada: ${fmtDataISO(e.data)}${e.pallets?` · ${e.pallets} pallet(s)${e.porPallet?` × ${Number(e.porPallet).toLocaleString('pt-BR')}`:''}`:''}${e.origem?' · Origem: '+esc(e.origem):''}</div>${e.obs?`<div class="meta">${esc(e.obs)}</div>`:''}</div>`).join('') || '<p class="meta">Nenhuma entrada registrada.</p>';
}
renderEstoque();
renderConsultaEstoque();

/* ---------- CADASTROS ---------- */
function addProduto(){
  const nome = document.getElementById('cpNome').value.trim();
  if(!nome) return toast('Informe o nome do produto');
  const codigo = document.getElementById('cpCodigo').value.trim();
  const list = DB.get('produtos',[]);
  list.push({id:Date.now(),nome,codigo,ativo:true});
  DB.set('produtos',list);
  document.getElementById('cpNome').value=''; document.getElementById('cpCodigo').value='';
  fillProdutoSelects(); renderCadastros(); toast('Produto adicionado');
}
function addModelo(){
  const produtoId = Number(document.getElementById('cmProduto').value);
  const nome = document.getElementById('cmNome').value.trim();
  if(!nome || !produtoId) return toast('Preencha produto e nome do modelo');
  const list = DB.get('modelos',[]);
  list.push({id:Date.now(),produtoId,nome});
  DB.set('modelos',list);
  document.getElementById('cmNome').value='';
  renderCadastros(); toast('Modelo adicionado');
}
function addFolha(){
  const produtoId = Number(document.getElementById('cfProduto').value);
  const qtd = document.getElementById('cfQtd').value.trim();
  if(!qtd || !produtoId) return toast('Preencha produto e quantidade');
  const list = DB.get('folhas',[]);
  list.push({id:Date.now(),produtoId,qtd});
  DB.set('folhas',list);
  document.getElementById('cfQtd').value='';
  renderCadastros(); toast('Adicionado');
}
function addSimples(key, inputId, listId){
  const val = document.getElementById(inputId).value.trim();
  if(!val) return toast('Informe um nome');
  const list = DB.get(key,[]);
  list.push(val); DB.set(key,list);
  document.getElementById(inputId).value='';
  fillListasSimples(); renderCadastros(); toast('Adicionado');
}
function removerItem(key, id){
  let list = DB.get(key,[]);
  list = typeof id==='number' ? list.filter(i=>i.id!==id) : list.filter(i=>i!==id);
  DB.set(key,list);
  fillProdutoSelects(); fillListasSimples(); renderCadastros();
}

function renderCadastros(){
  const produtos = DB.get('produtos',[]);
  document.getElementById('listaProdutos').innerHTML = produtos.map(p=>`
    <div class="item"><div class="row"><h4>${p.nome} ${p.codigo?`<span class="tag">${p.codigo}</span>`:''}</h4>
    <button class="del" onclick="removerItem('produtos',${p.id})">✕</button></div></div>`).join('') || '<p class="meta">Nenhum produto.</p>';

  const modelos = DB.get('modelos',[]);
  document.getElementById('listaModelos').innerHTML = modelos.map(m=>{
    const prod = produtos.find(p=>p.id===m.produtoId);
    return `<div class="item"><div class="row"><h4>${m.nome} <span class="tag">${prod?prod.nome:'?'}</span></h4>
    <button class="del" onclick="removerItem('modelos',${m.id})">✕</button></div></div>`;
  }).join('') || '<p class="meta">Nenhum modelo.</p>';

  const folhas = DB.get('folhas',[]);
  document.getElementById('listaFolhas').innerHTML = folhas.map(f=>{
    const prod = produtos.find(p=>p.id===f.produtoId);
    return `<div class="item"><div class="row"><h4>${f.qtd} <span class="tag">${prod?prod.nome:'?'}</span></h4>
    <button class="del" onclick="removerItem('folhas',${f.id})">✕</button></div></div>`;
  }).join('') || '<p class="meta">Nenhuma quantidade cadastrada.</p>';

  document.getElementById('listaFuracao').innerHTML = DB.get('furacoes',[]).map(f=>`
    <div class="item"><div class="row"><h4>${f}</h4><button class="del" onclick="removerItem('furacoes','${f}')">✕</button></div></div>`).join('');
  document.getElementById('listaAcabamento').innerHTML = DB.get('acabamentos',[]).map(f=>`
    <div class="item"><div class="row"><h4>${f}</h4><button class="del" onclick="removerItem('acabamentos','${f}')">✕</button></div></div>`).join('');
}
renderCadastros();

/* ---------- PEDIDOS ---------- */
function nomeProduto(id){ return DB.get('produtos',[]).find(p=>p.id===Number(id))?.nome || '?'; }
function nomeModelo(id){ return DB.get('modelos',[]).find(m=>m.id===Number(id))?.nome || '?'; }

function tituloPedido(p){
  const prod = nomeProduto(p.produtoId), mod = nomeModelo(p.modeloId);
  const base = mod.toLowerCase().startsWith(prod.toLowerCase()) ? mod : `${prod} ${mod}`;
  return base + (p.descricao?` — ${p.descricao}`:'') + (p.tamanho?` (${p.tamanho})`:'');
}

function produzidoValidoDoPedido(pedidoId){
  return DB.get('apontamentos',[])
    .filter(a=>a.pedidoId===pedidoId)
    .reduce((s,a)=> s + (a.produzido - a.defeito), 0);
}

/* Pedido escanteado = Tipo de processo "Escanteado" OU Acabamento "Escanteado".
   (Antes só o Tipo de processo era lido; quem escolhia o escanteio no Acabamento
   tinha o pedido tratado como "reto" e concluído logo após a furação.) */
function ehEscanteado(p){
  return !!p && (p.tipoProcesso === 'escanteado' || /escant/i.test(p.acabamento || ''));
}

/* Regra do escanteamento: só pode escantear o que já foi furado e ainda não foi escanteado.
   Devolve a mensagem de erro, ou '' se estiver tudo certo. */
function erroEscanteamento(p, valido){
  const furada = quantidadeEtapa(p.id,'furacao');
  const escanteada = quantidadeEtapa(p.id,'escanteamento');
  const disponivel = furada - escanteada;
  if(furada <= 0) return 'Ainda não há material furado neste pedido para escantear';
  if(valido > disponivel) return `Só há ${Math.max(disponivel,0)} peças furadas aguardando escanteamento`;
  return '';
}

/* Soma válida (produzido - defeito) lançada numa etapa ('furacao'|'escanteamento') de um pedido */
function quantidadeEtapa(pedidoId, etapa){
  return DB.get('apontamentos',[])
    .filter(a=>a.pedidoId===pedidoId && (a.etapa||'furacao')===etapa)
    .reduce((s,a)=> s + (a.produzido - a.defeito), 0);
}

/* Status de produção do pedido conforme o fluxo:
   ENTRADA -> APURAÇÃO -> FURAÇÃO -> (reto: MATERIAL PRONTO) | (escanteado: ESCANTEAMENTO -> MATERIAL PRONTO)
   Devolve {texto, etapaAtual, furada, escanteada, saldo, pronto} */
function statusPedido(p){
  const furada = quantidadeEtapa(p.id,'furacao');
  const escanteado = ehEscanteado(p);
  // O escanteamento é uma etapa independente da furação para fins de exibição.
  // Mesmo enquanto ainda faltam peças para completar a furação, os lançamentos
  // de escanteamento já realizados devem continuar aparecendo no pedido.
  const escanteadaAtual = escanteado ? quantidadeEtapa(p.id,'escanteamento') : 0;
  if(furada < p.quantidade){
    return {texto:'Aguardando furação', etapaAtual:'furacao', furada, escanteada:escanteadaAtual, saldo:p.quantidade-furada, pronto:false};
  }
  if(!escanteado){
    return {texto:'Furação OK — Material pronto para produção', etapaAtual:'pronto', furada, escanteada:0, saldo:0, pronto:true};
  }
  const esc2 = quantidadeEtapa(p.id,'escanteamento');
  if(esc2 < p.quantidade){
    return {texto:'Furação OK — Aguardando escanteamento', etapaAtual:'escanteamento', furada, escanteada:esc2, saldo:p.quantidade-esc2, pronto:false};
  }
  return {texto:'Escanteamento OK — Material pronto para produção', etapaAtual:'pronto', furada, escanteada:esc2, saldo:0, pronto:true};
}

/* Nome de quem está lançando (lembrado no aparelho, sempre editável no formulário) */
function usuarioAtual(){ return DB.get('usuarioAtual',''); }
function salvarUsuarioAtual(nome){ DB.set('usuarioAtual', nome||''); }

function salvarPedido(){
  const produtoId = Number(document.getElementById('pProduto').value);
  const modeloId = Number(document.getElementById('pModelo').value);
  const quantidade = Number(document.getElementById('pQuantidade').value);
  if(!produtoId || !modeloId || !quantidade) return toast('Preencha produto, modelo e quantidade');

  let seq = DB.get('seqPedido',0) + 1;
  DB.set('seqPedido', seq);

  const pedido = {
    id: Date.now(),
    numero: String(seq).padStart(4,'0'),
    cliente: document.getElementById('pCliente').value.trim(),
    numero_op: document.getElementById('pOP').value.trim(),   // opcional; '' = sem OP
    produtoId, modeloId,
    folhas: document.getElementById('pFolhas').value,
    furacao: document.getElementById('pFuracao').value,
    acabamento: document.getElementById('pAcabamento').value,
    tipoProcesso: (document.getElementById('pTipoProcesso').value === 'escanteado' || /escant/i.test(document.getElementById('pAcabamento').value)) ? 'escanteado' : 'reto',   // 'reto' | 'escanteado'
    quantidade,
    data: document.getElementById('pData').value || hoje(),
    prazo: document.getElementById('pPrazo').value,
    obs: document.getElementById('pObs').value.trim(),
    status: 'aberto',
    historico: []
  };
  pedido.historico.push({data:pedido.data, hora:fmtDataHora(new Date().toISOString()).split(' ')[1]||'',
    usuario:usuarioAtual(), operacao:'Entrada do pedido', quantidade:pedido.quantidade});
  const list = DB.get('pedidos',[]);
  list.push(pedido); DB.set('pedidos',list);
  document.getElementById('formPedido').reset();
  document.getElementById('pData').value = hoje();
  renderPedidoSelectApontamento();
  renderPedidos();
  toast(`Pedido ${pedido.numero} criado`);
}

function renderPedidoSelectApontamento(){
  const pedidos = DB.get('pedidos',[]).filter(p=>p.status!=='concluido');
  const sel = document.getElementById('aPedido');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- nenhum --</option>' + pedidos.map(p=>
    `<option value="${p.id}">${esc(p.numero)}${p.numero_op?' · OP '+esc(p.numero_op):''} - ${esc(tituloPedido(p))}</option>`).join('');
  sel.value = cur;
  sel.onchange = ()=>{
    const p = pedidos.find(x=>x.id===Number(sel.value));
    if(p){
      document.getElementById('aProduto').value = p.produtoId;
      fillModeloSelect('aProduto','aModelo');
      document.getElementById('aModelo').value = p.modeloId;
      document.getElementById('aOP').value = p.numero_op || '';   // OP vinculada ao pedido (editável)
      atualizarEtapaSelect(p);
    } else {
      atualizarEtapaSelect(null);
    }
  };
}

/* Preenche o select de Etapa conforme o pedido: só mostra Escanteamento se o pedido for
   ESCANTEADO e a Furação já estiver completa; sem pedido selecionado, mostra as duas opções. */
function atualizarEtapaSelect(pedido){
  const sel = document.getElementById('aEtapa');
  if(!pedido){ sel.innerHTML = '<option value="furacao">Furação</option><option value="escanteamento">Escanteamento</option>'; return; }
  const st = statusPedido(pedido);
  let opts = '<option value="furacao">Furação</option>';
  if(ehEscanteado(pedido)) opts += '<option value="escanteamento">Escanteamento</option>';
  sel.innerHTML = opts;
  sel.value = (st.etapaAtual === 'escanteamento') ? 'escanteamento' : 'furacao';
}

function renderPedidos(){
  const busca = (document.getElementById('buscaPedido')?.value || '').toLowerCase();
  const pedidos = DB.get('pedidos',[]).slice().reverse().filter(p=>{
    const alvo = `${p.numero} ${p.numero_op||''} ${p.cliente} ${tituloPedido(p)}`.toLowerCase();
    return alvo.includes(busca);
  });
  document.getElementById('listaPedidos').innerHTML = pedidos.map(p=>{
    const st = statusPedido(p);
    const feito = st.pronto ? p.quantidade : (st.etapaAtual==='escanteamento' ? st.escanteada : st.furada);
    const pct = Math.min(100, Math.round(feito / p.quantidade * 100));
    const alerta = !st.pronto && st.saldo <= p.quantidade * 0.1;
    return `<div class="item" onclick="abrirDetalhesPedido(${p.id})">
      <div class="row"><h4>Pedido ${p.numero} — ${tituloPedido(p)}</h4>
      <span onclick="event.stopPropagation()"><button class="del" title="Editar pedido" onclick="editarQuantidadePedido(${p.id})">✏️</button><button class="del" title="Editar OP" onclick="editarOP(${p.id})">🔢</button><button class="del" onclick="excluirPedido(${p.id})">✕</button></span></div>
      <div class="meta">OP: ${p.numero_op?esc(p.numero_op):'-'} · ${p.cliente?('Cliente: '+p.cliente+' · '):''}${ehEscanteado(p)?'Escanteado':'Reto'}${p.furacao?' · '+p.furacao:''} ${p.acabamento||''}</div>
      <div class="meta">Solicitado: ${p.quantidade} · Furação: ${st.furada}/${p.quantidade}${ehEscanteado(p)?` · Escanteamento: ${st.escanteada}/${p.quantidade}`:''}</div>
      <div class="meta"><b>${st.texto}</b>${st.pronto?'':` · Saldo: ${st.saldo}`}</div>
      <div class="progress ${alerta?'alerta':''}"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || '<p class="meta">Nenhum pedido cadastrado.</p>';
}
document.getElementById('buscaPedido')?.addEventListener('input', renderPedidos);
/* Edita somente a quantidade solicitada do pedido.
   Os apontamentos antigos permanecem exatamente como foram lançados;
   como eles apontam para pedidoId, o saldo/status passa a considerar a nova quantidade. */
function editarQuantidadePedido(id){
  const pedidos = DB.get('pedidos',[]);
  const p = pedidos.find(x=>x.id===id); if(!p) return;
  const atual = Number(p.quantidade)||0;
  const produzido = produzidoValidoDoPedido(id);
  const novoTexto = prompt(`Quantidade solicitada do pedido ${p.numero}:\nJá lançado: ${produzido}\n\nDigite a nova quantidade:`, atual);
  if(novoTexto === null) return;
  const novo = Number(String(novoTexto).replace(/[^0-9.,-]/g,'').replace(',','.'));
  if(!Number.isFinite(novo) || novo <= 0 || !Number.isInteger(novo)) return toast('Informe uma quantidade inteira maior que zero');
  if(novo < produzido && !confirm(`A nova quantidade (${novo}) é menor que o já lançado (${produzido}). Continuar mesmo assim?`)) return;
  p.quantidade = novo;
  if(!Array.isArray(p.historico)) p.historico=[];
  p.historico.push({data:hoje(), hora:fmtDataHora(new Date().toISOString()).split(' ')[1]||'', usuario:usuarioAtual(), operacao:`Quantidade do pedido alterada de ${atual} para ${novo}`, quantidade:novo});
  p.status = statusPedido(p).pronto ? 'concluido' : 'aberto';
  DB.set('pedidos', pedidos);
  renderPedidos(); renderPedidoSelectApontamento(); renderDashboard(); renderRegistros();
  abrirDetalhesPedido(id);
  toast(`Pedido ${p.numero} atualizado para ${novo}`);
}

/* Edita a OP de um pedido existente. Não altera apontamentos já lançados. */
function editarOP(id){
  const pedidos = DB.get('pedidos',[]);
  const p = pedidos.find(x=>x.id===id); if(!p) return;
  const novo = prompt(`Número da OP do pedido ${p.numero} (deixe vazio para remover):`, p.numero_op || '');
  if(novo === null) return;
  p.numero_op = novo.trim();
  DB.set('pedidos', pedidos);
  renderPedidos(); renderPedidoSelectApontamento();
  toast(p.numero_op ? `OP ${p.numero_op} salva no pedido ${p.numero}` : `OP removida do pedido ${p.numero}`);
}
/* Tela de detalhes: número, OP, material, quantidade, processo, histórico completo e status atual */
function abrirDetalhesPedido(id){
  const p = DB.get('pedidos',[]).find(x=>x.id===id); if(!p) return;
  const st = statusPedido(p);
  const hist = (p.historico||[]).slice().reverse();
  document.getElementById('modalConteudo').innerHTML = `
    <div class="row"><h3>Pedido ${esc(p.numero)}</h3><button class="del" onclick="fecharModal()">✕</button></div>
    <div class="meta">OP: <b>${p.numero_op?esc(p.numero_op):'-'}</b></div>
    <div class="meta">Material: ${esc(tituloPedido(p))}</div>
    <div class="meta">Cliente: ${p.cliente?esc(p.cliente):'-'}</div>
    <div class="meta">Quantidade total: <b>${p.quantidade}</b> peças</div>
    <div class="meta">Processo: ${ehEscanteado(p)
      ? `☑ Furação ${st.furada>=p.quantidade?'concluída':`(${st.furada}/${p.quantidade})`} · ☑ Escanteamento ${st.escanteada}/${p.quantidade}`
      : `☑ Furação ${st.furada}/${p.quantidade} (reto, sem escanteamento)`}</div>
    <h3>Histórico</h3>
    <div class="lista-cad">${hist.map(h=>`<div class="item">
      <div class="meta"><b>${fmtDataISO(h.data)}</b>${h.hora?' '+h.hora:''}</div>
      <div>${esc(h.operacao)}${h.quantidade!=null?`: ${h.quantidade} peças`:''}</div>
      ${h.usuario?`<div class="meta">Usuário: ${esc(h.usuario)}</div>`:''}
    </div>`).join('') || '<p class="meta">Sem eventos.</p>'}</div>
    <div class="resultado-calc"><b>Status:</b> ${st.texto}${st.pronto?'':` — Saldo: ${st.saldo}`}</div>`;
  document.getElementById('modalDetalhes').style.display = 'flex';
}
function fecharModal(){ document.getElementById('modalDetalhes').style.display = 'none'; }

function excluirPedido(id){
  DB.set('pedidos', DB.get('pedidos',[]).filter(p=>p.id!==id));
  renderPedidos(); renderPedidoSelectApontamento();
}
renderPedidos();

/* ---------- APONTAMENTO ---------- */
function renderApontamentoView(){
  renderPedidoSelectApontamento();
  renderApontamentos();
}
document.getElementById('aProduzido')?.addEventListener('input', atualizarCalculo);
document.getElementById('aDefeito')?.addEventListener('input', atualizarCalculo);
document.getElementById('aPedido')?.addEventListener('change', atualizarCalculo);
/* Se digitar só a OP à mão e existir um único pedido aberto com ela, seleciona o pedido */
document.getElementById('aOP')?.addEventListener('change', ()=>{
  const op = document.getElementById('aOP').value.trim();
  if(!op || document.getElementById('aPedido').value) return;
  const achados = DB.get('pedidos',[]).filter(p=>p.status!=='concluido' && mesmaOP(p.numero_op, op));
  if(achados.length === 1){
    preencherFormApontamento({pedido:achados[0], op:achados[0].numero_op});
    toast(`OP ligada ao pedido ${achados[0].numero}`);
  }
});
document.getElementById('aEtapa')?.addEventListener('change', atualizarCalculo);
function atualizarCalculo(){
  const produzido = Number(document.getElementById('aProduzido').value)||0;
  const defeito = Number(document.getElementById('aDefeito').value)||0;
  const valido = produzido - defeito;
  const pedidoId = Number(document.getElementById('aPedido').value);
  const etapa = document.getElementById('aEtapa').value || 'furacao';
  let saldoTxt = '';
  if(pedidoId){
    const p = DB.get('pedidos',[]).find(x=>x.id===pedidoId);
    if(p){
      const jaNaEtapa = quantidadeEtapa(pedidoId, etapa);
      const saldo = p.quantidade - jaNaEtapa - valido;
      const nomeEtapa = etapa==='escanteamento' ? 'escanteamento' : 'furação';
      saldoTxt = `<br>Saldo de ${nomeEtapa} do pedido ${p.numero}: <b>${Math.max(saldo,0)}</b> de ${p.quantidade}`;
    }
  }
  const pid=Number(document.getElementById('aProduto')?.value), mid=Number(document.getElementById('aModelo')?.value);
  if(pid&&mid){
    const disponivel=saldoEstoque(pid,mid);
    saldoTxt += `<br>Material disponível no estoque após este lançamento: <b>${Math.max(disponivel-produzido,0).toLocaleString('pt-BR')}</b>`;
  }
  document.getElementById('resultadoCalc').innerHTML =
    `Produção válida: <b>${valido}</b> unidades${saldoTxt}`;
}

/* Grava um apontamento (usado pelo lançamento manual e pelo de voz).
   origem: 'Manual' | 'Áudio' · op: opcional ('' = sem OP) */
function registrarApontamento({pedido, produtoId, modeloId, produzido, defeito, op, origem, data, obs, etapa, usuario, origemMaterial}){
  etapa = etapa === 'escanteamento' ? 'escanteamento' : 'furacao';
  const agora = new Date().toISOString();
  const registro = {
    id: Date.now(),
    pedidoId: pedido ? pedido.id : null,
    produtoId, modeloId, produzido, defeito,
    valido: produzido - defeito,
    etapa,
    data: data || hoje(),
    obs: obs || '',
    numeroOp: op || '',
    usuario: usuario || '',
    origem: origem || 'Manual',
    origemMaterial: origemMaterial === 'Estoque' ? 'Estoque' : 'Pedido',
    criadoEm: agora
  };
  const list = DB.get('apontamentos',[]);
  list.push(registro); DB.set('apontamentos',list);

  if(registro.pedidoId){
    const pedidos = DB.get('pedidos',[]);
    const p = pedidos.find(x=>x.id===registro.pedidoId);
    if(p){
      if(!Array.isArray(p.historico)) p.historico = [];
      p.historico.push({
        data: registro.data, hora: fmtDataHora(agora).split(' ')[1] || '',
        usuario: registro.usuario,
        operacao: (etapa==='escanteamento' ? 'Escanteamento lançado' : 'Furação lançada') + (registro.defeito?` (${registro.defeito} com defeito)`:''),
        quantidade: registro.valido
      });
      const st = statusPedido(p);
      if(st.pronto) p.status = 'concluido';
      DB.set('pedidos',pedidos);
    }
  }
  return registro;
}

function limparFormApontamento(){
  document.getElementById('formApontamento').reset();
  document.getElementById('aData').value = hoje();
  document.getElementById('aUsuario').value = usuarioAtual();
  atualizarEtapaSelect(null);
  document.getElementById('resultadoCalc').innerHTML = '';
  window._origemForm = 'Manual';
}

function salvarApontamento(){
  const produtoId = Number(document.getElementById('aProduto').value);
  const modeloId = Number(document.getElementById('aModelo').value);
  const produzido = Number(document.getElementById('aProduzido').value);
  const defeito = Number(document.getElementById('aDefeito').value)||0;
  if(!produtoId || !modeloId || !produzido) return toast('Preencha produto, modelo e quantidade produzida');

  const origemMaterial = document.getElementById('aOrigemMaterial')?.value || 'pedido';
  // Um lançamento pode estar ligado a um pedido, mas o material físico sempre
  // sai do estoque. Sem pedido = produção antecipada/estoque.
  const pedidoId = Number(document.getElementById('aPedido').value) || null;
  const pedido = pedidoId ? DB.get('pedidos',[]).find(p=>p.id===pedidoId) : null;
  const etapa = document.getElementById('aEtapa').value || 'furacao';
  if(etapa==='furacao') {
    const disponivel=saldoEstoque(produtoId,modeloId);
    if(produzido>disponivel) return toast(`Estoque insuficiente. Disponível: ${disponivel.toLocaleString('pt-BR')}`);
  }
  if(pedido && etapa==='furacao' && ehEscanteado(pedido) && quantidadeEtapa(pedidoId,'furacao')>=pedido.quantidade)
    return toast('A furação deste pedido já está completa — lance em Escanteamento');
  if(pedido && etapa==='escanteamento'){
    const erro = erroEscanteamento(pedido, produzido - defeito);
    if(erro) return toast(erro);
  }
  const usuario = document.getElementById('aUsuario').value.trim();
  salvarUsuarioAtual(usuario);

  const registro = registrarApontamento({
    pedido, produtoId, modeloId, produzido, defeito, etapa, usuario,
    origemMaterial: origemMaterial==='estoque' ? 'Estoque' : 'Pedido',
    op: document.getElementById('aOP').value.trim(),      // OP opcional, pode ter sido alterada à mão
    origem: window._origemForm === 'Áudio' ? 'Áudio' : 'Manual',  // 'Áudio' se os campos vieram da voz
    data: document.getElementById('aData').value,
    obs: document.getElementById('aObs').value.trim()
  });

  limparFormApontamento();
  renderApontamentos(); renderPedidos(); renderPedidoSelectApontamento(); renderEstoque(); atualizarEstoqueDisponivel();
  mostrarRetorno(registro);
  toast('Produção lançada');
}

/* Mensagem de confirmação após o lançamento (manual ou voz) */
function mostrarRetorno(r){
  const p = DB.get('pedidos',[]).find(x=>x.id===r.pedidoId);
  const box = document.getElementById('retornoApontamento');
  box.innerHTML = `<b>Apontamento realizado com sucesso.</b><br>
    Origem: ${r.origemMaterial==='Estoque'?'📦 Estoque':'📋 Pedido'}<br>
    Pedido: ${p?esc(p.numero):'-'}<br>
    OP: ${esc(r.numeroOp||'-')}<br>
    Etapa: ${r.etapa==='escanteamento'?'Escanteamento':'Furação'}<br>
    Quantidade: ${r.produzido} unidades<br>
    Data: ${fmtDataHora(r.criadoEm)}<br>
    Origem: ${r.origem==='Áudio'?'🎤 Áudio':'Manual'}`;
  box.style.display = 'block';
}

/* Histórico: mesmo cartão de antes, com Pedido, OP, Usuário e Origem na linha de dados */
function renderApontamentos(){
  const pedidos = DB.get('pedidos',[]);
  const list = DB.get('apontamentos',[]).slice().reverse().slice(0,20);
  document.getElementById('listaApontamentos').innerHTML = list.map(a=>{
    const ped = pedidos.find(p=>p.id===a.pedidoId);
    const quando = a.criadoEm ? fmtDataHora(a.criadoEm) : fmtDataISO(a.data);
    return `<div class="item">
      <div class="row"><h4>${nomeProduto(a.produtoId)} ${nomeModelo(a.modeloId)}</h4>
      <button class="del" onclick="excluirApontamento(${a.id})">✕</button></div>
      <div class="meta">${a.origemMaterial==='Estoque'?'📦 Produção do estoque':'📋 Pedido '+(ped?esc(ped.numero):'-')} · OP ${esc(a.numeroOp||'-')} · ${(a.etapa==='escanteamento'?'Escanteamento':'Furação')} · ${quando}</div>
      <div class="meta">Produzido: ${a.produzido} · Defeito: ${a.defeito} · Válido: ${a.valido} · ${a.usuario?esc(a.usuario)+' · ':''}${a.origem==='Áudio'?'🎤 Áudio':'Manual'}</div>
    </div>`;
  }).join('') || '<p class="meta">Nenhum lançamento ainda.</p>';
}
function excluirApontamento(id){
  DB.set('apontamentos', DB.get('apontamentos',[]).filter(a=>a.id!==id));
  renderApontamentos(); renderPedidos();
}
renderApontamentos();

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  const pedidos = DB.get('pedidos',[]);
  const apont = DB.get('apontamentos',[]);
  const abertos = pedidos.filter(p=>p.status!=='concluido');
  const hojeStr = hoje();
  const produzidoHoje = apont.filter(a=>a.data===hojeStr).reduce((s,a)=>s+a.valido,0);
  const defeitosTotal = apont.reduce((s,a)=>s+a.defeito,0);
  const produzidoPeriodo = apont.reduce((s,a)=>s+a.valido,0);
  const proximosFim = abertos.filter(p=> statusPedido(p).saldo <= p.quantidade*0.1).length;
  const saldoRestanteTotal = abertos.reduce((s,p)=> s + statusPedido(p).saldo, 0);

  document.getElementById('cards').innerHTML = `
    <div class="card"><b>${abertos.length}</b><span>Pedidos em andamento</span></div>
    <div class="card"><b>${produzidoHoje}</b><span>Produzido hoje</span></div>
    <div class="card"><b>${produzidoPeriodo}</b><span>Produzido no período</span></div>
    <div class="card"><b>${defeitosTotal}</b><span>Total de defeitos</span></div>
    <div class="card ${proximosFim?'alerta':''}"><b>${proximosFim}</b><span>Pedidos perto do fim</span></div>
    <div class="card"><b>${saldoRestanteTotal}</b><span>Saldo restante total</span></div>`;

  document.getElementById('listaPedidosAndamento').innerHTML = abertos.slice().reverse().slice(0,8).map(p=>{
    const st = statusPedido(p);
    const feito = st.etapaAtual==='escanteamento' ? st.escanteada : st.furada;
    const pct = Math.min(100, Math.round(feito/p.quantidade*100));
    return `<div class="item" onclick="abrirDetalhesPedido(${p.id})"><h4>Pedido ${p.numero} — ${tituloPedido(p)}</h4>
      <div class="meta">${st.texto} · Saldo: ${st.saldo} de ${p.quantidade}</div>
      <div class="progress ${st.saldo<=p.quantidade*0.1?'alerta':''}"><div style="width:${pct}%"></div></div></div>`;
  }).join('') || '<p class="meta">Nenhum pedido em andamento.</p>';
}
renderDashboard();

/* ---------- ENTRADA POR VOZ ---------- */
/* Fluxo por voz:
   1. ouvirVoz() grava (Web Speech API) e joga o texto em #colarTexto
   2. interpretarTexto('voz') extrai pedido / OP / quantidade (extrairComando)
   3. resolverIdentificacao() valida pedido e OP contra os pedidos cadastrados
   4. se estiver tudo válido -> registra sozinho (origem 'Áudio'); senão pergunta o que falta
      e guarda o que já entendeu (_pendenteVoz) por 90s, para a próxima fala completar. */
let _rec = null;              // reconhecimento em andamento (toque no botão de novo = parar)
let _pendenteVoz = null;      // {pedidoNum, op, qtd, defeito, t} aguardando complemento
window._origemForm = 'Manual'; // vira 'Áudio' quando a voz preencheu o formulário para conferência

function setVozStatus(html, tipo){
  const el = document.getElementById('vozStatus');
  el.className = 'voz-status' + (tipo ? ' ' + tipo : '');
  el.innerHTML = html;
}

function ouvirVoz(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    setVozStatus('Reconhecimento de voz não suportado neste navegador.', 'erro');
    toast('Reconhecimento de voz não suportado neste navegador');
    return;
  }
  if(_rec){ _rec.stop(); return; }           // segundo toque = parar de gravar

  const btn = document.getElementById('btnMic');
  const rec = new SR();
  _rec = rec;
  rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = false;

  rec.onstart = ()=>{
    btn.classList.add('gravando');
    btn.textContent = '🔴 Ouvindo… toque para parar';
    setVozStatus('🎙️ Ouvindo… diga, por exemplo: “Apontar pedido 12548 OP 202600145 quantidade 100”', 'info');
  };
  rec.onresult = (e)=>{
    const texto = e.results[0][0].transcript;
    document.getElementById('colarTexto').value = texto;
    interpretarTexto('voz');
  };
  rec.onerror = (e)=>{
    const erro = e && e.error;
    if(erro === 'aborted') return;
    const msg = erro === 'no-speech' ? 'Não ouvi nada. Toque no microfone e tente de novo.'
      : (erro === 'not-allowed' || erro === 'service-not-allowed') ? 'Permita o uso do microfone no navegador para lançar por voz.'
      : 'Não entendi, tente novamente.';
    setVozStatus('❌ ' + msg, 'erro');
  };
  rec.onend = ()=>{
    if(_rec === rec) _rec = null;
    btn.classList.remove('gravando');
    btn.textContent = '🎤 Falar lançamento';
  };
  try{ rec.start(); }catch(_){ _rec = null; }
}

/* ---------- INTERPRETAÇÃO DO COMANDO (pedido / OP / quantidade / defeito) ---------- */
/* Devolve {pedidoNum, op, qtd, defeito, soltos, temApontar}. Tudo é null/0 quando não aparece no texto.
   Aceita números com ponto de milhar ("12.548", "1.500") e "2 mil". */
function extrairComando(original){
  let t = semAcento(original);
  const dig = s => String(s).replace(/\D/g,'');
  const cmd = {pedidoNum:null, op:null, qtd:null, defeito:0, soltos:[], temApontar:/\bapont/.test(t), etapa:null};
  const tomar = re => { const m = t.match(re); if(m) t = t.replace(m[0],' '); return m; };  // acha e remove do texto

  if(tomar(/\bescant\w*/)) cmd.etapa = 'escanteamento';
  else if(tomar(/\bfura[cç]\w*/)) cmd.etapa = 'furacao';

  let m = tomar(/\b(?:o\.?\s?p\.?|ordem\s+de\s+producao)\s*(?:(?:numero|n[ºo°]?\.?)\s*)?(\d[\d.]*)/);
  if(m) cmd.op = dig(m[1]);
  m = tomar(/\bpedido\s*(?:(?:numero|n[ºo°]?\.?)\s*)?(\d[\d.]*)/);
  if(m) cmd.pedidoNum = dig(m[1]);

  m = tomar(/(\d[\d.]*)\s*(?:com\s+defeitos?|defeituos[oa]s?|defeitos?|refugos?)/)
      || tomar(/defeitos?\s*(?:de\s*)?(\d[\d.]*)/);
  if(m) cmd.defeito = Number(dig(m[1])) || 0;

  // quantidade: "quantidade 100" > "2 mil" > "apontar/produzi 200" > "200 peças"
  let q = null;
  if((m = t.match(/quantidade\s*(?:de\s*)?(\d[\d.]*)/))) q = Number(dig(m[1]));
  else if((m = t.match(/(\d+(?:,\d+)?)\s*mil\b/))) q = Math.round(parseFloat(m[1].replace(',','.')) * 1000);
  else if((m = t.match(/(?:apontar|apontei|apontado|produzi|produziu|produzido|lancar|lance|registrar|registre)\s*(?:hoje\s*)?(?:o\s*)?(\d[\d.]*)/))) q = Number(dig(m[1]));
  else if((m = t.match(/(\d[\d.]*)\s*(?:unidades?|und|pecas?|pcs)\b/))) q = Number(dig(m[1]));
  cmd.qtd = q;
  cmd.soltos = (t.match(/\d[\d.]*/g) || []).map(s => Number(dig(s))).filter(n => n > 0);
  return cmd;
}

/* Valida pedido e OP contra os cadastros.
   Devolve {pedido, op} | {erro} | {pergunta} | {} (nada identificado). */
function resolverIdentificacao(cmd){
  const pedidos = DB.get('pedidos',[]);
  const temOP = cmd.op != null && cmd.op !== '';
  if(cmd.pedidoNum != null){
    const pedido = pedidos.find(p => semZeros(p.numero) === semZeros(cmd.pedidoNum));
    if(!pedido) return {erro:`Pedido ${cmd.pedidoNum} não encontrado.`};
    if(pedido.status === 'concluido') return {erro:`O pedido ${pedido.numero} já está concluído.`};
    if(temOP && pedido.numero_op && !mesmaOP(pedido.numero_op, cmd.op))
      return {erro:`A OP ${cmd.op} não é a OP do pedido ${pedido.numero} (OP ${pedido.numero_op}).`};
    // OP: a cadastrada no pedido; se o pedido não tem OP e ela foi falada, usa a falada
    return {pedido, op: pedido.numero_op || (temOP ? cmd.op : '')};
  }
  if(temOP){
    const achados = pedidos.filter(p => p.numero_op && mesmaOP(p.numero_op, cmd.op));
    if(!achados.length) return {erro:`OP ${cmd.op} não encontrada em nenhum pedido.`};
    const abertos = achados.filter(p => p.status !== 'concluido');
    if(!abertos.length) return {erro:`Os pedidos da OP ${cmd.op} já estão concluídos.`};
    if(abertos.length > 1)
      return {pergunta:`A OP ${cmd.op} está em mais de um pedido (${abertos.map(p=>p.numero).join(', ')}). Informe o número do pedido.`};
    return {pedido:abertos[0], op:abertos[0].numero_op};
  }
  return {};
}

/* Preenche o formulário de apontamento (parcial ou completo) para o usuário conferir/completar */
function preencherFormApontamento({pedido, op, produzido, defeito, etapa}){
  if(pedido){
    document.getElementById('aPedido').value = pedido.id;
    document.getElementById('aProduto').value = pedido.produtoId;
    fillModeloSelect('aProduto','aModelo');
    document.getElementById('aModelo').value = pedido.modeloId;
    atualizarEtapaSelect(pedido);
  }
  if(op !== undefined && op !== null) document.getElementById('aOP').value = op;
  if(produzido) document.getElementById('aProduzido').value = produzido;
  document.getElementById('aDefeito').value = defeito || 0;
  if(etapa) document.getElementById('aEtapa').value = etapa;
  atualizarCalculo();
}

/* Modo comando (voz): valida, pergunta o que falta ou registra automaticamente */
function processarComandoVoz(cmd, ouvido){
  renderPedidoSelectApontamento();
  const guardar = extra => {
    _pendenteVoz = Object.assign({pedidoNum:cmd.pedidoNum, op:cmd.op, qtd:cmd.qtd, defeito:cmd.defeito, etapa:cmd.etapa, t:Date.now()}, extra || {});
  };
  const falar = (msg, tipo) => { setVozStatus(ouvido + msg, tipo); };

  const id = resolverIdentificacao(cmd);
  if(id.erro){
    guardar({pedidoNum:null, op:null});
    preencherFormApontamento({produzido:cmd.qtd, defeito:cmd.defeito});
    toast(id.erro);
    return falar('❌ ' + esc(id.erro), 'erro');
  }
  if(id.pergunta){
    guardar({pedidoNum:null});
    preencherFormApontamento({op:cmd.op, produzido:cmd.qtd, defeito:cmd.defeito});
    return falar('❓ ' + esc(id.pergunta), 'aviso');
  }
  if(!id.pedido){
    guardar();
    preencherFormApontamento({produzido:cmd.qtd, defeito:cmd.defeito});
    return falar('❓ ' + esc(cmd.qtd
      ? `Identifiquei a quantidade ${cmd.qtd}, informe o número do pedido ou OP.`
      : 'Não identifiquei pedido, OP nem quantidade. Exemplo: “Apontar pedido 12548 OP 202600145 quantidade 100”.'), 'aviso');
  }

  const {pedido, op} = id;
  const resumo = `Pedido ${pedido.numero}` + (op ? ` · OP ${op}` : '');
  if(cmd.qtd == null){
    guardar({pedidoNum:pedido.numero});
    preencherFormApontamento({pedido, op, defeito:cmd.defeito});
    return falar(`❓ ${esc(resumo)} identificado. Informe a quantidade.`, 'aviso');
  }
  if(!Number.isInteger(cmd.qtd) || cmd.qtd <= 0 || cmd.qtd > 1000000){
    guardar({qtd:null, pedidoNum:pedido.numero});
    preencherFormApontamento({pedido, op});
    toast('Quantidade inválida');
    return falar(`❌ Quantidade inválida (${esc(cmd.qtd)}). Informe um número maior que zero.`, 'erro');
  }
  if(cmd.defeito > cmd.qtd){
    guardar({qtd:null, pedidoNum:pedido.numero});
    preencherFormApontamento({pedido, op});
    return falar('❌ A quantidade com defeito não pode ser maior que a produzida.', 'erro');
  }

  const etapa = cmd.etapa || (ehEscanteado(pedido) && quantidadeEtapa(pedido.id,'furacao')>=pedido.quantidade ? 'escanteamento' : 'furacao');
  if(etapa==='furacao' && ehEscanteado(pedido) && quantidadeEtapa(pedido.id,'furacao')>=pedido.quantidade){
    guardar({qtd:null, pedidoNum:pedido.numero});
    return falar('❌ A furação deste pedido já está completa — fale "escanteamento".', 'erro');
  }
  if(etapa==='escanteamento'){
    const erro = erroEscanteamento(pedido, cmd.qtd - (cmd.defeito||0));
    if(erro){
      guardar({qtd:null, pedidoNum:pedido.numero});
      return falar('❌ ' + erro + '.', 'erro');
    }
  }
  // tudo válido -> registra
  const registro = registrarApontamento({
    pedido, produtoId:pedido.produtoId, modeloId:pedido.modeloId,
    produzido:cmd.qtd, defeito:cmd.defeito || 0, op, etapa, usuario:usuarioAtual(), origem:'Áudio'
  });
  _pendenteVoz = null;
  document.getElementById('colarTexto').value = '';
  limparFormApontamento();
  renderApontamentos(); renderPedidos(); renderPedidoSelectApontamento();
  mostrarRetorno(registro);
  toast('Apontamento realizado com sucesso');
  falar(`✅ ${esc(resumo)} · ${registro.produzido} unidades registradas.`, 'ok');
}

/* ---------- ENTRADA POR TEXTO / VOZ ---------- */
/* origem 'voz'   : com pedido/OP/"apontar" no texto, valida e REGISTRA sozinho; sem isso, só preenche o formulário
   origem 'texto' : (botão "Transformar em lançamento") só preenche o formulário para conferência */
function interpretarTexto(origem){
  origem = origem === 'voz' ? 'voz' : 'texto';
  const original = document.getElementById('colarTexto').value;
  if(!original.trim()) return toast('Cole ou fale um texto primeiro');

  const cmd = extrairComando(original);
  const pend = (origem === 'voz' && _pendenteVoz && Date.now() - _pendenteVoz.t < 90000) ? _pendenteVoz : null;
  if(pend){   // completa SÓ o que a nova fala não trouxe (identificação e quantidade são blocos independentes)
    if(cmd.pedidoNum == null && cmd.op == null){ cmd.pedidoNum = pend.pedidoNum; cmd.op = pend.op; }
    if(cmd.qtd == null){ cmd.qtd = pend.qtd; if(!cmd.defeito) cmd.defeito = pend.defeito || 0; }
  }
  const ouvido = origem === 'voz' ? `🎤 “${esc(original)}”<br>` : '';

  const modoComando = origem === 'voz' && (cmd.pedidoNum != null || cmd.op != null || cmd.temApontar || pend);
  if(modoComando){
    if(cmd.qtd == null && cmd.soltos.length === 1) cmd.qtd = cmd.soltos[0];   // "pedido 12548 ... 50"
    return processarComandoVoz(cmd, ouvido);
  }
  _pendenteVoz = null;

  /* ----- preenchimento para conferência (comportamento original + pedido/OP) ----- */
  const texto = original.toLowerCase();

  // Quantidade produzida: "produzi 2000" / "2 mil" / "2000 unidades"
  let produzido = null, defeito = 0;
  const milMatch = texto.match(/(\d+)\s*mil/);
  if(milMatch) produzido = Number(milMatch[1]) * 1000;
  if(produzido===null){
    const m = texto.match(/produzi(?:u|do)?\s*(?:hoje)?\s*(\d+[\.\d]*)/) || texto.match(/(\d+[\.\d]*)\s*(?:unidades|und|peças)/);
    if(m) produzido = Number(m[1].replace(/\./g,''));
  }
  if(produzido===null && cmd.qtd!=null) produzido = cmd.qtd;   // "quantidade 100"
  const defMatch = texto.match(/(\d+)\s*(?:com defeito|defeituos|defeito)/);
  if(defMatch) defeito = Number(defMatch[1]);

  // Produto/modelo: procura por nome cadastrado dentro do texto
  const produtos = DB.get('produtos',[]);
  const modelos = DB.get('modelos',[]);
  let produtoAchado = produtos.find(p=> texto.includes(p.nome.toLowerCase()));
  let modeloAchado = null;
  if(produtoAchado){
    modeloAchado = modelos.find(m=> m.produtoId===produtoAchado.id && texto.includes(m.nome.toLowerCase().split(' ')[0]));
  }
  if(!modeloAchado) modeloAchado = modelos.find(m=> texto.includes(m.nome.toLowerCase()));
  if(modeloAchado && !produtoAchado) produtoAchado = produtos.find(p=>p.id===modeloAchado.produtoId);

  // Pedido / OP citados no texto
  renderPedidoSelectApontamento();
  const id = resolverIdentificacao(cmd);
  if(id.erro) toast(id.erro);

  if(id.pedido){
    preencherFormApontamento({pedido:id.pedido, op:id.op, produzido, defeito, etapa:cmd.etapa});
  } else {
    if(produtoAchado){
      document.getElementById('aProduto').value = produtoAchado.id;
      fillModeloSelect('aProduto','aModelo');
      if(modeloAchado) document.getElementById('aModelo').value = modeloAchado.id;
    }
    if(cmd.op != null && !id.erro) document.getElementById('aOP').value = cmd.op;
    preencherFormApontamento({produzido, defeito, etapa:cmd.etapa});
  }
  if(origem === 'voz') window._origemForm = 'Áudio';   // ao clicar em "Lançar", o registro sai como Áudio

  const completo = !(produzido===null && !produtoAchado && !id.pedido);
  const msg = id.erro ? id.erro : completo ? 'Campos preenchidos automaticamente, confira e lance' : 'Não consegui identificar tudo — confira os campos';
  if(!id.erro) toast(msg);
  if(origem === 'voz') setVozStatus(ouvido + (id.erro ? '❌ ' : completo ? '✅ ' : '❓ ') + esc(msg), id.erro ? 'erro' : completo ? 'ok' : 'aviso');
}

/* ---------- ENTRADA POR IMAGEM (estrutura preparada para OCR) ---------- */
function handleFoto(e){
  const file = e.target.files[0];
  if(!file) return;
  document.getElementById('ocrStatus').textContent = 'Foto recebida. OCR automático ainda não ativado — preencha os campos manualmente.';
  // TODO futuro: enviar `file` para um serviço de OCR e chamar interpretarTexto()
  // com o texto reconhecido, ou preencher os campos diretamente a partir do
  // resultado estruturado (produto, modelo, quantidade, código).
}

/* ---------- BACKUP / RESTAURAÇÃO COMPLETA ---------- */
const BACKUP_KEYS = [
  'produtos','modelos','folhas','furacoes','acabamentos','pedidos','apontamentos','seqPedido',
  'schemaOP','schemaEtapas','schemaEscanteio','imp_20260927','estoqueEntradas'
];
function exportarBackup(){
  const dados={};
  BACKUP_KEYS.forEach(k=>{
    const raw=localStorage.getItem(k);
    if(raw!==null){ try{ dados[k]=JSON.parse(raw); }catch(e){ dados[k]=raw; } }
  });
  const backup={
    tipo:'controle-producao-backup',
    versao:4,
    criadoEm:new Date().toISOString(),
    dados
  };
  const nome=`backup-controle-producao-${new Date().toISOString().slice(0,10)}.json`;
  baixarArquivo(nome, JSON.stringify(backup,null,2), 'application/json;charset=utf-8');
  const st=document.getElementById('backupStatus');
  if(st) st.textContent=`Backup criado em ${new Date().toLocaleString('pt-BR')}. Guarde este arquivo em outro local.`;
  toast('Backup completo baixado');
}
function importarBackup(event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const backup=JSON.parse(String(reader.result));
      if(backup?.tipo!=='controle-producao-backup' || !backup.dados) throw new Error('Formato inválido');
      const dados=backup.dados;
      const pedidos=Array.isArray(dados.pedidos)?dados.pedidos.length:0;
      const apont=Array.isArray(dados.apontamentos)?dados.apontamentos.length:0;
      const quando=backup.criadoEm?new Date(backup.criadoEm).toLocaleString('pt-BR'):'data desconhecida';
      if(!confirm(`RESTAURAR BACKUP?\n\nBackup: ${quando}\nPedidos: ${pedidos}\nApontamentos: ${apont}\n\nIsso substituirá os dados atuais deste aplicativo. Faça um backup atual antes de continuar.\n\nContinuar?`)) return;
      BACKUP_KEYS.forEach(k=>localStorage.removeItem(k));
      Object.entries(dados).forEach(([k,v])=>{ if(BACKUP_KEYS.includes(k)) localStorage.setItem(k, JSON.stringify(v)); });
      alert('Backup restaurado. O aplicativo será recarregado.');
      location.reload();
    }catch(err){
      alert('Não foi possível restaurar este arquivo. Use um backup JSON gerado pelo botão “Baixar backup completo”.');
    }
  };
  reader.readAsText(file);
}

/* ---------- EXPORTAÇÃO ---------- */
function exportarCSV(){
  const apont = DB.get('apontamentos',[]);
  const cel = v => String(v??'').replace(/[;\r\n]/g,' ');
  let csv = 'Data;Produto;Modelo;Etapa;Produzido;Defeito;Valido;Pedido;OP;Usuario;Origem do lançamento;Origem do material\n';
  apont.forEach(a=>{
    const pedido = a.pedidoId ? DB.get('pedidos',[]).find(p=>p.id===a.pedidoId)?.numero : '';
    csv += `${a.data};${nomeProduto(a.produtoId)};${nomeModelo(a.modeloId)};${a.etapa==='escanteamento'?'Escanteamento':'Furação'};${a.produzido};${a.defeito};${a.valido};${pedido||''};${cel(a.numeroOp)};${cel(a.usuario)};${a.origem||'Manual'};${a.origemMaterial||'Pedido'}\n`;
  });
  baixarArquivo('relatorio_producao.csv', csv, 'text/csv;charset=utf-8;');
}
function exportarPDF(){
  const win = window.open('', '_blank');
  const apont = DB.get('apontamentos',[]).slice().reverse();
  win.document.write(`<html><head><title>Relatório de Produção</title>
    <style>body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #999;padding:6px;font-size:13px;text-align:left}</style></head><body>
    <h2>Relatório de Produção</h2><p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <table><tr><th>Data</th><th>Produto</th><th>Modelo</th><th>Produzido</th><th>Defeito</th><th>Válido</th><th>Pedido</th><th>OP</th><th>Origem</th></tr>
    ${apont.map(a=>`<tr><td>${a.data}</td><td>${nomeProduto(a.produtoId)}</td><td>${nomeModelo(a.modeloId)}</td><td>${a.produzido}</td><td>${a.defeito}</td><td>${a.valido}</td><td>${esc((DB.get('pedidos',[]).find(p=>p.id===a.pedidoId)||{}).numero||'-')}</td><td>${esc(a.numeroOp||'-')}</td><td>${a.origem||'Manual'}</td></tr>`).join('')}
    </table></body></html>`);
  win.document.close();
  setTimeout(()=>win.print(), 400);
}
function gerarCardWhatsApp(){
  const apont = DB.get('apontamentos',[]).filter(a=>a.data===hoje());
  if(!apont.length) return toast('Nenhum lançamento hoje ainda');
  let texto = `*PRODUÇÃO DIÁRIA*\n\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  apont.forEach(a=>{
    const p = a.pedidoId ? DB.get('pedidos',[]).find(x=>x.id===a.pedidoId) : null;
    texto += `*${nomeProduto(a.produtoId).toUpperCase()} ${nomeModelo(a.modeloId).toUpperCase()}*\n`;
    if(a.numeroOp) texto += `OP: ${a.numeroOp}\n`;
    if(p){
      const saldo = Math.max(p.quantidade - produzidoValidoDoPedido(p.id),0);
      texto += `Pedido: ${p.quantidade}\n`;
      texto += `Produzido: ${a.produzido}\nDefeito: ${a.defeito}\nSaldo: ${saldo}\n\n`;
    } else {
      texto += `Produzido: ${a.produzido}\nDefeito: ${a.defeito}\n\n`;
    }
  });
  const box = document.getElementById('cardWhats');
  box.textContent = texto; box.style.display='block';
}
function baixarArquivo(nome, conteudo, tipo){
  const blob = new Blob([conteudo], {type:tipo});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- IMPORTAÇÃO DE LISTA (descrição;leitura;papelaria) ---------- */
const CLIENTES_IMPORT = ['Leitura','Papelaria Varejo'];
let _idc = 0; const nid = () => Date.now()*1000 + (++_idc % 1000);
window._imp = {itens:[], origem:''};

function parseLista(texto){
  const num = v => Math.round(Number(String(v||'').replace(/\./g,'').replace(',','.'))) || 0;
  return texto.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    const c = l.split(/[;\t]/);
    const desc = (c[0]||'').trim();
    const tam = (desc.match(/\(([^)]*)\)/)||[])[1];
    const limpo = desc.replace(/\(.*?\)/,'').trim();
    let produto=null, modelo=null, resto=limpo, m;
    if((m=limpo.match(/^AGENDA\s+CL[AÁ]SSICA\s+/i))){produto='Agenda';modelo='Agenda Clássica';}
    else if((m=limpo.match(/^AGENDA\s+M[EÉ]DIA\s+/i))){produto='Agenda';modelo='Agenda Média';}
    else if((m=limpo.match(/^PLANNER\s+/i))){produto='Planner';modelo='Planner';}
    if(m) resto = limpo.slice(m[0].length);
    return {produto,modelo,descricao:resto,tamanho:(tam||'').replace(/\s+/g,' ').toLowerCase(),
            qtds:[num(c[1]),num(c[2])], ok:!!produto, revisar:(c[3]||'').trim()==='?'};
  });
}
function carregarListaImagem(){
  if(DB.get('imp_20260927',false) && !confirm('Essa lista já foi importada. Importar de novo (vai duplicar os pedidos)?')) return;
  previewImport(LISTA_IMAGEM,'imagem');
}
function previewImport(texto, origem){ mostrarPreview(parseLista(texto), origem); }
function mostrarPreview(itens, origem){
  window._imp = {itens, origem};
  const box = document.getElementById('importPreview');
  if(!itens.length){ box.innerHTML=''; return toast('Nenhum item encontrado'); }
  const rev = itens.filter(x=>x.revisar).length, inv = itens.filter(x=>!x.ok).length;
  box.innerHTML = `<div class="resultado-calc"><b>${itens.length}</b> itens lidos. Confira e corrija as quantidades antes de confirmar.
    ${rev?`<br>⚠️ <b>${rev}</b> linha(s) em amarelo: a leitura ficou incerta (principalmente qual cliente).`:''}
    ${inv?`<br>❌ ${inv} linha(s) sem produto reconhecido serão ignoradas.`:''}</div>
    <div class="tabela-scroll"><table class="tabela"><tr><th></th><th>Item</th><th>Leitura</th><th>Papelaria</th></tr>
    ${itens.map((x,i)=>`<tr data-i="${i}" class="${x.ok?'':'inv'} ${x.revisar?'rev':''}">
      <td><input type="checkbox" ${x.ok?'checked':'disabled'}></td>
      <td>${x.modelo||'?'} — ${x.descricao} <small>${x.tamanho}</small></td>
      <td><input type="number" class="qi" value="${x.qtds[0]||''}"></td>
      <td><input type="number" class="qi" value="${x.qtds[1]||''}"></td></tr>`).join('')}
    </table></div>
    <button class="btn btn-primary big" onclick="confirmarImportacao()">Confirmar e criar pedidos</button>`;
}

/* --- Envio de arquivo: foto (OCR) ou CSV/TXT --- */
function setImportStatus(t){ document.getElementById('importStatus').textContent = t; }
function handleArquivoLista(e){
  const f = e.target.files[0]; e.target.value=''; if(!f) return;
  if(f.type.startsWith('image/')) return lerFotoLista(f);
  const r = new FileReader();
  r.onload = ()=>previewImport(String(r.result),'arquivo');
  r.readAsText(f);
}
function carregarTesseract(){
  if(window.Tesseract) return Promise.resolve();
  return new Promise((ok,err)=>{
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    sc.onload = ok; sc.onerror = ()=>err(new Error('offline'));
    document.head.appendChild(sc);
  });
}
async function prepararImagem(file){
  const bmp = await createImageBitmap(file);
  const esc = Math.min(3000, Math.max(2000, bmp.width)) / bmp.width;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width*esc); c.height = Math.round(bmp.height*esc);
  const ctx = c.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.6)';
  ctx.drawImage(bmp,0,0,c.width,c.height);
  return c;
}
async function lerFotoLista(file){
  try{
    setImportStatus('Carregando leitor de imagem (precisa de internet)...');
    await carregarTesseract();
    const canvas = await prepararImagem(file);
    const {data} = await Tesseract.recognize(canvas,'eng',{
      logger:m=>{ if(m.status==='recognizing text') setImportStatus(`Lendo a foto... ${Math.round(m.progress*100)}%`); }
    });
    const lista = ocrParaLista(data.text);
    setImportStatus('');
    if(!lista) return toast('Não achei itens na foto. Tente uma foto mais reta e nítida.');
    previewImport(lista,'foto');
  }catch(err){
    setImportStatus('');
    toast('Falha ao ler a foto (sem internet?). Use colar lista ou CSV.');
  }
}
/* Converte o texto do OCR em linhas "descrição (tam);leitura;papelaria;?" */
function ocrParaLista(texto){
  const v = n => Math.round(Number(n.replace(/\./g,'').replace(',','.')))||0;
  const out = [];
  texto.split('\n').forEach(linha=>{
    const L = linha.toUpperCase().replace(/[|_]/g,' ');
    const m = L.match(/AGENDA\s+\S+|PLANNER/); if(!m) return;
    const s = L.slice(m.index);
    const sm = s.match(/\(?\s*(\d+[.,]?\d*)\s*[X×]\s*(\d+)\s*C?M?\s*\)?/);
    let desc, tam='', rest;
    if(sm){ desc=s.slice(0,sm.index).trim(); tam=`(${sm[1].replace(',','.')} X ${sm[2]}CM)`; rest=s.slice(sm.index+sm[0].length); }
    else { desc=s.replace(/[\d.,\s]+$/,'').trim(); rest=s.slice(desc.length); }
    const nums = (rest.match(/\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?/g)||[]).map(v);
    let l=0,p=0,rev=false;
    if(nums.length>=3){ l=nums[0]; p=nums[1]; rev = l+p!==nums[2]; }
    else { l=nums[0]||0; rev=true; }   // 1 ou 2 números: não dá para saber o cliente
    out.push(`${desc} ${tam};${l};${p};${rev?'?':''}`);
  });
  return out.join('\n');
}

function garantirProdutoModelo(prodNome, modNome){
  const produtos = DB.get('produtos',[]); const modelos = DB.get('modelos',[]);
  let p = produtos.find(x=>x.nome.toLowerCase()===prodNome.toLowerCase());
  if(!p){ p={id:nid(),nome:prodNome,codigo:'',ativo:true}; produtos.push(p); DB.set('produtos',produtos); }
  let m = modelos.find(x=>x.produtoId===p.id && x.nome.toLowerCase()===modNome.toLowerCase());
  if(!m){ m={id:nid(),produtoId:p.id,nome:modNome}; modelos.push(m); DB.set('modelos',modelos); }
  return {produtoId:p.id, modeloId:m.id};
}
function confirmarImportacao(){
  const {itens, origem} = window._imp;
  const pedidos = DB.get('pedidos',[]);
  let seq = DB.get('seqPedido',0), criados = 0;
  document.querySelectorAll('#importPreview tr[data-i]').forEach(tr=>{
    const x = itens[Number(tr.dataset.i)];
    if(!x.ok || !tr.querySelector('input[type=checkbox]').checked) return;
    const qtds = [...tr.querySelectorAll('input.qi')].map(i=>Math.round(Number(i.value))||0);
    const ids = garantirProdutoModelo(x.produto, x.modelo);
    qtds.forEach((q,i)=>{
      if(q<=0) return;
      pedidos.push({id:nid(), numero:String(++seq).padStart(4,'0'), cliente:CLIENTES_IMPORT[i],
        ...ids, descricao:x.descricao, tamanho:x.tamanho, folhas:'', furacao:'', acabamento:'',
        quantidade:q, numero_op:'', data:hoje(), prazo:'', obs:'', status:'aberto'});
      criados++;
    });
  });
  DB.set('pedidos',pedidos); DB.set('seqPedido',seq);
  if(origem==='imagem') DB.set('imp_20260927',true);
  document.getElementById('importPreview').innerHTML='';
  document.getElementById('importTexto').value='';
  fillProdutoSelects(); fillModeloSelect('pProduto','pModelo'); fillModeloSelect('aProduto','aModelo');
  renderPedidoSelectApontamento(); renderPedidos(); renderDashboard();
  toast(`${criados} pedidos criados`);
}


/* ===== REGISTROS HISTÓRICOS E RELATÓRIOS ===== */
/* Preenche uma lista suspensa só com valores cadastrados, mantendo a seleção atual */
function preencherFiltroRegistro(id, valores){
  const sel=document.getElementById(id); if(!sel) return;
  const atual=sel.value;
  const unicos=[...new Set(valores.filter(Boolean))].sort((x,y)=>x.localeCompare(y,'pt-BR'));
  sel.innerHTML='<option value="">Todos</option>'+unicos.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value=unicos.includes(atual)?atual:'';
}

/* Relatório de produção: filtros por listas cadastradas, resumo agrupado e lista de lançamentos.
   Furado = etapa furação · Escanteado = etapa escanteamento · % defeito = defeitos / total produzido */
function renderRegistros(){
  const aps=DB.get('apontamentos',[]);
  const pedidos=DB.get('pedidos',[]);
  const porId=id=>pedidos.find(x=>x.id===id)||{};

  preencherFiltroRegistro('rCliente', pedidos.map(p=>p.cliente));
  preencherFiltroRegistro('rProduto', DB.get('produtos',[]).map(p=>p.nome));
  const modelosFiltro = DB.get('modelos',[]).map(m=>m.nome);
  // Inclui também modelos encontrados nos apontamentos antigos, caso o cadastro tenha sido alterado.
  preencherFiltroRegistro('rModelo', [...modelosFiltro, ...aps.map(a=>nomeModelo(a.modeloId))]);
  preencherFiltroRegistro('rFuracao', [...DB.get('furacoes',[]), ...pedidos.map(p=>p.furacao)]);
  preencherFiltroRegistro('rOrigemMaterial', ['Pedido','Estoque']);

  const v=id=>document.getElementById(id)?.value||'';
  const inicio=v('rInicio')||'0000-01-01', fim=v('rFim')||'9999-12-31';
  const cli=v('rCliente'), prod=v('rProduto'), modelo=v('rModelo'), fur=v('rFuracao'), origemMat=v('rOrigemMaterial');
  const busca=v('rBusca').trim().toLowerCase();

  const lista=aps.filter(a=>{
    const p=porId(a.pedidoId);
    const data=String(a.data||'').slice(0,10);
    if(data<inicio || data>fim) return false;
    if(cli && (p.cliente||'')!==cli) return false;
    if(prod && nomeProduto(a.produtoId)!==prod) return false;
    if(modelo && nomeModelo(a.modeloId)!==modelo) return false;
    if(fur && (p.furacao||'')!==fur) return false;
    if(origemMat && (a.origemMaterial||'Pedido')!==origemMat) return false;
    if(busca){
      const alvo=[p.numero, a.numeroOp, p.numero_op, a.usuario, p.cliente].join(' ').toLowerCase();
      if(!alvo.includes(busca)) return false;
    }
    return true;
  }).sort((x,y)=>String(y.data||'').localeCompare(String(x.data||'')));

  const soma=(arr,f)=>arr.reduce((s,a)=>s+Number(f(a)||0),0);
  const furado=soma(lista.filter(a=>(a.etapa||'furacao')==='furacao'),a=>a.produzido);
  const escant=soma(lista.filter(a=>a.etapa==='escanteamento'),a=>a.produzido);
  const defeitos=soma(lista,a=>a.defeito);
  const totalProd=soma(lista,a=>a.produzido);
  const pct=n=>n?((defeitos/n)*100).toFixed(2).replace('.',','):'0,00';

  document.getElementById('cardsRegistros').innerHTML=`
   <div class="card"><b>Total furado</b><strong>${furado}</strong></div>
   <div class="card"><b>Escanteado</b><strong>${escant}</strong></div>
   <div class="card"><b>Defeitos</b><strong>${defeitos}</strong></div>
   <div class="card"><b>Índice de defeito</b><strong>${pct(totalProd)}%</strong></div>
   <div class="card"><b>Lançamentos</b><strong>${lista.length}</strong></div>`;

  /* Resumo agrupado automaticamente: Cliente + Produto/Modelo + Tipo de furação */
  const grupos={};
  lista.forEach(a=>{
    const p=porId(a.pedidoId);
    const chave=[p.cliente||'Sem cliente', nomeProduto(a.produtoId)+' '+nomeModelo(a.modeloId), p.furacao||'-'].join('|');
    const g=grupos[chave]=grupos[chave]||{cliente:p.cliente||'Sem cliente',item:nomeProduto(a.produtoId)+' '+nomeModelo(a.modeloId),furacao:p.furacao||'-',furado:0,escant:0,def:0,prod:0};
    if(a.etapa==='escanteamento') g.escant+=Number(a.produzido||0); else g.furado+=Number(a.produzido||0);
    g.def+=Number(a.defeito||0); g.prod+=Number(a.produzido||0);
  });
  const resumo=Object.values(grupos).sort((x,y)=>y.prod-x.prod).map(g=>{
    const pg=g.prod?((g.def/g.prod)*100).toFixed(2).replace('.',','):'0,00';
    return `<div class="panel">
      <b>${esc(g.cliente)} - ${esc(g.item)}</b><br>
      Tipo de furação: ${esc(g.furacao)}<br>
      Furado: ${g.furado} | Escanteado: ${g.escant} | Defeitos: ${g.def} (${pg}%)
    </div>`;}).join('');

  document.getElementById('listaRegistros').innerHTML=
    (resumo?`<h3>Resumo por Cliente / Produto / Furação</h3>${resumo}<h3>Lançamentos</h3>`:'')+
    (lista.map(a=>{
      const p=porId(a.pedidoId);
      const op=a.numeroOp||p.numero_op||'-';
      return `<div class="panel">
      <b>${fmtDataISO(a.data)} - ${esc(p.cliente||'Sem cliente')}</b><br>
      Pedido ${esc(p.numero||'-')} · OP ${esc(op)} · Produto: ${esc(nomeProduto(a.produtoId))} ${esc(nomeModelo(a.modeloId))}<br>
      ${a.etapa==='escanteamento'?'Escanteamento':'Furação'}: ${a.produzido} | Defeitos: ${a.defeito||0}${a.usuario?' | '+esc(a.usuario):''}
    </div>`;}).join('') || '<p>Nenhum registro encontrado.</p>');
}
/* Atualiza a lista assim que qualquer filtro muda (sem precisar clicar em Pesquisar) */
['rInicio','rFim','rCliente','rProduto','rModelo','rFuracao','rOrigemMaterial'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderRegistros));
document.getElementById('rBusca')?.addEventListener('input',renderRegistros);
function gerarCardsPedidos(status){
 const ps=DB.get('pedidos',[]).filter(p=>p.status===status);
 document.getElementById('cardsPedidosRelatorio').innerHTML=ps.map(p=>`
 <div class="panel card">
 <b>Pedido ${esc(p.numero||'')}</b><br>
 Cliente: ${esc(p.cliente||'-')}<br>
 Produto: ${esc(nomeProduto(p.produtoId))}<br>
 Quantidade: ${p.quantidade}<br>
 Status: ${status==='concluido'?'Concluído':'Em andamento'}
 </div>`).join('')||'<p>Nenhum pedido.</p>';
}
function imprimirRegistros(){
 const el=document.getElementById('view-registros').innerHTML;
 const w=window.open('','_blank'); w.document.write('<html><body>'+el+'</body></html>'); w.print();
}

/* ---------- PWA: registro do service worker ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}
