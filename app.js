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

  /* Migração CLIENTES (roda uma única vez). Cria o cadastro de clientes a partir dos nomes já
     digitados nos pedidos (sem duplicar por maiúscula/acento) e padroniza a grafia nos pedidos. */
  if(!DB.get('schemaClientes',false)){
    const ps = DB.get('pedidos',[]);
    const canon = {};
    [...DB.get('clientes',[]), 'Leitura', 'Papelaria Varejo', ...ps.map(p=>String(p.cliente||'').trim())]
      .forEach(n=>{ if(n && !canon[semAcento(n)]) canon[semAcento(n)] = n; });
    ps.forEach(p=>{ const k = semAcento(String(p.cliente||'').trim()); if(k && canon[k]) p.cliente = canon[k]; });
    DB.set('pedidos', ps);
    DB.set('clientes', Object.values(canon).sort((x,y)=>x.localeCompare(y,'pt-BR')));
    DB.set('schemaClientes', true);
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
  document.querySelectorAll('#pProduto,#aProduto,#cmProduto,#cfProduto').forEach(sel=>{
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
  document.getElementById('pFuracao').innerHTML = DB.get('furacoes',[]).map(f=>`<option>${esc(f)}</option>`).join('');
  document.getElementById('pAcabamento').innerHTML = DB.get('acabamentos',[]).map(f=>`<option>${esc(f)}</option>`).join('');
  const af = document.getElementById('aFuracao');
  if(af){ const cur = af.value;
    af.innerHTML = '<option value="">-- nenhum --</option>' + DB.get('furacoes',[]).map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');
    setSelectValor(af, cur); }
  fillClienteSelects();
}
/* Cliente: lista suspensa alimentada pelo cadastro (evita erro de digitação) */
function fillClienteSelects(){
  const clientes = DB.get('clientes',[]);
  [['pCliente','-- selecione --'],['aCliente','-- nenhum --']].forEach(([id,vazio])=>{
    const sel = document.getElementById(id); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${vazio}</option>` + clientes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    setSelectValor(sel, cur);
  });
}
/* Seleciona um valor no select; se ele não estiver na lista (ex.: cadastro removido depois), acrescenta a opção */
function setSelectValor(sel, val){
  if(!sel) return;
  val = val || '';
  if(val && ![...sel.options].some(o=>o.value===val)){
    const o = document.createElement('option'); o.value = val; o.textContent = val; sel.appendChild(o);
  }
  sel.value = val;
}
/* Pedido escolhido no apontamento -> preenche cliente e furação (editáveis) */
function aplicarPedidoNosCampos(p){
  setSelectValor(document.getElementById('aCliente'), p ? (p.cliente||'') : '');
  setSelectValor(document.getElementById('aFuracao'), p ? (p.furacao||'') : '');
}
document.getElementById('pProduto')?.addEventListener('change',()=>{fillModeloSelect('pProduto','pModelo');fillFolhasSelect();});
document.getElementById('aProduto')?.addEventListener('change',()=>fillModeloSelect('aProduto','aModelo'));
document.getElementById('cmProduto')?.addEventListener('change',()=>{});

function initForms(){
  fillClienteSelects();
  fillProdutoSelects();
  fillModeloSelect('pProduto','pModelo');
  fillFolhasSelect();
  fillListasSimples();
  fillModeloSelect('aProduto','aModelo');
  document.getElementById('pData').value = hoje();
  document.getElementById('aData').value = hoje();
  document.getElementById('aUsuario').value = usuarioAtual();
  atualizarEtapaSelect(null);
  renderPedidoSelectApontamento();
}
initForms();

/* ---------- CADASTROS ---------- */
function addProduto(){
  const nome = document.getElementById('cpNome').value.trim();
  if(!nome) return toast('Informe o nome do produto');
  const codigo = document.getElementById('cpCodigo').value.trim();
  const list = DB.get('produtos',[]);
  if(list.some(p=>semAcento(p.nome)===semAcento(nome))) return toast('Esse produto já está cadastrado');
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
  if(list.some(x=>semAcento(x)===semAcento(val))) return toast('Já está cadastrado');
  list.push(val); DB.set(key,list);
  document.getElementById(inputId).value='';
  fillListasSimples(); renderCadastros(); toast('Adicionado');
}
function addCliente(){
  const nome = document.getElementById('cclNome').value.trim().replace(/\s+/g,' ');
  if(!nome) return toast('Informe o nome do cliente');
  const list = DB.get('clientes',[]);
  if(list.some(c=>semAcento(c)===semAcento(nome))) return toast('Esse cliente já está cadastrado');
  list.push(nome); list.sort((x,y)=>x.localeCompare(y,'pt-BR'));
  DB.set('clientes', list);
  document.getElementById('cclNome').value='';
  fillClienteSelects(); renderCadastros(); toast('Cliente adicionado');
}
function removerCliente(i){
  const list = DB.get('clientes',[]);
  const nome = list[i]; if(nome===undefined) return;
  if(!confirm(`Remover o cliente "${nome}" da lista? Os pedidos e registros antigos continuam com o nome.`)) return;
  list.splice(i,1); DB.set('clientes', list);
  fillClienteSelects(); renderCadastros();
}
/* garante que um cliente exista no cadastro (usado pela importação de lista) e devolve o nome padronizado */
function garantirCliente(nome){
  const list = DB.get('clientes',[]);
  const achou = list.find(c=>semAcento(c)===semAcento(nome));
  if(achou) return achou;
  list.push(nome); list.sort((x,y)=>x.localeCompare(y,'pt-BR')); DB.set('clientes', list);
  return nome;
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
  const elCli = document.getElementById('listaClientes');
  if(elCli) elCli.innerHTML = DB.get('clientes',[]).map((c,i)=>`
    <div class="item"><div class="row"><h4>${esc(c)}</h4><button class="del" onclick="removerCliente(${i})">✕</button></div></div>`).join('') || '<p class="meta">Nenhum cliente cadastrado.</p>';
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
  const escanteado = p.tipoProcesso === 'escanteado';
  if(furada < p.quantidade){
    return {texto:'Aguardando furação', etapaAtual:'furacao', furada, escanteada:0, saldo:p.quantidade-furada, pronto:false};
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

function nomeExibicaoPedido(p){
  const nome = String(p.nome || '').trim();
  return nome || `Pedido ${p.numero}`;
}

function limparFormPedido(){
  document.getElementById('formPedido').reset();
  document.getElementById('pEditId').value = '';
  document.getElementById('pData').value = hoje();
  fillProdutoSelects();
  fillModeloSelect('pProduto','pModelo');
  fillFolhasSelect();
  fillListasSimples();
  document.getElementById('btnSalvarPedido').textContent = 'Salvar Pedido';
  document.getElementById('btnCancelarEdicao').style.display = 'none';
}

function cancelarEdicaoPedido(){
  limparFormPedido();
  toast('Edição cancelada');
}

function editarPedido(id){
  const p = DB.get('pedidos',[]).find(x=>x.id===id);
  if(!p) return;
  document.getElementById('pEditId').value = p.id;
  document.getElementById('pNome').value = p.nome || '';
  setSelectValor(document.getElementById('pCliente'), p.cliente || '');
  document.getElementById('pOP').value = p.numero_op || '';
  document.getElementById('pProduto').value = p.produtoId;
  fillModeloSelect('pProduto','pModelo');
  document.getElementById('pModelo').value = p.modeloId;
  fillFolhasSelect();
  document.getElementById('pFolhas').value = p.folhas || '';
  setSelectValor(document.getElementById('pFuracao'), p.furacao || '');
  setSelectValor(document.getElementById('pAcabamento'), p.acabamento || '');
  document.getElementById('pTipoProcesso').value = p.tipoProcesso || 'reto';
  document.getElementById('pQuantidade').value = p.quantidade || '';
  document.getElementById('pData').value = p.data || hoje();
  document.getElementById('pPrazo').value = p.prazo || '';
  document.getElementById('pObs').value = p.obs || '';
  document.getElementById('btnSalvarPedido').textContent = 'Salvar alterações';
  document.getElementById('btnCancelarEdicao').style.display = 'inline-block';
  document.getElementById('formPedido').scrollIntoView({behavior:'smooth', block:'start'});
}

function salvarPedido(){
  const produtoId = Number(document.getElementById('pProduto').value);
  const modeloId = Number(document.getElementById('pModelo').value);
  const quantidade = Number(document.getElementById('pQuantidade').value);
  if(!produtoId || !modeloId || !quantidade) return toast('Preencha produto, modelo e quantidade');

  const editId = Number(document.getElementById('pEditId').value) || 0;
  const list = DB.get('pedidos',[]);
  let pedido;

  if(editId){
    pedido = list.find(x=>x.id===editId);
    if(!pedido) return toast('Pedido não encontrado');
    Object.assign(pedido, {
      nome: document.getElementById('pNome').value.trim(),
      cliente: document.getElementById('pCliente').value.trim(),
      numero_op: document.getElementById('pOP').value.trim(),
      produtoId, modeloId,
      folhas: document.getElementById('pFolhas').value,
      furacao: document.getElementById('pFuracao').value,
      acabamento: document.getElementById('pAcabamento').value,
      tipoProcesso: document.getElementById('pTipoProcesso').value || 'reto',
      quantidade,
      data: document.getElementById('pData').value || hoje(),
      prazo: document.getElementById('pPrazo').value,
      obs: document.getElementById('pObs').value.trim()
    });
    pedido.historico = pedido.historico || [];
    pedido.historico.push({data:hoje(), hora:fmtDataHora(new Date().toISOString()).split(' ')[1]||'',
      usuario:usuarioAtual(), operacao:'Pedido editado', quantidade:pedido.quantidade});
    DB.set('pedidos',list);
    toast(`${nomeExibicaoPedido(pedido)} atualizado`);
  } else {
    let seq = DB.get('seqPedido',0) + 1;
    DB.set('seqPedido', seq);
    pedido = {
      id: Date.now(),
      numero: String(seq).padStart(4,'0'),
      nome: document.getElementById('pNome').value.trim(),
      cliente: document.getElementById('pCliente').value.trim(),
      numero_op: document.getElementById('pOP').value.trim(),
      produtoId, modeloId,
      folhas: document.getElementById('pFolhas').value,
      furacao: document.getElementById('pFuracao').value,
      acabamento: document.getElementById('pAcabamento').value,
      tipoProcesso: document.getElementById('pTipoProcesso').value || 'reto',
      quantidade,
      data: document.getElementById('pData').value || hoje(),
      prazo: document.getElementById('pPrazo').value,
      obs: document.getElementById('pObs').value.trim(),
      status: 'aberto',
      historico: []
    };
    pedido.historico.push({data:pedido.data, hora:fmtDataHora(new Date().toISOString()).split(' ')[1]||'',
      usuario:usuarioAtual(), operacao:'Entrada do pedido', quantidade:pedido.quantidade});
    list.push(pedido); DB.set('pedidos',list);
    toast(`${nomeExibicaoPedido(pedido)} criado`);
  }

  limparFormPedido();
  renderPedidoSelectApontamento();
  renderPedidos();
}

function renderPedidoSelectApontamento(){
  const pedidos = DB.get('pedidos',[]).filter(p=>p.status!=='concluido');
  const sel = document.getElementById('aPedido');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- nenhum --</option>' + pedidos.map(p=>
    `<option value="${p.id}">${esc(nomeExibicaoPedido(p))}${p.numero_op?' · OP '+esc(p.numero_op):''} - ${esc(tituloPedido(p))}</option>`).join('');
  sel.value = cur;
  sel.onchange = ()=>{
    const p = pedidos.find(x=>x.id===Number(sel.value));
    if(p){
      document.getElementById('aProduto').value = p.produtoId;
      fillModeloSelect('aProduto','aModelo');
      document.getElementById('aModelo').value = p.modeloId;
      document.getElementById('aOP').value = p.numero_op || '';   // OP vinculada ao pedido (editável)
      aplicarPedidoNosCampos(p);
      atualizarEtapaSelect(p);
    } else {
      aplicarPedidoNosCampos(null);
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
  if(pedido.tipoProcesso === 'escanteado') opts += '<option value="escanteamento">Escanteamento</option>';
  sel.innerHTML = opts;
  sel.value = (st.etapaAtual === 'escanteamento') ? 'escanteamento' : 'furacao';
}

function renderPedidos(){
  const busca = (document.getElementById('buscaPedido')?.value || '').toLowerCase();
  const pedidos = DB.get('pedidos',[]).slice().reverse().filter(p=>{
    const alvo = `${p.numero} ${p.nome||''} ${p.numero_op||''} ${p.cliente} ${tituloPedido(p)}`.toLowerCase();
    return alvo.includes(busca);
  });
  document.getElementById('listaPedidos').innerHTML = pedidos.map(p=>{
    const st = statusPedido(p);
    const feito = st.pronto ? p.quantidade : (st.etapaAtual==='escanteamento' ? st.escanteada : st.furada);
    const pct = Math.min(100, Math.round(feito / p.quantidade * 100));
    const alerta = !st.pronto && st.saldo <= p.quantidade * 0.1;
    return `<div class="item" onclick="abrirDetalhesPedido(${p.id})">
      <div class="row"><h4>${esc(nomeExibicaoPedido(p))} — ${tituloPedido(p)}</h4>
      <span onclick="event.stopPropagation()"><button class="del" title="Editar pedido" onclick="editarPedido(${p.id})">✏️ Editar</button><button class="del" onclick="excluirPedido(${p.id})">✕</button></span></div>
      <div class="meta">OP: ${p.numero_op?esc(p.numero_op):'-'} · ${p.cliente?('Cliente: '+p.cliente+' · '):''}${p.tipoProcesso==='escanteado'?'Escanteado':'Reto'}${p.furacao?' · '+p.furacao:''} ${p.acabamento||''}</div>
      <div class="meta">Solicitado: ${p.quantidade} · Furação: ${st.furada}/${p.quantidade}${p.tipoProcesso==='escanteado'?` · Escanteamento: ${st.escanteada}/${p.quantidade}`:''}</div>
      <div class="meta"><b>${st.texto}</b>${st.pronto?'':` · Saldo: ${st.saldo}`}</div>
      <div class="progress ${alerta?'alerta':''}"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || '<p class="meta">Nenhum pedido cadastrado.</p>';
}
document.getElementById('buscaPedido')?.addEventListener('input', renderPedidos);
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
    <div class="row"><h3>${esc(nomeExibicaoPedido(p))}</h3><button class="del" onclick="fecharModal()">✕</button></div>
    <div class="meta">Código interno: ${esc(p.numero)}</div>
    <div class="meta">OP: <b>${p.numero_op?esc(p.numero_op):'-'}</b></div>
    <div class="meta">Material: ${esc(tituloPedido(p))}</div>
    <div class="meta">Cliente: ${p.cliente?esc(p.cliente):'-'}</div>
    <div class="meta">Quantidade total: <b>${p.quantidade}</b> peças</div>
    <div class="meta">Processo: ${p.tipoProcesso==='escanteado'
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
    toast(`OP ligada a ${nomeExibicaoPedido(achados[0])}`);
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
  document.getElementById('resultadoCalc').innerHTML =
    `Produção válida: <b>${valido}</b> unidades${saldoTxt}`;
}

/* Grava um apontamento (usado pelo lançamento manual e pelo de voz).
   origem: 'Manual' | 'Áudio' · op: opcional ('' = sem OP) */
function registrarApontamento({pedido, produtoId, modeloId, produzido, defeito, op, origem, data, obs, etapa, usuario, cliente, furacao}){
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
    cliente: (pedido && pedido.cliente) || cliente || '',     // fotografia do cliente/furação no momento do lançamento
    furacao: (pedido && pedido.furacao) || furacao || '',     // (o relatório de Registros agrupa por estes campos)
    usuario: usuario || '',
    origem: origem || 'Manual',
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

  const pedidoId = Number(document.getElementById('aPedido').value) || null;
  const pedido = pedidoId ? DB.get('pedidos',[]).find(p=>p.id===pedidoId) : null;
  const etapa = document.getElementById('aEtapa').value || 'furacao';
  if(pedido && etapa==='furacao' && pedido.tipoProcesso==='escanteado' && quantidadeEtapa(pedidoId,'furacao')>=pedido.quantidade)
    return toast('A furação deste pedido já está completa — lance em Escanteamento');
  if(pedido && etapa==='escanteamento' && quantidadeEtapa(pedidoId,'furacao')<pedido.quantidade)
    return toast('Ainda falta concluir a furação antes do escanteamento');
  const usuario = document.getElementById('aUsuario').value.trim();
  salvarUsuarioAtual(usuario);

  const registro = registrarApontamento({
    pedido, produtoId, modeloId, produzido, defeito, etapa, usuario,
    cliente: document.getElementById('aCliente').value,
    furacao: document.getElementById('aFuracao').value,
    op: document.getElementById('aOP').value.trim(),      // OP opcional, pode ter sido alterada à mão
    origem: window._origemForm === 'Áudio' ? 'Áudio' : 'Manual',  // 'Áudio' se os campos vieram da voz
    data: document.getElementById('aData').value,
    obs: document.getElementById('aObs').value.trim()
  });

  limparFormApontamento();
  renderApontamentos(); renderPedidos(); renderPedidoSelectApontamento();
  mostrarRetorno(registro);
  toast('Produção lançada');
}

/* Mensagem de confirmação após o lançamento (manual ou voz) */
function mostrarRetorno(r){
  const p = DB.get('pedidos',[]).find(x=>x.id===r.pedidoId);
  const box = document.getElementById('retornoApontamento');
  box.innerHTML = `<b>Apontamento realizado com sucesso.</b><br>
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
      <div class="meta">Pedido ${ped?esc(ped.numero):'-'} · OP ${esc(a.numeroOp||'-')} · ${(a.etapa==='escanteamento'?'Escanteamento':'Furação')} · ${quando}</div>
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
    aplicarPedidoNosCampos(pedido);
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

  const etapa = cmd.etapa || (pedido.tipoProcesso==='escanteado' && quantidadeEtapa(pedido.id,'furacao')>=pedido.quantidade ? 'escanteamento' : 'furacao');
  if(etapa==='furacao' && pedido.tipoProcesso==='escanteado' && quantidadeEtapa(pedido.id,'furacao')>=pedido.quantidade){
    guardar({qtd:null, pedidoNum:pedido.numero});
    return falar('❌ A furação deste pedido já está completa — fale "escanteamento".', 'erro');
  }
  if(etapa==='escanteamento' && quantidadeEtapa(pedido.id,'furacao')<pedido.quantidade){
    guardar({qtd:null, pedidoNum:pedido.numero});
    return falar('❌ Ainda falta concluir a furação antes do escanteamento.', 'erro');
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

/* ---------- EXPORTAÇÃO ---------- */
function exportarCSV(){
  const apont = DB.get('apontamentos',[]);
  const cel = v => String(v??'').replace(/[;\r\n]/g,' ');
  let csv = 'Data;Produto;Modelo;Etapa;Produzido;Defeito;Valido;Pedido;OP;Usuario;Origem;Cliente;Furacao\n';
  apont.forEach(a=>{
    const pedido = a.pedidoId ? DB.get('pedidos',[]).find(p=>p.id===a.pedidoId)?.numero : '';
    csv += `${a.data};${nomeProduto(a.produtoId)};${nomeModelo(a.modeloId)};${a.etapa==='escanteamento'?'Escanteamento':'Furação'};${a.produzido};${a.defeito};${a.valido};${pedido||''};${cel(a.numeroOp)};${cel(a.usuario)};${a.origem||'Manual'};${cel(a.cliente||(a.pedidoId?(DB.get('pedidos',[]).find(p=>p.id===a.pedidoId)||{}).cliente:''))};${cel(a.furacao||(a.pedidoId?(DB.get('pedidos',[]).find(p=>p.id===a.pedidoId)||{}).furacao:''))}\n`;
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
  if(typeof LISTA_IMAGEM === 'undefined') return toast('Arquivo import-data.js não encontrado no site');
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
      pedidos.push({id:nid(), numero:String(++seq).padStart(4,'0'), cliente:garantirCliente(CLIENTES_IMPORT[i]),
        ...ids, descricao:x.descricao, tamanho:x.tamanho, folhas:'', furacao:'', acabamento:'',
        quantidade:q, numero_op:'', data:hoje(), prazo:'', obs:'', status:'aberto'});
      criados++;
    });
  });
  DB.set('pedidos',pedidos); DB.set('seqPedido',seq);
  if(origem==='imagem') DB.set('imp_20260927',true);
  document.getElementById('importPreview').innerHTML='';
  document.getElementById('importTexto').value='';
  fillProdutoSelects(); fillModeloSelect('pProduto','pModelo'); fillModeloSelect('aProduto','aModelo'); fillClienteSelects(); renderCadastros();
  renderPedidoSelectApontamento(); renderPedidos(); renderDashboard();
  toast(`${criados} pedidos criados`);
}


/* ===== REGISTROS HISTÓRICOS E RELATÓRIOS =====
   Relatório de qualidade por Cliente / Produto / Tipo de furação.
   · Furada      = soma de "produzido" nos lançamentos da etapa Furação
   · Escanteada  = soma de "produzido" nos lançamentos da etapa Escanteamento
   · Defeitos    = soma de "defeito" (das duas etapas)
   · % Defeito   = Defeitos ÷ (Furada + Escanteada) × 100
     (pedido reto só tem furação, então é exatamente Defeitos ÷ Produção × 100;
      ex.: 570 ÷ 50.000 × 100 = 1,14%). Por etapa, o detalhe aparece abaixo do total.
   Os filtros só mostram valores que existem nos Cadastros (Clientes, Produtos, Furação). */

const SEM_CLIENTE = 'Sem cliente', SEM_FURACAO = 'Furação não informada';
const fmtNum = n => Number(n||0).toLocaleString('pt-BR');
const fmtPct = n => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
const pctDe = (d,q) => q>0 ? (d/q)*100 : 0;
const mesmoTexto = (x,y) => semAcento(String(x||'').trim()) === semAcento(String(y||'').trim());

function preencherFiltrosRegistros(){
  const fill = (id, arr)=>{
    const el = document.getElementById(id); if(!el) return;
    const val = el.value;
    el.innerHTML = '<option value="">Todos</option>' + arr.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    el.value = arr.includes(val) ? val : '';
  };
  fill('rCliente', DB.get('clientes',[]).slice().sort((x,y)=>x.localeCompare(y,'pt-BR')));
  fill('rProduto', DB.get('produtos',[]).filter(p=>p.ativo).map(p=>p.nome));
  fill('rFuracao', DB.get('furacoes',[]));
}

/* Normaliza um apontamento: cliente/furação vêm do próprio lançamento ou, se for antigo, do pedido */
function dadosRegistro(a, pedidos){
  const p = pedidos.find(x=>x.id===a.pedidoId) || {};
  const nomeProd = nomeProduto(a.produtoId);
  return {
    a,
    cliente: String(a.cliente || p.cliente || '').trim() || SEM_CLIENTE,
    produto: nomeProd === '?' ? 'Produto não encontrado' : nomeProd,
    furacao: String(a.furacao || p.furacao || '').trim() || SEM_FURACAO,
    etapa: a.etapa === 'escanteamento' ? 'escanteamento' : 'furacao',
    produzido: Number(a.produzido)||0,
    defeito: Number(a.defeito)||0
  };
}

function filtrosRegistrosAtuais(){
  const v = id => document.getElementById(id)?.value || '';
  return { inicio:v('rInicio'), fim:v('rFim'), cliente:v('rCliente'), produto:v('rProduto'), furacao:v('rFuracao'), agrupar:v('rAgrupar')||'produto' };
}

function calcularRegistros(){
  const f = filtrosRegistrosAtuais();
  const pedidos = DB.get('pedidos',[]);
  const linhas = DB.get('apontamentos',[]).map(a=>dadosRegistro(a,pedidos)).filter(r=>{
    const d = r.a.data || '';
    return (!f.inicio || d>=f.inicio) && (!f.fim || d<=f.fim)
      && (!f.cliente || mesmoTexto(r.cliente,f.cliente))
      && (!f.produto || mesmoTexto(r.produto,f.produto))
      && (!f.furacao || mesmoTexto(r.furacao,f.furacao));
  });

  const chave = r => f.agrupar==='cliente' ? r.cliente
                   : f.agrupar==='furacao' ? r.furacao
                   : f.agrupar==='combo'   ? `${r.cliente} › ${r.produto} › ${r.furacao}`
                   : r.produto;
  const novo = () => ({furada:0, escanteada:0, defFur:0, defEsc:0, lanc:0});
  const soma = (g,r)=>{
    if(r.etapa==='escanteamento'){ g.escanteada += r.produzido; g.defEsc += r.defeito; }
    else { g.furada += r.produzido; g.defFur += r.defeito; }
    g.lanc++;
  };
  const grupos = {}, total = novo();
  linhas.forEach(r=>{ const k = chave(r); (grupos[k] = grupos[k] || novo()); soma(grupos[k],r); soma(total,r); });
  const fim = g => { g.produzido = g.furada + g.escanteada; g.defeitos = g.defFur + g.defEsc; g.pct = pctDe(g.defeitos, g.produzido); return g; };
  fim(total);
  const lista = Object.entries(grupos).map(([nome,g])=>({nome, ...fim(g)}))
      .sort((x,y)=> y.pct-x.pct || y.produzido-x.produzido || x.nome.localeCompare(y.nome,'pt-BR'));
  return {f, linhas, lista, total};
}

const ROTULO_AGRUPAR = {produto:'Produto', cliente:'Cliente', furacao:'Tipo de furação', combo:'Cliente › Produto › Furação'};

function htmlTabelaGrupos(R){
  const {lista, total, f} = R;
  const detalhe = g => {
    const p = [];
    if(g.furada || g.defFur) p.push(`Furação: ${fmtNum(g.defFur)} de ${fmtNum(g.furada)} (${fmtPct(pctDe(g.defFur,g.furada))})`);
    if(g.escanteada || g.defEsc) p.push(`Escanteamento: ${fmtNum(g.defEsc)} de ${fmtNum(g.escanteada)} (${fmtPct(pctDe(g.defEsc,g.escanteada))})`);
    return p.length ? `<br><small>${p.join(' · ')}</small>` : '';
  };
  const linha = (nome,g,extra='') => `<tr${extra}>
      <td>${esc(nome)}</td><td class="num">${fmtNum(g.furada)}</td><td class="num">${fmtNum(g.escanteada)}</td>
      <td class="num">${fmtNum(g.defeitos)}${detalhe(g)}</td><td class="num"><b>${fmtPct(g.pct)}</b></td></tr>`;
  return `<div class="tabela-scroll livre"><table class="tabela">
    <thead><tr><th>${ROTULO_AGRUPAR[f.agrupar]}</th><th class="num">Furada</th><th class="num">Escanteada</th><th class="num">Defeitos</th><th class="num">% Defeito</th></tr></thead>
    <tbody>${lista.map(g=>linha(g.nome,g)).join('')}${linha('TOTAL',total,' class="total"')}</tbody></table></div>`;
}

function renderRegistros(){
  preencherFiltrosRegistros();
  const R = calcularRegistros();
  const {linhas, lista, total, f} = R;

  document.getElementById('cardsRegistros').innerHTML = `
    <div class="card"><b>${fmtNum(total.furada)}</b><span>Total furado</span></div>
    <div class="card"><b>${fmtNum(total.escanteada)}</b><span>Total escanteado</span></div>
    <div class="card ${total.defeitos?'alerta':''}"><b>${fmtNum(total.defeitos)}</b><span>Defeitos</span></div>
    <div class="card ${total.pct>=2?'alerta':''}"><b>${fmtPct(total.pct)}</b><span>Índice de defeito</span></div>
    <div class="card"><b>${fmtNum(linhas.length)}</b><span>Lançamentos</span></div>`;

  const semCli = linhas.filter(r=>r.cliente===SEM_CLIENTE).length;
  const semFur = linhas.filter(r=>r.furacao===SEM_FURACAO).length;
  const aviso = (semCli||semFur) ? `<p class="meta aviso-dados">⚠️ ${semCli?`${semCli} lançamento(s) sem cliente`:''}${semCli&&semFur?' e ':''}${semFur?`${semFur} sem tipo de furação`:''}.
     Eles entram nos totais, mas só aparecem em "Todos" nos filtros. Preencha Cliente e Tipo de furação no pedido/lançamento para a análise ficar completa.</p>` : '';

  const detalhes = linhas.slice().sort((x,y)=> String(y.a.data).localeCompare(String(x.a.data)) || (y.a.id-x.a.id)).map(r=>`
    <div class="item">
      <div class="row"><h4>${fmtDataISO(r.a.data)} — ${esc(r.produto)}</h4><span class="tag">${r.etapa==='escanteamento'?'Escanteamento':'Furação'}</span></div>
      <div class="meta">${esc(r.cliente)} · ${esc(r.furacao)}</div>
      <div class="meta">Quantidade: ${fmtNum(r.produzido)} · Defeitos: ${fmtNum(r.defeito)} (${fmtPct(pctDe(r.defeito,r.produzido))})</div>
    </div>`).join('');

  document.getElementById('listaRegistros').innerHTML = linhas.length ? `
    <h3>Resumo por ${ROTULO_AGRUPAR[f.agrupar].toLowerCase()} <span class="meta">(maior % de defeito primeiro)</span></h3>
    ${aviso}
    ${htmlTabelaGrupos(R)}
    <p class="meta">% Defeito = Defeitos ÷ (Furada + Escanteada) × 100. Pedido reto: Defeitos ÷ Produção × 100.</p>
    <details class="detalhe-lanc"><summary>Detalhamento dos lançamentos (${fmtNum(linhas.length)})</summary>
      <div class="lista-pedidos" style="margin-top:10px">${detalhes}</div></details>`
    : '<p class="meta">Nenhum registro encontrado para os filtros escolhidos.</p>';
}

function limparFiltrosRegistros(){
  ['rInicio','rFim','rCliente','rProduto','rFuracao'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const ag = document.getElementById('rAgrupar'); if(ag) ag.value = 'produto';
  renderRegistros();
}

function exportarRegistrosCSV(){
  const R = calcularRegistros(); if(!R.lista.length) return toast('Nada para exportar com esses filtros');
  const cel = v => String(v??'').replace(/[;\r\n]/g,' ');
  const num = n => String(Number(n).toFixed(2)).replace('.',',');
  let csv = `${ROTULO_AGRUPAR[R.f.agrupar]};Furada;Escanteada;Defeitos furação;Defeitos escanteamento;Defeitos total;% Defeito\n`;
  [...R.lista, {nome:'TOTAL', ...R.total}].forEach(g=>{
    csv += `${cel(g.nome)};${g.furada};${g.escanteada};${g.defFur};${g.defEsc};${g.defeitos};${num(g.pct)}\n`;
  });
  baixarArquivo('relatorio_registros.csv', csv, 'text/csv;charset=utf-8;');
}

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
  const R = calcularRegistros();
  const {f, total} = R;
  const filtros = [f.inicio&&`De ${fmtDataISO(f.inicio)}`, f.fim&&`até ${fmtDataISO(f.fim)}`, f.cliente&&`Cliente: ${f.cliente}`,
                   f.produto&&`Produto: ${f.produto}`, f.furacao&&`Furação: ${f.furacao}`].filter(Boolean).join(' · ') || 'Sem filtros (todos os registros)';
  const w = window.open('','_blank'); if(!w) return toast('Permita pop-ups para imprimir');
  w.document.write(`<html><head><meta charset="utf-8"><title>Registros de Produção</title>
    <style>body{font-family:system-ui,sans-serif;padding:20px;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:12px} td,th{border:1px solid #999;padding:6px 8px;font-size:13px;text-align:left}
    .num{text-align:right} tr.total td{font-weight:700;background:#eee} small{color:#555}
    .cards{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.c{border:1px solid #999;border-radius:8px;padding:8px 14px}.c b{display:block;font-size:20px}</style></head><body>
    <h2>Registros de Produção — por ${ROTULO_AGRUPAR[f.agrupar].toLowerCase()}</h2>
    <p>${esc(filtros)}<br>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <div class="cards"><div class="c"><b>${fmtNum(total.furada)}</b>Furado</div><div class="c"><b>${fmtNum(total.escanteada)}</b>Escanteado</div>
    <div class="c"><b>${fmtNum(total.defeitos)}</b>Defeitos</div><div class="c"><b>${fmtPct(total.pct)}</b>Índice de defeito</div></div>
    ${R.lista.length ? htmlTabelaGrupos(R).replace('tabela-scroll livre','') : '<p>Nenhum registro encontrado.</p>'}
    <p><small>% Defeito = Defeitos ÷ (Furada + Escanteada) × 100</small></p></body></html>`);
  w.document.close(); setTimeout(()=>w.print(), 400);
}

/* ---------- PWA: registro do service worker ----------
   updateViaCache:'none' -> o navegador sempre busca service-worker.js na rede (nunca do cache HTTP).
   O próprio service worker recarrega as abas abertas quando publica uma versão nova. */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js', {updateViaCache:'none'}).then(reg=>{
      reg.update();                                                   // procura versão nova a cada abertura
      document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) reg.update(); });
      setInterval(()=>reg.update(), 30*60*1000);                      // e a cada 30 min com o app aberto
    }).catch(()=>{});
  });
}


/* ---------- SEGURANÇA / BACKUP COMPLETO ---------- */
const APP_BACKUP_KEYS = [
  'produtos','modelos','folhas','furacoes','acabamentos','clientes',
  'pedidos','apontamentos','seqPedido','schemaOP','schemaEtapas','schemaClientes',
  'imp_20260927','usuarioAtual'
];

function dadosParaBackup(){
  const dados = {};
  APP_BACKUP_KEYS.forEach(chave=>{
    const bruto = localStorage.getItem(chave);
    if(bruto !== null){
      try{ dados[chave] = JSON.parse(bruto); }
      catch(_){ dados[chave] = bruto; }
    }
  });
  return dados;
}

function nomeArquivoBackup(){
  const d = new Date();
  const z = n => String(n).padStart(2,'0');
  return `backup-producao-${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}.json`;
}

function baixarJSON(obj, nome){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function fazerBackupCompleto(){
  const agora = new Date();
  const pacote = {
    app: 'Apontamento de Produção',
    formato: 'backup-completo',
    versaoBackup: 1,
    criadoEm: agora.toISOString(),
    dados: dadosParaBackup()
  };
  baixarJSON(pacote, nomeArquivoBackup());
  localStorage.setItem('ultimoBackupCompleto', agora.toISOString());
  atualizarStatusBackup();
  toast('Backup completo baixado com sucesso');
}

function abrirRestauracaoBackup(){
  const input = document.getElementById('arquivoBackupCompleto');
  if(input){ input.value=''; input.click(); }
}

async function restaurarBackupCompleto(event){
  const arquivo = event.target.files && event.target.files[0];
  if(!arquivo) return;
  try{
    const txt = await arquivo.text();
    const pacote = JSON.parse(txt);
    if(!pacote || pacote.formato !== 'backup-completo' || !pacote.dados || typeof pacote.dados !== 'object'){
      throw new Error('Arquivo não reconhecido como backup completo deste app.');
    }
    const presentes = APP_BACKUP_KEYS.filter(k => Object.prototype.hasOwnProperty.call(pacote.dados, k));
    if(!presentes.length) throw new Error('O backup não contém dados reconhecidos.');

    const qtdPedidos = Array.isArray(pacote.dados.pedidos) ? pacote.dados.pedidos.length : 0;
    const qtdApont = Array.isArray(pacote.dados.apontamentos) ? pacote.dados.apontamentos.length : 0;
    const data = pacote.criadoEm ? new Date(pacote.criadoEm).toLocaleString('pt-BR') : 'data desconhecida';
    const ok = confirm(`Restaurar este backup?\n\nCriado em: ${data}\nPedidos: ${qtdPedidos}\nApontamentos: ${qtdApont}\n\nOs dados atuais do app serão substituídos pelos dados do arquivo.`);
    if(!ok) return;

    APP_BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
    presentes.forEach(k => localStorage.setItem(k, JSON.stringify(pacote.dados[k])));
    localStorage.setItem('ultimoBackupRestaurado', new Date().toISOString());
    alert('Backup restaurado com sucesso. O aplicativo será recarregado agora.');
    location.reload();
  }catch(err){
    alert('Não foi possível restaurar o backup.\n\n' + (err && err.message ? err.message : 'Arquivo inválido.'));
  }
}

function atualizarStatusBackup(){
  const el = document.getElementById('statusBackupCompleto');
  if(!el) return;
  const iso = localStorage.getItem('ultimoBackupCompleto');
  if(!iso){
    el.innerHTML = '<strong>⚠️ Nenhum backup completo registrado neste navegador.</strong><br>Faça um backup antes de cadastrar dados que você não pode perder.';
    return;
  }
  const d = new Date(iso);
  el.innerHTML = `<strong>✅ Último backup:</strong> ${isNaN(d) ? esc(iso) : d.toLocaleString('pt-BR')}`;
}

document.addEventListener('DOMContentLoaded', atualizarStatusBackup);
