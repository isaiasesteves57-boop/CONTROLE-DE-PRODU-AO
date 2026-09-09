/* Cálculo de produtividade */
window.Produtividade={
 media:function(valores){ if(!valores.length)return 0; return valores.reduce((a,b)=>a+Number(b),0)/valores.length; },
 analisar:function(registros){
  const total=registros.reduce((a,b)=>a+Number(b.quantidade||0),0);
  const horas=registros.reduce((a,b)=>a+Number(b.horas||0),0);
  return {total:total,mediaDia:this.media(registros.map(r=>r.quantidade)),porHora:horas?total/horas:0};
 }
};
