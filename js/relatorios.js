/* Exportação simples CSV compatível com Excel */
window.Relatorios={
 excel:function(nome,dados){
  const csv=Object.keys(dados[0]||{}).join(';')+'\n'+dados.map(x=>Object.values(x).join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=nome+'.csv';a.click();
 }
};
