/* FURACAO APP - Módulo Gestão Industrial MES/ERP
   OP, apontamentos, produtividade, qualidade, relatórios e exportação.
*/
(function(){
const DB={
 op:'ordem_producao', apont:'apontamentos', defeitos:'defeitos'
};
function load(k){return JSON.parse(localStorage.getItem('cp_'+k)||'[]')}
function save(k,v){localStorage.setItem('cp_'+k,JSON.stringify(v))}
function uid(){return 'id_'+Date.now()+Math.random().toString(16).slice(2)}
function hours(a,b){return Math.max(0,(new Date(b)-new Date(a))/3600000)}
window.GestaoIndustrial={
 criarOP(d){const x={id:uid(),numero_op:d.numero_op||'21234',produto:d.produto||'Caderno Universitário 160 folhas',categoria:d.categoria||'',cliente:d.cliente||'Cliente X',quantidade_planejada:+d.quantidade_planejada||10000,quantidade_produzida:0,quantidade_aprovada:0,quantidade_rejeitada:0,status:'aberta',data_criacao:new Date().toISOString(),funcionarios:[],maquinas:[]};let a=load(DB.op);a.push(x);save(DB.op,a);return x},
 apontar(d){let a=load(DB.apont);let h=hours(d.inicio,d.fim);let x={id:uid(),op:d.op,funcionario:d.funcionario,produto:d.produto,maquina:d.maquina,inicio:d.inicio,fim:d.fim,quantidade:+d.quantidade||0,boa:+d.boa||0,defeito:+d.defeito||0,horas:h,produtividade:h?d.quantidade/h:0};a.push(x);save(DB.apont,a);this.recalcularOP(d.op);return x},
 defeito(d){let a=load(DB.defeitos);a.push(Object.assign({id:uid(),data:new Date().toISOString()},d));save(DB.defeitos,a)},
 recalcularOP(n){let ops=load(DB.op), aps=load(DB.apont), op=ops.find(x=>String(x.numero_op)==String(n));if(!op)return;let r=aps.filter(x=>String(x.op)==String(n));op.quantidade_produzida=r.reduce((s,x)=>s+x.quantidade,0);op.quantidade_aprovada=r.reduce((s,x)=>s+x.boa,0);op.quantidade_rejeitada=r.reduce((s,x)=>s+x.defeito,0);op.status=op.quantidade_produzida>=op.quantidade_planejada?'finalizada':'produção';save(DB.op,ops)},
 historicoOP(n){return {op:load(DB.op).find(x=>String(x.numero_op)==String(n)),producao:load(DB.apont).filter(x=>String(x.op)==String(n)),defeitos:load(DB.defeitos).filter(x=>String(x.op)==String(n))}},
 ranking(){let m={};load(DB.apont).forEach(x=>{m[x.funcionario]=m[x.funcionario]||{funcionario:x.funcionario,q:0,h:0};m[x.funcionario].q+=x.quantidade;m[x.funcionario].h+=x.horas});return Object.values(m).map(x=>({...x,media_hora:x.h?x.q/x.h:0})).sort((a,b)=>b.media_hora-a.media_hora)},
 capacidade(prod){let r=load(DB.apont).filter(x=>x.produto==prod);let f=new Set(r.map(x=>x.funcionario)).size;return {produto:prod,funcionarios:f,capacidade_dia:r.reduce((s,x)=>s+x.quantidade,0)/(new Set(r.map(x=>x.inicio.slice(0,10))).size||1)}},
 dashboard(){return {producaoHoje:load(DB.apont).filter(x=>x.inicio&&x.inicio.slice(0,10)==new Date().toISOString().slice(0,10)).reduce((s,x)=>s+x.quantidade,0),mes:load(DB.apont).reduce((s,x)=>s+x.quantidade,0),defeitos:load(DB.defeitos).reduce((s,x)=>s+(+x.quantidade||0),0),ranking:this.ranking()}},
 excel(nome,dados){let csv=Object.keys(dados[0]||{}).join(';')+'\n'+dados.map(x=>Object.values(x).join(';')).join('\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv]));a.download=nome+'.csv';a.click()},
 seed(){if(!load(DB.op).length){this.criarOP({numero_op:'21234'});this.apontar({op:'21234',funcionario:'João',produto:'Caderno Universitário 160 folhas',maquina:'Automática 1',inicio:'2026-09-07T07:30',fim:'2026-09-07T16:30',quantidade:3000,boa:2980,defeito:20})}}
};
GestaoIndustrial.seed();
let d=document.getElementById('dash');if(d){let x=GestaoIndustrial.dashboard();d.innerHTML='<h2>Produção hoje: '+x.producaoHoje+'</h2><h2>Produção total: '+x.mes+'</h2><h2>Defeitos: '+x.defeitos+'</h2><h2>Ranking</h2>'+x.ranking.map((r,i)=>'<p>'+(i+1)+' - '+r.funcionario+' '+r.media_hora.toFixed(1)+' un/h</p>').join('')}
})();
