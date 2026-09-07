/* Módulo OP - FURACAO APP 56 */
window.OPService={
 criar:function(op){
  const lista=JSON.parse(localStorage.getItem('cp_ordens')||'[]');
  lista.push({...op,criada:new Date().toISOString()});
  localStorage.setItem('cp_ordens',JSON.stringify(lista));
 },
 buscar:function(numero){return (JSON.parse(localStorage.getItem('cp_ordens')||'[]')).filter(x=>String(x.op)===String(numero));}
};
