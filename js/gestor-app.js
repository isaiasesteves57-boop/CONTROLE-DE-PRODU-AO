const { useState, useEffect, useRef, useMemo } = React;
  function excluirEstrategiaSelecionada(nome){
    if(!nome) return;
    if(!confirm("Excluir esta estratégia da lista?")) return;
    setEstrategias(prev=>prev.filter(e=>e.nome!==nome));
  }

const D5 = 7, SAQ = 0.3, ENT = 4;
const DM7 = {0:"DOM",1:"SEG",2:"TER",3:"QUA",4:"QUI",5:"SEX",6:"SAB"};
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const TIERS_PADRAO = [
  { dias:30, taxa:0.06, label:"Mês 1" },
  { dias:30, taxa:0.05, label:"Mês 2" },
  { dias:30, taxa:0.04, label:"Mês 3" },
];

function tierDia(diaGlobal, tiers) {
  tiers = tiers || TIERS_PADRAO;
  let a=0;
  for(const t of tiers) { if(diaGlobal<a+t.dias) return t; a+=t.dias; }
  return tiers[tiers.length-1];
}

function tierInfo(diaGlobal, tiers) {
  tiers = tiers || TIERS_PADRAO;
  let a=0;
  for(let i=0;i<tiers.length;i++) {
    const t=tiers[i];
    if(diaGlobal<a+t.dias) return {tier:t, index:i, start:a, diaNoTier:diaGlobal-a};
    a+=t.dias;
  }
  const last=tiers.length-1, ini=a-tiers[last].dias;
  return {tier:tiers[last], index:last, start:ini, diaNoTier:diaGlobal-ini};
}

function fmt(n) {
  if(n==null||isNaN(n)) return "—";
  const a=Math.abs(n), s=a.toFixed(2).replace(".",",").replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1.");
  return (n<0?"−R$ ":"R$ ")+s;
}

function resultadoCSV(op) { return (op.status==="aberta"||op.resultado==null) ? "Aberta" : String(op.resultado).replace(".",","); }

function fd(d) { if(!d) return "—"; return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; }
function pISO(s) { if(!s) return new Date(); const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function tISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function normalizarDataJogo(valor,fallback){
  const fb=fallback||tISO(new Date()); const v=String(valor||"").trim().toLowerCase();
  if(!v||v==="n/d"||v==="nd") return fb;
  if(v==="hoje") return tISO(new Date());
  if(v==="amanha"||v==="amanhã"){const d=new Date();d.setDate(d.getDate()+1);return tISO(d);}
  let m=v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=v.match(/^(\d{1,2})[\/. -](\d{1,2})(?:[\/. -](\d{2,4}))?$/);
  if(m){const ano=m[3]?(m[3].length===2?2000+Number(m[3]):Number(m[3])):Number(fb.slice(0,4));return `${ano}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;}
  return fb;
}
function kw(w,d) { return `${w}-${d}`; }

// Mantém o histórico de "Possíveis Entradas" enxuto: a tela principal só mostra o dia
// atual (filtro por data), mas guardamos um histórico interno de alguns dias para
// eventual análise futura, sem deixar o armazenamento crescer para sempre.
function limparPossiveisEntradasAntigas(lista) {
  if(!Array.isArray(lista)) return [];
  const limite=new Date(); limite.setDate(limite.getDate()-30);
  const chaveLimite=tISO(limite);
  return lista.filter(e=>e && e.data && e.data>=chaveLimite);
}

function normBusca(s) {
  return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}


// Banco local para as imagens originais. Os dados estruturados dos jogos ficam no
// estado sincronizado do app; a mídia pesada fica no IndexedDB para não estourar
// o documento do Firestore nem travar a sincronização PC/celular.
const JOGOS_MEDIA_DB = "gestor-banca-media-v1";
const JOGOS_MEDIA_STORE = "imagensJogos";
function abrirBancoMidiaJogos() {
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)) { reject(new Error("IndexedDB indisponível")); return; }
    const req=indexedDB.open(JOGOS_MEDIA_DB,1);
    req.onupgradeneeded=()=>{ const dbi=req.result; if(!dbi.objectStoreNames.contains(JOGOS_MEDIA_STORE)) dbi.createObjectStore(JOGOS_MEDIA_STORE,{keyPath:"id"}); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error("Falha no IndexedDB"));
  });
}
async function salvarImagemJogoLocal(id,file) {
  const dbi=await abrirBancoMidiaJogos();
  return new Promise((resolve,reject)=>{ const tx=dbi.transaction(JOGOS_MEDIA_STORE,"readwrite"); tx.objectStore(JOGOS_MEDIA_STORE).put({id,blob:file,nome:file.name,tipo:file.type,criadoEm:Date.now()}); tx.oncomplete=()=>{dbi.close();resolve(true);}; tx.onerror=()=>{dbi.close();reject(tx.error);}; });
}
async function lerImagemJogoLocal(id) {
  if(!id) return null;
  try { const dbi=await abrirBancoMidiaJogos(); return await new Promise((resolve)=>{ const tx=dbi.transaction(JOGOS_MEDIA_STORE,"readonly"); const req=tx.objectStore(JOGOS_MEDIA_STORE).get(id); req.onsuccess=()=>{const v=req.result||null;dbi.close();resolve(v);}; req.onerror=()=>{dbi.close();resolve(null);}; }); } catch(e) { return null; }
}
function pctJogo(v) {
  if(v===null||v===undefined||v===""||String(v).toUpperCase()==="N/D") return "N/D";
  const m=String(v).match(/\d{1,3}/); if(!m) return "N/D";
  const n=Math.max(0,Math.min(100,Number(m[0]))); return isNaN(n)?"N/D":n;
}

function parseRadarOportunidadeOCR(text,dataISO,imagem) {
  const original=String(text||'').replace(/\r/g,'\n');
  const linhas=original.split(/\n+/).map(x=>x.replace(/[|]/g,'I').replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!linhas.length) return [];

  // O card do Radar normalmente quebra o confronto em duas linhas:
  // "SHANGHAI SHENHUA X" / "TAMPINES ROVERS".
  // Também aceita "TIME A X TIME B" na mesma linha.
  let idxCab=-1, mandante='', visitante='';
  for(let i=0;i<linhas.length;i++) {
    const l=linhas[i];
    let m=l.match(/^(.+?)\s+(?:x|×|vs\.?|versus)\s+(.+?)$/i);
    if(m && !/radar de oportunidade|m[eé]todo|entrada|hor[aá]rio/i.test(l)) {
      idxCab=i; mandante=m[1].trim(); visitante=m[2].trim(); break;
    }
    // Caso o OCR coloque o X no fim da primeira linha.
    m=l.match(/^(.+?)\s+[x×]$/i);
    if(m && i+1<linhas.length) {
      const prox=linhas[i+1];
      if(prox && !/^(m[eé]todo|entrada|hor[aá]rio|aguardando|pendente|back|lay|over|under|[-—–]+|\d{1,2}[:.]\d{2})$/i.test(prox) && !/^\d/.test(prox)) {
        idxCab=i; mandante=m[1].trim(); visitante=prox.trim(); break;
      }
    }
  }
  if(idxCab<0) {
    // Última tentativa: encontra a palavra X isolada entre nomes.
    for(let i=0;i<linhas.length-1;i++) {
      if(/^x$/i.test(linhas[i])) {
        const a=linhas[i-1]||'', b=linhas[i+1]||'';
        if(a.length>=2 && b.length>=2 && !/^(m[eé]todo|entrada|hor[aá]rio)$/i.test(a+b)) {
          idxCab=i; mandante=a; visitante=b; break;
        }
      }
    }
  }
  if(idxCab<0 || mandante.length<2 || visitante.length<2) return [];

  const limparNome=v=>String(v||'').replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').replace(/[^A-Za-zÀ-ÿ0-9)]+$/,'').replace(/\s+/g,' ').trim();
  mandante=limparNome(mandante); visitante=limparNome(visitante);
  if(mandante.length<2 || visitante.length<2) return [];

  const horarioIdx=linhas.findIndex((l,i)=>i>idxCab && /^(hor[aá]rio|hora)$/i.test(l));
  let horario='N/D';
  if(horarioIdx>=0) {
    const hm=(linhas.slice(horarioIdx+1,horarioIdx+5).join(' ').match(/\b([01]?\d|2[0-3])[:.]\d{2}\b/)||[])[0];
    if(hm) horario=hm.replace('.',':');
  } else {
    const hm=(linhas.slice(idxCab+1,idxCab+12).join(' ').match(/\b([01]?\d|2[0-3])[:.]\d{2}\b/)||[])[0];
    if(hm) horario=hm.replace('.',':');
  }

  // A leitura do Tesseract pode devolver "ENTRADA: TIME", "ENTRADA TIME"
  // ou "ENTRADA" em uma linha e a seleção na linha seguinte. Aceita os três.
  let entrada='N/D';
  let entradaIdx=-1;
  for(let i=idxCab+1;i<linhas.length;i++) {
    if(/\bentrada\b/i.test(linhas[i])) { entradaIdx=i; break; }
  }
  if(entradaIdx>=0) {
    const mesmaLinha=linhas[entradaIdx].replace(/^.*?\bentrada\b\s*[:：\-–—]?\s*/i,'').trim();
    if(mesmaLinha && !/^(hor[aá]rio|m[eé]todo|aguardando|pendente|n\/?d)$/i.test(mesmaLinha)) {
      entrada=mesmaLinha;
    } else {
      const achado=linhas.slice(entradaIdx+1,entradaIdx+7).find(l=>l &&
        !/^(hor[aá]rio|m[eé]todo|aguardando|pendente|entrada|radar de oportunidade)$/i.test(l) &&
        !/^\d{1,2}[:.]\d{2}$/.test(l) && !/^[—–\-]+$/.test(l) &&
        !/^[-—–]+$/.test(l));
      if(achado) entrada=achado.replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();
    }
  }

  const id='jg_'+Date.now().toString(36)+'_radar_'+Math.random().toString(36).slice(2,7);
  return [{
    id, data:dataISO||tISO(new Date()), horario, mandante, visitante,
    favorito:'N/D', over25:'N/D', under25:'N/D', btts:'N/D', golHT:'N/D', favoritoHT:'N/D', primeiroGolFavorito:'N/D',
    entradaSugerida:entrada, confianca:'N/D', nota:null, classificacoes:[], estatisticas:[], metodos:[], timesMetodo:{},
    analiseInicial:original, atualizacoes:[], leituraFinal:null,
    observacoes:'Leitura automática do card RADAR DE OPORTUNIDADE. O método não foi informado no card.',
    cuidado:false, status:'PENDENTE', statusLeitura:'REVISAR',
    errosLeitura:['Confira os nomes dos times e selecione o método antes de salvar.'],
    lembreteAtivo:false, lembreteMin:30, imagemId:imagem?.id||null, imagemNome:imagem?.nome||'N/D',
    criadoEm:Date.now(), atualizadoEm:Date.now(), origem:'OCR_RADAR'
  }];
}

function parseAnaliseJogosOCR(text,dataISO,imagem) {
  const original=String(text||'').replace(/\r/g,'\n');
  const linhas=original.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const jogos=[];

  // Novo modo LISTA: lê várias partidas da mesma imagem.
  // Formato esperado:
  // Time A x Time B - 09:00 (60/40)
  // Lay ao Time B
  const blocos=[]; let atual=null;
  for(const linha of linhas){
    const cab=linha.match(/^(.+?)\s+x\s+(.+?)\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s*\((\d{1,3})\s*\/\s*(\d{1,3})\)/i);
    if(cab){
      if(atual) blocos.push(atual);
      atual={cab,linhas:[]};
    } else if(atual){
      atual.linhas.push(linha);
    }
  }
  if(atual) blocos.push(atual);

  if(blocos.length){
    blocos.forEach((b,z)=>{
      const cab=b.cab;
      const entrada=b.linhas.find(l=>/^(lay|back|over|under|gol|apost)/i.test(l)) || 'N/D';
      const id='jg_'+Date.now().toString(36)+'_'+z+'_'+Math.random().toString(36).slice(2,7);
      jogos.push({
        id,
        data:dataISO||tISO(new Date()),
        horario:cab[3].replace('.',':'),
        mandante:cab[1].trim(),
        visitante:cab[2].trim(),
        favorito:'N/D',
        over25:'N/D',
        under25:'N/D',
        btts:'N/D',
        golHT:'N/D',
        favoritoHT:'N/D',
        primeiroGolFavorito:'N/D',
        entradaSugerida:entrada,
        confianca:'N/D',
        placarLeitura:`${cab[4]}/${cab[5]}`,
        status:'PENDENTE',
        lembreteAtivo:false,
        lembreteMin:30,
        imagemId:imagem?.id||null,
        imagemNome:imagem?.nome||'N/D',
        criadoEm:Date.now(),
        atualizadoEm:Date.now(),
        origem:'OCR_LISTA'
      });
    });
    return jogos;
  }

  // Mantém compatibilidade com o leitor antigo de análises.
  const preparado=original.replace(/\b([0-2]?\d[:.]\d{2})\b/g,'\n$1\n');
  const ls=preparado.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const inicios=[];
  ls.forEach((l,i)=>{if(/^([01]?\d|2[0-3])[:.]\d{2}$/.test(l))inicios.push(i);});
  for(let z=0;z<inicios.length;z++){
    const seg=ls.slice(inicios[z],z+1<inicios.length?inicios[z+1]:ls.length);
    const junto=seg.join(' ');
    const confronto=seg.find((l,i)=>i>0&&/\s(?:x|×|vs\.?)\s/i.test(l))||'';
    if(!confronto) continue;
    const partes=confronto.split(/\s+(?:x|×|vs\.?)\s+/i);
    jogos.push({
      id:'jg_'+Date.now().toString(36)+'_'+z,
      data:dataISO||tISO(new Date()),
      horario:seg[0].replace('.',':'),
      mandante:partes[0]?.trim()||'N/D',
      visitante:partes[1]?.trim()||'N/D',
      favorito:'N/D',over25:'N/D',under25:'N/D',btts:'N/D',golHT:'N/D',favoritoHT:'N/D',primeiroGolFavorito:'N/D',
      entradaSugerida:'N/D',confianca:'N/D',status:'PENDENTE',lembreteAtivo:false,lembreteMin:30,
      imagemId:imagem?.id||null,imagemNome:imagem?.nome||'N/D',criadoEm:Date.now(),atualizadoEm:Date.now(),origem:'OCR'
    });
  }
  return jogos;
}

// ===== DICAS DE HOJE: importação textual e classificação conservadora =====
const METODOS_DICAS = [
  {id:"back_favorito",ico:"🟢",nome:"BACK FAVORITO",sub:"Favorito com sinal explícito de marcar primeiro / assumir vantagem"},
  {id:"under_gols",ico:"🛡️",nome:"UNDER GOLS",sub:"Leituras explicitamente classificadas para poucos gols"},
  {id:"favorito_nao_goleia",ico:"🚫",nome:"FAVORITO NÃO GOLEIA",sub:"Favorito presente, mas texto aponta jogo equilibrado/truncado ou sem goleada"},
  {id:"over_btts",ico:"🔥",nome:"OVER GOLS / AMBAS MARCAM",sub:"Sinais ofensivos explicitamente citados no texto"},
  {id:"gol_ht",ico:"⏱️",nome:"GOL NO 1º TEMPO",sub:"Over 0,5 HT / pelo menos um gol antes do intervalo"},
  {id:"lay_zebra",ico:"🦓",nome:"LAY ZEBRA",sub:"Lay ao time indicado na seção Zebra"},
  {id:"lay_time",ico:"🎯",nome:"LAY AO TIME",sub:"Lay direcionado ao time indicado na estratégia"},
  {id:"lay_goleada",ico:"🛑",nome:"LAY GOLEADA",sub:"Lay contra uma possível goleada do favorito"},
  {id:"lay_0x1",ico:"🎯",nome:"LAY 0X1",sub:"Lay ao placar 0x1"},
  {id:"lay_1x0",ico:"🎯",nome:"LAY 1X0",sub:"Lay ao placar 1x0"},
];

function metodoDicaInfo(id) { return METODOS_DICAS.find(m=>m.id===id)||{id,ico:"🎯",nome:id||"Método"}; }
function limparTextoAnalise(s) {
  return String(s||"")
    .replace(/\r/g,"\n").replace(/\uFFFD/g,"").replace(/[\u200B-\u200D\uFEFF]/g,"")
    .replace(/\u00A0/g," ")
    .replace(/\*\*/g,"")
    .split("\n")
    .map(l=>l.replace(/\s+/g," ").trim())
    .filter(l=>l && !/^Mutating\s*\+\s*\d+$/i.test(l) && !/^Mutating\s*$/i.test(l))
    .join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
function limparLinhaCabecalhoJogo(linha) {
  return String(linha||"")
    .replace(/^\s*(?:#{1,6}\s*)?/ ,"")
    .replace(/^\s*\d+\s*[.)-]\s*/,"")
    .replace(/^\s*(?:[01]?\d|2[0-3])[:.]\d{2}\s*(?:[—–|\-]\s*)?/ ,"")
    .replace(/[\*_`]/g,"").trim();
}
function pareceFonteSolta(linha) {
  const l=String(linha||"").trim();
  if(!l) return false;
  if(/^https?:\/\//i.test(l) || /^(?:www\.)?[\w.-]+\.(?:com|net|org|io|br)(?:\s*\+\s*\d+)?$/i.test(l)) return true;
  if(/^(?:Sports Mole|Forebet|Ratingbet(?:\.com)?|Sofascore|Flashscore|FootyStats)(?:\s*\+\s*\d+)?$/i.test(l)) return true;
  return false;
}

// Reconhece tanto o formato com quebras de linha quanto a lista compactada
// copiada de WhatsApp/Telegram, onde vários jogos chegam todos na mesma linha.
function expandirListaCompactaAnalise(texto) {
  let x=limparTextoAnalise(texto)
    .replace(/\s*\bZEBRA\s*\(\s*FORA\s*\)\s*/ig,"\n@@SEC_ZEBRA_FORA@@\n")
    .replace(/\s*\bZEBRA\s*\(\s*CASA\s*\)\s*/ig,"\n@@SEC_ZEBRA_CASA@@\n")
    .replace(/\s*\bZEBRA\s+COM\s+ODD\s+6\s*A\s*12\s*\([^)]*\)\s*/ig,"\n@@SEC_ZEBRA_ODD@@\n")
    .replace(/\s*\bSUGEST(?:ÃO|AO)\s+DE\s+APOSTA\s+BACK\s*-\s*ACADEMIA\s+DAS\s+APOSTAS\s*/ig,"\n@@SEC_BACK@@\n");

  // Insere uma quebra após recomendações somente quando o texto original já
  // oferece uma separação clara. Para listas compactas, a separação é feita
  // pelo parser abaixo usando os horários como âncoras.
  x=x.replace(/\s+(?=(?:Lay|Back)\s+ao\b)/ig,"\n");
  return x.replace(/\n{3,}/g,"\n\n").trim();
}

function detectarCabecalhoJogoTexto(linha) {
  const l=limparLinhaCabecalhoJogo(linha);
  // Formato completo: Time A x Time B - 07:00 (100/0) Lay ao Time B
  let m=l.match(/^([^:;|]{2,55}?)\s+(?:x|×|vs\.?|versus)\s+([^:;|—–-]{2,55}?)\s*(?:[-–—|]\s*)(\d{1,2}[:.]\d{2})(?:\s*\(\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\))?\s*(.*)$/i);
  if(m) {
    return {mandante:m[1].trim(),visitante:m[2].trim(),horario:m[3].replace(".",":"),pctCasa:m[4]||"",pctFora:m[5]||"",recomendacao:(m[6]||"").trim(),analiseInline:"",invalido:/\s+(?:x|×|vs\.?|versus)\s+/i.test(m[2])};
  }
  // Formato já separado: Time A x Time B — recomendação
  m=l.match(/^([^:;|]{2,55}?)\s+(?:x|×|vs\.?|versus)\s+([^:;|—–]{2,55}?)\s+(?:—|–|-|\|)\s+(.+)$/i);
  if(m) return {mandante:m[1].trim(),visitante:m[2].trim(),horario:"N/D",pctCasa:"",pctFora:"",recomendacao:m[3].trim(),analiseInline:"",invalido:/\s+(?:x|×|vs\.?|versus)\s+/i.test(m[2])};
  m=l.match(/^([^:;|]{2,55}?)\s+(?:x|×|vs\.?|versus)\s+([^:;|]{2,55})\s*:\s*(.+)$/i);
  if(m) return {mandante:m[1].trim(),visitante:m[2].trim(),horario:"N/D",pctCasa:"",pctFora:"",recomendacao:"",analiseInline:m[3].trim(),invalido:/\s+(?:x|×|vs\.?|versus)\s+/i.test(m[2])};
  m=l.match(/^([^:;|]{2,55}?)\s+(?:x|×|vs\.?|versus)\s+([^:;|]{2,55})$/i);
  if(!m) return null;
  return {mandante:m[1].trim(),visitante:m[2].trim(),horario:"N/D",pctCasa:"",pctFora:"",recomendacao:"",analiseInline:"",invalido:/\s+(?:x|×|vs\.?|versus)\s+/i.test(m[2])};
}
function blocosJogosDoTexto(texto) {
  // O leitor aceita texto colado com ou sem quebras de linha. Para o formato
  // de listas do usuário, os horários são as âncoras confiáveis e as seções
  // são removidas antes de localizar os confrontos.
  const bruto=limparTextoAnalise(texto)
    .replace(/ZEBRA\s*\(\s*FORA\s*\)\s*/ig,"\n@@ZFORA@@\n")
    .replace(/ZEBRA\s*\(\s*CASA\s*\)\s*/ig,"\n@@ZCASA@@\n")
    .replace(/ZEBRA\s+COM\s+ODD\s+6\s*A\s*12\s*\([^)]*\)\s*/ig,"\n@@ZODD@@\n")
    .replace(/SUGEST(?:ÃO|AO)\s+DE\s+APOSTA\s+BACK\s*-\s*ACADEMIA\s+DAS\s+APOSTAS\s*/ig,"\n@@BACK@@\n");
  const anchor=/\s*-\s*(\d{1,2}\s*[:.]\s*\d{2})(?:\s*\(\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\))?/ig;
  const am=[]; let m;
  while((m=anchor.exec(bruto))!==null) am.push({i:m.index,fim:anchor.lastIndex,hora:m[1].replace(/\s+/g,""),pc:m[2]||"",pf:m[3]||""});
  if(!am.length) return [];

  const out=[]; let secao=""; let anterior=null;
  for(let i=0;i<am.length;i++){
    let antes=bruto.slice(i===0?0:am[i-1].fim,am[i].i);
    const secs=Array.from(antes.matchAll(/@@(ZFORA|ZCASA|ZODD|BACK)@@/g));
    if(secs.length) secao=secs[secs.length-1][1];
    antes=antes.replace(/@@(?:ZFORA|ZCASA|ZODD|BACK)@@/g,"");
    if(i===0) antes=antes.replace(/^\s*(?:SABADOU!|MELHORES JOGOS[^\n]*|DIA\s+\d{1,2}\/\d{1,2}\/\d{2,4})/i,"");
    if(anterior?.alvo){
      const esc=anterior.alvo.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      antes=antes.replace(new RegExp("(?:Lay|Back)\\s+ao\\s*"+esc,"i"),"");
    }
    // O restante do trecho contém o próximo confronto. Pegamos o último "x"
    // antes do horário atual para tolerar o texto "Lay ao TIME" colado.
    const confrontos=Array.from(antes.matchAll(/([^\n@]{2,70}?)\s+(?:x|×|vs\.?|versus)\s+([^\n@]{2,70})\s*$/ig));
    let cm=confrontos[confrontos.length-1];
    if(!cm){
      // Fallback para uma linha já separada.
      cm=antes.match(/([^:;|]{2,70}?)\s+(?:x|×|vs\.?|versus)\s+([^:;|]{2,70})\s*$/i);
    }
    if(!cm) continue;
    const linhaBase=`${cm[1].trim()} x ${cm[2].trim()} - ${am[i].hora}${am[i].pc!==""?` (${am[i].pc}/${am[i].pf})`:""}`;
    let depois=bruto.slice(am[i].fim,i+1<am.length?am[i+1].i:bruto.length).replace(/\s+/g," ").trim();
    let rec="";
    const alvoEsc1=cm[1].trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), alvoEsc2=cm[2].trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const recAlvo=depois.match(new RegExp("((?:Lay|Back)\\s+ao\\s*(?:"+alvoEsc1+"|"+alvoEsc2+")(?:\\s*-\\s*ODD\\s*[0-9]+[,.][0-9]+)?)","i"));
    if(recAlvo) rec=recAlvo[1].trim();
    else { const gen=depois.match(/((?:Lay|Back)\s+ao\s+[^@]+?)(?=@@|$)/i); if(gen) rec=gen[1].trim(); }
    const linha=rec?`${linhaBase} ${rec}`:linhaBase;
    const cab=detectarCabecalhoJogoTexto(linha); if(!cab) continue;
    out.push({cab:{...cab,secao},linhas:[linha],cuidado:secao==="ZODD",texto:linha});
    anterior={alvo:rec.replace(/^(?:Lay|Back)\s+ao\s+/i,"").replace(/\s*-\s*ODD.*$/i,"").trim()};
  }
  return out;
}

function pctPertoDeTermo(texto,termos) {
  const linhas=String(texto||"").split("\n");
  let melhor=null;
  for(const linha of linhas) {
    const n=normBusca(linha);
    const percentuais=Array.from(linha.matchAll(/(\d{1,3}(?:[,.]\d+)?)\s*%/g));
    if(!percentuais.length) continue;
    for(const termo of (termos||[])) {
      const nt=normBusca(termo); if(!nt) continue;
      let pos=n.indexOf(nt);
      while(pos>=0) {
        for(const pm of percentuais) {
          const ppos=pm.index||0, pend=ppos+pm[0].length;
          const dist=ppos>pos ? ppos-(pos+nt.length) : pos-pend;
          // Se existe outro rótulo de mercado entre o termo e a porcentagem,
          // essa porcentagem provavelmente pertence ao outro mercado.
          const a=Math.min(pend,pos+nt.length), b=Math.max(ppos,pos);
          const entre=n.slice(a,b);
          const cruzaOutroMercado=/(?:o\s*2[,.]5|over\s*2[,.]5|u\s*2[,.]5|under\s*2[,.]5|btts|ambas marcam|gol no ht|gol no primeiro tempo|marcar primeiro|marcando primeiro|vencendo ht|vencendo o primeiro tempo)/.test(entre);
          const penalidade=(dist<0?0:dist)+(cruzaOutroMercado?500:0);
          if(!melhor || penalidade<melhor.dist) {
            const v=Number(pm[1].replace(",","."));
            if(!isNaN(v)) melhor={dist:penalidade,v:Math.max(0,Math.min(100,v))};
          }
        }
        pos=n.indexOf(nt,pos+nt.length);
      }
    }
  }
  return melhor?melhor.v:"N/D";
}
function pctModeloEspecificoFavHT(texto) {
  const raw=String(texto||"");
  const linhas=raw.split("\n");
  for(const linha of linhas) {
    const n=normBusca(linha);
    if(!/(modelo especifico|modelo do confronto|chance atual|modelo atual)/.test(n)) continue;
    const ms=Array.from(linha.matchAll(/(\d{1,3}(?:[,.]\d+)?)\s*%/g));
    for(let i=ms.length-1;i>=0;i--) {
      const trecho=n.slice(Math.max(0,(ms[i].index||0)-35),Math.min(n.length,(ms[i].index||0)+ms[i][0].length+80));
      if(/vencendo (?:o )?(?:primeiro tempo|ht)|vencer (?:o )?(?:primeiro tempo|ht)|vitoria no (?:primeiro tempo|ht)/.test(trecho)) {
        const v=Number(ms[i][1].replace(",",".")); if(!isNaN(v)) return Math.max(0,Math.min(100,v));
      }
    }
  }
  return "N/D";
}
function timeLigadoAMarcarPrimeiro(texto,times) {
  const n=normBusca(texto);
  for(const time of (times||[])) {
    const t=normBusca(time); if(!t||t==="n/d") continue;
    let pos=n.indexOf(t);
    while(pos>=0) {
      const ini=Math.max(0,pos-35), trecho=n.slice(ini,Math.min(n.length,pos+t.length+120));
      if(/marcar primeiro|marca primeiro|marcando primeiro|primeiro gol|1o gol|1 gol/.test(trecho)) return time;
      pos=n.indexOf(t,pos+t.length);
    }
  }
  return "";
}
function classificarMetodosDoTexto(texto,mandante,visitante,favorito,recomendacao="") {
  const n=normBusca(texto), r=normBusca(recomendacao||"");
  // Quando existe título/recomendação explícita, ele é a fonte principal da classificação.
  // Isso evita transformar uma comparação narrativa ("mais Under do que Over") em uma dica de Over.
  const alvo=r || (n.length<=220?n:"");
  const metodos=[];
  if(/back favorito|marcar primeiro|marca primeiro|marcando primeiro|primeiro gol|1o gol/.test(alvo) || (/^back\b/.test(alvo) && !/over|under|btts|ambas marcam|gol no|placar|zebra|varios resultados/.test(alvo))) metodos.push("back_favorito");
  if(/\bunder\b|poucos gols|baixa expectativa de gols/.test(alvo)) metodos.push("under_gols");
  if(/ambas marcam|\bbtts\b|\bover\s*(?:1[,.]5|2[,.]5|3[,.]5|gols|ft)\b|tendencia ofensiva/.test(alvo)) metodos.push("over_btts");
  if(/gol no (1º|1o|1|primeiro) tempo|gol no ht|gol ht|over 0[,.]5 ht|pelo menos um gol no (1º|1o|1|primeiro) tempo|pelo menos um gol no ht/.test(alvo)) metodos.push("gol_ht");
  // Esta estratégia ainda não tem regra estatística rígida; só entra por linguagem explícita no texto.
  if((favorito && favorito!=="N/D" || /\bfavorito\b/.test(n)) && /favorito nao goleia|nao goleia|sem goleada|baixa expectativa de (uma )?goleada|jogo (mais )?equilibrado|jogo truncado|cenario (mais )?equilibrado|cenario truncado/.test(n)) metodos.push("favorito_nao_goleia");
  // Sem recomendação no cabeçalho, só aceite métodos quando houver indicação operacional explícita.
  if(!r && !metodos.length) {
    const trechos=n.split(/[.!?\n]+/).filter(x=>/eu prefiro|prefiro|eu gosto|gosto mais|entrada|mercado que|selecionaria|estudaria primeiro/.test(x));
    for(const t of trechos) {
      if(/marcar primeiro|marca primeiro|primeiro gol/.test(t)) metodos.push("back_favorito");
      if(/\bunder\b|poucos gols/.test(t)) metodos.push("under_gols");
      if(/ambas marcam|\bbtts\b|\bover\s*(?:1[,.]5|2[,.]5|3[,.]5|gols|ft)\b/.test(t)) metodos.push("over_btts");
      if(/gol no (?:1o|1|primeiro) tempo|gol no ht|gol ht|over 0[,.]5 ht/.test(t)) metodos.push("gol_ht");
    }
  }
  return Array.from(new Set(metodos));
}
function metodoDaClassificacaoContexto(contexto) {
  const n=normBusca(contexto||"");
  if(/under/.test(n)) return "under_gols";
  if(/gol ht|gol no ht|gol no primeiro tempo|over 0[,.]5 ht/.test(n)) return "gol_ht";
  if(/marcar primeiro|primeiro gol/.test(n)) return "back_favorito";
  if(/btts|ambas marcam|over/.test(n)) return "over_btts";
  if(/nao goleia|sem goleada/.test(n)) return "favorito_nao_goleia";
  return "";
}
function notasPorMetodoDoTexto(classificacoes,metodos) {
  const out={};
  for(const c of (classificacoes||[])) {
    const m=metodoDaClassificacaoContexto(c.contexto);
    if(m && !isNaN(Number(c.nota))) out[m]=Math.max(Number(out[m])||0,Number(c.nota));
  }
  // Nota sem contexto é uma nota geral da recomendação; aplica-se aos métodos explicitamente recomendados.
  const gerais=(classificacoes||[]).filter(c=>!String(c.contexto||"").trim()).map(c=>Number(c.nota)).filter(n=>!isNaN(n));
  if(gerais.length) {
    const g=Math.max(...gerais);
    for(const m of (metodos||[])) if(out[m]==null) out[m]=g;
  }
  return out;
}
function validarPartidaTexto(j,bloco) {
  const erros=[];
  const a=(j.mandante||"").trim(), b=(j.visitante||"").trim();
  if(!a||!b||a==="N/D"||b==="N/D") erros.push("Não foi possível identificar exatamente os dois times.");
  if(a && b && normBusca(a)===normBusca(b)) erros.push("Os dois times não podem ser iguais.");
  if(bloco?.cab?.invalido || /\s+(?:x|×|vs\.?|versus)\s+/i.test(b)) erros.push("Foram detectadas mais de duas equipes no confronto.");
  const favs=String(bloco?.texto||"").match(/Favorito\s*:/gi)||[];
  if(favs.length>1) erros.push("Há mais de um campo Favorito no mesmo jogo.");
  if(j.favorito && j.favorito!=="N/D" && ![a,b].some(t=>normBusca(t)===normBusca(j.favorito))) erros.push("O favorito informado não corresponde a uma das duas equipes.");
  const horas=Array.from(new Set((String(bloco?.texto||"").match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)||[])));
  if(horas.length>1) erros.push("Há mais de um horário diferente no mesmo bloco.");
  if(bloco?.cuidado || bloco?.cab?.cuidado) erros.push("Este confronto está na seção de cuidado/observação; confirme manualmente antes de tratá-lo como oportunidade.");
  if(!Array.isArray(j.metodos)||!j.metodos.length) erros.push("Nenhum dos métodos atuais foi identificado com segurança.");
  return erros;
}
function parseAnaliseTexto(texto,dataISO) {
  const blocos=blocosJogosDoTexto(texto), jogos=[];
  for(let i=0;i<blocos.length;i++) {
    const b=blocos[i], cab=b.cab, raw=b.texto;
    const horarios=Array.from(new Set(raw.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)||[]));
    const favoritoMatches=Array.from(raw.matchAll(/Favorito\s*:\s*([^\n.;]+)/gi));
    const favorito=favoritoMatches.length?String(favoritoMatches[0][1]||"").trim():"N/D";
    const lay=raw.match(/Lay\s+ao\s+(.+?)(?=\s+(?:Back|Lay)\s+ao\b|$)/i);
    const back=raw.match(/Back\s+ao\s+(.+?)(?=\s+(?:Back|Lay)\s+ao\b|$)/i);
    const recLinha=raw.match(/Entrada\s+sugerida\s*:\s*([^\n]+)/i);
    let recomendacao=(cab.recomendacao||recLinha?.[1]||"").trim();
    if(!recomendacao && lay) recomendacao=`Lay ao ${lay[1].trim()}`;
    if(!recomendacao && back) recomendacao=`Back ao ${back[1].trim()}`;
    if(!recomendacao) recomendacao="N/D";

    // A porcentagem do cabeçalho é explicitamente Casa/Fora. Quando existe no
    // texto compacto, ela alimenta a leitura de 1º gol sem inventar outros mercados.
    const pctCabCasa=cab.pctCasa!==""?Number(cab.pctCasa):null, pctCabFora=cab.pctFora!==""?Number(cab.pctFora):null;
    const alvoLay=lay?.[1]?.trim()||"";
    const alvoBack=(back?.[1]?.trim()||"").replace(/\s*-\s*ODD\s*[0-9]+[,.][0-9]+.*$/i,"").trim();
    const alvoOperacional=alvoLay||alvoBack;
    const alvoCasa=alvoOperacional && normBusca(alvoOperacional).includes(normBusca(cab.mandante));
    const alvoFora=alvoOperacional && normBusca(alvoOperacional).includes(normBusca(cab.visitante));

    const notas=Array.from(raw.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*\/\s*10\b/gi)).map(m=>Number(m[1].replace(",","."))).filter(n=>!isNaN(n)&&n>=0&&n<=10);
    const classificacoes=Array.from(raw.matchAll(/(\d{1,2}(?:[,.]\d+)?)\s*\/\s*10(?:\s+para\s+([^.;\n]+))?/gi)).map(m=>({nota:Number(m[1].replace(",",".")),contexto:(m[2]||"").trim()}));
    const conf=raw.match(/Confian[cç]a\s*:\s*(Alta|M[eé]dia(?:\s*\/\s*Alta)?|Baixa)/i);
    const confianca=conf?(normBusca(conf[1]).startsWith("media")?"Média":normBusca(conf[1])==="alta"?"Alta":"Baixa"):"N/D";

    let metodos=classificarMetodosDoTexto(raw,cab.mandante,cab.visitante,favorito,recomendacao==="N/D"?"":recomendacao);
    const recN=normBusca(recomendacao), sec=String(cab.secao||"");
    if(/lay\s+ao\b/.test(recN)) {
      if(/0\s*x\s*1/.test(recN)) metodos.push("lay_0x1");
      else if(/1\s*x\s*0/.test(recN)) metodos.push("lay_1x0");
      else metodos.push("lay_zebra");
    }
    if(sec.startsWith("ZEBRA")) metodos.push("lay_zebra");
    if(sec==="BACK" || /^back\s+ao\b/.test(recN)) metodos.push("back_favorito");
    metodos=Array.from(new Set(metodos));

    const timePrimeiro=alvoOperacional || (metodos.includes("back_favorito")?timeLigadoAMarcarPrimeiro(recomendacao!="N/D"?recomendacao:raw,[cab.mandante,cab.visitante]):"");
    const favoritoDetectado=(favorito&&favorito!=="N/D")?favorito:(metodos.includes("back_favorito")?timePrimeiro:"N/D");
    const timesMetodo={};
    if(metodos.includes("back_favorito")) timesMetodo.back_favorito=timePrimeiro||favoritoDetectado;
    if(metodos.includes("lay_zebra")) timesMetodo.lay_zebra=alvoLay || (sec==="ZFORA"?cab.visitante:sec==="ZCASA"?cab.mandante:"");
    if(metodos.includes("lay_0x1")) timesMetodo.lay_0x1=alvoLay;
    if(metodos.includes("lay_1x0")) timesMetodo.lay_1x0=alvoLay;

    const estatisticas=raw.split("\n").filter(l=>/%/.test(l)).map(l=>l.trim());
    const favHtEspecifico=pctModeloEspecificoFavHT(raw);
    const j={
      id:"jg_txt_"+Date.now().toString(36)+"_"+i+"_"+Math.random().toString(36).slice(2,7),
      data:dataISO||tISO(new Date()),horario:cab.horario&&cab.horario!=="N/D"?cab.horario:(horarios[0]||"N/D"),
      mandante:cab.mandante||"N/D",visitante:cab.visitante||"N/D",favorito:favoritoDetectado||"N/D",
      over25:pctPertoDeTermo(raw,["over 2,5","over 2.5","o2,5","o2.5"]),
      under25:pctPertoDeTermo(raw,["under 2,5","under 2.5","u2,5","u2.5"]),
      btts:pctPertoDeTermo(raw,["btts","ambas marcam"]),
      golHT:pctPertoDeTermo(raw,["gol no 1º tempo","gol no 1o tempo","gol no primeiro tempo","gol no ht","gol ht","over 0,5 ht","over 0.5 ht","pelo menos um gol no ht"]),
      favoritoHT:favHtEspecifico!=="N/D"?favHtEspecifico:pctPertoDeTermo(raw,["vitoria no ht","vitória no ht","vitorias no ht","vitórias no ht","vencer ht","vencendo ht","vencendo o primeiro tempo","fav. ht","favorito ht"]),
      primeiroGolFavorito:pctCabCasa!=null&&pctCabFora!=null ? (alvoCasa?pctCabCasa:alvoFora?pctCabFora:Math.max(pctCabCasa,pctCabFora)) : pctPertoDeTermo(raw,["marcar primeiro","marca primeiro","marcando primeiro","primeiro gol","1º gol"]),
      percentualCasa:pctCabCasa!=null?pctCabCasa:"N/D",percentualFora:pctCabFora!=null?pctCabFora:"N/D",
      entradaSugerida:recomendacao,confianca,nota:notas.length?Math.max(...notas):null,classificacoes,notasMetodo:notasPorMetodoDoTexto(classificacoes,metodos),estatisticas,
      metodos,timesMetodo,analiseInicial:raw,atualizacoes:[],leituraFinal:null,
      observacoes:sec==="ZODD"?"Lista marcada no texto como ZEBRA com ODD 6 a 12 (não contabilizado).":b.cuidado?"Marcado no texto como jogo de cuidado/observação.":"",
      cuidado:!!b.cuidado,status:"PENDENTE",statusLeitura:"OK",lembreteAtivo:false,lembreteMin:30,imagemId:null,imagemNome:"N/D",criadoEm:Date.now(),atualizadoEm:Date.now(),origem:"TEXTO"
    };
    const erros=validarPartidaTexto(j,b); if(erros.length){j.statusLeitura="REVISAR";j.errosLeitura=erros;}
    jogos.push(j);
  }
  return {jogos,blocosDetectados:blocos.length};
}

function mesmaPartida(a,b) {
  if(!a||!b||a.data!==b.data) return false;
  const a1=normBusca(a.mandante), a2=normBusca(a.visitante), b1=normBusca(b.mandante), b2=normBusca(b.visitante);
  return !!a1&&!!a2&&((a1===b1&&a2===b2)||(a1===b2&&a2===b1));
}
function impactoAtualizacaoTexto(texto) {
  const n=normBusca(texto);
  if(/cancelou|cancelar|cancelada|cancelo|descartar a entrada|descarto a entrada/.test(n)) return "CANCELOU";
  if(/enfraqueceu|enfraquece|perde forca|piora|piorou|reduz a confianca/.test(n)) return "ENFRAQUECEU";
  if(/manteve|mantem|sem mudanca|sem alteracao|segue igual/.test(n)) return "MANTEVE";
  if(/reforcou|reforca|melhora|melhorou|fortalece|fortaleceu|confirma a tese|volta a ser/.test(n)) return "REFORÇOU";
  return "REVISAR";
}
function extrairLeituraFinalTexto(texto) {
  const raw=String(texto||"");
  const pegar=(res)=>{for(const re of res){const m=raw.match(re);if(m&&m[1])return m[1].trim().replace(/[.;,]+$/g,"");}return "N/D";};
  const entradaFinal=pegar([/ENTRADA\s+FINAL\s*:\s*([^\n]+)/i,/entrada\s+que\s+mais\s+gosto\s+(?:volta\s+a\s+ser|e|é|:)\s*([^\n,.]+(?:\s+[^\n,.]+){0,6})/i]);
  const segundaOpcao=pegar([/SEGUNDA\s+OP[CÇ][AÃ]O\s*:\s*([^\n]+)/i,/seguida\s+de\s+([^\n.]+)/i]);
  const evitar=pegar([/EVITAR\s*:\s*([^\n]+)/i,/evitar\s+([^\n.]+)/i]);
  const sinais=raw.split("\n").map(l=>l.trim()).filter(l=>/(?:→|->)\s*(?:Alta|M[eé]dia|Baixa|M[eé]dia\s*\/\s*Alta)/i.test(l));
  return {impacto:impactoAtualizacaoTexto(raw),entradaFinal,segundaOpcao,evitar,sinais};
}

// Normaliza o nome de uma estratégia para evitar duplicidade por maiúsculas/minúsculas,
// acentuação, espaçamento ou abreviação (ex: "back fav", "Back FV", "BACK FAVORITO" -> "BACK FAV").
// Passo 1: normalização básica (maiúsculo, sem acento, sem espaço duplicado).
function normEstrategiaBase(s) {
  return (s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // remove acentos
    .toUpperCase()
    .replace(/\s+/g," ")
    .trim();
}

// Passo 2: mapa de aliases — cada chave é o nome canônico (o que será salvo),
// e a lista são todas as variações que devem ser agrupadas nele.
// Edite/adicione entradas aqui para padronizar novas abreviações.
const ALIASES_ESTRATEGIA = {
  "BACK FAVORITO": ["BACK FAVORITO", "BACK FAV", "BACK FV", "BACK FAVORITOS", "BACK FAVS"],
  "BACK VARIOS RESULTADOS": ["BACK VARIOS RESULTADOS", "BACK VÁRIOS RESULTADOS"],
  "LAY 1X1": ["LAY 1X1", "LAY 1 X 1"],
  "LAY 0X1": ["LAY 0X1", "LAY 0 X 1"],
};

// Constrói o lookup reverso (variação normalizada -> nome canônico) uma única vez.
const _ALIAS_LOOKUP_ESTRATEGIA = (() => {
  const m = new Map();
  for(const canon in ALIASES_ESTRATEGIA) {
    const canonNorm = normEstrategiaBase(canon);
    m.set(canonNorm, canonNorm);
    for(const variante of ALIASES_ESTRATEGIA[canon]) {
      m.set(normEstrategiaBase(variante), canonNorm);
    }
  }
  return m;
})();

function normEstrategia(s) {
  const base = normEstrategiaBase(s);
  if(!base) return base;
  return _ALIAS_LOOKUP_ESTRATEGIA.get(base) || base;
}

function sugestoesLista(lista, termo, limite=8) {
  const q=normBusca(termo);
  const ativos=(lista||[]).filter(x=>x.ativa!==false);
  if(!q) return ativos.slice(0,limite);
  return ativos
    .filter(x=>normBusca(x.nome).includes(q))
    .sort((a,b)=>{
      const aa=normBusca(a.nome), bb=normBusca(b.nome);
      const ap=aa.startsWith(q)?0:1, bp=bb.startsWith(q)?0:1;
      return ap-bp || aa.localeCompare(bb);
    })
    .slice(0,limite);
}

function proxUtil(data, offset) {
  const d=new Date(data); let c=0;
  while(c<offset) { d.setDate(d.getDate()+1); c++; }
  return d;
}

function offsetHoje(inicio) {
  const h=new Date(); h.setHours(0,0,0,0);
  const i=new Date(inicio); i.setHours(0,0,0,0);
  if(h<i) return -1;
  let d=0; let c=new Date(i);
  while(c<h) { c.setDate(c.getDate()+1); d++; }
  return d;
}

// Converte uma data real (ex: data do evento de uma linha importada da
// planilha) na posição (offset de dias) dentro do ciclo, a partir da data de
// início — usado para saber em qual dia da Gestão essa operação deve entrar.
function offsetDeData(inicio, alvo) {
  const a=new Date(alvo); a.setHours(0,0,0,0);
  const i=new Date(inicio); i.setHours(0,0,0,0);
  if(a<i) return -1;
  let d=0; let c=new Date(i);
  while(c<a) { c.setDate(c.getDate()+1); d++; }
  return d;
}

function calc(cap, inicio, ent, suporMeta, cfg) {
  const d5 = cfg?.diasPorSemana ?? D5;
  const tiers = cfg?.tiers ?? TIERS_PADRAO;
  const saqPct = cfg?.saqPct ?? SAQ;
  // Intervalo independente da quantidade de dias exibidos por semana.
  // 0 = sem saques automáticos durante o ciclo.
  const saqueIntervalo = Number(cfg?.saqueIntervalo ?? d5);
  const totalDias = tiers.reduce((s,t)=>s+t.dias,0);
  const numSem = Math.ceil(totalDias / d5);
  const sem=[];
  let atu=cap, atuMeta=cap, off=0;
  let saldoReferenciaSaque=cap;
  let tierIdxAtual=-1, bancaIniTier=cap, sacadoAcumTier=0, taxaAjustadaAtual=tiers[0].taxa;
  const hojeOff = offsetHoje(inicio);

  for(let w=0; w<numSem; w++) {
    const tSemana=tierDia(w*d5, tiers);
    const semanaInicial=atu;
    let v=atu, vMeta=atuMeta;
    let saqueSemana=0;
    const dias=[];

    for(let d=0; d<d5 && off<totalDias; d++) {
      const date=proxUtil(inicio, off);
      const info=tierInfo(off, tiers);
      const t=info.tier;
      if(info.index!==tierIdxAtual) {
        tierIdxAtual=info.index;
        bancaIniTier=v;
        sacadoAcumTier=0;
        vMeta=v;
        taxaAjustadaAtual=t.taxa;
      }

      const diaOff=off;
      off++;
      const base=v;
      const meta=base*t.taxa;
      const diasRestantesTier=t.dias-info.diaNoTier;
      const alvoFimTier=bancaIniTier*Math.pow(1+t.taxa, t.dias);
      const taxaAjustada=taxaAjustadaAtual;
      const metaAjustada=vMeta*taxaAjustada;
      const folgaTier=(base+sacadoAcumTier)-bancaIniTier*Math.pow(1+t.taxa, info.diaNoTier);
      const vals=ent[kw(w,d)]||["","","",""];
      const nums=vals.map(e=>e===""||e==null?null:Number(e));
      const tem=nums.some(n=>n!==null&&!isNaN(n));
      const soma=nums.reduce((s,n)=>s+(n!==null&&!isNaN(n)?n:0),0);

      dias.push({label:DM7[date.getDay()],date,base,meta,metaAjustada,taxaAjustada,folgaTier,vals,tem,soma,taxa:t.taxa,saque:0});

      v = tem ? base + soma : (suporMeta ? base * (1 + t.taxa) : base);
      vMeta = tem ? (base + soma) : vMeta * (1 + taxaAjustada);

      // Saque no intervalo configurado.
      // 15 => dias 15, 30, 45... | 30 => dias 30, 60, 90...
      // 0 => nenhum saque automático até a conclusão do ciclo.
      const deveSacar = saqueIntervalo > 0 && (diaOff + 1) % saqueIntervalo === 0;
      let saqueDia = 0;
      if(deveSacar) {
        const lucroAcumulado = Math.max(0, v - saldoReferenciaSaque);
        saqueDia = lucroAcumulado * saqPct;
        v -= saqueDia;
        vMeta = Math.max(0, vMeta - saqueDia);
        saqueSemana += saqueDia;
        sacadoAcumTier += saqueDia;
        saldoReferenciaSaque = v;
      }
      dias[dias.length-1].saque = saqueDia;

      if(tem || diaOff===hojeOff) {
        const diasRestProx=diasRestantesTier-1;
        const shadowBaseProx=v+sacadoAcumTier;
        taxaAjustadaAtual = (diasRestProx>0 && shadowBaseProx>0) ? Math.pow(alvoFimTier/shadowBaseProx, 1/diasRestProx)-1 : t.taxa;
      }
    }

    const lucro = v - semanaInicial + saqueSemana;
    sem.push({
      semana:w+1,
      tier:tSemana,
      inicial:semanaInicial,
      dias,
      lucro,
      saque:saqueSemana,
      fim:v,
      prox:v
    });
    atu=v;
    atuMeta=vMeta;
  }
  return sem;
}
function inteligente(semanas) {
  let saldoGlobal = 0;
  return semanas.map(sem => {
    const dias = sem.dias.map(d => {
      const metaBase = d.meta;
      const metaEfetiva = saldoGlobal > 0 ? Math.max(0, metaBase - saldoGlobal)
        : saldoGlobal < 0 ? metaBase + Math.abs(saldoGlobal)
        : metaBase;
      let status, cor;
      if (!d.tem) {
        if (saldoGlobal > 0) { status = "coberto"; cor = "#3b82f6"; }
        else if (saldoGlobal < 0) { status = "pendente"; cor = "#f59e0b"; }
        else { status = "sem_op"; cor = "#4a5a4a"; }
      } else if (d.soma < 0) {
        status = "negativo"; cor = "#ef4444";
      } else if (d.soma === 0) {
        status = saldoGlobal < 0 ? "pendente" : "sem_op"; cor = saldoGlobal < 0 ? "#f59e0b" : "#4a5a4a";
      } else if (d.soma >= metaBase) {
        status = "atingiu"; cor = "#22c55e";
      } else if (d.soma >= metaEfetiva && metaEfetiva < metaBase) {
        status = "coberto"; cor = "#3b82f6";
      } else {
        status = "parcial"; cor = "#f59e0b";
      }
      saldoGlobal += d.soma - metaBase;
      return { ...d, metaEfetiva, status, cor, saldo: saldoGlobal };
    });
    return { ...sem, dias };
  });
}

const auth = firebase.auth();
const db = firebase.firestore();
// Mantém uma cópia local do Firestore para uso mais estável entre PC/celular e
// permite que alterações feitas sem conexão sejam recuperadas ao voltar online.
try {
  db.enablePersistence({synchronizeTabs:true}).catch(err => {
    // Pode falhar em alguns navegadores/modo privado/file://. A sincronização online continua funcionando.
    console.warn("Persistência offline do Firestore indisponível:", err && err.code ? err.code : err);
  });
} catch(e) { console.warn(e); }

function Login() {
  const [modoCad, setModoCad] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [senha2, setSenha2] = React.useState("");
  const [erro, setErro] = React.useState("");
  const [aviso, setAviso] = React.useState("");
  const [load, setLoad] = React.useState(false);
  function tradErro(msg) {
    if(msg.includes("invalid-email")) return "Email inválido.";
    if(msg.includes("user-not-found")||msg.includes("wrong-password")||msg.includes("invalid-credential")) return "Email ou senha incorretos.";
    if(msg.includes("email-already-in-use")) return "Email já cadastrado.";
    if(msg.includes("weak-password")) return "Senha deve ter no mínimo 6 caracteres.";
    if(msg.includes("too-many-requests")) return "Muitas tentativas. Aguarde e tente novamente.";
    if(msg.includes("operation-not-allowed")) return "Login por e-mail/senha ainda não foi ativado neste projeto Firebase (Console → Authentication → Sign-in method → Email/senha).";
    if(msg.includes("network-request-failed")) return "Sem conexão com a internet.";
    return "Erro ao conectar. Tente novamente.";
  }
  async function entrar() { setLoad(true); setErro(""); setAviso(""); try { await auth.signInWithEmailAndPassword(email, senha); } catch(e) { setErro(tradErro(e.message)); setLoad(false); } }
  async function cadastrar() {
    setErro(""); setAviso("");
    if(senha !== senha2) { setErro("As senhas não conferem."); return; }
    if(senha.length < 6) { setErro("Senha deve ter no mínimo 6 caracteres."); return; }
    setLoad(true);
    try { await auth.createUserWithEmailAndPassword(email, senha); } catch(e) { setErro(tradErro(e.message)); setLoad(false); }
  }
  async function recuperar() {
    setErro(""); setAviso("");
    if(!email) { setErro("Digite seu email primeiro."); return; }
    setLoad(true);
    try { await auth.sendPasswordResetEmail(email); setAviso("Enviamos um link de recuperação para o seu email."); }
    catch(e) { setErro(tradErro(e.message)); }
    setLoad(false);
  }
  return (
    <div className="bg-app" style={{display:"flex",flexDirection:"column",justifyContent:"center",minHeight:"100vh"}}>
      <div className="card" style={{maxWidth:320,margin:"0 auto",width:"100%"}}>
        <h1 className="text-lg font-bold text-center mb-1">Gestor d Trader</h1>
        <p className="text-xs text-[#6a7d6a] text-center mb-4 font-mono">Faça login no PC e celular com a mesma conta</p>
        {erro && <div className="alerta mb-3"><span>⚠️</span><span className="text-xs">{erro}</span></div>}
        {aviso && <div className="alerta sucesso mb-3"><span>✅</span><span className="text-xs">{aviso}</span></div>}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
        <input type="password" placeholder="Senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(modoCad?cadastrar():entrar())}
          className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
        {modoCad && (
          <input type="password" placeholder="Confirmar senha" value={senha2} onChange={e=>setSenha2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&cadastrar()}
            className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
        )}

        {modoCad ? (
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={cadastrar} disabled={load} className="btn-primary w-full">{load?"...":"Criar conta"}</button>
            <button onClick={()=>{setModoCad(false);setErro("");setAviso("");}} className="text-[10px] text-[#6a7d6a] hover:text-[#c6a15b] font-mono" style={{background:"none",border:"none",cursor:"pointer"}}>Já tenho conta, entrar</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={entrar} disabled={load} className="btn-primary w-full">{load?"...":"Entrar"}</button>
            <div className="flex justify-between mt-1">
              <button onClick={()=>{setModoCad(true);setErro("");setAviso("");}} className="text-[10px] text-[#6a7d6a] hover:text-[#c6a15b] font-mono" style={{background:"none",border:"none",cursor:"pointer"}}>Criar conta</button>
              <button onClick={recuperar} disabled={load} className="text-[10px] text-[#6a7d6a] hover:text-[#c6a15b] font-mono" style={{background:"none",border:"none",cursor:"pointer"}}>Esqueci a senha</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TelaBloqueada() {
  return (
    <div className="bg-app" style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",minHeight:"100vh",padding:24,textAlign:"center"}}>
      <div className="card" style={{maxWidth:320}}>
        <div style={{fontSize:32,marginBottom:8}}>🔒</div>
        <h1 className="text-lg font-bold mb-2">Acesso bloqueado</h1>
        <p className="text-xs text-[#8a9a8a] mb-4">Seu acesso foi bloqueado pelo administrador. Fale com quem administra sua conta para liberar novamente.</p>
        <button onClick={()=>auth.signOut()} className="btn-primary w-full">Sair</button>
      </div>
    </div>
  );
}

function semHoje(inicio, cfg) {
  const d5 = cfg?.diasPorSemana ?? D5;
  const tiers = cfg?.tiers ?? TIERS_PADRAO;
  const totalDias = tiers.reduce((s,t)=>s+t.dias,0);
  const numSem = Math.ceil(totalDias / d5);
  const h=new Date(); h.setHours(0,0,0,0);
  const i=new Date(inicio); i.setHours(0,0,0,0);
  if(h<i) return null;
  let dU=0; let c=new Date(i);
  while(true) {
    c.setDate(c.getDate()+1); dU++;
    if(c>=h) { if(c>h) dU--; break; }
  }
  const sm=Math.floor(dU/d5), di=dU%d5;
  if(sm<0||sm>=numSem) return null;
  return {semana:sm,dia:di};
}

// Converte uma data qualquer (não necessariamente hoje) em semana/dia dentro do
// ciclo ativo — usado pela importação em lote, que pede uma data para as operações
// em vez de depender do dia selecionado na grade.
function dataParaSemDia(data, inicio, cfg) {
  const d5 = cfg?.diasPorSemana ?? D5;
  const tiers = cfg?.tiers ?? TIERS_PADRAO;
  const totalDias = tiers.reduce((s,t)=>s+t.dias,0);
  const numSem = Math.ceil(totalDias / d5);
  const h=new Date(data); h.setHours(0,0,0,0);
  const i=new Date(inicio); i.setHours(0,0,0,0);
  if(h<i) return null;
  const dU = Math.round((h-i)/86400000);
  const sm=Math.floor(dU/d5), di=dU%d5;
  if(sm<0||sm>=numSem) return null;
  return {semana:sm,dia:di};
}

function criarCicloPadrao(cap, ini, ent, fechados, senha, historico) {
  return {
    id: "c1", nome: "Ciclo 1",
    dataIni: typeof ini === "string" ? ini : tISO(ini),
    cap: cap || 200, status: "ativo",
    diasPorSemana: 7, saqueIntervalo: 7, saqPct: 0.3,
    tiers: TIERS_PADRAO.map(t => ({...t})),
    ent: ent || {}, fechados: fechados || {},
    historico: historico || [], senha: senha || ""
  };
}

function migrarV6(d) {
  const ciclo = criarCicloPadrao(d.cap, d.ini, d.ent, d.fechados, d.senha, d.historico);
  return {ciclos:[ciclo], ativo:"c1", cap:ciclo.cap, ini:ciclo.dataIni, ent:ciclo.ent, fechados:ciclo.fechados, senha:ciclo.senha, historico:ciclo.historico};
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoad, setAuthLoad] = useState(true);
  const [firePronto, setFirePronto] = useState(false);
  // --- Controle de acesso (Etapa 3): admins/{uid} é só leitura própria (nunca
  // escrito pelo app); clientes/{uid} é criado automaticamente no primeiro
  // login e guarda o status (ativo/bloqueado) usado para liberar/bloquear o
  // acesso ao app em tempo real.
  const [isAdmin, setIsAdmin] = useState(false);
  const [acessoLoad, setAcessoLoad] = useState(true);
  const [erroAcesso, setErroAcesso] = useState(null);
  const [clienteStatus, setClienteStatus] = useState(null);
  const [listaClientes, setListaClientes] = useState([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  // Cadastro de cliente pelo admin (melhoria da aba Clientes): cria a conta
  // no Firebase Authentication e o documento clientes/{uid}, sem afetar a
  // sessão logada do admin (usa um app Firebase secundário só para isso).
  const [mostrarCadastroCliente, setMostrarCadastroCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteEmail, setNovoClienteEmail] = useState("");
  const [novoClienteSenha, setNovoClienteSenha] = useState("");
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
  const [erroCadastroCliente, setErroCadastroCliente] = useState("");
  const [avisoCadastroCliente, setAvisoCadastroCliente] = useState("");
  // Jogos do Dia (Etapa 4): coleção compartilhada via ProductionStore/store.js
  // (mesmo mecanismo de sincronização do antigo Controle de Produção) — o
  // administrador publica, todo cliente logado recebe em tempo real.
  const [jogosPublicados, setJogosPublicados] = useState([]);
  const [novoJogoMandante, setNovoJogoMandante] = useState("");
  const [novoJogoVisitante, setNovoJogoVisitante] = useState("");
  const [novoJogoHorario, setNovoJogoHorario] = useState("");
  const [novoJogoCampeonato, setNovoJogoCampeonato] = useState("");
  const [novoJogoObs, setNovoJogoObs] = useState("");
  const [editandoJogoId, setEditandoJogoId] = useState(null);
  const [cap, setCap] = useState(200);
  const [inpCap, setInpCap] = useState("200");
  const [dataIni, setDataIni] = useState(() => { const d=new Date(); d.setHours(0,0,0); return d; });
  const [ent, setEnt] = useState({});
  const [carreg, setCarreg] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncErro, setSyncErro] = useState(false);
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? "conectando" : "offline");
  const [ultimaSync, setUltimaSync] = useState(() => { try { const v=Number(localStorage.getItem("bc:ultimaSync")||0); return v||null; } catch(e) { return null; } });
  const [syncOrigem, setSyncOrigem] = useState("");
  const [showSyncInfo, setShowSyncInfo] = useState(false);
  const syncAssinaturaRemotaRef = useRef("");
  const aplicandoRemotoRef = useRef(false);
  const deviceIdRef = useRef((()=>{
    try {
      let id=localStorage.getItem("bc:deviceId");
      if(!id){ id="dev_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8); localStorage.setItem("bc:deviceId",id); }
      return id;
    } catch(e) { return "dev_"+Math.random().toString(36).slice(2,10); }
  })());
  const deviceLabel = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ? "Celular" : "PC";
  const [editDia, setEditDia] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [modo, setModo] = useState("dia");
  const [semAtual, setSemAtual] = useState(null);
  const [focoDia, setFocoDia] = useState(null);
  const [selDia, setSelDia] = useState(null);
  const [selMes, setSelMes] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  // Stake fixa (substitui o antigo cálculo por percentual da banca para operações automáticas).
  // Valor salvo em localStorage e mantido até o usuário alterar — sem validade ou controle de dias.
  const [stakeFixa, setStakeFixa] = useState(() => { try { const v=Number(localStorage.getItem("bc:stakeFixa")); return isFinite(v)&&v>0?v:50; } catch(e) { return 50; } });
  const [inpStakeFixa, setInpStakeFixa] = useState(() => { try { const v=Number(localStorage.getItem("bc:stakeFixa")); return (isFinite(v)&&v>0?v:50).toFixed(2).replace(".",","); } catch(e) { return "50,00"; } });
  const [secao, setSecao] = useState("dashboard");
  // ===== CICLOS DA ESTRATÉGIA (módulo independente da Gestão principal) =====
  const [estratCiclos, setEstratCiclos] = useState(() => {
    const padrao = () => Array.from({length:5},(_,i)=>({
      id:i+1, nome:`Ciclo ${i+1}`, cap:i===0?100:null,
      objetivo:0.10, meta:1, entradasMax:12, entradasObj:12, reducao:0,
      operacoes:[], status:"aberto",
      saquePlanejadoTipo:"valor", saquePlanejado:100, saqueConfirmado:null,
      capitalLevado:null, encerradoEm:null, modeloPlanilha:"nettuno"
    }));
    try {
      const v=JSON.parse(localStorage.getItem("bc:estratCiclos")||"null");
      if(!Array.isArray(v)||!v.length) return padrao();
      return Array.from({length:5},(_,i)=>{
        const c=v[i]||{};
        return {
          ...c, id:i+1, nome:`Ciclo ${i+1}`,
          cap:i===0 ? (Number(c.cap)>0?Number(c.cap):100) : (Number(c.cap)>0?Number(c.cap):null),
          objetivo:Number.isFinite(Number(c.objetivo))?Number(c.objetivo):0.10,
          meta:Number.isFinite(Number(c.meta))?Number(c.meta):1,
          entradasMax:Number(c.entradasMax)>0?Number(c.entradasMax):12,
          entradasObj:Number(c.entradasObj)>0?Number(c.entradasObj):12,
          reducao:Number.isFinite(Number(c.reducao))?Number(c.reducao):0,
          operacoes:Array.isArray(c.operacoes)?c.operacoes:[],
          status:c.status||"aberto", saquePlanejadoTipo:c.saquePlanejadoTipo||"valor",
          saquePlanejado:Number.isFinite(Number(c.saquePlanejado))?Number(c.saquePlanejado):100,
          saqueConfirmado:c.saqueConfirmado??null, capitalLevado:c.capitalLevado??null,
          encerradoEm:c.encerradoEm??null, modeloPlanilha:"nettuno"
        };
      });
    } catch(e) { return padrao(); }
  });
  const [estratCicloSel, setEstratCicloSel] = useState(1);
  const [estratAba, setEstratAba] = useState("matriz");
  const [estratNome, setEstratNome] = useState(() => { try{return localStorage.getItem("bc:estratNome")||"Minha estratégia";}catch(e){return "Minha estratégia";} });
  const [estratLucro, setEstratLucro] = useState("");
  const [estratObs, setEstratObs] = useState("");
  const [estratTime, setEstratTime] = useState("");
  const [estratMetodo, setEstratMetodo] = useState("");
  const [estratJogo, setEstratJogo] = useState("");
  const [estratOdd, setEstratOdd] = useState("");
  const [estratEntrada, setEstratEntrada] = useState("");
  const [estratResponsabilidade, setEstratResponsabilidade] = useState("");
  const [estratShowConfig, setEstratShowConfig] = useState(false);
  const [estratNovaLista, setEstratNovaLista] = useState("");
  const [estratSaqueManual, setEstratSaqueManual] = useState("");
  const [estratSaqueRealEdit, setEstratSaqueRealEdit] = useState({});
  const [estratFinalizarId, setEstratFinalizarId] = useState(null);
  const [estratFinalizarTipo, setEstratFinalizarTipo] = useState("");
  const [estratFinalizarValor, setEstratFinalizarValor] = useState("");
  const [estratFinalizarErro, setEstratFinalizarErro] = useState("");
  const [estratEditarOpId, setEstratEditarOpId] = useState(null);
  const [estratEditarForm, setEstratEditarForm] = useState({jogo:"",time:"",estrategia:"",metodo:"",odd:"",observacao:"",resultadoTipo:"",resultadoValor:""});
  const [histFiltroTime, setHistFiltroTime] = useState("");
  const [histFiltroEstrategia, setHistFiltroEstrategia] = useState("");
  const [histFiltroCiclo, setHistFiltroCiclo] = useState("todos");
  const [histFiltroResultado, setHistFiltroResultado] = useState("todos");
  const [histFiltroBusca, setHistFiltroBusca] = useState("");
  const [temaApp, setTemaApp] = useState(() => { try { return localStorage.getItem("bc:temaApp") || "auto"; } catch(e) { return "auto"; } });
  const [layoutApp, setLayoutApp] = useState(() => { try { return localStorage.getItem("bc:layoutApp") || "comfortable"; } catch(e) { return "comfortable"; } });
  const [planejamentosDia, setPlanejamentosDia] = useState(() => {
    try { const p=JSON.parse(localStorage.getItem("bc:planejamentosDia")||"{}"); return p && typeof p==="object" ? p : {}; } catch(e) { return {}; }
  });
  const [showPlanoHoje, setShowPlanoHoje] = useState(false);
  const [showEspelhoDetalhe, setShowEspelhoDetalhe] = useState(false);
  const [planoEditId, setPlanoEditId] = useState(null);
  const [planoForm, setPlanoForm] = useState({time:"",adversario:"",hora:"",estrategia:"BACK FAVORITO",pretendo:"",lembrete:15});
  const [lembreteBanner, setLembreteBanner] = useState(null);
  const lembretesDisparadosRef = useRef(new Set());
  const [fechados, setFechados] = useState({});
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [historico, setHistorico] = useState([]);
  const [showModalSenha, setShowModalSenha] = useState(false);
  const [senhaAcao, setSenhaAcao] = useState(null);
  const [inpSenha, setInpSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState("");
  const timer = useRef(null);
  const ref = useRef(null);
  const migradoEstrategiasRef = useRef(false);
  const [ciclos, setCiclos] = useState([]);
  const [cicloAtivo, setCicloAtivo] = useState(null);
  const [showNovoCiclo, setShowNovoCiclo] = useState(false);
  const [showGerCiclo, setShowGerCiclo] = useState(false);
  const [ncNome, setNcNome] = useState("");
  const [ncCap, setNcCap] = useState("200");
  const [ncIni, setNcIni] = useState(() => tISO(new Date()));
  const [ncDias, setNcDias] = useState(7);
  const [ncSaqueIntervalo, setNcSaqueIntervalo] = useState(7);
  const [ncSaq, setNcSaq] = useState("30");
  const [ncTiers, setNcTiers] = useState([{dias:30,taxa:0.06,label:"Mês 1"},{dias:30,taxa:0.05,label:"Mês 2"},{dias:30,taxa:0.04,label:"Mês 3"}]);
  const [showEncerrarCiclo, setShowEncerrarCiclo] = useState(false);
  const [showWizardEnc, setShowWizardEnc] = useState(false);
  const [encSaldoFinal, setEncSaldoFinal] = useState("");
  const [encValorSacado, setEncValorSacado] = useState("");
  const [encValorPermanece, setEncValorPermanece] = useState("");
  const [showEditarCiclo, setShowEditarCiclo] = useState(false);
  const [editCicloId, setEditCicloId] = useState(null);
  const [ecNome, setEcNome] = useState("");
  const [ecCap, setEcCap] = useState("200");
  const [ecDias, setEcDias] = useState(7);
  const [ecSaqueIntervalo, setEcSaqueIntervalo] = useState(7);
  const [ecSaq, setEcSaq] = useState("30");
  const [ecTiers, setEcTiers] = useState([]);
  const [resultadoEnc, setResultadoEnc] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [saquesConfirmados, setSaquesConfirmados] = useState({});
  const [confirmandoSaqueSemana, setConfirmandoSaqueSemana] = useState(false);
  const [showNovaMov, setShowNovaMov] = useState(false);
  const [movTipo, setMovTipo] = useState("aporte");
  const [movValor, setMovValor] = useState("");
  const [movNota, setMovNota] = useState("");
  const [showSaqEmerg, setShowSaqEmerg] = useState(false);
  const [showPlanejamento, setShowPlanejamento] = useState(false);
  const [saqEmergValor, setSaqEmergValor] = useState("");
  const [saqEmergNota, setSaqEmergNota] = useState("");
  const [showDeposito, setShowDeposito] = useState(false);
  const [depValor, setDepValor] = useState("");
  const [depNota, setDepNota] = useState("");
  const [extBusca, setExtBusca] = useState("");
  const [extTipoFiltro, setExtTipoFiltro] = useState("todos");
  const [extDataIni, setExtDataIni] = useState("");
  const [extDataFim, setExtDataFim] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinErro, setPinErro] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [locked, setLocked] = useState(false);
  const [operacoes, setOperacoes] = useState({});
  const [showAddOp, setShowAddOp] = useState(false);
  const [opEditIdx, setOpEditIdx] = useState(null);
  const opTimeInputRef = useRef(null);
  // Novo formulário padronizado (sem OCR): método (BACK/LAY) + estratégia fixa
  // (Favorito/Zebra/Vários Resultados/Total de Gols/Placar Correto) + detalhe.
  const [opForm, setOpForm] = useState({metodo:"",estrategiaBase:"",golsSelecao:"",placar:"",placarManual:"",observacao:"",hora:"",time:"",jogo:"",mercado:"",odd:"",ordemLay:"",entrada:"",responsabilidade:"",lucroPossivel:"",origem:"manual",betId:""});
  const [opCalcTocado, setOpCalcTocado] = useState(false);
  const [opDiaKey, setOpDiaKey] = useState(null);
  const [showFinalizarOp, setShowFinalizarOp] = useState(false);
  const [finalizarAlvo, setFinalizarAlvo] = useState(null);
  const [finalizarTipo, setFinalizarTipo] = useState(null);
  const [finalizarValor, setFinalizarValor] = useState("");
  const [finalizarMinuto, setFinalizarMinuto] = useState("");
  const [finalizarErro, setFinalizarErro] = useState("");
  const [opNovaEstrategia, setOpNovaEstrategia] = useState("");
  const [opNovaTime, setOpNovaTime] = useState("");
  // ---- Importação recorrente da planilha (Excel) da Bolsa de Apostas ----
  // Alimenta o mesmo "Minhas Operações" (operacoes[k]) usado pelo OCR e pelo
  // lançamento manual — nunca cria uma tela/base de dados separada.
  const [importExcelCarregando, setImportExcelCarregando] = useState(false);
  const [importExcelErro, setImportExcelErro] = useState("");
  const [importExcelResumo, setImportExcelResumo] = useState(null);
  const importExcelInputRef = useRef(null);
  // Filtro de período aplicado à importação: qual recorte da planilha exportada
  // da Bolsa deve ser considerado. A data inicial NUNCA é "hoje" por padrão —
  // é configurável pelo usuário (default: 01/08/2026), evitando que a carga
  // inicial descarte operações passadas.
  // modo: "periodo" (de/até livre, ex: 01/08 até hoje) | "dia" (um dia só) |
  //       "ciclo" (desde o início do ciclo ativo até uma data) | "custom".
  const [importFiltroModo, setImportFiltroModo] = useState("periodo");
  const [importFiltroDe, setImportFiltroDe] = useState("2026-08-01");
  const [importFiltroAte, setImportFiltroAte] = useState(() => tISO(new Date()));
  const [estrategias, setEstrategias] = useState([]);
  const [times, setTimes] = useState([]);
  const [lastEstrategia, setLastEstrategia] = useState("");
  const [lastTime, setLastTime] = useState("");
  const [showGerEstrategias, setShowGerEstrategias] = useState(false);
  const [showGerTimes, setShowGerTimes] = useState(false);
  const [estrBusca, setEstrBusca] = useState("");
  const [timeBusca, setTimeBusca] = useState("");
  const [novaEstrategia, setNovaEstrategia] = useState("");
  const [estratMsg, setEstratMsg] = useState("");
  const [novaTime, setNovaTime] = useState("");
  const [editEstr, setEditEstr] = useState(null);
  const [editTime, setEditTime] = useState(null);
  const [showHistoricoCiclo, setShowHistoricoCiclo] = useState(false);
  const [histCicloId, setHistCicloId] = useState(null);
  const [pEstrategia, setPEstrategia] = useState("");
  const [pTime, setPTime] = useState("");
  const [pResultado, setPResultado] = useState("todos");
  const [pCiclo, setPCiclo] = useState("todos");
  const [pDataIni, setPDataIni] = useState("");
  const [pDataFim, setPDataFim] = useState("");
  const [pDiaSem, setPDiaSem] = useState("todos");
  const [grafPeriodo, setGrafPeriodo] = useState("ciclo");
  const [grafDataIni, setGrafDataIni] = useState("");
  const [grafDataFim, setGrafDataFim] = useState("");
  useEffect(()=>{ try{localStorage.setItem("bc:estratCiclos",JSON.stringify(estratCiclos));localStorage.setItem("bc:estratNome",estratNome);}catch(e){} },[estratCiclos,estratNome]);

  function atualizarConfigCicloEstrat(id, campo, valor){
    setEstratCiclos(prev=>prev.map(c=>c.id===id?{...c,[campo]:valor}:c));
  }

  function taxaEfetivaCiclo(c){
    const obj=Math.max(0,Number(c?.objetivo)||0);
    const red=Math.min(1,Math.max(0,Number(c?.reducao)||0));
    return obj*(1-red);
  }

  // Projeção da matriz: parte da banca inicial e aplica a meta de cada ciclo.
  // O saque planejado é retirado do fim de cada ciclo para formar o início do próximo.
  function projecaoCiclosEstrat(lista=estratCiclos){
    const arr=Array.isArray(lista)?lista.slice(0,5):[];
    let inicio=100;
    return arr.map((c,i)=>{
      if(i===0) inicio=Number(c.cap)>0?Number(c.cap):100;
      const metaPct=Math.max(0,Number(c.meta)||0);
      const fim=inicio*(1+metaPct);
      const saqueCfg=Math.max(0,Number(c.saquePlanejado)||0);
      const saque=c.saquePlanejadoTipo==="percentual" ? fim*(saqueCfg/100) : saqueCfg;
      const saqueLimitado=Math.min(Math.max(0,saque),Math.max(0,fim));
      const proximoTeorico=Math.max(0,fim-saqueLimitado);
      const entradaPct=Math.max(0,Number(c.objetivo)||0)*(1-Math.min(1,Math.max(0,Number(c.reducao)||0)));
      const entradasParaMeta=entradaPct>0 ? Math.ceil(Math.log(1+metaPct)/Math.log(1+entradaPct)) : 0;
      const ops=Array.isArray(c.operacoes)?c.operacoes:[];
      const lucroReal=ops.reduce((a,o)=>a+(o.status==="aberta"?0:Number(o.lucro||0)),0);
      const fimReal=Math.max(0,inicio+lucroReal);
      const saqueReal=c.saqueConfirmado && Number.isFinite(Number(c.saqueConfirmado.valor)) ? Math.max(0,Number(c.saqueConfirmado.valor)) : null;
      const proximoReal=saqueReal!==null ? Math.max(0,fimReal-saqueReal) : null;
      const proximo=proximoReal!==null ? proximoReal : proximoTeorico;
      const linha={c,indice:i+1,inicio,entradaInicial:inicio,fim,metaValor:fim,metaPct,saque:saqueLimitado,apos:proximoTeorico,proximoInicio:proximo,entradaPct,entradasParaMeta,lucroReal,fimReal,saqueReal,aposReal:proximoReal,ops,usaReal:i>0 && !!arr[i-1]?.saqueConfirmado};
      inicio=proximo;
      return linha;
    });
  }

  function dadosCiclosEstrat(lista=estratCiclos){
    const arr=Array.isArray(lista)?lista.slice(0,5):[];
    const proj=projecaoCiclosEstrat(arr);
    return proj.map((x,i)=>{
      const c=x.c; const ops=x.ops;
      const lucro=ops.reduce((a,o)=>a+(o.status==="aberta"?0:Number(o.lucro||0)),0);
      const bancaAtual=x.inicio+lucro;
      const meta=x.fim;
      const concluidas=ops.filter(o=>o.status!=="aberta").length;
      const taxa=taxaEfetivaCiclo(c);
      let teorica=x.inicio;
      for(let j=0;j<concluidas;j++) teorica*=1+taxa*Math.pow(Math.max(0,1-(Number(c.reducao)||0)),j);
      const progresso=meta>x.inicio?Math.min(100,Math.max(0,(bancaAtual-x.inicio)/(meta-x.inicio)*100)):0;
      return {...x,lucro,bancaAtual,meta,taxa,teorica,progresso,encerrado:bancaAtual>=meta||c.status==="encerrado"};
    });
  }

  function bancaOperacionalCiclo(id){
    const dados=dadosCiclosEstrat();
    const d=dados.find(x=>x.indice===Number(id));
    return d?.bancaAtual || d?.inicio || 100;
  }

  function registrarEntradaEstrat(){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    if(!ciclo || ciclo.status==="encerrado") return;
    const ops=ciclo.operacoes||[];
    if(ops.length >= Number(ciclo.entradasMax||12)) return;
    const odd=Number(String(estratOdd).replace(",","."));
    if(!estratMetodo || !isFinite(odd) || odd<=1) return;
    const banca=Number(bancaOperacionalCiclo(estratCicloSel));
    if(!(banca>0)) return;
    const entrada=+banca.toFixed(2);
    const objetivo=taxaEfetivaCiclo(ciclo);
    const lucroPossivel=+(entrada*objetivo).toFixed(2);
    const op={
      id:"ecop"+Date.now().toString(36), numero:ops.length+1, data:tISO(new Date()),
      jogo:(estratJogo||"").trim(), time:estratTime, metodo:estratMetodo,
      estrategia:estratNome&&estratNome!=="Minha estratégia"?estratNome:"Não definida",
      odd:+odd.toFixed(3), entrada, responsabilidade:entrada, lucroPossivel,
      percentualObjetivo:objetivo, ordem:ops.length+1, status:"aberta", resultado:null, lucro:0, resultadoTipo:null, observacao:estratObs
    };
    setEstratCiclos(prev=>prev.map(c=>c.id===ciclo.id?{...c,operacoes:[...ops,op]}:c));
    setEstratJogo("");setEstratObs("");setEstratOdd("");setEstratEntrada("");setEstratResponsabilidade("");setEstratMetodo("");
  }

  function lucroGreenPorOdd(op){
    const entrada=Number(op?.entrada||0);
    const odd=Number(op?.odd||0);
    if(!(entrada>0) || !(odd>1)) return 0;
    // No módulo de ciclos, GREEN integral é calculado pela odd informada:
    // entrada × (odd - 1). Ex.: R$100 na odd 1,30 = R$30 de lucro.
    return +(entrada*(odd-1)).toFixed(2);
  }

  function abrirFinalizarEstrat(opId){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    const op=(ciclo?.operacoes||[]).find(o=>o.id===opId);
    if(!op || op.status!=="aberta") return;
    setEstratFinalizarId(opId);setEstratFinalizarTipo("");setEstratFinalizarValor("");setEstratFinalizarErro("");
  }

  function abrirEditarEstrat(opId){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    const op=(ciclo?.operacoes||[]).find(o=>o.id===opId);
    if(!op) return;
    setEstratEditarOpId(opId);
    setEstratEditarForm({
      jogo:op.jogo||"", time:op.time||"", estrategia:op.estrategia||"", metodo:op.metodo||"",
      odd:op.odd!=null?String(op.odd).replace(".",","):"", observacao:op.observacao||"",
      resultadoTipo:op.resultadoTipo||"",
      resultadoValor:(op.resultadoTipo==="red_parcial"||op.resultadoTipo==="green_parcial")?String(Math.abs(Number(op.lucro||0))).replace(".",","):""
    });
  }

  function salvarEdicaoEstrat(){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    const op=(ciclo?.operacoes||[]).find(o=>o.id===estratEditarOpId);
    if(!ciclo || !op) return;
    const odd=Number(String(estratEditarForm.odd).replace(",","."));
    if(!isFinite(odd)||odd<=1){ alert("Informe uma odd válida maior que 1."); return; }
    const jogo=(estratEditarForm.jogo||"").trim();
    const estrategia=estratEditarForm.estrategia||"Não definida";
    const tipo=estratEditarForm.resultadoTipo||"";
    let lucro=0,status="aberta",resultado=null;
    const stake=Number(op.entrada||0);
    if(tipo==="green"){ lucro=lucroGreenPorOdd(op); resultado=lucro; status="finalizada"; }
    else if(tipo==="red"){ lucro=-stake; resultado=lucro; status="finalizada"; }
    else if(tipo==="green_parcial"){
      const n=Number(String(estratEditarForm.resultadoValor).replace(",","."));
      if(!isFinite(n)||n<0){ alert("Informe o lucro parcial realizado."); return; }
      lucro=Math.abs(n); resultado=lucro; status="finalizada";
    }
    else if(tipo==="red_parcial"){
      const n=Number(String(estratEditarForm.resultadoValor).replace(",","."));
      if(!isFinite(n)||n<0){ alert("Informe a perda parcial realizada."); return; }
      lucro=-Math.abs(n); resultado=lucro; status="finalizada";
    }
    const novos=(ciclo.operacoes||[]).map(o=>o.id===op.id?{...o,
      jogo,time:estratEditarForm.time||"",estrategia,metodo:estratEditarForm.metodo||"",odd:+odd.toFixed(3),
      observacao:estratEditarForm.observacao||"",status,resultado,resultadoTipo:tipo||null,lucro,
      dataEdicao:Date.now(),dataFechamento:status==="finalizada"?(o.dataFechamento||Date.now()):null
    }:o);
    const inicio=dadosCiclosEstrat().find(x=>x.indice===estratCicloSel)?.inicio || Number(ciclo.cap)||100;
    const totalLucro=novos.reduce((a,o)=>a+(o.status==="aberta"?0:Number(o.lucro||0)),0);
    const meta=inicio*(1+(Number(ciclo.meta)||0));
    setEstratCiclos(prev=>prev.map(c=>c.id===ciclo.id?{...c,operacoes:novos,status:inicio+totalLucro>=meta?"encerrado":"aberto",encerradoEm:inicio+totalLucro>=meta?(c.encerradoEm||Date.now()):null}:c));
    setEstratEditarOpId(null);
  }

  function excluirEstratOperacao(opId){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    if(!ciclo || !(ciclo.operacoes||[]).some(o=>o.id===opId)) return;
    if(!window.confirm("Apagar esta operação? Essa ação não pode ser desfeita.")) return;
    const novos=(ciclo.operacoes||[]).filter(o=>o.id!==opId).map((o,i)=>({...o,numero:i+1,ordem:i+1}));
    const inicio=dadosCiclosEstrat().find(x=>x.indice===estratCicloSel)?.inicio || Number(ciclo.cap)||100;
    const totalLucro=novos.reduce((a,o)=>a+(o.status==="aberta"?0:Number(o.lucro||0)),0);
    const meta=inicio*(1+(Number(ciclo.meta)||0));
    setEstratCiclos(prev=>prev.map(c=>c.id===ciclo.id?{...c,operacoes:novos,status:inicio+totalLucro>=meta?"encerrado":"aberto",encerradoEm:inicio+totalLucro>=meta?(c.encerradoEm||Date.now()):null}:c));
  }

  function confirmarFinalizarEstrat(){
    const ciclo=estratCiclos.find(c=>c.id===estratCicloSel);
    const op=(ciclo?.operacoes||[]).find(o=>o.id===estratFinalizarId);
    if(!ciclo || !op || !estratFinalizarTipo) return;
    const stake=Number(op.entrada||0);
    let resultado=0;
    if(estratFinalizarTipo==="green") {
      resultado=lucroGreenPorOdd(op);
      setEstratFinalizarValor(String(resultado).replace(".",","));
    } else if(estratFinalizarTipo==="red") {
      resultado=-stake;
    } else if(estratFinalizarTipo==="green_parcial") {
      const n=Number(String(estratFinalizarValor).replace(",","."));
      if(!isFinite(n)||n<0){setEstratFinalizarErro("Informe o lucro parcial realizado.");return;}
      resultado=Math.abs(n);
    } else {
      const n=Number(String(estratFinalizarValor).replace(",","."));
      if(!isFinite(n)||n<0){setEstratFinalizarErro("Informe a perda parcial realizada.");return;}
      resultado=-Math.abs(n);
    }
    const novos=(ciclo.operacoes||[]).map(o=>o.id===estratFinalizarId?{...o,status:"finalizada",resultado,resultadoTipo:estratFinalizarTipo,lucro:resultado,dataFechamento:Date.now()}:o);
    const inicio=dadosCiclosEstrat().find(x=>x.indice===estratCicloSel)?.inicio || Number(ciclo.cap)||100;
    const totalLucro=novos.reduce((a,o)=>a+Number(o.lucro||0),0);
    const meta=inicio*(1+(Number(ciclo.meta)||0));
    setEstratCiclos(prev=>prev.map(c=>c.id===ciclo.id?{...c,operacoes:novos,status:inicio+totalLucro>=meta?"encerrado":"aberto",encerradoEm:inicio+totalLucro>=meta?Date.now():null}:c));
    setEstratFinalizarId(null);setEstratFinalizarTipo("");setEstratFinalizarValor("");setEstratFinalizarErro("");
  }

  function confirmarSaqueCicloEstrat(id, valorManual){
    const idx=estratCiclos.findIndex(c=>c.id===id); if(idx<0) return;
    const dados=dadosCiclosEstrat(); const d=dados[idx]; if(!d) return;
    let saque=valorManual!==undefined && String(valorManual).trim()!=="" ? Number(String(valorManual).replace(",",".")) : d.saque;
    if(!isFinite(saque)||saque<0) { alert("Informe um saque real válido."); return; }
    saque=Math.min(saque,Math.max(0,d.bancaAtual));
    const levado=+(d.bancaAtual-saque).toFixed(2);
    setEstratCiclos(prev=>prev.map(x=>x.id===id?{...x,saqueConfirmado:{valor:+saque.toFixed(2),data:tISO(new Date()),bancaAntes:+d.bancaAtual.toFixed(2)},capitalLevado:levado}:x));
    setEstratSaqueRealEdit(prev=>({...prev,[id]:String(+saque.toFixed(2)).replace(".",",")}));
  }

  function simularCincoCiclosEstrat(){
    const linhas=projecaoCiclosEstrat();
    const totalSaques=linhas.reduce((a,x)=>a+x.saque,0);
    const finalBruto=linhas.length?linhas[linhas.length-1].fim:0;
    const finalLiquido=linhas.length?linhas[linhas.length-1].apos:0;
    const totalInicial=linhas.length?linhas[0].inicio:0;
    const lucroProjetado=totalSaques+finalLiquido-totalInicial;
    return {linhas,totalSaques,finalBruto,finalLiquido,lucroTotal:lucroProjetado};
  }

  function resetarCicloEstrat(id){
    const idx=estratCiclos.findIndex(c=>c.id===id);
    setEstratCiclos(prev=>prev.map((c,i)=>i===idx?{...c,operacoes:[],status:"aberto",saqueConfirmado:null,capitalLevado:null,encerradoEm:null}:c));
    setEstratSaqueRealEdit(prev=>{const n={...prev};delete n[id];return n;});
  }

  // ===== JOGOS DO DIA =====
  const [jogosDia, setJogosDia] = useState([]);
  const [analisesJogos, setAnalisesJogos] = useState([]);
  const [jogosDataFiltro, setJogosDataFiltro] = useState(() => tISO(new Date()));
  const [jogosFiltro, setJogosFiltro] = useState("todos");
  const [jogosBusca, setJogosBusca] = useState("");
  const [jogosEstrategiaFiltro, setJogosEstrategiaFiltro] = useState("todas");
  const [jogosMelhorMercado, setJogosMelhorMercado] = useState("golHT");
  const [jogosRevisao, setJogosRevisao] = useState([]);
  const [showRevisaoJogos, setShowRevisaoJogos] = useState(false);
  const [importJogosCarregando, setImportJogosCarregando] = useState(false);
  const [importJogosProgresso, setImportJogosProgresso] = useState({pct:0,texto:""});
  const jogosInputRef = useRef(null);
  const entradaAoVivoInputRef = useRef(null);
  const [entradaAoVivoCarregando, setEntradaAoVivoCarregando] = useState(false);
  const [entradaAoVivoStatus, setEntradaAoVivoStatus] = useState("");
  const [jogoDetalheId, setJogoDetalheId] = useState(null);
  const [jogosCardSelecionados, setJogosCardSelecionados] = useState([]);
  const [jogosExcluirSelecionados, setJogosExcluirSelecionados] = useState([]);
  const [autoLimpezaJogos, setAutoLimpezaJogos] = useState(() => { try { return localStorage.getItem("bc:autoLimpezaJogos") !== "0"; } catch(e) { return true; } });
  const [showCardJogosDia, setShowCardJogosDia] = useState(false);
  const [jogoLembreteBanner, setJogoLembreteBanner] = useState(null);
  const jogoLembretesDisparadosRef = useRef(new Set());
  const [imagemJogoModal, setImagemJogoModal] = useState(null);
  const [opJogoOrigemId, setOpJogoOrigemId] = useState(null);
  const [opJogoMetodoOrigem, setOpJogoMetodoOrigem] = useState(null);

  // Limpeza automática dos jogos pendentes após o horário do confronto.
  useEffect(() => {
    try { localStorage.setItem("bc:autoLimpezaJogos", autoLimpezaJogos ? "1" : "0"); } catch(e) {}
    if(!autoLimpezaJogos) return;
    const limparVencidos = () => {
      const agora = new Date();
      const hoje = tISO(agora);
      // Remove somente 15 minutos após o fim estimado da partida.
      // Considera aproximadamente 2h de duração do jogo + acréscimo.
      const limiteFim = agora.getTime() - 135 * 60 * 1000;
      setJogosDia(prev => {
        let mudou = false;
        const filtrados = prev.filter(j => {
          if(j.data !== hoje || j.status !== "PENDENTE") return true;
          const h = String(j.horario || "").trim();
          if(!/^\d{1,2}:\d{2}$/.test(h)) return true;
          const [hh,mm] = h.split(":").map(Number);
          const quando = new Date(agora); quando.setHours(hh,mm,0,0);
          if((quando.getTime() + 135 * 60 * 1000) < agora.getTime()) { mudou = true; return false; }
          return true;
        });
        return mudou ? filtrados : prev;
      });
    };
    limparVencidos();
    const id = setInterval(limparVencidos, 60000);
    return () => clearInterval(id);
  }, [autoLimpezaJogos]);
  const [resultadosMetodoFiltro, setResultadosMetodoFiltro] = useState("todos");
  const [relogioDicas, setRelogioDicas] = useState(Date.now());

  // Dicas de Hoje — a fonte principal agora é texto colado, mantendo o importador OCR como opção legada.
  const [dicasMetodo, setDicasMetodo] = useState("back_favorito");
  const [dicasPeriodo, setDicasPeriodo] = useState("todos");
  const [dicasOrdem, setDicasOrdem] = useState("horario");
  const [showColarAnalise, setShowColarAnalise] = useState(false);
  const [textoAnaliseColada, setTextoAnaliseColada] = useState("");
  const [showColarAtualizacao, setShowColarAtualizacao] = useState(false);
  const [textoAtualizacaoColada, setTextoAtualizacaoColada] = useState("");
  const [showEntradaInteligente, setShowEntradaInteligente] = useState(false);
  const [textoEntradaInteligente, setTextoEntradaInteligente] = useState("");
  const [resultadoTextoJogos, setResultadoTextoJogos] = useState(null);
  const [atualizacaoRevisar, setAtualizacaoRevisar] = useState(null);

  // ===== ENTRADAS PRÉ-LIVE (central de início de operações) =====
  const [entradasSubView, setEntradasSubView] = useState(null); // null = menu | "ao_vivo" = lista de jogos do dia
  const leitorBolsaInputRef = useRef(null);
  const [showLeitorBolsa, setShowLeitorBolsa] = useState(false);
  const [showListaLayZebra, setShowListaLayZebra] = useState(false);
  const listaLayZebraInputRef = useRef(null);
  const [listaLayZebraJogos, setListaLayZebraJogos] = useState([]);
  const [listaLayZebraCarregando, setListaLayZebraCarregando] = useState(false);
  const [listaLayZebraStatus, setListaLayZebraStatus] = useState("");
  const [listaLayPlacarTipo, setListaLayPlacarTipo] = useState("zebra");
  const [listaLayPlacarSalvas, setListaLayPlacarSalvas] = useState([]);
  // Une listas locais/remotas sem deixar uma leitura antiga do Firestore apagar
  // jogos que acabaram de ser reconhecidos pelo OCR. O ID de cada jogo é único.
  // Para estas listas, a operação é somente de inclusão/substituição por tipo;
  // portanto a união é segura e evita a corrida PC/celular que fazia os jogos
  // aparecerem por alguns segundos e depois sumirem.
  function mesclarListasLaySalvas(a,b) {
    const mapa=new Map();
    for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]) {
      if(item && item.id) mapa.set(String(item.id),item);
    }
    return Array.from(mapa.values()).sort((x,y)=>{
      const dx=String(x?.data||"")+" "+String(x?.hora||"");
      const dy=String(y?.data||"")+" "+String(y?.hora||"");
      return dx.localeCompare(dy);
    });
  }

  function abrirListaLaySalva(tipo="zebra") {
    setListaLayPlacarTipo(tipo);
    const hoje=tISO(new Date());
    let salvas=listaLayPlacarSalvas;
    try {
      const local=JSON.parse(localStorage.getItem("bc:listaLayPlacarSalvas")||"[]");
      if(Array.isArray(local)) salvas=mesclarListasLaySalvas(salvas,local);
    } catch(e) {}
    // Também corrige o estado React imediatamente quando a cópia local tem
    // itens que ainda não chegaram ao estado atual.
    if(salvas.length!==listaLayPlacarSalvas.length) setListaLayPlacarSalvas(salvas);
    setListaLayZebraJogos(salvas.filter(j=>j.data===hoje&&j.tipo===tipo));
    setListaLayZebraStatus(""); setShowListaLayZebra(true);
  }
  // Persistência reforçada das listas Lay: salva localmente imediatamente e, quando
  // houver conta/conexão, grava diretamente no Firestore. Assim não dependemos
  // apenas do debounce geral de 350 ms, que pode ser interrompido ao fechar o PWA.
  async function persistirListaLayAgora(lista) {
    const consolidada=mesclarListasLaySalvas(lista,[]);
    try { localStorage.setItem("bc:listaLayPlacarSalvas",JSON.stringify(consolidada)); } catch(e) {}
    setListaLayPlacarSalvas(consolidada);
    if(user && firePronto && navigator.onLine) {
      try {
        await db.collection("dados").doc(user.uid).set({
          listaLayPlacarSalvas: consolidada,
          syncMeta:{updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:deviceIdRef.current,updatedDevice:deviceLabel}
        },{merge:true});
      } catch(e) { console.warn("Falha ao salvar listas Lay na nuvem:",e); }
    }
    return consolidada;
  }

  useEffect(()=>{ try { localStorage.setItem("bc:listaLayPlacarSalvas",JSON.stringify(listaLayPlacarSalvas)); } catch(e) {} },[listaLayPlacarSalvas]);
  const [leitorBolsaCarregando, setLeitorBolsaCarregando] = useState(false);
  const [leitorBolsaStatus, setLeitorBolsaStatus] = useState("");
  const [leitorBolsaResultado, setLeitorBolsaResultado] = useState(null); // {mandante,visitante}
  const [leitorBolsaLista, setLeitorBolsaLista] = useState([]); // [{horario,mandante,visitante,oddCasa,oddVisitante,favorito,oddFavorito}]

  // ===== POSSÍVEIS ENTRADAS (jogos salvos automaticamente pelo Leitor da Bolsa) =====
  const [possiveisEntradas, setPossiveisEntradas] = useState([]); // [{id,data,horario,mandante,visitante,oddCasa,oddVisitante,favorito,oddFavorito,estrategia,usada,ignorada,criadoEm}]
  const [showPossiveisEntradas, setShowPossiveisEntradas] = useState(false);
  const [possivelEntradaBanner, setPossivelEntradaBanner] = useState(null);
  const possivelEntradaAlertasDisparadosRef = useRef(new Set());


  useEffect(() => {
    const id=setInterval(()=>setRelogioDicas(Date.now()),60000);
    return ()=>clearInterval(id);
  }, []);

  useEffect(() => {
    function aplicarTema() {
      let efetivo = temaApp;
      if (temaApp === "auto") {
        const h = new Date().getHours();
        efetivo = (h >= 6 && h < 18) ? "morning" : "dark";
      }
      document.documentElement.setAttribute("data-theme", efetivo);
      document.documentElement.setAttribute("data-layout", layoutApp);
      const meta = document.querySelector('meta[name="theme-color"]');
      if(meta) meta.setAttribute("content", efetivo === "morning" ? "#f7f1e6" : efetivo === "clean" ? "#edf5ef" : efetivo === "executive" ? "#1b1e20" : "#06100b");
      try { localStorage.setItem("bc:temaApp", temaApp); localStorage.setItem("bc:layoutApp", layoutApp); } catch(e) {}
    }
    aplicarTema();
    const timerTema = temaApp === "auto" ? setInterval(aplicarTema, 300000) : null;
    return () => { if(timerTema) clearInterval(timerTema); };
  }, [temaApp, layoutApp]);

  useEffect(()=>{ try{ const p=localStorage.getItem("bc:pin"); if(p) setPinCode(p); }catch(e){} }, []);

  // Persiste a stake fixa — permanece salva até o usuário alterar, sem controle de dias/validade.
  useEffect(()=>{ try{ localStorage.setItem("bc:stakeFixa", String(stakeFixa)); }catch(e){} }, [stakeFixa]);

  useEffect(() => {
    try {
      const ciclosStr = localStorage.getItem("bc:ciclos");
      const ativoStr = localStorage.getItem("bc:cicloAtivo");
      if(ciclosStr) {
        const c = JSON.parse(ciclosStr);
        if(Array.isArray(c) && c.length > 0) {
          setCiclos(c);
          let aid = ativoStr ? JSON.parse(ativoStr) : c[0].id;
          if(!c.find(x=>x.id===aid)) aid = c[0].id;
          setCicloAtivo(aid);
          const ac = c.find(x => x.id === aid) || c[0];
          setCap(ac.cap); setInpCap(String(ac.cap));
          setDataIni(pISO(ac.dataIni));
          setEnt(ac.ent || {});
          setFechados(ac.fechados || {});
          setSenhaAdmin(ac.senha || "");
          setHistorico(ac.historico || []);
          setMovimentacoes(ac.movimentacoes || []);
          setSaquesConfirmados(ac.saquesConfirmados || {});
          setOperacoes(ac.operacoes || {});
        }
      } else {
        const oldCap = localStorage.getItem("bc:cap");
        if(oldCap) {
          const cap=JSON.parse(oldCap);
          const ini=JSON.parse(localStorage.getItem("bc:ini")||"null");
          const ent=JSON.parse(localStorage.getItem("bc:ent")||"{}");
          const fech=JSON.parse(localStorage.getItem("bc:fech")||"{}");
          const senha=localStorage.getItem("bc:senha")||"";
          const hist=JSON.parse(localStorage.getItem("bc:hist")||"[]");
          const ciclo=criarCicloPadrao(cap,ini,ent,fech,senha,hist);
          setCiclos([ciclo]); setCicloAtivo("c1");
          setCap(ciclo.cap); setInpCap(String(ciclo.cap));
          setDataIni(pISO(ciclo.dataIni));
          setEnt(ciclo.ent); setFechados(ciclo.fechados);
          setSenhaAdmin(ciclo.senha); setHistorico(ciclo.historico);
          try{["bc:cap","bc:ini","bc:ent","bc:fech","bc:senha","bc:hist"].forEach(k=>localStorage.removeItem(k));}catch(e){}
        }
      }
    } catch(e) { console.warn(e); }
    try {
      const es = localStorage.getItem("bc:estrategias");
      if(es) { const p = JSON.parse(es); if(Array.isArray(p)) setEstrategias(p); }
      const ts = localStorage.getItem("bc:times");
      if(ts) { const p = JSON.parse(ts); if(Array.isArray(p)) setTimes(p); }
      const le = localStorage.getItem("bc:lastEstrategia");
      if(le) setLastEstrategia(le);
      const lt = localStorage.getItem("bc:lastTime");
      if(lt) setLastTime(lt);
      const jj = localStorage.getItem("bc:jogosDia");
      if(jj) { const p=JSON.parse(jj); if(Array.isArray(p)) setJogosDia(p); }
      const aj = localStorage.getItem("bc:analisesJogos");
      if(aj) { const p=JSON.parse(aj); if(Array.isArray(p)) setAnalisesJogos(p); }
      const pe = localStorage.getItem("bc:possiveisEntradas");
      if(pe) { const p=JSON.parse(pe); if(Array.isArray(p)) setPossiveisEntradas(limparPossiveisEntradasAntigas(p)); }
      const lp = localStorage.getItem("bc:listaLayPlacarSalvas");
      if(lp) { const p=JSON.parse(lp); if(Array.isArray(p)) setListaLayPlacarSalvas(p); }
    } catch(e) { console.warn(e); }
    setCarreg(true);
  }, []);

  // Normaliza (uma única vez, para sempre) estratégias já cadastradas e operações já
  // salvas, corrigindo duplicidade por maiúsculas/minúsculas, espaçamento ou abreviação.
  useEffect(() => {
    if(!carreg) return;
    if(migradoEstrategiasRef.current) return;
    migradoEstrategiasRef.current = true;
    try {
      if(localStorage.getItem("bc:estrategiasMigradas_v2") === "1") return;
    } catch(e) {}
    try {
      let mudou = false;

      // Passo 1: deduplicar a lista de estratégias cadastradas pelo nome normalizado
      const vistos = new Map(); // norm -> index em novasEstrategias
      const novasEstrategias = [];
      for(const e of estrategias) {
        const norm = normEstrategia(e.nome);
        if(!norm) continue;
        if(vistos.has(norm)) {
          mudou = true;
          const idx = vistos.get(norm);
          if(e.ativa) novasEstrategias[idx] = {...novasEstrategias[idx], ativa:true};
          continue;
        }
        vistos.set(norm, novasEstrategias.length);
        if(e.nome !== norm) mudou = true;
        novasEstrategias.push({...e, nome:norm});
      }

      // Passo 2: reescrever o campo "estrategia" de cada operação já salva, mantendo
      // intactos id, data (chave), resultado, observação, hora e time — sem
      // criar, remover ou duplicar nenhuma operação.
      const normalizarOps = (opsObj) => {
        let alterou = false;
        const novo = {};
        for(const k in opsObj) {
          novo[k] = (opsObj[k]||[]).map(op => {
            if(!op.estrategia) return op;
            const norm = normEstrategia(op.estrategia);
            if(norm !== op.estrategia) { alterou = true; return {...op, estrategia:norm}; }
            return op;
          });
        }
        return {novo, alterou};
      };

      const {novo: novasOperacoes, alterou: mudouOps} = normalizarOps(operacoes);
      if(mudouOps) mudou = true;

      let mudouCiclos = false;
      const novosCiclos = ciclos.map(c => {
        if(!c.operacoes) return c;
        const {novo, alterou} = normalizarOps(c.operacoes);
        if(alterou) { mudouCiclos = true; return {...c, operacoes:novo}; }
        return c;
      });
      if(mudouCiclos) mudou = true;

      if(mudou) {
        setEstrategias(novasEstrategias);
        setOperacoes(novasOperacoes);
        if(mudouCiclos) setCiclos(novosCiclos);
        if(lastEstrategia) {
          const normLast = normEstrategia(lastEstrategia);
          if(normLast !== lastEstrategia) {
            setLastEstrategia(normLast);
            try{ localStorage.setItem("bc:lastEstrategia", normLast); }catch(e){}
          }
        }
      }
      // Marca a migração como concluída definitivamente, mesmo que nada tenha
      // mudado nesta execução (dados já estavam normalizados).
      try{ localStorage.setItem("bc:estrategiasMigradas_v2", "1"); }catch(e){}
    } catch(e) { console.warn(e); }
  }, [carreg]);

  useEffect(() => {
    if(!carreg || aplicandoRemotoRef.current) return;
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(() => {
      const atualizados = cicloAtivo ? ciclos.map(c =>
        c.id === cicloAtivo ? {...c, cap, dataIni:tISO(dataIni), ent, fechados, senha:senhaAdmin, historico, movimentacoes, saquesConfirmados, operacoes} : c
      ) : ciclos;

      // 1) Sempre salva no aparelho primeiro. Assim PC/celular continuam utilizáveis mesmo se a internet cair.
      try {
        localStorage.setItem("bc:ciclos", JSON.stringify(atualizados));
        if(cicloAtivo) localStorage.setItem("bc:cicloAtivo", JSON.stringify(cicloAtivo));
        localStorage.setItem("bc:estrategias", JSON.stringify(estrategias));
        localStorage.setItem("bc:times", JSON.stringify(times));
        localStorage.setItem("bc:lastEstrategia", lastEstrategia);
        localStorage.setItem("bc:lastTime", lastTime);
        localStorage.setItem("bc:planejamentosDia", JSON.stringify(planejamentosDia));
        localStorage.setItem("bc:jogosDia", JSON.stringify(jogosDia));
        localStorage.setItem("bc:analisesJogos", JSON.stringify(analisesJogos));
        localStorage.setItem("bc:possiveisEntradas", JSON.stringify(possiveisEntradas));
        // IMPORTANTE: listaLayPlacarSalvas possui persistência própria (imediata).
        // Não a gravamos aqui: este efeito usa snapshots antigos durante a corrida
        // do React e podia sobrescrever no Firestore uma lista recém-salva pelo OCR.
        setSalvo(true); setTimeout(()=>setSalvo(false),2000);
      } catch(e) { console.warn(e); }

      // 2) Nuvem: a mesma conta usa o mesmo documento no Firestore em qualquer aparelho.
      if(user && firePronto) {
        const payload = {
          ciclos: atualizados,
          cicloAtivo,
          estrategias,
          times,
          planejamentosDia,
          jogosDia,
          analisesJogos,
          possiveisEntradas,
          // listaLayPlacarSalvas é persistida por persistirListaLayAgora(),
          // separadamente, para impedir que um snapshot antigo sobrescreva OCR novo.
          preferencias: {temaApp, layoutApp, stakeFixa, lastEstrategia, lastTime}
        };
        const assinatura = JSON.stringify(payload);

        // Se este estado acabou de chegar da nuvem, não escreve de volta e evita loop de sincronização.
        if(assinatura === syncAssinaturaRemotaRef.current) {
          if(online) setSyncStatus("sincronizado");
          return;
        }

        if(!online) {
          setSyncStatus("offline");
          return;
        }

        setSyncStatus("salvando");
        setSyncErro(false);
        db.collection("dados").doc(user.uid).set({
          ...payload,
          syncMeta: {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: deviceIdRef.current,
            updatedDevice: deviceLabel
          }
        }, {merge:true})
          .then(()=>{
            syncAssinaturaRemotaRef.current = assinatura;
            const agora=Date.now();
            setUltimaSync(agora);
            setSyncOrigem("este "+deviceLabel.toLowerCase());
            setSyncStatus("sincronizado");
            setSyncErro(false);
            try{localStorage.setItem("bc:ultimaSync",String(agora));}catch(e){}
          })
          .catch(()=>{ setSyncErro(true); setSyncStatus("erro"); });
      }
    },350);
  },[ciclos,cicloAtivo,cap,dataIni,ent,fechados,senhaAdmin,historico,movimentacoes,saquesConfirmados,operacoes,estrategias,times,lastEstrategia,lastTime,planejamentosDia,jogosDia,analisesJogos,possiveisEntradas,temaApp,layoutApp,stakeFixa,carreg,user,firePronto,online]);

  useEffect(() => { if(editDia!==null&&ref.current) ref.current.focus(); }, [editDia]);

  useEffect(() => {
    function on() { setOnline(true); setSyncStatus(auth.currentUser ? "conectando" : "sincronizado"); }
    function off() { setOnline(false); setSyncStatus("offline"); }
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);


  // Lembretes dos jogos planejados. Com o app aberto, dispara banner e notificação
  // do navegador (quando autorizada). Os planos são sincronizados junto com a conta.
  useEffect(() => {
    function checarLembretes() {
      const agora=new Date();
      const chave=tISO(agora);
      const lista=planejamentosDia[chave]||[];
      for(const p of lista) {
        if(p.concluido || !p.hora) continue;
        const [hh,mm]=p.hora.split(":").map(Number);
        if(isNaN(hh)||isNaN(mm)) continue;
        const alvo=new Date(agora); alvo.setHours(hh,mm,0,0);
        const dif=(alvo-agora)/60000;
        const antecedencia=Number(p.lembrete)||15;
        const token=chave+":"+p.id+":"+antecedencia;
        if(dif<=antecedencia && dif>=-1 && !lembretesDisparadosRef.current.has(token)) {
          lembretesDisparadosRef.current.add(token);
          setLembreteBanner(p);
          try {
            if("Notification" in window && Notification.permission==="granted") {
              new Notification(`⚽ ${p.time}${p.adversario?" x "+p.adversario:""} — ${p.hora}`, {
                body:`Plano: ${p.estrategia||"Estratégia não informada"}${p.pretendo?" · "+p.pretendo:""}`,
                tag:"plano-"+p.id
              });
            }
          } catch(e) {}
        }
      }
    }
    checarLembretes();
    const id=setInterval(checarLembretes,30000);
    return ()=>clearInterval(id);
  }, [planejamentosDia]);

  // Alertas dos jogos importados. Notification API não agenda notificações com o
  // navegador totalmente fechado; por isso também mantemos banner dentro do app.
  useEffect(() => {
    function checarAlertasJogos() {
      const agora=new Date();
      for(const j of jogosDia) {
        if(!j.lembreteAtivo || !j.data || !j.horario || j.status==="IGNORADO" || j.status==="FINALIZADO") continue;
        const [yy,mm,dd]=String(j.data).split("-").map(Number);
        const hm=String(j.horario).match(/(\d{1,2})[:.](\d{2})/); if(!yy||!mm||!dd||!hm) continue;
        const alvo=new Date(yy,mm-1,dd,Number(hm[1]),Number(hm[2]),0,0);
        const dif=(alvo-agora)/60000, antecedencia=Math.max(1,Number(j.lembreteMin)||30);
        const token=j.id+":"+antecedencia+":"+j.data+":"+j.horario;
        if(dif<=antecedencia && dif>=-1 && !jogoLembretesDisparadosRef.current.has(token)) {
          jogoLembretesDisparadosRef.current.add(token); setJogoLembreteBanner(j);
          try { if("Notification" in window && Notification.permission==="granted") new Notification(`⚽ ${j.mandante} x ${j.visitante} — ${j.horario}`,{body:`${(j.leituraFinal?.entradaFinal&&j.leituraFinal.entradaFinal!=="N/D"?j.leituraFinal.entradaFinal:j.entradaSugerida)||"Oportunidade cadastrada"} · Confiança: ${j.confianca||"N/D"}`,tag:"jogo-"+j.id}); } catch(e) {}
        }
      }
    }
    checarAlertasJogos(); const id=setInterval(checarAlertasJogos,30000); return ()=>clearInterval(id);
  }, [jogosDia]);

  // Alerta das "Possíveis Entradas" salvas automaticamente pelo Leitor da Bolsa: dispara
  // 5 minutos antes do início de cada jogo do dia que ainda não virou operação.
  useEffect(() => {
    function checarAlertasPossiveisEntradas() {
      const agora=new Date(); const hoje=tISO(agora);
      for(const e of possiveisEntradas) {
        if(!e || e.data!==hoje || e.usada || e.ignorada || !e.horario) continue;
        const hm=String(e.horario).match(/(\d{1,2})[:.](\d{2})/); if(!hm) continue;
        const alvo=new Date(agora); alvo.setHours(Number(hm[1]),Number(hm[2]),0,0);
        const dif=(alvo-agora)/60000; const antecedencia=5;
        const token=e.id+":"+e.data+":"+e.horario;
        if(dif<=antecedencia && dif>=-1 && !possivelEntradaAlertasDisparadosRef.current.has(token)) {
          possivelEntradaAlertasDisparadosRef.current.add(token); setPossivelEntradaBanner(e);
          try { if("Notification" in window && Notification.permission==="granted") new Notification(`🔔 ${e.mandante} x ${e.visitante} — ${e.horario}`,{body:`Favorito: ${e.favorito} · Estratégia: Back Favorito`,tag:"possivel-entrada-"+e.id}); } catch(err) {}
        }
      }
    }
    checarAlertasPossiveisEntradas(); const id=setInterval(checarAlertasPossiveisEntradas,30000); return ()=>clearInterval(id);
  }, [possiveisEntradas]);

  useEffect(() => { const unsub = auth.onAuthStateChanged(u => { setUser(u); setAuthLoad(false); }); return unsub; }, []);

  // Controle de acesso (Etapa 3): decide se este usuário é administrador
  // (admins/{uid} existe — documento só criado manualmente pelo Console do
  // Firebase, nunca pelo app) e, se não for, escuta em tempo real o próprio
  // clientes/{uid} para saber se está ativo ou bloqueado. O documento
  // clientes/{uid} é criado automaticamente no primeiro login de qualquer
  // usuário (inclusive o admin, sem efeito prático para ele).
  function traduzErroAcesso(e) {
    const code = (e && e.code) || "";
    if(code === "permission-denied") return "O Firestore recusou o acesso (permission-denied). As regras de segurança (firestore.rules) provavelmente ainda não foram publicadas no Console do Firebase, ou o documento admins/{seu-uid} não existe.";
    if(code === "unavailable") return "Sem conexão com o Firestore no momento. Verifique sua internet e tente novamente.";
    return "Erro ao verificar seu acesso: " + (e && e.message ? e.message : String(e));
  }

  useEffect(() => {
    if(!user) { setIsAdmin(false); setAcessoLoad(true); setClienteStatus(null); setErroAcesso(null); return; }
    let unsubCliente = () => {};
    let cancelado = false;
    setAcessoLoad(true); setErroAcesso(null);
    db.collection("admins").doc(user.uid).get().then(adminDoc => {
      if(cancelado) return;
      const souAdmin = adminDoc.exists;
      setIsAdmin(souAdmin);
      const refCliente = db.collection("clientes").doc(user.uid);
      unsubCliente = refCliente.onSnapshot(doc => {
        if(!doc.exists) {
          refCliente.set({
            email: user.email || "",
            status: "ativo",
            role: "cliente",
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(e => { console.warn("Falha ao criar clientes/{uid}:", e); if(!cancelado) setErroAcesso(traduzErroAcesso(e)); });
          setClienteStatus("ativo");
        } else {
          setClienteStatus((doc.data() || {}).status || "ativo");
        }
        setAcessoLoad(false);
      }, err => { console.warn("Falha ao ler clientes/{uid}:", err); if(!cancelado) { setErroAcesso(traduzErroAcesso(err)); setAcessoLoad(false); } });
    }).catch(e => { console.warn("Falha ao checar admins/{uid}:", e); if(cancelado) return; setIsAdmin(false); setErroAcesso(traduzErroAcesso(e)); setAcessoLoad(false); });
    return () => { cancelado = true; unsubCliente(); };
  }, [user]);

  // Lista de clientes (só o admin consegue ler a coleção inteira — ver
  // firestore.rules) para a aba "👥 Clientes".
  useEffect(() => {
    if(!user || !isAdmin) { setListaClientes([]); return; }
    const unsub = db.collection("clientes").onSnapshot(snap => {
      setListaClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, e => console.warn("Falha ao listar clientes:", e));
    return unsub;
  }, [user, isAdmin]);

  // Jogos do Dia (Etapa 4): inicializa a coleção compartilhada uma única vez
  // e assina atualizações — ProductionStore já cuida do onSnapshot/local
  // fallback (mesma peça usada no Controle de Produção original).
  useEffect(() => {
    if(!user) return;
    if(typeof window.ProductionStore === "undefined") { console.warn("ProductionStore indisponível — store.js não carregou."); return; }
    ProductionStore.init("jogosPublicados", []);
    setJogosPublicados(ProductionStore.get("jogosPublicados"));
    ProductionStore.on("jogosPublicados", setJogosPublicados);
  }, [user]);

  useEffect(() => {
    if(!user) return;
    setSyncStatus(navigator.onLine ? "conectando" : "offline");
    const refDados = db.collection("dados").doc(user.uid);
    const unsub = refDados.onSnapshot({includeMetadataChanges:true}, doc => {
      if(doc.metadata && doc.metadata.hasPendingWrites) {
        setSyncStatus(navigator.onLine ? "salvando" : "offline");
        return;
      }
      if(!doc.exists) {
        setFirePronto(true);
        setSyncStatus(navigator.onLine ? "sincronizado" : "offline");
        return;
      }
      const d = doc.data() || {};
      aplicandoRemotoRef.current = true;
      const remotoCore = {
        ciclos: Array.isArray(d.ciclos) ? d.ciclos : [],
        cicloAtivo: d.cicloAtivo || null,
        estrategias: Array.isArray(d.estrategias) ? d.estrategias : [],
        times: Array.isArray(d.times) ? d.times : [],
        planejamentosDia: d.planejamentosDia && typeof d.planejamentosDia==="object" ? d.planejamentosDia : {},
        jogosDia: Array.isArray(d.jogosDia) ? d.jogosDia : [],
        analisesJogos: Array.isArray(d.analisesJogos) ? d.analisesJogos : [],
        possiveisEntradas: Array.isArray(d.possiveisEntradas) ? d.possiveisEntradas : [],
        listaLayPlacarSalvas: Array.isArray(d.listaLayPlacarSalvas) ? d.listaLayPlacarSalvas : [],
        preferencias: d.preferencias && typeof d.preferencias==="object" ? d.preferencias : {temaApp:"auto",layoutApp:"comfortable",stakeFixa:50,lastEstrategia:"",lastTime:""}
      };
      syncAssinaturaRemotaRef.current = JSON.stringify(remotoCore);

      if(Array.isArray(d.estrategias)) setEstrategias(d.estrategias);
      if(Array.isArray(d.times)) setTimes(d.times);
      if(d.planejamentosDia && typeof d.planejamentosDia==="object") setPlanejamentosDia(d.planejamentosDia);
      if(Array.isArray(d.jogosDia)) {
        let localJogos=[];
        try { const p=JSON.parse(localStorage.getItem("bc:jogosDia")||"[]"); if(Array.isArray(p)) localJogos=p; } catch(e) {}
        const remoto=d.jogosDia;
        const consolidado=[...remoto];
        for(const lj of localJogos){
          const idx=consolidado.findIndex(r=>mesmaPartida(r,lj));
          if(idx>=0) consolidado[idx]=mesclarJogoExistente(consolidado[idx],lj); else consolidado.push(lj);
        }
        setJogosDia(consolidado);
        if(localJogos.length>remoto.length && navigator.onLine) {
          db.collection("dados").doc(user.uid).set({jogosDia:consolidado,syncMeta:{updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:deviceIdRef.current,updatedDevice:deviceLabel}},{merge:true}).catch(()=>{});
        }
      }
      if(Array.isArray(d.analisesJogos)) setAnalisesJogos(d.analisesJogos);
      if(Array.isArray(d.possiveisEntradas)) setPossiveisEntradas(limparPossiveisEntradasAntigas(d.possiveisEntradas));
      if(Array.isArray(d.listaLayPlacarSalvas)) {
        // Nunca substitui cegamente a lista local pela cópia remota: um snapshot
        // antigo pode chegar depois do upload e apagar visualmente os jogos novos.
        // Fazemos união por ID e, em seguida, a rotina de persistência grava a
        // lista consolidada novamente no Firestore.
        let localLay=[];
        try {
          const raw=localStorage.getItem("bc:listaLayPlacarSalvas");
          const p=raw?JSON.parse(raw):[];
          if(Array.isArray(p)) localLay=p;
        } catch(e) {}
        const consolidada=mesclarListasLaySalvas(d.listaLayPlacarSalvas,localLay);
        setListaLayPlacarSalvas(consolidada);
        // Se a cópia local tiver jogos que ainda não existem na nuvem,
        // restaura-os imediatamente no Firestore. Isso cobre inclusive o
        // caso de o usuário fechar/reabrir o app antes do debounce geral.
        if(localLay.length > (Array.isArray(d.listaLayPlacarSalvas)?d.listaLayPlacarSalvas.length:0) && navigator.onLine) {
          db.collection("dados").doc(user.uid).set({
            listaLayPlacarSalvas: consolidada,
            syncMeta:{updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:deviceIdRef.current,updatedDevice:deviceLabel}
          },{merge:true}).catch(e=>console.warn("Falha ao restaurar listas Lay na nuvem:",e));
        }
      }
      if(d.preferencias && typeof d.preferencias==="object") {
        if(d.preferencias.temaApp) setTemaApp(d.preferencias.temaApp);
        if(d.preferencias.layoutApp) setLayoutApp(d.preferencias.layoutApp);
        if(Number(d.preferencias.stakeFixa)>0) { setStakeFixa(Number(d.preferencias.stakeFixa)); setInpStakeFixa(Number(d.preferencias.stakeFixa).toFixed(2).replace(".",",")); }
        if(typeof d.preferencias.lastEstrategia==="string") setLastEstrategia(d.preferencias.lastEstrategia);
        if(typeof d.preferencias.lastTime==="string") setLastTime(d.preferencias.lastTime);
      }
      if(d.ciclos && Array.isArray(d.ciclos)) {
        setCiclos(d.ciclos);
        let aid = d.cicloAtivo || d.ciclos[0]?.id;
        if(!d.ciclos.find(c=>c.id===aid)) aid = d.ciclos[0]?.id;
        if(aid) {
          setCicloAtivo(aid);
          const ac = d.ciclos.find(c => c.id === aid);
          if(ac) {
            setCap(ac.cap); setInpCap(String(ac.cap));
            setDataIni(pISO(ac.dataIni));
            setEnt(ac.ent||{}); setFechados(ac.fechados||{});
            setSenhaAdmin(ac.senha||""); setHistorico(ac.historico||[]);
            setMovimentacoes(ac.movimentacoes||[]);
            setSaquesConfirmados(ac.saquesConfirmados||{});
            setOperacoes(ac.operacoes||{});
          }
        }
      } else if(d.cap) {
        const mig=migrarV6(d);
        setCiclos(mig.ciclos); setCicloAtivo(mig.ativo);
        setCap(mig.cap); setInpCap(String(mig.cap));
        setDataIni(pISO(mig.ini));
        setEnt(mig.ent); setFechados(mig.fechados);
        setSenhaAdmin(mig.senha); setHistorico(mig.historico);
      }

      let ts=Date.now();
      try { if(d.syncMeta && d.syncMeta.updatedAt && d.syncMeta.updatedAt.toDate) ts=d.syncMeta.updatedAt.toDate().getTime(); } catch(e) {}
      setUltimaSync(ts);
      try{localStorage.setItem("bc:ultimaSync",String(ts));}catch(e){}
      if(d.syncMeta && d.syncMeta.updatedBy) {
        setSyncOrigem(d.syncMeta.updatedBy===deviceIdRef.current ? "este "+deviceLabel.toLowerCase() : (d.syncMeta.updatedDevice||"outro aparelho").toLowerCase());
      }
      setSyncErro(false);
      setSyncStatus(navigator.onLine ? "sincronizado" : "offline");
      setFirePronto(true);
      setTimeout(()=>{ aplicandoRemotoRef.current=false; },0);
    }, err => {
      console.warn("Erro de sincronização:", err);
      setSyncErro(true);
      setSyncStatus(navigator.onLine ? "erro" : "offline");
      setFirePronto(true);
      aplicandoRemotoRef.current=false;
    });
    return unsub;
  }, [user]);

  const cicloCfg = useMemo(() => {
    const c = ciclos.find(x => x.id === cicloAtivo);
    return c ? {tiers:c.tiers, diasPorSemana:c.diasPorSemana||7, saqueIntervalo:(c.saqueIntervalo!==undefined ? c.saqueIntervalo : (c.diasPorSemana||7)), saqPct:c.saqPct||0.3} : null;
  }, [ciclos, cicloAtivo]);

  const cicloEncerrado = useMemo(() => {
    const c = ciclos.find(x => x.id === cicloAtivo);
    return c?.status === "encerrado";
  }, [ciclos, cicloAtivo]);

  const semanas=useMemo(()=>calc(cap,dataIni,ent,false,cicloCfg),[cap,dataIni,ent,cicloCfg]);
  const semanasProj=useMemo(()=>calc(cap,dataIni,{},true,cicloCfg),[cap,dataIni,cicloCfg]);
  const semanasReal=useMemo(()=>calc(cap,dataIni,ent,true,cicloCfg),[cap,dataIni,ent,cicloCfg]);
  const semanasInt=useMemo(()=>inteligente(semanas),[semanas]);
  const semanasProjInt=useMemo(()=>inteligente(semanasProj),[semanasProj]);
  const hj=useMemo(()=>semHoje(dataIni,cicloCfg),[dataIni,cicloCfg]);

  const dashData = useMemo(() => {
    let totalLucro=0, totalSaque=0, diasOperados=0, diasComLucro=0;
    let melhorDia={soma:0, data:null}, piorDia={soma:0, data:null};
    let seqAtual=0, maxSeq=0;
    for(const sem of semanas) {
      for(const d of sem.dias) {
        if(d.tem && d.soma!==0) {
          diasOperados++;
          totalLucro += d.soma;
          if(d.soma>0) diasComLucro++;
          if(d.soma>melhorDia.soma) melhorDia={soma:d.soma,data:d.date};
          if(d.soma<piorDia.soma) piorDia={soma:d.soma,data:d.date};
        }
        if(d.tem && d.soma>0) { seqAtual++; if(seqAtual>maxSeq) maxSeq=seqAtual; }
        else if(d.tem) { seqAtual=0; }
      }
    }
    for(const sem of semanas) totalSaque += sem.saque;
    const bancaFinal = semanas.length>0 ? semanas[semanas.length-1].prox : cap;
    const bancaProj = semanasProj.length>0 ? semanasProj[semanasProj.length-1].prox : cap;
    const winRate = diasOperados>0 ? Math.round(diasComLucro/diasOperados*100) : 0;
    return { totalLucro, totalSaque, diasOperados, winRate, melhorDia, piorDia, seqAtual:maxSeq, bancaFinal, bancaProj, diff:bancaFinal-bancaProj };
  }, [semanas, semanasProj, cap]);

  // Status do espelho no dia atual: compara a banca real de agora com o valor
  // que o espelho de evolução (semanasProj) projeta para o dia de hoje —
  // não usa apenas o resultado do dia, e sim a banca acumulada do plano.
  //
  // CORREÇÃO 1: se o dia de hoje já foi operado (já existe resultado real
  // lançado), a referência do espelho precisa ser o valor esperado pelo
  // plano ao FINAL do dia (base + meta do dia) — e não o valor de início
  // do dia. Comparar a banca real já com o resultado de hoje contra a
  // banca do espelho ainda sem o ganho do dia inflava artificialmente o
  // "à frente do plano". Se hoje ainda não foi operado, a referência
  // continua sendo o início do dia (base), exatamente como antes.
  //
  // CORREÇÃO 2: "Banca atual" NÃO pode vir de dashData.bancaFinal aqui,
  // porque dashData.bancaFinal usa semanas[último].prox — e "prox" já vem
  // com o saque semanal (30%) da semana em andamento subtraído, mesmo que
  // essa semana ainda não tenha terminado nem o saque tenha sido de fato
  // efetuado. Isso fazia a "banca atual" do Status do Espelho aparecer
  // menor do que o resultado realmente lançado hoje. Aqui usamos
  // diretamente base + soma do dia de hoje na semana REAL (que já é a
  // banca inicial da semana + todos os resultados finalizados até hoje,
  // sem nenhum saque da semana atual descontado) — sem alterar em nada o
  // cálculo de "prox", das próximas semanas, do Espelho ou da regra dos 30%.
  // CORREÇÃO 3: SAQUE PREVISTO ≠ SAQUE REALIZADO. A "banca bruta" acima
  // (CORREÇÃO 2) nunca inclui o saque de 30% da semana em andamento — isso
  // já está certo enquanto o saque não foi confirmado. Mas se o usuário já
  // apertou "💰 SAQUE SEMANAL" e confirmou que aquele saque foi realmente
  // efetuado (saquesConfirmados), o dinheiro já saiu de verdade da banca —
  // então, e SÓ ENTÃO, esse valor confirmado passa a ser abatido da "banca
  // atual" usada no Status. Isso não mexe no cálculo do Espelho, na regra
  // dos 30%, na projeção ou nas próximas entradas — os 30% continuam sendo
  // calculados exatamente como sempre foram; aqui só decidimos se aquele
  // valor específico já saiu (confirmado) ou ainda não (previsto).
  const espelhoStatus = useMemo(() => {
    if(!hj) return null;
    const semanaProjHj = semanasProj[hj.semana];
    const diaProjHj = semanaProjHj ? semanaProjHj.dias[hj.dia] : null;
    if(!diaProjHj) return null;
    const semanaRealHj = semanas[hj.semana];
    const diaRealHj = semanaRealHj ? semanaRealHj.dias[hj.dia] : null;
    const hojeOperado = !!(diaRealHj && diaRealHj.tem);
    const espelho = hojeOperado ? (diaProjHj.base + diaProjHj.meta) : diaProjHj.base;
    const atualBruto = diaRealHj ? (diaRealHj.base + (diaRealHj.tem ? diaRealHj.soma : 0)) : dashData.bancaFinal;
    const saqueJaConfirmado = saquesConfirmados[hj.semana] ? saquesConfirmados[hj.semana].valor : 0;
    const atual = atualBruto - saqueJaConfirmado;
    const diff = atual - espelho;
    const progresso = espelho>0 ? Math.round((atual/espelho)*100) : 0;
    return { espelho, atual, diff, progresso };
  }, [hj, semanasProj, semanas, dashData, saquesConfirmados]);

  const semIdx = semAtual !== null ? semAtual : (hj ? hj.semana : 0);
  const sm = semIdx >= 0 && semIdx < semanas.length ? semanas[semIdx] : null;
  const smProj = semIdx >= 0 && semIdx < semanasProj.length ? semanasProj[semIdx] : null;
  const smInt = semIdx >= 0 && semIdx < semanasInt.length ? semanasInt[semIdx] : null;

  // Stake atual = Stake Fixa configurada em Configurações (sem dependência de percentual da banca).
  // Usado para pré-preencher o campo "Valor da Entrada" em Adicionar Operação — o usuário pode alterar manualmente.
  const stakeAtual = stakeFixa;

  const D5ATUAL = cicloCfg?.diasPorSemana ?? D5;
  const totalDiasAtu = cicloCfg?.tiers?.reduce((s,t)=>s+t.dias,0) || 90;
  const numSemAtu = semanas.length;

  const trajetoria = useMemo(() => {
    let diasOperados=0, totalLucro=0;
    for(const sem of semanas) for(const d of sem.dias) {
      if(d.tem && d.soma!==0) { diasOperados++; totalLucro += d.soma; }
    }
    const lucroMedioDia = diasOperados>0 ? totalLucro/diasOperados : 0;
    const diasRestantes = Math.max(0, totalDiasAtu - diasOperados);
    const trajBanca = cap + totalLucro + (lucroMedioDia * diasRestantes);
    const bancaProj = dashData.bancaProj;
    const diff = trajBanca - bancaProj;
    const pct = bancaProj>0 ? ((trajBanca/bancaProj)-1)*100 : 0;
    let status="on_track", cor="#c6a15b";
    if(diasOperados===0) { status="sem_dados"; cor="#4a5a4a"; }
    else if(pct>3) { status="ahead"; cor="#22c55e"; }
    else if(pct<-3) { status="behind"; cor="#ef4444"; }
    return { diasOperados, totalLucro, lucroMedioDia, trajBanca, bancaProj, diff, pct, status, cor, diasRestantes };
  }, [semanas, dashData, cap, totalDiasAtu]);

  const cenarios = useMemo(() => {
    const taxaBase = cicloCfg?.tiers?.[0]?.taxa || 0.06;
    const saqPctC = cicloCfg?.saqPct || 0.3;
    function simular(mult) {
      let b = cap;
      for(const sem of semanas) { if(sem.dias.some(d=>d.tem)) b = sem.prox; }
      const diasRest = Math.max(0, totalDiasAtu - trajetoria.diasOperados);
      const dPS = cicloCfg?.diasPorSemana || 7;
      const semRest = Math.ceil(diasRest / dPS);
      let tl=0, ts=0;
      for(let s=0; s<semRest; s++) {
        for(let d=0; d<dPS; d++) b = b*(1+taxaBase*mult);
        const l=b*taxaBase*mult*dPS; const sq=l*saqPctC;
        tl+=l; ts+=sq; b-=sq;
      }
      return {bancaFim:b, lucroTotal:tl+(b-cap), saqueTotal:ts};
    }
    return { conservador:simular(0.7), normal:simular(1.0), otimista:simular(1.3) };
  }, [cap, semanas, cicloCfg, totalDiasAtu, trajetoria]);

  const bancaIni = sm ? sm.inicial : cap;
  const bancaAtu = sm ? sm.prox : cap;
  const bancaEsp = smProj ? smProj.prox : cap;
  const diff = bancaAtu - bancaEsp;
  const lucro = sm ? sm.lucro : 0;
  const saque = sm ? sm.saque : 0;

  function diaFechado(sem, dia) { return !!fechados[kw(sem, dia)]; }

  function fecharDia(sem, dia) {
    const k=kw(sem,dia);
    setFechados(p=>({...p,[k]:Date.now()}));
    setHistorico(p=>[...p,{tipo:"fechar",k,data:Date.now()}]);
  }

  function desfecharDia(sem, dia) {
    const k=kw(sem,dia);
    setFechados(p=>{const n={...p}; delete n[k]; return n;});
    setHistorico(p=>[...p,{tipo:"desfechar",k,data:Date.now()}]);
  }

  function pedirSenha(acao) {
    if(!senhaAdmin) { acao(); return; }
    setSenhaAcao(()=>acao);
    setShowModalSenha(true);
    setInpSenha("");
    setSenhaErro("");
  }

  function confirmarSenha() {
    if(inpSenha===senhaAdmin) {
      setShowModalSenha(false);
      if(senhaAcao) senhaAcao();
      setSenhaAcao(null);
    } else {
      setSenhaErro("Senha incorreta.");
    }
  }

  function abrirDia(sem, dia) {
    if(diaFechado(sem,dia)) {
      pedirSenha(()=>abrirDia(sem,dia));
      return;
    }
    const k=kw(sem,dia);
    const v=ent[k]||["","","",""];
    const vals=v.filter(x=>x!==""&&x!=null);
    if(vals.length>0) {
      setEditDia({semana:sem,dia:dia,slot:0});
      setEditVal(vals[0]);
    } else {
      const vz=v.findIndex(x=>x===""||x==null);
      setEditDia({semana:sem,dia:dia,slot:vz>=0?vz:0});
      setEditVal("");
    }
  }

  function conf() {
    if(!editDia) return;
    const {semana,dia,slot}=editDia;
    const k=kw(semana,dia);
    const v=editVal.replace(",",".");
    const n=Number(v);
    if(v===""||isNaN(n)) { setEditDia(null); return; }
    setEnt(p=>{ const c=p[k]?p[k].slice():["","","",""]; c[slot]=v; return {...p,[k]:c}; });
    setHistorico(p=>[...p,{tipo:"entrada",k,slot,val:v,data:Date.now()}]);
    const proxVazio=ent[k]?ent[k].findIndex((x,i)=>i!==slot&&(x===""||x==null)):1;
    if(proxVazio>=0) { setEditDia({semana,dia,slot:proxVazio}); setEditVal(""); }
    else setEditDia(null);
  }

  function naoOperei(sem, dia) {
    if(diaFechado(sem,dia)) { pedirSenha(()=>naoOperei(sem,dia)); return; }
    const k=kw(sem,dia);
    setEnt(p=>({...p,[k]:["0","0","0","0"]}));
    setOperacoes(p=>{const n={...p};delete n[k];return n;});
    setHistorico(p=>[...p,{tipo:"naoOperei",k,data:Date.now()}]);
  }

  function desfazer(sem, dia) {
    if(diaFechado(sem,dia)) { pedirSenha(()=>desfazer(sem,dia)); return; }
    const k=kw(sem,dia);
    setEnt(p=>{const n={...p}; delete n[k]; return n;});
    setHistorico(p=>[...p,{tipo:"limpar",k,data:Date.now()}]);
  }

  function proximoDia() {
    if(!hj) return;
    const d5 = cicloCfg?.diasPorSemana ?? D5;
    let s = focoDia ? focoDia.semana : hj.semana;
    let d = focoDia ? focoDia.dia + 1 : hj.dia + 1;
    if(d >= d5) { d = 0; s++; }
    const numSem = semanas.length;
    if(s >= numSem) return;
    setFocoDia({semana: s, dia: d});
    setSemAtual(s);
  }

  function atualizarEntDeOps(k, ops) {
    const total = ops.reduce((s, op) => s + op.resultado, 0);
    setEnt(p => {
      if(ops.length === 0) { const n = {...p}; delete n[k]; return n; }
      return {...p, [k]: [String(total), "", "", ""]};
    });
  }

  // ---- Importação recorrente do Excel/CSV exportado da Bolsa de Apostas ----
  // Alimenta o MESMO "Minhas Operações" (operacoes[k]) usado pelo OCR e pelo
  // lançamento manual — nunca cria uma tela ou base de dados separada.
  // Cada operação sempre carrega um campo "origem" (ocr/bolsa/manual) e, para
  // as vindas da Bolsa, um "betId" — usado pra nunca duplicar ao reimportar a
  // planilha (compara pelo Bet ID e ignora quem já existe em qualquer dia).
  function carregarXLSX() {
    return new Promise((resolve, reject) => {
      if(window.XLSX) { resolve(); return; }
      const existente = document.getElementById("xlsx-cdn-script");
      if(existente) {
        existente.addEventListener("load", ()=>resolve());
        existente.addEventListener("error", ()=>reject(new Error("Falha ao carregar leitor de planilha")));
        return;
      }
      const s = document.createElement("script");
      s.id = "xlsx-cdn-script";
      s.src = "https://unpkg.com/xlsx/dist/xlsx.full.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Falha ao carregar leitor de planilha"));
      document.head.appendChild(s);
    });
  }

  // Nomes de coluna aceitos por campo (case/acento-insensível) — cobre as
  // variações mais comuns de export de exchanges de apostas em português/inglês.
  const CABECALHOS_BOLSA = {
    betId: ["bet id","betid","id da aposta","id aposta","id","bilhete","ticket"],
    data: ["data do evento","data evento","data da aposta","data","date"],
    hora: ["hora","horario"],
    mercado: ["mercado","market"],
    selecao: ["selecao","selection","escolha","pick","runner"],
    tipo: ["tipo","type","lado","side"],
    stake: ["stake","valor","entrada","valor apostado"],
    odd: ["odd","cotacao","price"],
    resultado: ["lucro","resultado","p/l","pnl","ganho/perda","profit","lucro/prejuizo","amount"],
    status: ["status"],
    confronto: ["evento","partida","confronto","jogo","match","competicao","description","descricao"],
  };

  function mapearColunasBolsa(headerRow) {
    const norm = (headerRow||[]).map(h => normBusca(String(h==null?"":h)));
    const map = {};
    for(const campo in CABECALHOS_BOLSA) {
      const candidatos = CABECALHOS_BOLSA[campo];
      let idx = norm.findIndex(h => candidatos.some(c=>h===normBusca(c)));
      if(idx<0) idx = norm.findIndex(h => candidatos.some(c=>h.includes(normBusca(c))));
      map[campo] = idx;
    }
    return map;
  }

  // Aceita célula de data como objeto Date (com cellDates:true), número de
  // série do Excel, ou texto em formato brasileiro/ISO.
  function parseDataCelulaBolsa(v) {
    if(v instanceof Date && !isNaN(v)) return v;
    if(typeof v === "number" && isFinite(v)) {
      const epoch = new Date(Date.UTC(1899,11,30));
      return new Date(epoch.getTime() + v*86400000);
    }
    if(typeof v === "string") {
      const s = v.trim();
      let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if(m) { let [,dd,mm,yyyy]=m; if(yyyy.length===2) yyyy="20"+yyyy; return new Date(Number(yyyy),Number(mm)-1,Number(dd)); }
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(m) { const [,y,mo,da]=m; return new Date(Number(y),Number(mo)-1,Number(da)); }
    }
    return null;
  }

  // Calcula o intervalo [de, até] efetivo do filtro de importação, de acordo
  // com o modo escolhido pelo usuário. Nunca usa a data atual como início —
  // "hoje" só entra como limite superior padrão (fim do período), nunca como
  // ponto de partida da carga.
  function rangeFiltroImportacao() {
    let de, ate;
    if(importFiltroModo === "dia") {
      de = pISO(importFiltroDe); ate = pISO(importFiltroDe);
    } else if(importFiltroModo === "ciclo") {
      de = new Date(dataIni); ate = pISO(importFiltroAte);
    } else {
      // "periodo" e "custom" usam livremente os dois campos de/até.
      de = pISO(importFiltroDe); ate = pISO(importFiltroAte);
    }
    de.setHours(0,0,0,0);
    ate.setHours(23,59,59,999);
    return { de, ate };
  }

  async function importarExcelBolsa(file) {
    if(!file) return;
    setImportExcelErro("");
    setImportExcelResumo(null);
    setImportExcelCarregando(true);
    try {
      const { de: filtroDe, ate: filtroAte } = rangeFiltroImportacao();
      if(filtroDe > filtroAte) { setImportExcelErro("A data \"de\" não pode ser posterior à data \"até\"."); return; }

      await carregarXLSX();
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, {type:"array", cellDates:true});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const linhas = window.XLSX.utils.sheet_to_json(sheet, {header:1, raw:true, defval:""});
      if(!linhas || linhas.length < 2) { setImportExcelErro("Planilha vazia ou sem linhas de dados."); return; }

      const map = mapearColunasBolsa(linhas[0]);
      if(map.betId<0 && map.confronto<0 && map.mercado<0) {
        setImportExcelErro("Não reconheci as colunas dessa planilha. Confira se é o export de operações da Bolsa de Apostas.");
        return;
      }

      // Bet IDs já existentes em QUALQUER dia do ciclo atual — é o que impede
      // duplicar ao reimportar a mesma planilha (ex: importar de novo às 13h e 18h).
      const betIdsExistentes = new Set();
      for(const k in operacoes) { for(const op of (operacoes[k]||[])) { if(op.betId) betIdsExistentes.add(String(op.betId)); } }

      const d5 = cicloCfg?.diasPorSemana ?? D5;
      const estrategiasExistentesNorm = new Set(estrategias.map(e=>normEstrategia(e.nome)));
      const timesExistentesNorm = new Set(times.map(t=>normBusca(t.nome)));
      const estrategiasParaAdicionar = [];
      const timesParaAdicionar = [];
      const porDia = {};
      let novas=0, ignoradas=0, semData=0, incompletas=0, foraDoPeriodo=0, anterioresCiclo=0;

      for(let li=1; li<linhas.length; li++) {
        const row = linhas[li];
        if(!row || row.every(c=>c==="")) continue;

        const betId = map.betId>=0 ? String(row[map.betId]||"").trim() : "";
        if(betId && betIdsExistentes.has(betId)) { ignoradas++; continue; }

        const dataCel = map.data>=0 ? row[map.data] : null;
        const dataLinha = parseDataCelulaBolsa(dataCel);
        if(!dataLinha) { semData++; continue; }
        // Considera a data REAL da operação encontrada na planilha (não a data
        // de hoje) para decidir se ela entra nesta importação.
        if(dataLinha < filtroDe || dataLinha > filtroAte) { foraDoPeriodo++; continue; }
        const offset = offsetDeData(dataIni, dataLinha);
        if(offset<0) { anterioresCiclo++; continue; }
        const semIdx = Math.floor(offset/d5), dIdx = offset%d5;
        const k = kw(semIdx, dIdx);

        let tipoTxt = map.tipo>=0 ? String(row[map.tipo]||"") : "";
        let tipo = /lay|contra/i.test(tipoTxt) ? "LAY" : /back|favor/i.test(tipoTxt) ? "BACK" : null;

        // Extratos de exchange (ex: Betfair) trazem, na coluna "Bet Type", tanto
        // movimentações financeiras (saque, depósito, comissão) quanto apostas
        // combinadas/múltiplas (Doubles, Trebles, N folds, Single bets). Nenhuma
        // dessas é uma operação individual de back/lay em um único mercado, então
        // são ignoradas aqui em vez de importadas com dados incorretos.
        const tipoTxtNorm = normBusca(tipoTxt);
        if(["deposit","withdraw","charge_commission"].includes(tipoTxtNorm) || /^(doubles|trebles|single bets|\d+\s*folds?)/.test(tipoTxtNorm)) { incompletas++; continue; }

        let mercadoTxt = map.mercado>=0 ? String(row[map.mercado]||"").trim() : "";
        let selecaoTxt = map.selecao>=0 ? String(row[map.selecao]||"").trim() : "";
        let confrontoTxt = map.confronto>=0 ? String(row[map.confronto]||"").trim() : "";
        const stake = map.stake>=0 ? limparNumero(row[map.stake]) : null;
        const odd = map.odd>=0 ? limparNumero(row[map.odd]) : null;
        const resultado = map.resultado>=0 ? limparNumero(row[map.resultado]) : null;

        // Alguns extratos (ex: Betfair) não têm colunas separadas de confronto/
        // mercado/seleção/tipo — tudo vem concatenado em uma única célula de
        // descrição, no formato "Competição | Confronto | Mercado | Seleção | TIPO"
        // (mercados de total/handicap repetem a linha no final, ex: "... | LAY | 1.5").
        // Detecta esse padrão pela quantidade de "|" e desmembra os campos,
        // sobrepondo o que veio (errado) das colunas mapeadas individualmente.
        if(confrontoTxt.split("|").length >= 4) {
          const partes = confrontoTxt.split("|").map(p=>p.trim());
          if(partes.length>=6 && /^\d+(\.\d+)?$/.test(partes[partes.length-1])) partes.pop();
          confrontoTxt = partes[1] || confrontoTxt;
          mercadoTxt = partes[2] || mercadoTxt;
          selecaoTxt = partes[3] || selecaoTxt;
          const tipoBruto = partes[4] || "";
          tipo = /lay/i.test(tipoBruto) ? "LAY" : /back/i.test(tipoBruto) ? "BACK" : tipo;
        }

        if(!confrontoTxt && !mercadoTxt && odd==null && stake==null) { incompletas++; continue; }

        let mercadoGenerico = mercadoTxt;
        const achadoMercado = MERCADOS_CONHECIDOS.find(mk => mercadoTxt && normBusca(mercadoTxt).includes(normBusca(mk)));
        if(achadoMercado) mercadoGenerico = achadoMercado;

        const estrategiaFinal = tipo ? classificarEstrategia(tipo, mercadoGenerico, selecaoTxt) : (mercadoGenerico || "Não informado");
        const backFavorito = tipo==="BACK" && ehMercadoResultadoPartida(mercadoGenerico);
        const timeFinal = (backFavorito && selecaoTxt) ? selecaoTxt : (confrontoTxt || selecaoTxt || "");
        const horaTxt = map.hora>=0 ? String(row[map.hora]||"").trim() : (dataLinha.getHours()||dataLinha.getMinutes() ? `${String(dataLinha.getHours()).padStart(2,"0")}:${String(dataLinha.getMinutes()).padStart(2,"0")}` : "");

        const temResultado = resultado!=null && !isNaN(resultado);
        const statusOp = temResultado ? (resultado>=0?"green":"red") : "aberta";
        const estrategiaNorm = normEstrategia(estrategiaFinal);

        // Mesma lógica de exchange usada no lançamento manual: para LAY,
        // Responsabilidade = (Odd-1)×Stake e Lucro possível = Stake; para BACK,
        // Lucro possível = Stake×(Odd-1). Só serve de referência/exibição — o
        // resultado real já vem pronto da própria planilha da Bolsa.
        let responsabilidadeCalc, lucroPossivelCalc;
        if(odd!=null && stake!=null && odd>1) {
          if(tipo==="LAY") { responsabilidadeCalc = +(stake*(odd-1)).toFixed(2); lucroPossivelCalc = +stake.toFixed(2); }
          else if(tipo==="BACK") { lucroPossivelCalc = +(stake*(odd-1)).toFixed(2); }
        }

        const novoOpRaw = {
          id: "op"+Date.now()+"_"+li+"_"+Math.random().toString(36).slice(2,7),
          num: 0,
          estrategia: estrategiaNorm,
          time: timeFinal,
          resultado: temResultado ? resultado : null,
          observacao: "",
          hora: horaTxt,
          tipo: tipo||undefined,
          mercado: mercadoGenerico||undefined,
          odd: odd!=null?odd:undefined,
          entrada: stake!=null?stake:undefined,
          responsabilidade: responsabilidadeCalc,
          lucroPossivel: lucroPossivelCalc,
          status: statusOp,
          origem: "bolsa",
          betId: betId||undefined,
          data: tISO(dataLinha), // data real do evento, conforme a exportação da Bolsa
        };
        const novoOp = {}; for(const kk in novoOpRaw) { if(novoOpRaw[kk]!==undefined) novoOp[kk]=novoOpRaw[kk]; }

        if(!porDia[k]) porDia[k]=[];
        porDia[k].push(novoOp);
        if(betId) betIdsExistentes.add(betId);
        novas++;

        if(estrategiaNorm && !estrategiasExistentesNorm.has(estrategiaNorm)) { estrategiasExistentesNorm.add(estrategiaNorm); estrategiasParaAdicionar.push(estrategiaNorm); }
        if(timeFinal && !timesExistentesNorm.has(normBusca(timeFinal))) { timesExistentesNorm.add(normBusca(timeFinal)); timesParaAdicionar.push(timeFinal); }
      }

      if(novas>0) {
        const diasAtualizados = {};
        setOperacoes(prev => {
          const next = {...prev};
          for(const k in porDia) {
            const existentesDia = next[k] ? [...next[k]] : [];
            const combinado = [...existentesDia, ...porDia[k]].map((o,i)=>({...o, num:i+1}));
            next[k] = combinado;
            diasAtualizados[k] = combinado;
          }
          return next;
        });
        for(const k in diasAtualizados) atualizarEntDeOps(k, diasAtualizados[k]);
        if(estrategiasParaAdicionar.length) setEstrategias(p=>[...p, ...estrategiasParaAdicionar.map(nome=>({id:"e"+Date.now()+Math.random().toString(36).slice(2,6),nome,ativa:true}))]);
        if(timesParaAdicionar.length) setTimes(p=>[...p, ...timesParaAdicionar.map(nome=>({id:"t"+Date.now()+Math.random().toString(36).slice(2,6),nome,ativa:true}))]);
        setHistorico(p=>[...p,{tipo:"import_excel_bolsa",data:Date.now(),qtd:novas}]);
      }

      setImportExcelResumo({novas, ignoradas, semData, incompletas, foraDoPeriodo, anterioresCiclo});
    } catch(e) {
      setImportExcelErro("Erro ao ler a planilha" + (e && e.message ? (": "+e.message) : ". Confira o arquivo e tente novamente."));
    } finally {
      setImportExcelCarregando(false);
    }
  }

  const MERCADOS_CONHECIDOS = [
    "Resultado da partida","Resultado Final","Placar Exato","Ambas Marcam",
    "Total de Gols","Total de Escanteios","Escanteios","Handicap Asiático",
    "Handicap Europeu","Dupla Chance","Intervalo/Final","Cartões","Mais/Menos",
  ];

  // Mercados de vencedor da partida — aqui a estratégia é sempre a mesma (BACK
  // FAVORITO), pois o que varia de bilhete pra bilhete é só o time escolhido,
  // não o tipo de estratégia. O time vai para o campo "Time", nunca para o nome
  // da estratégia — assim ela nunca fica misturada com outros mercados.
  const MERCADOS_RESULTADO_PARTIDA = ["Resultado da partida", "Resultado Final"];

  function ehMercadoResultadoPartida(mercado) {
    const n = normBusca(mercado || "");
    return MERCADOS_RESULTADO_PARTIDA.some(m => normBusca(m) === n);
  }

  // Classifica o nome da estratégia a partir de Tipo + Mercado + Seleção.
  // Nunca salva a estratégia apenas com o nome do mercado da Bolsa. Regras:
  //  1) BACK no mercado "Resultado da partida" -> sempre "BACK FAVORITO" (fixo).
  //  2) BACK em qualquer outro mercado (ex.: Mais/Menos) -> "BACK" + seleção
  //     completa (ex.: "BACK MAIS DE 1.5 GOLS").
  //  3) LAY, em qualquer mercado -> "LAY" + seleção completa (ex.: "LAY 1X1").
  function classificarEstrategia(tipo, mercadoGenerico, selecao) {
    if(!tipo) return "";
    if(tipo === "BACK" && ehMercadoResultadoPartida(mercadoGenerico)) return "BACK FAVORITO";
    const pick = selecao || mercadoGenerico;
    return pick ? `${tipo} ${pick}` : tipo;
  }

  function limparNumero(s) {
    if(s==null) return null;
    let str = String(s).trim();
    if(!str) return null;
    if(str.includes(",")) {
      // formato brasileiro: ponto = separador de milhar, vírgula = decimal
      str = str.replace(/\./g,"").replace(",",".");
    }
    const n = Number(str.replace(/[^\d.\-]/g,""));
    return isNaN(n) ? null : n;
  }

  // Lista fixa de estratégias (não duplica Back/Lay — o método é campo separado).
  const ESTRATEGIAS_FIXAS = ["Favorito","Zebra","Vários Resultados","Total de Gols","Ambas Marcam","Gol no 1º Tempo","Favorito Não Goleia","Placar Correto"];
  const GOLS_OPCOES = ["Over 0.5","Over 1.5","Over 2.5","Over 3.5","Under 0.5","Under 1.5","Under 2.5"];
  const PLACARES_RAPIDOS = ["0x0","1x0","0x1","1x1","2x1","1x2","2x2"];
  const MINUTOS_SAIDA = ["15","30","45","50","60","70","80","90"];
  function rotuloMinuto(m) { return m==="45" ? "45' (intervalo)" : (m ? `${m}'` : ""); }

  // Monta o rótulo final da operação a partir de Método + Estratégia (+ detalhe).
  // Ex.: BACK+Favorito -> "Back Favorito" | LAY+Placar Correto+1x1 -> "Lay 1x1"
  //      BACK+Total de Gols+Over 2.5 -> "Back Over 2.5"
  function rotuloOperacao(metodo, estrategiaBase, golsSelecao, placar) {
    if(!metodo) return "";
    const metodoCap = metodo === "BACK" ? "Back" : metodo === "LAY" ? "Lay" : metodo;
    if(estrategiaBase === "Total de Gols" && golsSelecao) return `${metodoCap} ${golsSelecao}`;
    if(estrategiaBase === "Placar Correto" && placar) return `${metodoCap} ${placar}`;
    if(estrategiaBase) return `${metodoCap} ${estrategiaBase}`;
    return metodoCap;
  }

  function abrirAddOp(sem, dia, editIdx) {
    const k = kw(sem, dia);
    if(diaFechado(sem,dia)) { pedirSenha(()=>abrirAddOp(sem,dia,editIdx)); return; }
    setOpDiaKey(k);
    if(editIdx != null) {
      const op = (operacoes[k]||[])[editIdx];
      setOpEditIdx(editIdx);
      setOpForm({
        metodo: op.tipo||"",
        estrategiaBase: op.estrategiaBase||"",
        golsSelecao: op.golsSelecao||"",
        placar: op.placar && PLACARES_RAPIDOS.includes(op.placar) ? op.placar : "",
        placarManual: op.placar && !PLACARES_RAPIDOS.includes(op.placar) ? op.placar : "",
        observacao:op.observacao||"", hora:op.hora||"", time:op.time||"", jogo:op.jogo||"",
        mercado:op.mercado||"",
        odd:op.odd!=null?String(op.odd).replace(".",","):"",
        ordemLay:op.ordemLay!=null?String(op.ordemLay).replace(".",","):"",
        entrada:op.entrada!=null?String(op.entrada).replace(".",","):"",
        responsabilidade:op.responsabilidade!=null?String(op.responsabilidade).replace(".",","):"",
        lucroPossivel:op.lucroPossivel!=null?String(op.lucroPossivel).replace(".",","):"",
        origem:op.origem||"manual", betId:op.betId||""
      });
      setOpCalcTocado(true); // ao editar operação já existente, não sobrescrever o valor salvo automaticamente
    } else {
      setOpEditIdx(null);
      const stakeInicial = (isFinite(stakeAtual) && stakeAtual>0) ? stakeAtual.toFixed(2).replace(".",",") : "";
      setOpForm({metodo:"", estrategiaBase:"", golsSelecao:"", placar:"", placarManual:"", observacao:"", hora: new Date().toTimeString().slice(0,5), time:lastTime, jogo:"", mercado:"", odd:"", ordemLay:"", entrada:stakeInicial, responsabilidade:"", lucroPossivel:"", origem:"manual", betId:""});
      setOpCalcTocado(false);
    }
    setOpNovaEstrategia("");
    setOpNovaTime("");
    setShowAddOp(true);
  }

  // Cálculo automático, igual à lógica real de exchange (Bolsa de Apostas):
  // BACK -> você digita Entrada (Stake) + Odd; Lucro possível = Entrada × (Odd-1).
  // LAY  -> você digita Responsabilidade (o que topa perder) + Odd; o sistema
  //         calcula sozinho: Entrada (Stake) = Responsabilidade / (Odd-1) e
  //         Lucro possível = Entrada (o que você ganha se o LAY for GREEN).
  // Recalcula sempre que método/odd/entrada/responsabilidade mudam, a menos que
  // o trader já tenha editado manualmente o campo calculado (ex: saída parcial).
  useEffect(() => {
    if(!showAddOp || opCalcTocado) return;
    const odd = Number(String(opForm.odd).replace(",","."));
    if(isNaN(odd) || odd<=1) return;
    if(opForm.metodo === "BACK") {
      const entrada = Number(String(opForm.entrada).replace(",","."));
      if(isNaN(entrada)) return;
      const lucroStr = (entrada * (odd - 1)).toFixed(2).replace(".",",");
      setOpForm(p => (p.lucroPossivel===lucroStr && p.responsabilidade==="") ? p : {...p, lucroPossivel:lucroStr, responsabilidade:""});
    } else if(opForm.metodo === "LAY") {
      const responsabilidade = Number(String(opForm.responsabilidade).replace(",","."));
      if(isNaN(responsabilidade)) return;
      const entradaCalc = responsabilidade / (odd - 1);
      const entradaStr = entradaCalc.toFixed(2).replace(".",",");
      const lucroStr = entradaCalc.toFixed(2).replace(".",",");
      setOpForm(p => (p.entrada===entradaStr && p.lucroPossivel===lucroStr) ? p : {...p, entrada:entradaStr, lucroPossivel:lucroStr});
    }
  }, [showAddOp, opForm.metodo, opForm.odd, opForm.entrada, opForm.responsabilidade, opCalcTocado]);

  // Botões de múltiplo da Stake atual (0.5x/1x/1.5x/2x) — apenas preenchem o campo indicado
  // com o valor já calculado em "Gestão de Ciclos de Stake". Edição manual continua livre.
  function stakeMultiplierRow(targetField, tocadoAoAplicar) {
    return (
      <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
        <span className="font-mono text-[8px] text-[#6a7d6a]">Stake atual: <span className="text-[#c6a15b] font-bold">{fmt(stakeAtual)}</span></span>
        <div className="flex gap-1">
          {[0.5,1,1.5,2].map(mult=>(
            <button key={mult} type="button"
              onClick={()=>{
                const val=(stakeAtual*mult).toFixed(2).replace(".",",");
                setOpForm(p=>({...p,[targetField]:val}));
                setOpCalcTocado(tocadoAoAplicar);
              }}
              className="font-mono text-[8px] px-1.5 py-1 rounded border border-[#1e3228] text-[#8a9a8a] hover:border-[#c6a15b] hover:text-[#c6a15b] transition-colors">{mult}x</button>
          ))}
        </div>
      </div>
    );
  }

  function salvarOp() {
    const k = opDiaKey;
    const placarFinal = opForm.estrategiaBase==="Placar Correto" ? ((opForm.placar||opForm.placarManual||"").trim()) : "";
    const rotulo = rotuloOperacao(opForm.metodo, opForm.estrategiaBase, opForm.golsSelecao, placarFinal);
    const estrategiaNorm = normEstrategia(rotulo);
    const numOrUndef = (s) => { if(s===""||s==null) return undefined; const n=Number(String(s).replace(",",".").replace(/\s/g,"")); return isNaN(n)?undefined:n; };
    const extrasRaw = {
      tipo: opForm.metodo || undefined,
      estrategiaBase: opForm.estrategiaBase || undefined,
      golsSelecao: opForm.estrategiaBase==="Total de Gols" ? (opForm.golsSelecao||undefined) : undefined,
      placar: opForm.estrategiaBase==="Placar Correto" ? (placarFinal||undefined) : undefined,
      mercado: (opForm.mercado||"").trim() || undefined,
      odd: numOrUndef(opForm.odd),
      entrada: numOrUndef(opForm.entrada),
      responsabilidade: opForm.metodo==="LAY" ? numOrUndef(opForm.responsabilidade) : undefined,
      lucroPossivel: numOrUndef(opForm.lucroPossivel),
      origem: opForm.origem || "manual",
      jogo: (opForm.jogo||"").trim() || undefined,
      betId: (opForm.betId||"").trim() || undefined,
      jogoId: opJogoOrigemId || undefined,
      metodoDica: opJogoMetodoOrigem || undefined,
    };
    const extras = {};
    for(const key in extrasRaw) { if(extrasRaw[key] !== undefined) extras[key] = extrasRaw[key]; }
    const prevOps = operacoes[k] ? [...operacoes[k]] : [];
    let newOps;
    let novaOperacaoId = null;
    if(opEditIdx != null && opEditIdx < prevOps.length) {
      // Editar não mexe em resultado/status — isso só muda ao Finalizar a operação.
      newOps = [...prevOps];
      newOps[opEditIdx] = {...newOps[opEditIdx], estrategia:estrategiaNorm, time:opForm.time, observacao:opForm.observacao, hora:opForm.hora, ...extras};
    } else {
      // Toda operação nova nasce "Aberta" — o resultado real é lançado depois, ao Finalizar.
      novaOperacaoId = "op"+Date.now();
      newOps = [...prevOps, {id:novaOperacaoId, num:prevOps.length+1, estrategia:estrategiaNorm, time:opForm.time, resultado:null, observacao:opForm.observacao, hora:opForm.hora, status:"aberta", criadoEm:Date.now(), ...extras}];
    }
    setOperacoes(p=>({...p, [k]: newOps}));
    atualizarEntDeOps(k, newOps);
    setHistorico(p=>[...p,{tipo:opEditIdx!=null?"editar_op":"add_op",k,data:Date.now()}]);
    setLastEstrategia(estrategiaNorm);
    setLastTime(opForm.time);
    try{
      localStorage.setItem("bc:lastEstrategia", estrategiaNorm);
      localStorage.setItem("bc:lastTime", opForm.time);
    }catch(e){}
    if(opJogoOrigemId && novaOperacaoId) {
      setJogosDia(prev=>prev.map(j=>j.id===opJogoOrigemId?{...j,status:"OPERADO",operacaoId:novaOperacaoId,metodoOperado:opJogoMetodoOrigem||j.metodoOperado||null,atualizadoEm:Date.now()}:j));
    }
    setOpJogoOrigemId(null);
    setOpJogoMetodoOrigem(null);
    setShowAddOp(false);
  }

  function excluirOp(sem, dia, idx) {
    const k = kw(sem, dia);
    if(diaFechado(sem,dia)) { pedirSenha(()=>excluirOp(sem,dia,idx)); return; }
    const prevOps = (operacoes[k]||[]);
    const newOps = prevOps.filter((_,i)=>i!==idx).map((o,i)=>({...o,num:i+1}));
    if(newOps.length===0) {
      setOperacoes(p=>{const n={...p};delete n[k];return n;});
    } else {
      setOperacoes(p=>({...p, [k]:newOps}));
    }
    atualizarEntDeOps(k, newOps);
    setHistorico(p=>[...p,{tipo:"excluir_op",k,idx,data:Date.now()}]);
  }

  function duplicarOp(sem, dia, idx) {
    const k = kw(sem, dia);
    if(diaFechado(sem,dia)) { pedirSenha(()=>duplicarOp(sem,dia,idx)); return; }
    const prevOps = [...(operacoes[k]||[])];
    const orig = prevOps[idx];
    prevOps.splice(idx+1, 0, {...orig, id:"op"+Date.now(), num:0});
    const newOps = prevOps.map((o,i)=>({...o,num:i+1}));
    setOperacoes(p=>({...p, [k]:newOps}));
    atualizarEntDeOps(k, newOps);
    setHistorico(p=>[...p,{tipo:"dup_op",k,idx,data:Date.now()}]);
  }

  // ---- Finalização de operações abertas (Green/Red) ----
  function abrirFinalizarOp(sem, dia, idx) {
    if(diaFechado(sem,dia)) { pedirSenha(()=>abrirFinalizarOp(sem,dia,idx)); return; }
    const k = kw(sem, dia);
    const op = (operacoes[k]||[])[idx];
    setFinalizarAlvo({sem, dia, idx});
    setFinalizarTipo(null);
    setFinalizarValor("");
    setFinalizarMinuto(op && op.minutoSaida ? op.minutoSaida : "");
    setFinalizarErro("");
    setShowFinalizarOp(true);
  }

  function confirmarFinalizarOp() {
    if(!finalizarAlvo || !finalizarTipo) return;
    const v = finalizarValor.replace(",",".").replace(/\s/g,"");
    const n = Number(v);
    if(v===""||isNaN(n)||n<0) { setFinalizarErro("Informe um valor válido."); return; }
    // O usuário sempre digita um valor positivo — o sinal vem da escolha Green/Red.
    const sinal = finalizarTipo === "green" ? 1 : -1;
    const resultadoFinal = sinal * Math.abs(n);
    const statusFinal = finalizarTipo === "green" ? "green" : "red";
    const { sem, dia, idx } = finalizarAlvo;
    const k = kw(sem, dia);
    const prevOps = operacoes[k] ? [...operacoes[k]] : [];
    if(!prevOps[idx]) { setShowFinalizarOp(false); return; }
    const newOps = [...prevOps];
    // Minuto de saída se aplica a TODAS as operações (não só Lay).
    const minutoFinal = (finalizarMinuto||"").trim();
    const opAtualizada = {...newOps[idx], resultado:resultadoFinal, status:statusFinal, tipoFechamento:finalizarTipo, dataFechamento:Date.now()};
    if(minutoFinal) opAtualizada.minutoSaida = minutoFinal; else delete opAtualizada.minutoSaida;
    newOps[idx] = opAtualizada;
    setOperacoes(p=>({...p, [k]: newOps}));
    atualizarEntDeOps(k, newOps);
    setHistorico(p=>[...p,{tipo:"finalizar_op",k,idx,data:Date.now()}]);
    setShowFinalizarOp(false);
    setFinalizarAlvo(null);
    setFinalizarTipo(null);
    setFinalizarValor("");
    setFinalizarMinuto("");
    setFinalizarErro("");
  }

  function trocarCiclo(novoId) {
    if(novoId === cicloAtivo) return;
    const novo = ciclos.find(c => c.id === novoId);
    if(!novo) return;
    setCiclos(prev => prev.map(c =>
      c.id === cicloAtivo ? {...c, cap, dataIni:tISO(dataIni), ent, fechados, senha:senhaAdmin, historico, movimentacoes, saquesConfirmados, operacoes} : c
    ));
    setCicloAtivo(novoId);
    setCap(novo.cap); setInpCap(String(novo.cap));
    setDataIni(pISO(novo.dataIni));
    setEnt(novo.ent||{}); setFechados(novo.fechados||{});
    setSenhaAdmin(novo.senha||""); setHistorico(novo.historico||[]);
    setMovimentacoes(novo.movimentacoes||[]); setSaquesConfirmados(novo.saquesConfirmados||{}); setOperacoes(novo.operacoes||{});
    setSemAtual(null); setFocoDia(null); setSelDia(null); setSelMes(0);
  }

  function criarNovoCiclo() {
    const id = "c" + Date.now();
    const nc = {
      id, nome: ncNome || "Ciclo " + (ciclos.length + 1),
      dataIni: ncIni, cap: Number(ncCap) || 200, status: "ativo",
      diasPorSemana: 7, saqueIntervalo: ncSaqueIntervalo, saqPct: (Number(ncSaq) || 30) / 100,
      tiers: ncTiers.map(t => ({...t})),
      ent: {}, fechados: {}, historico: [], senha: "", operacoes: {}
    };
    setCiclos(prev => [...prev, nc]);
    setCicloAtivo(id);
    setCap(nc.cap); setInpCap(String(nc.cap));
    setDataIni(pISO(nc.dataIni));
    setEnt({}); setFechados({}); setSenhaAdmin(""); setHistorico([]); setOperacoes({});
    setShowNovoCiclo(false); setSemAtual(null); setFocoDia(null); setSelDia(null); setSelMes(0);
    setNcNome(""); setNcCap("200"); setNcIni(tISO(new Date()));
    setNcDias(7); setNcSaq("30");
    setNcTiers([{dias:30,taxa:0.06,label:"Mês 1"},{dias:30,taxa:0.05,label:"Mês 2"},{dias:30,taxa:0.04,label:"Mês 3"}]);
  }

  function excluirCiclo(id) {
    if(ciclos.length <= 1) return;
    const novos = ciclos.filter(c => c.id !== id);
    setCiclos(novos);
    if(cicloAtivo === id) {
      const proxC = novos[0];
      setCicloAtivo(proxC.id);
      setCap(proxC.cap); setInpCap(String(proxC.cap));
      setDataIni(pISO(proxC.dataIni));
      setEnt(proxC.ent||{}); setFechados(proxC.fechados||{});
      setSenhaAdmin(proxC.senha||""); setHistorico(proxC.historico||[]);
    }
  }

  function encerrarCiclo() {
    let totalLucro=0, totalSaque=0, diasOperados=0, diasComLucro=0;
    let melhorDia={soma:0,data:null}, piorDia={soma:0,data:null};
    for(const sem of semanas) {
      for(const d of sem.dias) {
        if(d.tem && d.soma!==0) {
          diasOperados++;
          totalLucro += d.soma;
          if(d.soma>0) diasComLucro++;
          if(d.soma>melhorDia.soma) melhorDia={soma:d.soma,data:d.date};
          if(d.soma<piorDia.soma) piorDia={soma:d.soma,data:d.date};
        }
      }
      totalSaque += sem.saque;
    }
    const bancaFinalCalc = semanas.length>0 ? semanas[semanas.length-1].prox : cap;
    const bancaFinal = encSaldoFinal ? Number(encSaldoFinal.replace(",",".")) : bancaFinalCalc;
    const valorSacado = encValorSacado ? Number(encValorSacado.replace(",",".")) : totalSaque;
    const valorPermanece = encValorPermanece ? Number(encValorPermanece.replace(",",".")) : Math.max(0, bancaFinal - valorSacado);
    const winRate = diasOperados>0 ? Math.round(diasComLucro/diasOperados*100) : 0;
    const totalSaqEmergCalc = movimentacoes.filter(m=>m.tipo==="saque_emergencial").reduce((s,m)=>s+m.valor,0);
    const totalDepCalc = movimentacoes.filter(m=>m.tipo==="deposito").reduce((s,m)=>s+m.valor,0);
    const res = {
      bancaFinal, totalLucro, totalSaque, winRate, diasOperados,
      valorSacado, valorPermanece, totalSaqEmerg: totalSaqEmergCalc, totalDepositos: totalDepCalc,
      melhorDia:{soma:melhorDia.soma, data:melhorDia.data?fd(melhorDia.data):"—"},
      piorDia:{soma:piorDia.soma, data:piorDia.data&&piorDia.soma<0?fd(piorDia.data):"—"},
      dataEncerramento: tISO(new Date())
    };
    setResultadoEnc(res);
    setCiclos(prev=>prev.map(c=>c.id===cicloAtivo?{
      ...c, status:"encerrado",
      dataEncerramento: tISO(new Date()),
      resultados: res
    }:c));
    setShowWizardEnc(false);
    setShowEncerrarCiclo(true);
    setEncSaldoFinal(""); setEncValorSacado(""); setEncValorPermanece("");
  }

  function criarNovoCicloAposEncerramento() {
    if(!resultadoEnc) return;
    const novaBanca = resultadoEnc.valorPermanece || Math.max(0, resultadoEnc.bancaFinal - resultadoEnc.totalSaque);
    const id = "c" + Date.now();
    const nc = {
      id, nome: "Ciclo " + (ciclos.length + 1),
      dataIni: tISO(new Date()), cap: Math.round(novaBanca), status: "ativo",
      diasPorSemana: cicloCfg?.diasPorSemana || D5,
      saqPct: cicloCfg?.saqPct || SAQ,
      tiers: (cicloCfg?.tiers || TIERS_PADRAO).map(t=>({...t})),
      ent: {}, fechados: {}, historico: [], senha: "", operacoes: {}
    };
    setCiclos(prev => [...prev, nc]);
    setCicloAtivo(id);
    setCap(nc.cap); setInpCap(String(nc.cap));
    setDataIni(pISO(nc.dataIni));
    setEnt({}); setFechados({}); setSenhaAdmin(""); setHistorico([]); setMovimentacoes([]);
    setSemAtual(null); setFocoDia(null); setSelDia(null); setSelMes(0);
    setShowEncerrarCiclo(false); setResultadoEnc(null);
  }

  function reabrirCiclo(id) {
    pedirSenha(()=>{
      setCiclos(prev=>prev.map(c=>c.id===id?{...c,status:"ativo",dataEncerramento:undefined,resultados:undefined}:c));
    });
  }

  function abrirEditarCiclo(id) {
    const c = ciclos.find(x=>x.id===id);
    if(!c) return;
    setEditCicloId(id);
    setEcNome(c.nome);
    setEcCap(String(c.cap));
    setEcDias(c.diasPorSemana||7);
     setEcSaqueIntervalo(c.saqueIntervalo!==undefined ? c.saqueIntervalo : (c.diasPorSemana||7));
    setEcSaq(String(Math.round((c.saqPct||0.3)*100)));
    setEcTiers(c.tiers.map(t=>({...t})));
    setShowEditarCiclo(true);
  }

  function salvarEditarCiclo() {
    if(!editCicloId) return;
    setCiclos(prev=>prev.map(c=>c.id===editCicloId?{
      ...c,
      nome: ecNome || c.nome,
      cap: Number(ecCap) || c.cap,
      diasPorSemana: 7,
      saqueIntervalo: ecSaqueIntervalo,
      saqPct: (Number(ecSaq)||30)/100,
      tiers: ecTiers.map(t=>({...t}))
    }:c));
    if(editCicloId===cicloAtivo) {
      const nc = ciclos.find(c=>c.id===editCicloId);
      if(nc) {
        setCap(Number(ecCap)||nc.cap);
        setInpCap(String(Number(ecCap)||nc.cap));
      }
    }
    setShowEditarCiclo(false);
    setEditCicloId(null);
  }

  function registrarMovimentacao() {
    const val = Number(movValor.replace(",","."));
    if(isNaN(val) || val<=0) return;
    const mov = {
      id: "m"+Date.now(),
      tipo: movTipo,
      valor: val,
      data: tISO(new Date()),
      hora: new Date().toTimeString().slice(0,5),
      nota: movNota || ""
    };
    setMovimentacoes(prev=>[...prev, mov]);
    if(movTipo==="aporte") {
      setCap(prev=>prev+val);
      setInpCap(String(cap+val));
    } else if(movTipo==="retirada") {
      setCap(prev=>Math.max(0,prev-val));
      setInpCap(String(Math.max(0,cap-val)));
    }
    setHistorico(prev=>[...prev,{tipo:"mov_"+movTipo,valor:val,data:Date.now(),nota:mov.nota}]);
    setMovValor(""); setMovNota(""); setShowNovaMov(false);
  }

  // Marca que o saque semanal (30% do lucro, já calculado pelo espelho) foi
  // REALMENTE efetuado na vida real. Isto é apenas um registro informativo:
  // não desconta valor nenhum de novo, não mexe no Espelho, não mexe na
  // regra dos 30% e não recalcula nenhuma projeção — essas continuam
  // exatamente como já eram calculadas antes.
  function confirmarSaqueSemanal(semanaIdx, valor) {
    if(!(valor>0)) return;
    if(saquesConfirmados[semanaIdx]) return; // já confirmado, evita duplicar
    setSaquesConfirmados(prev=>({
      ...prev,
      [semanaIdx]: { data: tISO(new Date()), hora: new Date().toTimeString().slice(0,5), valor }
    }));
    setHistorico(prev=>[...prev,{tipo:"saque_semanal_efetuado",semana:semanaIdx+1,valor,data:Date.now()}]);
    setConfirmandoSaqueSemana(false);
  }

  function registrarSaqueEmergencial() {
    const val = Number(saqEmergValor.replace(",","."));
    if(isNaN(val) || val<=0) return;
    const mov = {
      id: "se"+Date.now(),
      tipo: "saque_emergencial",
      valor: val,
      data: tISO(new Date()),
      hora: new Date().toTimeString().slice(0,5),
      nota: saqEmergNota || "Saque emergencial"
    };
    setMovimentacoes(prev=>[...prev, mov]);
    setHistorico(prev=>[...prev,{tipo:"mov_saque_emergencial",valor:val,data:Date.now(),nota:mov.nota}]);
    setSaqEmergValor(""); setSaqEmergNota(""); setShowSaqEmerg(false);
  }

  function registrarDeposito() {
    const val = Number(depValor.replace(",","."));
    if(isNaN(val) || val<=0) return;
    const mov = {
      id: "dep"+Date.now(),
      tipo: "deposito",
      valor: val,
      data: tISO(new Date()),
      hora: new Date().toTimeString().slice(0,5),
      nota: depNota || "Depósito para reposição"
    };
    setMovimentacoes(prev=>[...prev, mov]);
    setHistorico(prev=>[...prev,{tipo:"mov_deposito",valor:val,data:Date.now(),nota:mov.nota}]);
    setDepValor(""); setDepNota(""); setShowDeposito(false);
  }

  const diaAtual = focoDia || hj;
  const totalSaq = semanas.reduce((s,sem) => s + sem.saque, 0);
  const totalSaqEmerg = movimentacoes.filter(m=>m.tipo==="saque_emergencial").reduce((s,m)=>s+m.valor,0);
  const totalDepositos = movimentacoes.filter(m=>m.tipo==="deposito").reduce((s,m)=>s+m.valor,0);

  // Central de análises: filtros, rankings, combinações e horários.
  const graficosData = useMemo(() => {
    const porTime={}, porEstrategia={}, porDia={}, porHora={}, porCombo={}, porMetodo={}, porEstrategiaBase={}, porMinuto={};
    const porMomento={
      antes:{nome:"Antes do intervalo",ops:0,greens:0,reds:0,lucro:0},
      apos:{nome:"Após o intervalo",ops:0,greens:0,reds:0,lucro:0}
    };
    const diasNome={0:"Domingo",1:"Segunda",2:"Terça",3:"Quarta",4:"Quinta",5:"Sexta",6:"Sábado"};
    const hoje=new Date(); hoje.setHours(23,59,59,999);
    let iniFiltro=null, fimFiltro=hoje;
    if(grafPeriodo==="7") { iniFiltro=new Date(hoje); iniFiltro.setDate(iniFiltro.getDate()-6); iniFiltro.setHours(0,0,0,0); }
    if(grafPeriodo==="30") { iniFiltro=new Date(hoje); iniFiltro.setDate(iniFiltro.getDate()-29); iniFiltro.setHours(0,0,0,0); }
    if(grafPeriodo==="personalizado") {
      iniFiltro=grafDataIni?pISO(grafDataIni):null;
      fimFiltro=grafDataFim?pISO(grafDataFim):hoje; if(fimFiltro) fimFiltro.setHours(23,59,59,999);
    }
    function somar(map,chave,r){
      chave=(chave||"Não informado").trim()||"Não informado";
      if(!map[chave]) map[chave]={nome:chave,lucro:0,greens:0,reds:0,voids:0,ops:0};
      const a=map[chave]; a.lucro+=r; a.ops++; if(r>0)a.greens++; else if(r<0)a.reds++; else a.voids++;
    }
    const fontes = grafPeriodo==="ciclo" ? ciclos.filter(c=>c.id===cicloAtivo) : ciclos;
    let totalOps=0;
    let somaEsperado=0, somaRealizado=0, qtdComEsperado=0;
    for(const c of fontes){
      const dps=c.diasPorSemana||7, inicio=pISO(c.dataIni), opsMap=c.operacoes||{};
      for(const k in opsMap){
        const [w,d]=k.split("-").map(Number); if(isNaN(w)||isNaN(d)) continue;
        const data=new Date(inicio); data.setDate(data.getDate()+w*dps+d); data.setHours(12,0,0,0);
        if(iniFiltro && data<iniFiltro) continue; if(fimFiltro && data>fimFiltro) continue;
        for(const op of opsMap[k]||[]){
          if(op.status==="aberta") continue;
          const r=Number(op.resultado)||0, time=(op.time||"Não informado").trim()||"Não informado", est=normEstrategia(op.estrategia)||"Não informado";
          somar(porTime,time,r); somar(porEstrategia,est,r); somar(porDia,diasNome[data.getDay()],r);
          const h=parseInt((op.hora||"").split(":")[0],10);
          const faixa=isNaN(h)?"Sem horário":h<12?"Manhã (00–11h)":h<18?"Tarde (12–17h)":"Noite (18–23h)";
          somar(porHora,faixa,r); somar(porCombo,`${time} · ${est} · ${diasNome[data.getDay()]}`,r); totalOps++;
          if(op.tipo) somar(porMetodo, op.tipo==="BACK"?"Back":op.tipo==="LAY"?"Lay":op.tipo, r);
          if(op.estrategiaBase) somar(porEstrategiaBase, op.estrategiaBase, r);
          if(op.minutoSaida) {
            somar(porMinuto, rotuloMinuto(op.minutoSaida), r);
            const minMomento=parseInt(String(op.minutoSaida).replace(/\D/g,""),10);
            if(!isNaN(minMomento)) {
              const alvoMomento = minMomento<=45 ? porMomento.antes : porMomento.apos;
              alvoMomento.ops++; alvoMomento.lucro+=r;
              if(r>0) alvoMomento.greens++; else if(r<0) alvoMomento.reds++;
            }
          }
          if(op.lucroPossivel!=null && !isNaN(Number(op.lucroPossivel))) { somaEsperado += Number(op.lucroPossivel); somaRealizado += r; qtdComEsperado++; }
        }
      }
    }
    const arr=obj=>Object.values(obj).map(x=>{const wr=(x.greens+x.reds)>0?Math.round(x.greens/(x.greens+x.reds)*100):0; return {...x,winRate:wr,score:x.ops>=3?Math.round(wr*0.45+Math.min(x.ops,20)*2+Math.max(-20,Math.min(20,x.lucro))*0.75):0};});
    return {
      times:arr(porTime),estrategias:arr(porEstrategia),dias:arr(porDia),horarios:arr(porHora),combos:arr(porCombo),
      metodos:arr(porMetodo), estrategiasBase:arr(porEstrategiaBase), minutos:arr(porMinuto),
      momentoSaida: {
        antes: {...porMomento.antes, winRate:(porMomento.antes.greens+porMomento.antes.reds)>0?Math.round(porMomento.antes.greens/(porMomento.antes.greens+porMomento.antes.reds)*100):0},
        apos: {...porMomento.apos, winRate:(porMomento.apos.greens+porMomento.apos.reds)>0?Math.round(porMomento.apos.greens/(porMomento.apos.greens+porMomento.apos.reds)*100):0}
      },
      mediaEsperado: qtdComEsperado>0 ? somaEsperado/qtdComEsperado : null,
      mediaRealizado: qtdComEsperado>0 ? somaRealizado/qtdComEsperado : null,
      totalOps,
    };
  },[ciclos,cicloAtivo,grafPeriodo,grafDataIni,grafDataFim]);


  function usoEstrategia(nome) {
    let n=0;
    for(const c of ciclos) {
      const ops=c.operacoes||{};
      for(const k in ops) for(const o of ops[k]) if(o.estrategia===nome) n++;
    }
    // O módulo Método de Ciclos possui sua própria lista de operações.
    for(const c of (estratCiclos||[])) {
      for(const o of (c.operacoes||[])) if(o.estrategia===nome) n++;
    }
    return n;
  }

  function usoTime(nome) {
    let n=0;
    for(const c of ciclos) {
      const ops=c.operacoes||{};
      for(const k in ops) for(const o of ops[k]) if(o.time===nome) n++;
    }
    return n;
  }

  function adicionarEstrategia(nome) {
    nome=(nome||"").trim();
    if(!nome) { setEstratMsg("Digite o nome da estratégia."); return false; }
    nome=normEstrategia(nome);
    const existente=estrategias.find(e=>normEstrategia(e.nome)===nome);
    if(existente) {
      if(existente.ativa===false) setEstrategias(p=>p.map(e=>e.id===existente.id?{...e,ativa:true}:e));
      setEstratNome(existente.nome);
      setEstratMsg(`✓ ${existente.nome} já estava cadastrada e foi selecionada.`);
      try{localStorage.setItem("bc:lastEstrategia",existente.nome);localStorage.setItem("bc:estratNome",existente.nome);}catch(e){}
      return true;
    }
    const nova={id:"e"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),nome,ativa:true};
    setEstrategias(p=>[...p,nova]);
    setEstratNome(nome);
    setLastEstrategia(nome);
    setEstratMsg(`✓ Estratégia “${nome}” adicionada e selecionada.`);
    try{
      localStorage.setItem("bc:estrategias",JSON.stringify([...estrategias,nova]));
      localStorage.setItem("bc:lastEstrategia",nome);
      localStorage.setItem("bc:estratNome",nome);
    }catch(e){}
    return true;
  }

  function adicionarTime(nome) {
    nome=(nome||"").trim();
    if(!nome) return;
    if(!times.some(e=>e.nome.toLowerCase()===nome.toLowerCase())) {
      setTimes(p=>[...p,{id:"t"+Date.now(),nome,ativa:true}]);
    }
  }


  function salvarEstratEdit(id, novoNome) {
    const antiga = estrategias.find(e=>e.id===id);
    if(!antiga) return;
    novoNome=normEstrategia(novoNome);
    if(!novoNome) return;
    setEstrategias(p=>p.map(e=>e.id===id?{...e,nome:novoNome}:e));
    if(antiga.nome!==novoNome) {
      const ant=antiga.nome;
      setOperacoes(prev=>{
        const n={};
        for(const k in prev) n[k]=prev[k].map(o=>o.estrategia===ant?{...o,estrategia:novoNome}:o);
        return n;
      });
      setCiclos(prev=>prev.map(c=>{
        if(c.id===cicloAtivo) return c;
        const ops=c.operacoes||{};
        let mudou=false; const novas={};
        for(const k in ops) { novas[k]=ops[k].map(o=>{ if(o.estrategia===ant){mudou=true;return {...o,estrategia:novoNome};} return o;}); }
        return mudou?{...c,operacoes:novas}:c;
      }));
      setEstratCiclos(prev=>prev.map(c=>({
        ...c,
        operacoes:(c.operacoes||[]).map(o=>o.estrategia===ant?{...o,estrategia:novoNome}:o)
      })));
      if(lastEstrategia===antiga.nome) { setLastEstrategia(novoNome); try{localStorage.setItem("bc:lastEstrategia",novoNome);}catch(e){} }
    }
  }

  function salvarTimeEdit(id, novoNome) {
    const antiga = times.find(e=>e.id===id);
    if(!antiga) return;
    novoNome=(novoNome||"").trim();
    if(!novoNome) return;
    setTimes(p=>p.map(e=>e.id===id?{...e,nome:novoNome}:e));
    if(antiga.nome!==novoNome) {
      const ant=antiga.nome;
      setOperacoes(prev=>{
        const n={};
        for(const k in prev) n[k]=prev[k].map(o=>o.time===ant?{...o,time:novoNome}:o);
        return n;
      });
      setCiclos(prev=>prev.map(c=>{
        if(c.id===cicloAtivo) return c;
        const ops=c.operacoes||{};
        let mudou=false; const novas={};
        for(const k in ops) { novas[k]=ops[k].map(o=>{ if(o.time===ant){mudou=true;return {...o,time:novoNome};} return o;}); }
        return mudou?{...c,operacoes:novas}:c;
      }));
      if(lastTime===antiga.nome) { setLastTime(novoNome); try{localStorage.setItem("bc:lastTime",novoNome);}catch(e){} }
    }
  }

  function excluirEstrategia(id) {
    const e = estrategias.find(x=>x.id===id);
    if(!e) return;
    if(usoEstrategia(e.nome)>0) { alert("Esta estratégia já foi utilizada em operações e não pode ser excluída. Você pode desativá-la."); return; }
    setEstrategias(p=>p.filter(x=>x.id!==id));
    if(editEstr && editEstr.id===id) setEditEstr(null);
  }

  function excluirTime(id) {
    const e = times.find(x=>x.id===id);
    if(!e) return;
    if(usoTime(e.nome)>0) { alert("Este time já foi utilizado em operações e não pode ser excluído. Você pode desativá-lo."); return; }
    setTimes(p=>p.filter(x=>x.id!==id));
    if(editTime && editTime.id===id) setEditTime(null);
  }

  function resumoCiclo(c) {
    if(!c) return null;
    const cfg={tiers:c.tiers, diasPorSemana:c.diasPorSemana||7, saqueIntervalo:(c.saqueIntervalo!==undefined?c.saqueIntervalo:(c.diasPorSemana||7)), saqPct:c.saqPct||0.3};
    const sems=calc(c.cap, pISO(c.dataIni), c.ent||{}, false, cfg);
    const opsMap=c.operacoes||{};
    const r={ cap:c.cap, dataIni:c.dataIni, dataEncerramento:c.dataEncerramento||null,
      diasOperados:0, totalLucro:0, melhorDia:null, piorDia:null,
      totalOps:0, greens:0, reds:0, voids:0, abertas:0,
      porEstrategia:{}, porTime:{}, diasList:[], porDia:{}, sems };
    for(let w=0;w<sems.length;w++) {
      const sem=sems[w];
      for(let d=0;d<sem.dias.length;d++) {
        const dia=sem.dias[d];
        if(dia.tem && dia.soma!==0) {
          r.diasOperados++; r.totalLucro+=dia.soma;
          if(!r.melhorDia||dia.soma>r.melhorDia.soma) r.melhorDia={soma:dia.soma,data:dia.date};
          if(!r.piorDia||dia.soma<r.piorDia.soma) r.piorDia={soma:dia.soma,data:dia.date};
        }
        r.diasList.push(dia);
        const ky=kw(w,d);
        const ops=opsMap[ky]||[];
        r.porDia[ky]=ops;
        for(const o of ops) {
          r.totalOps++;
          if(o.status==="aberta") { r.abertas++; }
          else if(o.resultado>0) r.greens++; else if(o.resultado<0) r.reds++; else r.voids++;
          const e=normEstrategia(o.estrategia)||"Não informado";
          r.porEstrategia[e]=r.porEstrategia[e]||{lucro:0,count:0}; r.porEstrategia[e].lucro+=(o.resultado||0); r.porEstrategia[e].count++;
          const t=o.time||"Não informado";
          r.porTime[t]=r.porTime[t]||{lucro:0,count:0}; r.porTime[t].lucro+=(o.resultado||0); r.porTime[t].count++;
        }
      }
    }
    r.bancaFinal=sems.length>0?sems[sems.length-1].prox:c.cap;
    r.totalSaque=sems.reduce((s,sm)=>s+sm.saque,0);
    r.rentabilidade=c.cap>0?((r.bancaFinal/c.cap)-1)*100:0;
    r.movimentacoes=c.movimentacoes||[];
    r.totalSaqEmerg=r.movimentacoes.filter(m=>m.tipo==="saque_emergencial").reduce((s,m)=>s+m.valor,0);
    r.totalDepositos=r.movimentacoes.filter(m=>m.tipo==="deposito").reduce((s,m)=>s+m.valor,0);
    r.totalAportes=r.movimentacoes.filter(m=>m.tipo==="aporte").reduce((s,m)=>s+m.valor,0);
    r.totalRetiradas=r.movimentacoes.filter(m=>m.tipo==="retirada").reduce((s,m)=>s+m.valor,0);
    const totalFechadas = r.totalOps - r.abertas;
    r.taxaAcerto=totalFechadas>0?Math.round(r.greens/totalFechadas*100):0;
    r.melhorEstrategia=Object.entries(r.porEstrategia).sort((a,b)=>b[1].lucro-a[1].lucro)[0]||null;
    r.melhorTime=Object.entries(r.porTime).sort((a,b)=>b[1].lucro-a[1].lucro)[0]||null;
    return r;
  }

  const cicloObjAtivo = ciclos.find(x => x.id === cicloAtivo);
  const resumoAtivo = resumoCiclo(cicloObjAtivo);

  const chaveHoje = tISO(new Date());
  const planosHoje = (planejamentosDia[chaveHoje]||[]).slice().sort((a,b)=>(a.hora||"99:99").localeCompare(b.hora||"99:99"));

  function abrirNovoPlanoHoje() {
    const agora=new Date();
    const prox=new Date(agora.getTime()+60*60000);
    const hora=`${String(prox.getHours()).padStart(2,"0")}:${String(Math.floor(prox.getMinutes()/5)*5).padStart(2,"0")}`;
    setPlanoEditId(null);
    setPlanoForm({time:"",adversario:"",hora,estrategia:lastEstrategia||"BACK FAVORITO",pretendo:"",lembrete:15});
    setShowPlanoHoje(true);
  }

  function editarPlanoHoje(p) {
    setPlanoEditId(p.id);
    setPlanoForm({time:p.time||"",adversario:p.adversario||"",hora:p.hora||"",estrategia:p.estrategia||"BACK FAVORITO",pretendo:p.pretendo||"",lembrete:Number(p.lembrete)||15});
    setShowPlanoHoje(true);
  }

  function salvarPlanoHoje() {
    const time=(planoForm.time||"").trim();
    const hora=(planoForm.hora||"").trim();
    const estrategia=normEstrategia(planoForm.estrategia||"");
    if(!time) { alert("Informe o time que você pretende trabalhar."); return; }
    if(!hora) { alert("Informe o horário do jogo."); return; }
    const id=planoEditId||("pl"+Date.now());
    const anterior=(planejamentosDia[chaveHoje]||[]).find(x=>x.id===id);
    const item={
      id,time,adversario:(planoForm.adversario||"").trim(),hora,estrategia:estrategia||"Não informada",
      pretendo:(planoForm.pretendo||"").trim(),lembrete:Number(planoForm.lembrete)||15,
      concluido:anterior?.concluido||false,criadoEm:anterior?.criadoEm||Date.now(),atualizadoEm:Date.now()
    };
    setPlanejamentosDia(prev=>{
      const lista=[...(prev[chaveHoje]||[])];
      const idx=lista.findIndex(x=>x.id===id);
      if(idx>=0) lista[idx]=item; else lista.push(item);
      lista.sort((a,b)=>(a.hora||"99:99").localeCompare(b.hora||"99:99"));
      return {...prev,[chaveHoje]:lista};
    });
    adicionarTime(time);
    if(estrategia) adicionarEstrategia(estrategia);
    setLastTime(time); if(estrategia) setLastEstrategia(estrategia);
    setShowPlanoHoje(false); setPlanoEditId(null);
  }

  function alternarPlanoConcluido(id) {
    setPlanejamentosDia(prev=>({...prev,[chaveHoje]:(prev[chaveHoje]||[]).map(p=>p.id===id?{...p,concluido:!p.concluido,atualizadoEm:Date.now()}:p)}));
  }

  function excluirPlanoHoje(id) {
    if(!confirm("Remover este time do planejamento de hoje?")) return;
    setPlanejamentosDia(prev=>({...prev,[chaveHoje]:(prev[chaveHoje]||[]).filter(p=>p.id!==id)}));
  }

  function estatisticasDoPlano(plano) {
    const estNorm=normEstrategia(plano.estrategia||"");
    const timeNorm=normBusca(plano.time||"");
    const est={count:0,greens:0,lucro:0,intervalo:{count:0,lucro:0},posIntervalo:{count:0,lucro:0}};
    const combo={count:0,greens:0,lucro:0};
    for(const c of ciclos) {
      const mapa=c.id===cicloAtivo ? operacoes : (c.operacoes||{});
      for(const k in mapa) for(const o of (mapa[k]||[])) {
        if(o.status==="aberta" || o.resultado==null) continue;
        const r=Number(o.resultado)||0;
        const mesmaEst=estNorm && normEstrategia(o.estrategia||"")===estNorm;
        if(mesmaEst) {
          est.count++; est.lucro+=r; if(r>0) est.greens++;
          const min=parseInt(String(o.minutoSaida||"").replace(/\D/g,""),10);
          if(!isNaN(min)) {
            const alvo=min<=45?est.intervalo:est.posIntervalo;
            alvo.count++; alvo.lucro+=r;
          }
        }
        if(mesmaEst && timeNorm && normBusca(o.time||"")===timeNorm) {
          combo.count++; combo.lucro+=r; if(r>0) combo.greens++;
        }
      }
    }
    est.wr=est.count?Math.round(est.greens/est.count*100):0;
    combo.wr=combo.count?Math.round(combo.greens/combo.count*100):0;
    return {est,combo};
  }

  function insightsDoPlano(plano) {
    const {est,combo}=estatisticasDoPlano(plano);
    const msgs=[];
    if(combo.count>=3) {
      msgs.push({tipo:combo.lucro>0?"good":combo.lucro<0?"bad":"warn",texto:`${plano.time} + ${plano.estrategia}: ${combo.count} operações, ${combo.wr}% de acerto e ${combo.lucro>=0?"+":""}${fmt(combo.lucro)}.`});
    } else if(est.count>=3) {
      if(est.lucro<0) msgs.push({tipo:"bad",texto:`Atenção: ${plano.estrategia} está negativa no histórico: ${fmt(est.lucro)} em ${est.count} operações (${est.wr}% WR).`});
      else msgs.push({tipo:"good",texto:`${plano.estrategia}: ${est.count} operações, ${est.wr}% de acerto e +${fmt(est.lucro)} no histórico.`});
    } else {
      msgs.push({tipo:"warn",texto:`Ainda há poucos dados de ${plano.estrategia} para gerar um alerta confiável.`});
    }
    if(normEstrategia(plano.estrategia||"").includes("BACK FAVORITO") && est.intervalo.count>=2 && est.posIntervalo.count>=2) {
      const mediaInt=est.intervalo.lucro/est.intervalo.count;
      const mediaPos=est.posIntervalo.lucro/est.posIntervalo.count;
      if(mediaInt>mediaPos*1.15 || (mediaInt>0 && mediaPos<=0)) {
        msgs.push({tipo:"good",texto:`Padrão encontrado: BACK FAVORITO rende melhor com saída até o intervalo (${fmt(mediaInt)} por operação) do que depois (${fmt(mediaPos)}).`});
      } else if(mediaPos>mediaInt*1.15 || (mediaPos>0 && mediaInt<=0)) {
        msgs.push({tipo:"warn",texto:`No seu histórico, BACK FAVORITO tem rendido melhor após o intervalo (${fmt(mediaPos)} por operação) do que até 45' (${fmt(mediaInt)}).`});
      }
    }
    return msgs.slice(0,2);
  }

  async function ativarLembretesPlanejamento() {
    if(!("Notification" in window)) { alert("Este navegador não oferece notificações locais."); return; }
    if(Notification.permission==="granted") { alert("Lembretes do navegador já estão ativados."); return; }
    try {
      const r=await Notification.requestPermission();
      if(r==="granted") alert("Lembretes ativados. O app avisará perto do horário planejado enquanto estiver em execução.");
      else alert("A permissão de notificações não foi liberada. Os avisos continuarão aparecendo dentro do app.");
    } catch(e) { alert("Não foi possível ativar notificações neste navegador."); }
  }

  function abrirOperacaoDoPlano(plano) {
    if(!hj) { alert("O dia de hoje ainda não está dentro do ciclo ativo."); return; }
    abrirAddOp(hj.semana,hj.dia,null);
    const est=normEstrategia(plano.estrategia||"");
    const metodo=est.startsWith("LAY")?"LAY":est.startsWith("BACK")?"BACK":"";
    let base="";
    if(est.includes("FAVORITO")) base="Favorito";
    else if(est.includes("ZEBRA")) base="Zebra";
    else if(est.includes("VARIOS RESULTADOS")) base="Vários Resultados";
    else if(est.includes("TOTAL DE GOLS")) base="Total de Gols";
    else if(est.includes("PLACAR")) base="Placar Correto";
    setOpForm(prev=>({...prev,metodo:metodo||prev.metodo,estrategiaBase:base||prev.estrategiaBase,time:plano.time||prev.time,hora:plano.hora||prev.hora,observacao:[plano.pretendo,`Planejado: ${plano.estrategia}`].filter(Boolean).join(" · ")}));
  }


  // ===== FUNÇÕES DO BANCO DE OPORTUNIDADES / DICAS DE HOJE =====
  const MERCADOS_JOGOS = [
    {id:"over25",rotulo:"Over 2,5",curto:"OVER"},{id:"under25",rotulo:"Under 2,5",curto:"UNDER"},
    {id:"btts",rotulo:"BTTS",curto:"BTTS"},{id:"golHT",rotulo:"Gol HT",curto:"GOL HT"},
    {id:"favoritoHT",rotulo:"Fav. HT",curto:"FAV HT"},{id:"primeiroGolFavorito",rotulo:"1º Gol Fav.",curto:"1º GOL"}
  ];
  const numPctJogo=v=>typeof v==="number"?v:(String(v).toUpperCase()==="N/D"?null:(()=>{const n=Number(String(v).replace(/[^\d.]/g,""));return isNaN(n)?null:n;})());
  const confiancaPeso=j=>normBusca(j.confianca)==="alta"?6:normBusca(j.confianca)==="media"?2:normBusca(j.confianca)==="baixa"?-2:0;
  const scoreMercadoJogo=(j,campo)=>{const n=numPctJogo(j[campo]);return n==null?-999:n+confiancaPeso(j);};
  const metodosPorEntrada=j=>classificarMetodosDoTexto(j?.entradaSugerida||"",j?.mandante,j?.visitante,j?.favorito,j?.entradaSugerida||"");
  const metodosDoJogo=j=>Array.from(new Set([...(Array.isArray(j?.metodos)?j.metodos:[]),...metodosPorEntrada(j)]));
  const notaDoMetodo=(j,metodo)=>{
    const n=j?.notasMetodo?.[metodo];
    if(n!==null&&n!==undefined&&!isNaN(Number(n))) return Number(n);
    // Se há notas contextualizadas para outros métodos, não reaproveite a maior nota
    // como se fosse válida para este método específico.
    if(j?.notasMetodo && Object.keys(j.notasMetodo).length) return null;
    const geral=Number(j?.nota); return isNaN(geral)?null:geral;
  };
  const percentualDoMetodo=(j,metodo)=>{
    if(metodo==="back_favorito") return numPctJogo(j?.primeiroGolFavorito);
    if(metodo==="under_gols") return numPctJogo(j?.under25);
    if(metodo==="gol_ht") return numPctJogo(j?.golHT);
    if(metodo==="over_btts") { const a=numPctJogo(j?.over25),b=numPctJogo(j?.btts); return a==null?b:b==null?a:Math.max(a,b); }
    return null;
  };

  function jogoVazio(data=undefined,imagem=null) {
    return {id:"jg_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7),data:data||jogosDataFiltro||tISO(new Date()),horario:"N/D",mandante:"N/D",visitante:"N/D",favorito:"N/D",over25:"N/D",under25:"N/D",btts:"N/D",golHT:"N/D",favoritoHT:"N/D",primeiroGolFavorito:"N/D",entradaSugerida:"N/D",confianca:"N/D",nota:null,classificacoes:[],estatisticas:[],metodos:[],timesMetodo:{},analiseInicial:"",atualizacoes:[],leituraFinal:null,observacoes:"",status:"PENDENTE",statusLeitura:"REVISAR",errosLeitura:["Preencha os dois times e selecione ao menos um método."],lembreteAtivo:false,lembreteMin:30,imagemId:imagem?.id||null,imagemNome:imagem?.nome||"N/D",criadoEm:Date.now(),atualizadoEm:Date.now(),origem:"MANUAL"};
  }

  // ===== ENTRADA AO VIVO POR PRINT =====
  // Lê um print da casa/placar, identifica os dois times, usa a menor odd entre
  // casa e fora como favorito e abre a Nova Operação já em BACK + Favorito.
  // O parser é tolerante a OCR que quebra LIVE e as 3 odds em linhas separadas.
  function parseEntradaAoVivoOCR(texto) {
    const raw=String(texto||"").replace(/\r/g,"\n");
    const linhas=raw.split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
    const extrairOdds=txt=>Array.from(String(txt||"").matchAll(/\b(\d{1,2}[.,]\d{1,3})\b/g))
      .map(m=>Number(m[1].replace(",","."))).filter(n=>isFinite(n)&&n>1.01&&n<100);

    const linhaEhLive=l=>/^(?:LIVE|L[I1]VE|LIV[E3])\b/i.test(String(l||"").trim());
    const linhaEhPre=l=>/^(?:PR[EÉ]|PRE|PR3)\b/i.test(String(l||"").trim());
    const coletarDepois=(idx,maxLinhas=9)=>{
      if(idx<0) return [];
      const bloco=[];
      for(let k=idx;k<linhas.length&&k<=idx+maxLinhas;k++){
        const ln=linhas[k];
        if(k>idx && /^(?:Ver\s+Mais\s+Odds|TOTAL|HT|Estat[ií]sticas|Esca|Suporte)\b/i.test(ln)) break;
        bloco.push(ln);
        const o=extrairOdds(bloco.join(" "));
        if(o.length>=3) return o.slice(0,3);
      }
      return extrairOdds(bloco.join(" ")).slice(0,3);
    };

    let odds=[], origemOdd="LIVE";
    const idxLive=linhas.findIndex(linhaEhLive);
    if(idxLive>=0) odds=coletarDepois(idxLive,10);

    // Fallback 1: usa a faixa entre LIVE e "Ver Mais Odds/TOTAL" mesmo se o OCR
    // não preservar as quebras de linha como esperado.
    if(odds.length<3) {
      const flat=linhas.join(" ");
      const ml=flat.match(/(?:LIVE|L[I1]VE|LIV[E3])\b([\s\S]*?)(?=Ver\s+Mais\s+Odds|\bTOTAL\b|\bHT\b|$)/i);
      if(ml){ const arr=extrairOdds(ml[1]); if(arr.length>=3) odds=arr.slice(0,3); }
    }

    // Fallback 2: dentro da área de preços pré-jogo/ao vivo, normalmente existem
    // 6 odds (3 PRE + 3 LIVE). Nesse caso as 3 últimas são as LIVE.
    if(odds.length<3) {
      const flat=linhas.join(" ");
      const ini=flat.search(/(?:PR[EÉ]|PRE|PR3)\b/i);
      if(ini>=0){
        const trecho=flat.slice(ini).split(/Ver\s+Mais\s+Odds|\bTOTAL\b|\bHT\b/i)[0];
        const arr=extrairOdds(trecho);
        if(arr.length>=6){ odds=arr.slice(-3); origemOdd="LIVE"; }
        else if(arr.length>=3){ odds=arr.slice(0,3); origemOdd="PRÉ"; }
      }
    }

    // Fallback 3: tenta explicitamente o PRE caso o LIVE não tenha sido reconhecido.
    if(odds.length<3) {
      const idxPre=linhas.findIndex(linhaEhPre);
      const pre=coletarDepois(idxPre,10);
      if(pre.length>=3){ odds=pre.slice(0,3); origemOdd="PRÉ"; }
    }
    odds=odds.slice(0,3);

    let mandante="", visitante="";
    const limparTime=t=>String(t||"")
      .replace(/\(\s*\d+\s*[º°oª]?\s*\)/gi,"")
      .replace(/\bAO\s+VIVO\b/gi,"")
      .replace(/\bLIVE\b/gi,"")
      .replace(/\b\d{1,3}\s*['’]\b/g,"")
      .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.'’\- ]+$/g,"")
      .replace(/\s+/g," ").trim();
    const pareceTime=t=>{
      const x=limparTime(t), n=normBusca(x);
      const letras=(x.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
      const digitos=(x.match(/\d/g)||[]).length;
      const palavras=x.split(/\s+/).filter(Boolean);
      // Evita que fragmentos do placar/interface (ex.: "100 o", "Ga") virem nome de time.
      // Times curtos reais como AZ/AIK continuam aceitos quando vêm como sigla em maiúsculas.
      const siglaCurta=/^[A-Z]{2,4}$/.test(x);
      const tamanhoNome=letras>=3 || siglaCurta;
      const dominadoPorNumero=digitos>0 && digitos>=letras;
      const fragmentoCurto=letras<3 && !siglaCurta;
      const contemSeparadorConfronto=/\s(?:x|×|vs\.?)\s/i.test(x);
      return x.length>=2 && tamanhoNome && !dominadoPorNumero && !fragmentoCurto && /[a-zà-ÿ]/i.test(x) && !contemSeparadorConfronto &&
        !/^(pre|live|ver mais odds|total|estatisticas|estatistica|suporte|ht|ao vivo|este jogo|todos|casa|fora|empate|possivel|correcao|preco|favorito)$/.test(n) &&
        !/^(e|d|v|ga|go|o|x|vs)$/.test(n) &&
        !/^\d+$/.test(n) && !/^possivel correcao/.test(n) &&
        !(palavras.length===1 && letras<4 && !siglaCurta);
    };

    // Em jogos ainda não iniciados, muitos placares exibem somente "Time A x Time B"
    // (sem 0 x 0). Prioriza essa linha antes de procurar um placar numérico no gráfico.
    for(const ln of linhas){
      let m=String(ln).match(/^(.{2,55}?)\s*\(\s*\d+\s*[º°oª]?\s*\)\s*(?:x|×|vs\.?)\s*\(\s*\d+\s*[º°oª]?\s*\)\s*(.{2,55})$/i);
      if(!m){
        const textoLinha=String(ln);
        const parentesesQuebrados=(textoLinha.match(/\(/g)||[]).length!==(textoLinha.match(/\)/g)||[]).length;
        if(!parentesesQuebrados) {
          const semRuidoParenteses=textoLinha.replace(/\([^)]{0,14}\)/g," ").replace(/\s+/g," ").trim();
          m=semRuidoParenteses.match(/^(.{2,55}?)\s+(?:x|×|vs\.?)\s+(.{2,55})$/i);
        }
      }
      if(m){
        const a=limparTime(m[1]), b=limparTime(m[2]);
        if(pareceTime(a)&&pareceTime(b)){mandante=a;visitante=b;break;}
      }
    }

    let scoreIdx=-1, scoreMatch=null;
    if(!pareceTime(mandante)||!pareceTime(visitante)){
      for(let i=0;i<linhas.length;i++){
        const m=linhas[i].match(/(\d{1,2})\s*[xX×]\s*(\d{1,2})/);
        if(m){scoreIdx=i;scoreMatch=m;break;}
      }
    }
    if(scoreIdx>=0 && (!pareceTime(mandante)||!pareceTime(visitante))){
      const linha=linhas[scoreIdx];
      const pos=scoreMatch.index||0, fim=pos+scoreMatch[0].length;
      let esq=limparTime(linha.slice(0,pos));
      let dir=limparTime(linha.slice(fim));
      if(!pareceTime(esq)){
        for(let k=scoreIdx-1;k>=Math.max(0,scoreIdx-7);k--){ if(pareceTime(linhas[k])){esq=limparTime(linhas[k]);break;} }
      }
      if(!pareceTime(dir)){
        for(let k=scoreIdx+1;k<=Math.min(linhas.length-1,scoreIdx+7);k++){ if(pareceTime(linhas[k])){dir=limparTime(linhas[k]);break;} }
      }
      mandante=esq; visitante=dir;
    }

    // Fallback específico para layouts que trazem ranking entre parênteses.
    if(!pareceTime(mandante)||!pareceTime(visitante)){
      const flat=linhas.join(" ");
      const m=flat.match(/([A-Za-zÀ-ÿ0-9.'’\- ]{2,45}?)\s*\(\s*\d+\s*[º°oª]?\s*\)\s*\d{1,2}\s*[xX×]\s*\d{1,2}\s*\(\s*\d+\s*[º°oª]?\s*\)\s*([A-Za-zÀ-ÿ0-9.'’\- ]{2,45}?)(?=\s+(?:PR[EÉ]|PRE|LIVE|L[I1]VE|Ver\b|$))/i);
      if(m){mandante=limparTime(m[1]);visitante=limparTime(m[2]);}
    }

    // Fallback para OCR que separa os nomes e rankings em linhas distintas.
    if(!pareceTime(mandante)||!pareceTime(visitante)){
      const candidatos=[];
      const limiteOdds=Math.max(0,linhas.findIndex(l=>linhaEhPre(l)||linhaEhLive(l)));
      const ate=limiteOdds>0?limiteOdds:Math.min(linhas.length,30);
      for(let i=0;i<ate;i++){
        const ln=linhas[i];
        if(pareceTime(ln) && !/hybel|arena|an[aá]lise|acessar partida|corre[cç][aã]o|odds/i.test(normBusca(ln))) candidatos.push(limparTime(ln));
      }
      const unicos=[]; candidatos.forEach(x=>{if(!unicos.some(y=>normBusca(y)===normBusca(x)))unicos.push(x);});
      if(unicos.length>=2){
        if(!pareceTime(mandante)) mandante=unicos[unicos.length-2];
        if(!pareceTime(visitante)) visitante=unicos[unicos.length-1];
      }
    }

    if(!pareceTime(mandante)||!pareceTime(visitante)||odds.length<3) {
      return {ok:false,mandante,visitante,odds,origemOdd,texto:raw,motivo:`Times: ${mandante||"?"} x ${visitante||"?"} · Odds lidas: ${odds.join(" / ")||"nenhuma"}`};
    }
    const oddCasa=odds[0], oddEmpate=odds[1], oddFora=odds[2];
    if(oddCasa===oddFora) return {ok:false,mandante,visitante,odds,origemOdd,texto:raw,motivo:"Odds de casa e fora ficaram iguais."};
    const favorito=oddCasa<oddFora?mandante:visitante;
    const oddFavorito=oddCasa<oddFora?oddCasa:oddFora;
    return {ok:true,mandante,visitante,favorito,oddFavorito,oddCasa,oddEmpate,oddFora,origemOdd,texto:raw};
  }

  function parseComprovanteBackOCR(texto) {
    const raw=String(texto||"").replace(/\r/g,"\n");
    const linhas=raw.split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
    const limparTime=t=>String(t||"")
      .replace(/\s*[-–—]\s*resultado\s+da\s+partida.*$/i,"")
      .replace(/^a\s+favor\s*\(\s*back\s*\)\s*/i,"")
      .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.'’\- ]+$/g,"")
      .replace(/\s+/g," ").trim();
    const moedaNum=v=>{
      if(v==null||v==="") return null;
      let x=String(v).replace(/R\$/gi,"").replace(/\s/g,"").trim();
      if(x.includes(",")) x=x.replace(/\./g,"").replace(",",".");
      const n=Number(x.replace(/[^0-9.\-]/g,""));
      return isFinite(n)?n:null;
    };
    const scoreLocal=(a,b)=>{
      const na=normBusca(a), nb=normBusca(b);
      if(!na||!nb) return 0;
      if(na===nb) return 1;
      if(na.includes(nb)||nb.includes(na)) return 0.94;
      const ta=na.split(/[^a-z0-9]+/).filter(x=>x.length>=3), tb=nb.split(/[^a-z0-9]+/).filter(x=>x.length>=3);
      if(!ta.length||!tb.length) return 0;
      let ac=0; for(const x of ta) if(tb.some(y=>x===y||x.includes(y)||y.includes(x))) ac++;
      return ac/Math.max(ta.length,tb.length);
    };

    // Só entra neste parser quando o comprovante diz explicitamente BACK.
    if(!/a\s+favor\s*\(\s*back\s*\)/i.test(raw)) return {ok:false};
    if(/contra\s*\(\s*lay\s*\)/i.test(raw) && !/a\s+favor\s*\(\s*back\s*\)/i.test(raw)) return {ok:false,motivo:"Comprovante parece ser LAY, não BACK."};

    // Cabeçalho: "Time A vs Time B - Resultado da partida".
    let mandante="", visitante="";
    for(const ln of linhas){
      const m=ln.match(/^(.{2,75}?)\s+(?:vs\.?|x|×|versus)\s+(.{2,75}?)\s*[-–—]\s*resultado\s+da\s+partida\b/i);
      if(m){mandante=limparTime(m[1]);visitante=limparTime(m[2]);break;}
    }
    if(!mandante||!visitante){
      const flat=linhas.join(" ");
      const m=flat.match(/(.{2,75}?)\s+(?:vs\.?|x|×|versus)\s+(.{2,75}?)\s*[-–—]\s*resultado\s+da\s+partida\b/i);
      if(m){mandante=limparTime(m[1]);visitante=limparTime(m[2]);}
    }
    if(!mandante||!visitante) return {ok:false,motivo:"Confronto não encontrado no comprovante."};

    const posBack=raw.search(/a\s+favor\s*\(\s*back\s*\)/i);
    const posBet=raw.search(/\bbet\s*id\b/i);
    const blocoBack=raw.slice(posBack>=0?posBack:0,posBet>posBack?posBet:Math.min(raw.length,(posBack>=0?posBack:0)+700));

    // O cabeçalho ficou antes do bloco. Logo, dentro deste bloco o time que reaparece
    // é exatamente o time selecionado no BACK.
    const nBloco=normBusca(blocoBack), nCasa=normBusca(mandante), nFora=normBusca(visitante);
    let timeBack="";
    if(nCasa && nBloco.includes(nCasa)) timeBack=mandante;
    if(nFora && nBloco.includes(nFora)) {
      if(!timeBack || nBloco.indexOf(nFora)<nBloco.indexOf(nCasa)) timeBack=visitante;
    }
    if(!timeBack){
      // OCR pode quebrar "A favor / Odd / Stake / Lucro" em linhas diferentes.
      const candidatos=blocoBack.split(/\n+/).map(l=>l.replace(/\b(?:A\s+favor|Back|Odd|Stake|Lucro)\b/gi," ")
        .replace(/R\$\s*[\d.]+,\d{2}/gi," ").replace(/\b\d{1,2}[.,]\d{2,3}\b/g," ").replace(/[():]/g," ").replace(/\s+/g," ").trim())
        .filter(l=>/[A-Za-zÀ-ÿ]{2}/.test(l));
      let best={score:0,time:""};
      for(const c of candidatos){
        const sc=scoreLocal(c,mandante), sf=scoreLocal(c,visitante);
        if(sc>best.score){best={score:sc,time:mandante};}
        if(sf>best.score){best={score:sf,time:visitante};}
      }
      if(best.score>=0.45) timeBack=best.time;
    }
    if(!timeBack) return {ok:false,mandante,visitante,motivo:"Time do BACK não encontrado no comprovante."};

    // Remove valores em R$ antes de procurar a odd para não confundir 60,00/48,00 com preço.
    const blocoSemDinheiro=blocoBack.replace(/R\$\s*[\d.]+,\d{2}/gi," ");
    const odds=Array.from(blocoSemDinheiro.matchAll(/\b(\d{1,2}[.,]\d{2,3})\b/g))
      .map(m=>Number(m[1].replace(",","."))).filter(n=>isFinite(n)&&n>1.01&&n<100);
    const oddNum=odds.length?odds[0]:null;
    const dinheiros=Array.from(blocoBack.matchAll(/R\$\s*([\d.]+,\d{2})/gi)).map(m=>moedaNum(m[1])).filter(n=>n!=null);
    const stake=dinheiros.length?dinheiros[0]:null;
    const lucro=dinheiros.length>1?dinheiros[1]:null;
    const betId=(raw.match(/\bbet\s*id\b\s*[:#]?\s*([A-Za-z0-9_-]+)/i)||[])[1]||"";

    // Para o horário da operação, o evento é mais útil que o horário em que a aposta foi colocada.
    const evento=raw.match(/\bdata\s+do\s+evento\b\s*:\s*(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})(?::\d{2})?/i);
    const colocada=raw.match(/\bcolocada\b\s*:\s*(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})(?::\d{2})?/i);
    const horario=evento?.[2]||colocada?.[2]||"";
    const dataTexto=evento?.[1]||colocada?.[1]||"";

    if(!(oddNum>1)) return {ok:false,mandante,visitante,timeBack,motivo:"Odd não encontrada no comprovante."};
    if(![mandante,visitante].some(t=>normBusca(t)===normBusca(timeBack))) return {ok:false,motivo:"O time do BACK não bateu com o confronto do comprovante."};

    return {
      ok:true,mandante,visitante,favorito:timeBack,oddFavorito:oddNum,
      // Não há necessidade de inventar as outras odds: este comprovante já diz o lado operado.
      oddCasa:normBusca(timeBack)===normBusca(mandante)?oddNum:null,
      oddEmpate:null,oddFora:normBusca(timeBack)===normBusca(visitante)?oddNum:null,
      origemOdd:"COMPROVANTE BACK",entrada:stake!=null?stake.toFixed(2).replace(".",","):"",
      lucroPossivel:lucro!=null?lucro.toFixed(2).replace(".",","):"",betId:String(betId||""),
      horario,dataTexto,texto:raw
    };
  }

  // Cria uma versão ampliada, em alto contraste e invertida quando o print é
  // predominantemente escuro. Só é usada numa segunda tentativa de OCR.
  function prepararImagemOCRAoVivo(file) {
    return new Promise((resolve,reject)=>{
      try{
        const url=URL.createObjectURL(file), img=new Image();
        img.onload=()=>{
          try{
            const maxW=1800, escala=Math.max(1.35,Math.min(2,maxW/img.width));
            const canvas=document.createElement("canvas");
            canvas.width=Math.round(img.width*escala); canvas.height=Math.round(img.height*escala);
            const ctx=canvas.getContext("2d",{willReadFrequently:true});
            ctx.drawImage(img,0,0,canvas.width,canvas.height);
            const dados=ctx.getImageData(0,0,canvas.width,canvas.height), d=dados.data;
            let soma=0, amostras=0;
            for(let i=0;i<d.length;i+=40){soma+=(d[i]+d[i+1]+d[i+2])/3;amostras++;}
            const escura=(soma/Math.max(1,amostras))<135;
            for(let i=0;i<d.length;i+=4){
              let g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
              if(escura) g=255-g;
              g=Math.max(0,Math.min(255,(g-128)*1.65+128));
              d[i]=d[i+1]=d[i+2]=g;
            }
            ctx.putImageData(dados,0,0); URL.revokeObjectURL(url); resolve(canvas);
          }catch(e){URL.revokeObjectURL(url);reject(e);}
        };
        img.onerror=e=>{URL.revokeObjectURL(url);reject(e);}; img.src=url;
      }catch(e){reject(e);}
    });
  }

  // Recorte específico da área do placar. Quando o OCR geral acerta as odds mas
  // erra os nomes, esta leitura ampliada tenta apenas a região onde os times aparecem.
  function prepararRecorteTimesOCRAoVivo(file) {
    return new Promise((resolve,reject)=>{
      try{
        const url=URL.createObjectURL(file), img=new Image();
        img.onload=()=>{
          try{
            // Em prints de apps esportivos, nomes + placar normalmente ficam no miolo superior.
            // O recorte é propositalmente largo para funcionar com layouts diferentes.
            const sx=Math.round(img.width*0.02), sy=Math.round(img.height*0.16);
            const sw=Math.round(img.width*0.96), sh=Math.round(img.height*0.49);
            const escala=Math.max(2.0,Math.min(3.0,1900/sw));
            const canvas=document.createElement("canvas");
            canvas.width=Math.round(sw*escala); canvas.height=Math.round(sh*escala);
            const ctx=canvas.getContext("2d",{willReadFrequently:true});
            ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
            const dados=ctx.getImageData(0,0,canvas.width,canvas.height), d=dados.data;
            let soma=0, amostras=0;
            for(let i=0;i<d.length;i+=40){soma+=(d[i]+d[i+1]+d[i+2])/3;amostras++;}
            const escura=(soma/Math.max(1,amostras))<150;
            for(let i=0;i<d.length;i+=4){
              let g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
              if(escura) g=255-g;
              // Contraste um pouco mais suave para preservar letras finas dos nomes.
              g=Math.max(0,Math.min(255,(g-128)*1.38+128));
              d[i]=d[i+1]=d[i+2]=g;
            }
            ctx.putImageData(dados,0,0); URL.revokeObjectURL(url); resolve(canvas);
          }catch(e){URL.revokeObjectURL(url);reject(e);}
        };
        img.onerror=e=>{URL.revokeObjectURL(url);reject(e);}; img.src=url;
      }catch(e){reject(e);}
    });
  }


  // Recorte principal do confronto + preços. É a leitura prioritária da Entrada ao Vivo.
  // Evita que probabilidades, placares corretos e outros números mais abaixo contaminem a odd.
  function prepararRecorteCabecalhoAoVivo(file) {
    return new Promise((resolve,reject)=>{
      try{
        const url=URL.createObjectURL(file), img=new Image();
        img.onload=()=>{
          try{
            const paisagem=(img.width/img.height)>=1.30;
            const sx=Math.round(img.width*0.03), sw=Math.round(img.width*0.94);
            const sy=Math.round(img.height*(paisagem?0.08:0.14));
            const sh=Math.round(img.height*(paisagem?0.36:0.50));
            const escala=Math.max(1.8,Math.min(3.0,1900/sw));
            const canvas=document.createElement("canvas");
            canvas.width=Math.round(sw*escala); canvas.height=Math.round(sh*escala);
            const ctx=canvas.getContext("2d",{willReadFrequently:true});
            ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
            const dados=ctx.getImageData(0,0,canvas.width,canvas.height), d=dados.data;
            let soma=0,am=0;
            for(let i=0;i<d.length;i+=48){soma+=(d[i]+d[i+1]+d[i+2])/3;am++;}
            const escura=(soma/Math.max(1,am))<145;
            for(let i=0;i<d.length;i+=4){
              let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
              if(escura) g=255-g;
              g=Math.max(0,Math.min(255,(g-128)*1.42+128));
              d[i]=d[i+1]=d[i+2]=g;
            }
            ctx.putImageData(dados,0,0); URL.revokeObjectURL(url); resolve(canvas);
          }catch(e){URL.revokeObjectURL(url);reject(e);}
        };
        img.onerror=e=>{URL.revokeObjectURL(url);reject(e);}; img.src=url;
      }catch(e){reject(e);}
    });
  }

  function parseOddsRecorteAoVivo(texto) {
    const raw=String(texto||"").replace(/\r/g,"\n");
    const converter=token=>{
      const t=String(token||"").trim();
      if(/[.,]/.test(t)) { const n=Number(t.replace(",",".")); return isFinite(n)&&n>=1.05&&n<=30?n:null; }
      if(/^\d{3,4}$/.test(t)) { const n=Number(t)/100; return isFinite(n)&&n>=1.05&&n<=30?n:null; }
      return null;
    };
    const extrair=txt=>Array.from(String(txt||"").matchAll(/\b(\d{1,2}[.,]\d{1,3}|\d{3,4})\b/g))
      .map(m=>converter(m[1])).filter(n=>n!=null);
    const live=raw.match(/(?:^|\n)\s*(?:LIVE|L[I1]VE|LIV[E3])\b([\s\S]*?)(?=Ver\s+Mais\s+Odds|TOTAL|HT|$)/i);
    if(live){const a=extrair(live[1]);if(a.length>=3)return {odds:a.slice(0,3),origem:"LIVE"};}
    const pre=raw.match(/(?:^|\n)\s*(?:PR[EÉ]|PRE|PR3)\b([\s\S]*?)(?=(?:LIVE|L[I1]VE|LIV[E3])\b|Ver\s+Mais\s+Odds|TOTAL|HT|$)/i);
    if(pre){const a=extrair(pre[1]);if(a.length>=3)return {odds:a.slice(0,3),origem:"PRÉ"};}
    const todos=extrair(raw);
    // No recorte superior, rankings e relógio têm 1-2 dígitos; odds sem separador
    // costumam vir como 175/330/475. Por isso 3 valores válidos são bastante confiáveis.
    if(todos.length===3)return {odds:todos,origem:"PRINT"};
    if(todos.length>3){
      // Procura um trio consecutivo típico de mercado 1X2, evitando números muito extremos.
      let melhor=null;
      for(let i=0;i<=todos.length-3;i++){
        const trio=todos.slice(i,i+3);
        const plaus=trio.filter(n=>n>=1.05&&n<=15).length;
        const score=plaus*10-Math.abs(trio[1]-3.3)*.05;
        if(!melhor||score>melhor.score)melhor={trio,score};
      }
      if(melhor)return {odds:melhor.trio,origem:"PRINT"};
    }
    return {odds:[],origem:"PRINT"};
  }

  function distanciaLevenshtein(a,b) {
    a=String(a||"");b=String(b||"");
    if(!a.length)return b.length;if(!b.length)return a.length;
    const prev=Array.from({length:b.length+1},(_,i)=>i), cur=new Array(b.length+1);
    for(let i=1;i<=a.length;i++){
      cur[0]=i;
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      for(let j=0;j<=b.length;j++)prev[j]=cur[j];
    }
    return prev[b.length];
  }

  function scoreTimeNoTextoOCR(texto,nome) {
    const tx=normBusca(texto).replace(/[^a-z0-9à-ÿ]+/g," ").trim();
    const nm=normBusca(nome).replace(/[^a-z0-9à-ÿ]+/g," ").trim();
    if(!tx||!nm||nm==="n/d")return 0;
    const tc=tx.replace(/\s+/g,""), nc=nm.replace(/\s+/g,"");
    if(nc.length>=4&&tc.includes(nc))return 1;
    const palavrasTexto=tx.split(/\s+/).filter(Boolean), palavrasNome=nm.split(/\s+/).filter(x=>x.length>=3);
    if(!palavrasNome.length)return 0;
    let soma=0;
    for(const pn of palavrasNome){
      let best=0;
      for(const pt of palavrasTexto){
        if(Math.abs(pt.length-pn.length)>4)continue;
        if(pt===pn){best=1;break;}
        if(pt.includes(pn)||pn.includes(pt))best=Math.max(best,.88);
        const d=distanciaLevenshtein(pt,pn), sim=1-d/Math.max(pt.length,pn.length);
        best=Math.max(best,sim);
      }
      soma+=Math.max(0,best);
    }
    return soma/palavrasNome.length;
  }

  function nomeTimeOCRSeguro(t) {
    const x=String(t||"").replace(/\s+/g," ").trim();
    const n=normBusca(x);
    const letras=(x.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
    const digitos=(x.match(/\d/g)||[]).length;
    if(!x || letras<3 || digitos>2) return false;
    if(/\d\s*[xX×]\s*\d|\d+[.,]\d+%?|\b(?:TOTAL|HT|LIVE|PRE|PRÉ|ODD|PROBABILIDADE|PLACAR|SOMAR)\b/i.test(x)) return false;
    if(/^(?:0x0|1x0|0x1|1x1|2x0|0x2|2x1|1x2|2x2)/i.test(x.replace(/\s+/g,""))) return false;
    if(/^(?:favorito|under|over|resultado correto|valor esperado|gols|classificacao|classificação|mais provaveis|mais prováveis|acessar partida|analise pre|análise pré)$/i.test(n)) return false;
    return true;
  }

  // Quando o OCR geral não reconhece bem os nomes, lê cada metade do placar
  // separadamente. Isso funciona melhor em prints do CSCORE porque o mandante
  // fica à esquerda e o visitante à direita, tanto no celular quanto no PC.
  function prepararRecortesLateraisOCRAoVivo(file) {
    return new Promise((resolve,reject)=>{
      try{
        const url=URL.createObjectURL(file), img=new Image();
        img.onload=()=>{
          try{
            const paisagem=(img.width/img.height)>=1.30;
            const sy=Math.round(img.height*(paisagem?0.035:0.12));
            const sh=Math.round(img.height*(paisagem?0.34:0.46));
            const fazer=(lado)=>{
              const sx=Math.round(img.width*(lado==="esq"?0.035:0.535));
              const sw=Math.round(img.width*0.43);
              const escala=Math.max(2.2,Math.min(3.2,1450/sw));
              const c=document.createElement("canvas");
              c.width=Math.round(sw*escala); c.height=Math.round(sh*escala);
              const ctx=c.getContext("2d",{willReadFrequently:true});
              ctx.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
              const dados=ctx.getImageData(0,0,c.width,c.height), d=dados.data;
              let soma=0,am=0;
              for(let i=0;i<d.length;i+=48){soma+=(d[i]+d[i+1]+d[i+2])/3;am++;}
              const escura=(soma/Math.max(1,am))<155;
              for(let i=0;i<d.length;i+=4){
                let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
                if(escura) g=255-g;
                g=Math.max(0,Math.min(255,(g-128)*1.48+128));
                d[i]=d[i+1]=d[i+2]=g;
              }
              ctx.putImageData(dados,0,0);
              return c;
            };
            const esq=fazer("esq"), dir=fazer("dir");
            URL.revokeObjectURL(url); resolve({esq,dir});
          }catch(e){URL.revokeObjectURL(url);reject(e);}
        };
        img.onerror=e=>{URL.revokeObjectURL(url);reject(e);}; img.src=url;
      }catch(e){reject(e);}
    });
  }

  function extrairNomeTimeDeLadoOCR(texto) {
    const linhas=String(texto||"").replace(/\r/g,"\n").split(/\n+/)
      .map(l=>l.replace(/\(\s*\d+\s*[º°oª]?\s*\)/gi,"").replace(/\s+/g," ").trim())
      .filter(Boolean);
    const candidatos=linhas.filter(l=>{
      const n=normBusca(l);
      if(!nomeTimeOCRSeguro(l)) return false;
      if(/favor|under|over|analise|acessar|partida|rodada|serie|série|estadio|stadium|arena|clima|tempo|odds|resultado|valor esperado|classificacao|classificação|suporte|todos|proximos|próximos|finalizados|selecionar ligas|indicadores|placar atual|cscore|mais prov/.test(n)) return false;
      if(/^a\.?m\.?\s*nao|^a\.?m\.?\s*n[aã]o/.test(n)) return false;
      return true;
    });
    if(!candidatos.length) return "";
    candidatos.sort((a,b)=>{
      const la=(a.match(/[A-Za-zÀ-ÿ]/g)||[]).length, lb=(b.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
      const pa=a.split(/\s+/).length, pb=b.split(/\s+/).length;
      return (lb+Math.min(pb,3)*1.5)-(la+Math.min(pa,3)*1.5);
    });
    return candidatos[0];
  }

  function partidaGradePelosLadosOCR(textoEsq,textoDir,data) {
    const lista=(jogosDia||[]).filter(j=>j?.data===data&&j?.mandante&&j?.visitante&&j.mandante!=="N/D"&&j.visitante!=="N/D");
    let melhor=null;
    for(const j of lista){
      const a=scoreTimeNoTextoOCR(textoEsq,j.mandante);
      const b=scoreTimeNoTextoOCR(textoDir,j.visitante);
      const cruzA=scoreTimeNoTextoOCR(textoEsq,j.visitante);
      const cruzB=scoreTimeNoTextoOCR(textoDir,j.mandante);
      const direto=a+b, cruzado=cruzA+cruzB;
      const item=direto>=cruzado?{j,score:direto,a,b,invertido:false}:{j,score:cruzado,a:cruzA,b:cruzB,invertido:true};
      if(!melhor||item.score>melhor.score) melhor=item;
    }
    if(!melhor) return null;
    const forte=(melhor.a>=.52&&melhor.b>=.52) || (Math.max(melhor.a,melhor.b)>=.90&&melhor.score>=1.08);
    if(!forte) return null;
    if(!melhor.invertido) return melhor.j;
    return {...melhor.j,mandante:melhor.j.visitante,visitante:melhor.j.mandante};
  }

  function partidaGradePeloTextoOCR(texto,data) {
    const lista=(jogosDia||[]).filter(j=>j?.data===data&&j?.mandante&&j?.visitante&&j.mandante!=="N/D"&&j.visitante!=="N/D");
    let melhor=null;
    for(const j of lista){
      const a=scoreTimeNoTextoOCR(texto,j.mandante), b=scoreTimeNoTextoOCR(texto,j.visitante);
      const score=a+b;
      const item={j,a,b,score};
      if(!melhor||score>melhor.score)melhor=item;
    }
    if(!melhor)return null;
    // Dois lados medianamente reconhecidos, ou um lado praticamente exato + algum sinal do outro.
    if((melhor.a>=.48&&melhor.b>=.48) || (Math.max(melhor.a,melhor.b)>=.88&&melhor.score>=1.05))return melhor.j;
    return null;
  }

  function scoreNomeOCR(a,b) {
    const x=normBusca(a), y=normBusca(b);
    if(!x||!y||x==="n/d"||y==="n/d") return 0;
    if(x===y) return 1;
    if(x.includes(y)||y.includes(x)) return Math.min(x.length,y.length)>=4?0.92:0.72;
    const tx=x.split(/\s+/).filter(t=>t.length>=3), ty=y.split(/\s+/).filter(t=>t.length>=3);
    if(!tx.length||!ty.length) return 0;
    const comuns=tx.filter(t=>ty.some(u=>u===t||u.includes(t)||t.includes(u))).length;
    return comuns/Math.max(tx.length,ty.length);
  }

  function reconciliarTimesAoVivoComGrade(leitura,data) {
    if(!leitura?.ok) return leitura;
    const lista=(jogosDia||[]).filter(j=>j?.data===data&&j?.mandante&&j?.visitante&&j.mandante!=="N/D"&&j.visitante!=="N/D");
    if(!lista.length) return leitura;
    let melhor=null;
    for(const j of lista){
      const diretoA=scoreNomeOCR(leitura.mandante,j.mandante), diretoB=scoreNomeOCR(leitura.visitante,j.visitante);
      const invertA=scoreNomeOCR(leitura.mandante,j.visitante), invertB=scoreNomeOCR(leitura.visitante,j.mandante);
      const direto=diretoA+diretoB, invertido=invertA+invertB;
      const item=direto>=invertido?{j,score:direto,invertido:false,maxLado:Math.max(diretoA,diretoB)}:{j,score:invertido,invertido:true,maxLado:Math.max(invertA,invertB)};
      if(!melhor||item.score>melhor.score) melhor=item;
    }
    // Um lado reconhecido quase exatamente já basta para recuperar o confronto da grade.
    if(!melhor || (melhor.score<1.15 && melhor.maxLado<0.90)) return leitura;
    const mandante=melhor.invertido?melhor.j.visitante:melhor.j.mandante;
    const visitante=melhor.invertido?melhor.j.mandante:melhor.j.visitante;
    const favorito=leitura.oddCasa<leitura.oddFora?mandante:visitante;
    return {...leitura,mandante,visitante,favorito,oddFavorito:leitura.oddCasa<leitura.oddFora?leitura.oddCasa:leitura.oddFora,nomesConfirmadosPelaGrade:true};
  }

  async function importarEntradaAoVivo(file) {
    if(!file) return;
    if(!window.Tesseract || !window.Tesseract.recognize){alert("O leitor de imagem ainda não carregou. Verifique a internet e recarregue o app.");return;}
    setEntradaAoVivoCarregando(true); setEntradaAoVivoStatus("Lendo print ao vivo…");
    try{
      const logger=m=>{if(m.status==="recognizing text") setEntradaAoVivoStatus(`Lendo print… ${Math.round((Number(m.progress)||0)*100)}%`);};
      let r=await window.Tesseract.recognize(file,"por",{logger});
      const textoGeral=r?.data?.text||"";
      const comprovanteBack=parseComprovanteBackOCR(textoGeral);
      let leitura=parseEntradaAoVivoOCR(textoGeral);
      let melhorOdds=leitura.odds?.length>=3?leitura:null;

      // Prioridade máxima: comprovante/boletim da aposta já executada.
      // Esse layout é muito mais confiável do que tentar deduzir times e odds
      // a partir de uma página de estatísticas ao vivo.
      if(comprovanteBack?.ok){
        leitura={...comprovanteBack,ok:true};
      }

      // Leitura prioritária: recorta apenas confronto + odds. Isso impede números
      // de tabelas/probabilidades abaixo de virarem odd ou nome de time.
      let textoCabecalho="", oddsCabecalho=null, leituraCabecalho=null;
      if(!comprovanteBack?.ok){
        try{
          setEntradaAoVivoStatus("Lendo confronto e odds…");
          const cab=await prepararRecorteCabecalhoAoVivo(file);
          const rc=await window.Tesseract.recognize(cab,"por",{logger,tessedit_pageseg_mode:11});
          textoCabecalho=rc?.data?.text||"";
          oddsCabecalho=parseOddsRecorteAoVivo(textoCabecalho);
          leituraCabecalho=parseEntradaAoVivoOCR(textoCabecalho);
        }catch(e){console.warn("Leitura do cabeçalho não pôde ser executada",e);}
      }

      const dataHoje=tISO(new Date());
      let textoLadoEsq="", textoLadoDir="", nomesLaterais=null;
      let jogoGrade=comprovanteBack?.ok ? {mandante:comprovanteBack.mandante,visitante:comprovanteBack.visitante} : partidaGradePeloTextoOCR([textoCabecalho,textoGeral].filter(Boolean).join("\n"),dataHoje);
      // Se o OCR geral não encontrou o confronto na grade, lê cada time em seu lado.
      if(!jogoGrade && !comprovanteBack?.ok){
        try{
          setEntradaAoVivoStatus("Confirmando nomes dos times…");
          const lados=await prepararRecortesLateraisOCRAoVivo(file);
          const re=await window.Tesseract.recognize(lados.esq,"por",{logger,tessedit_pageseg_mode:11});
          const rd=await window.Tesseract.recognize(lados.dir,"por",{logger,tessedit_pageseg_mode:11});
          textoLadoEsq=re?.data?.text||""; textoLadoDir=rd?.data?.text||"";
          const nomeEsq=extrairNomeTimeDeLadoOCR(textoLadoEsq), nomeDir=extrairNomeTimeDeLadoOCR(textoLadoDir);
          if(nomeTimeOCRSeguro(nomeEsq)&&nomeTimeOCRSeguro(nomeDir)) nomesLaterais={mandante:nomeEsq,visitante:nomeDir};
          jogoGrade=partidaGradePelosLadosOCR(textoLadoEsq,textoLadoDir,dataHoje)
            || partidaGradePeloTextoOCR([textoCabecalho,textoGeral,textoLadoEsq,textoLadoDir].join("\n"),dataHoje);
        }catch(e){console.warn("Leitura lateral dos times não pôde ser executada",e);}
      }
      const oddsPri=oddsCabecalho?.odds?.length>=3?oddsCabecalho.odds:null;
      if(oddsPri){
        const nomesBase=jogoGrade||nomesLaterais||((leituraCabecalho?.mandante&&leituraCabecalho?.visitante&&nomeTimeOCRSeguro(leituraCabecalho.mandante)&&nomeTimeOCRSeguro(leituraCabecalho.visitante))?{mandante:leituraCabecalho.mandante,visitante:leituraCabecalho.visitante}:null);
        if(nomesBase){
          const oddCasa=oddsPri[0],oddEmpate=oddsPri[1],oddFora=oddsPri[2];
          if(oddCasa!==oddFora){
            const mandante=nomesBase.mandante,visitante=nomesBase.visitante;
            const favorito=oddCasa<oddFora?mandante:visitante;
            leitura={ok:true,mandante,visitante,favorito,oddFavorito:Math.min(oddCasa,oddFora),oddCasa,oddEmpate,oddFora,odds:oddsPri,origemOdd:oddsCabecalho.origem||"PRINT",texto:[textoCabecalho,textoGeral].join("\n"),nomesConfirmadosPelaGrade:!!jogoGrade};
            melhorOdds=leitura;
          }
        }
      } else if(jogoGrade && leitura?.odds?.length>=3){
        const oddCasa=leitura.odds[0],oddEmpate=leitura.odds[1],oddFora=leitura.odds[2];
        const favorito=oddCasa<oddFora?jogoGrade.mandante:jogoGrade.visitante;
        leitura={...leitura,ok:oddCasa!==oddFora,mandante:jogoGrade.mandante,visitante:jogoGrade.visitante,favorito,oddFavorito:Math.min(oddCasa,oddFora),oddCasa,oddEmpate,oddFora,nomesConfirmadosPelaGrade:true};
      }

      // Se a leitura prioritária ainda não fechou, o próprio app tenta novamente
      // com a imagem ampliada/contrastada. O usuário não precisa reenviar o print.
      if(!leitura.ok){
        setEntradaAoVivoStatus("Ajustando imagem e tentando novamente…");
        try{
          const otimizada=await prepararImagemOCRAoVivo(file);
          r=await window.Tesseract.recognize(otimizada,"por",{logger});
          let l2=parseEntradaAoVivoOCR(r?.data?.text||"");
          const grade2=partidaGradePeloTextoOCR([textoCabecalho,textoGeral,textoLadoEsq,textoLadoDir,r?.data?.text||""].join("\n"),dataHoje)
            || partidaGradePelosLadosOCR(textoLadoEsq,textoLadoDir,dataHoje);
          if(grade2&&l2.odds?.length>=3){
            const oc=l2.odds[0],oe=l2.odds[1],of=l2.odds[2];
            l2={...l2,ok:oc!==of,mandante:grade2.mandante,visitante:grade2.visitante,favorito:oc<of?grade2.mandante:grade2.visitante,oddFavorito:Math.min(oc,of),oddCasa:oc,oddEmpate:oe,oddFora:of,nomesConfirmadosPelaGrade:true};
          }
          if(l2.odds?.length>=3) melhorOdds=l2;
          // Prefere a segunda leitura se ela ficou completa ou trouxe nomes melhores.
          if(l2.ok || (!leitura.ok && (l2.mandante||l2.visitante))) leitura=l2;
        }catch(e){console.warn("Segunda leitura OCR não pôde ser executada",e);}
      }

      // Terceira tentativa: lê somente a área do placar para recuperar os nomes.
      // Mantém as odds já encontradas na leitura anterior.
      if(!leitura.ok){
        setEntradaAoVivoStatus("Lendo nomes dos times…");
        try{
          const recorteTimes=await prepararRecorteTimesOCRAoVivo(file);
          const rn=await window.Tesseract.recognize(recorteTimes,"por",{logger,tessedit_pageseg_mode:6});
          const nomes=parseEntradaAoVivoOCR(rn?.data?.text||"");
          const baseOdds=(leitura.odds?.length>=3?leitura:melhorOdds);
          if(baseOdds && nomes.mandante && nomes.visitante && nomeTimeOCRSeguro(nomes.mandante) && nomeTimeOCRSeguro(nomes.visitante)){
            const oddCasa=baseOdds.odds[0], oddEmpate=baseOdds.odds[1], oddFora=baseOdds.odds[2];
            if(oddCasa!==oddFora){
              const favorito=oddCasa<oddFora?nomes.mandante:nomes.visitante;
              const oddFavorito=oddCasa<oddFora?oddCasa:oddFora;
              leitura={ok:true,mandante:nomes.mandante,visitante:nomes.visitante,favorito,oddFavorito,oddCasa,oddEmpate,oddFora,origemOdd:baseOdds.origemOdd||"LIVE",odds:[oddCasa,oddEmpate,oddFora],texto:[baseOdds.texto||"",rn?.data?.text||""].join("\n")};
            }
          }
        }catch(e){console.warn("Leitura dedicada dos nomes não pôde ser executada",e);}
      }

      // Nunca deixa um texto de placar/probabilidade virar nome de time.
      if(leitura.ok && (!nomeTimeOCRSeguro(leitura.mandante)||!nomeTimeOCRSeguro(leitura.visitante))){
        const gradeSeguro=partidaGradePelosLadosOCR(textoLadoEsq,textoLadoDir,dataHoje)
          || partidaGradePeloTextoOCR([textoCabecalho,textoGeral,textoLadoEsq,textoLadoDir].join("\n"),dataHoje);
        if(gradeSeguro && leitura.odds?.length>=3){
          const oc=leitura.odds[0],oe=leitura.odds[1],of=leitura.odds[2];
          leitura={...leitura,ok:oc!==of,mandante:gradeSeguro.mandante,visitante:gradeSeguro.visitante,favorito:oc<of?gradeSeguro.mandante:gradeSeguro.visitante,oddFavorito:Math.min(oc,of),oddCasa:oc,oddEmpate:oe,oddFora:of,nomesConfirmadosPelaGrade:true};
        } else if(nomesLaterais && leitura.odds?.length>=3){
          const oc=leitura.odds[0],oe=leitura.odds[1],of=leitura.odds[2];
          leitura={...leitura,ok:oc!==of,mandante:nomesLaterais.mandante,visitante:nomesLaterais.visitante,favorito:oc<of?nomesLaterais.mandante:nomesLaterais.visitante,oddFavorito:Math.min(oc,of),oddCasa:oc,oddEmpate:oe,oddFora:of};
        } else leitura={...leitura,ok:false,motivo:"As odds foram lidas, mas os nomes dos times não ficaram confiáveis."};
      }
      if(!leitura.ok){
        console.warn("OCR ao vivo não conclusivo",leitura);
        alert(`Consegui ler as odds, mas não confirmei os nomes dos times com segurança. Não vou abrir uma operação com nome errado.\n\nDeixe o confronto cadastrado em Jogos do Dia e tente o mesmo print novamente.`);
        return;
      }

      const agora=new Date();
      const data=tISO(agora), horario=(leitura?.horario&&/^\d{2}:\d{2}$/.test(leitura.horario)?leitura.horario:agora.toTimeString().slice(0,5));
      if(leitura.origemOdd!=="COMPROVANTE BACK") {
        const gradeFinal=partidaGradePeloTextoOCR([textoCabecalho,textoLadoEsq,textoLadoDir,leitura?.texto||"",textoGeral].join("\n"),data)
          || partidaGradePelosLadosOCR(textoLadoEsq,textoLadoDir,data);
        if(gradeFinal){
          const oddCasa=leitura.oddCasa??leitura.odds?.[0], oddEmpate=leitura.oddEmpate??leitura.odds?.[1], oddFora=leitura.oddFora??leitura.odds?.[2];
          if(oddCasa!=null&&oddFora!=null){
            leitura={...leitura,ok:oddCasa!==oddFora,mandante:gradeFinal.mandante,visitante:gradeFinal.visitante,favorito:oddCasa<oddFora?gradeFinal.mandante:gradeFinal.visitante,oddFavorito:Math.min(oddCasa,oddFora),oddCasa,oddEmpate,oddFora,nomesConfirmadosPelaGrade:true};
          }
        } else leitura=reconciliarTimesAoVivoComGrade(leitura,data);
      }
      const imagem={id:"img_live_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),nome:file.name||"entrada-ao-vivo.jpg",data};
      try{await salvarImagemJogoLocal(imagem.id,file);}catch(e){console.warn("Não foi possível salvar o print ao vivo localmente",e);}

      const existente=jogosDia.find(x=>mesmaPartida(x,{data,mandante:leitura.mandante,visitante:leitura.visitante}));
      const j={
        ...(existente||jogoVazio(data,imagem)),
        id:existente?.id||("jg_live_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)),
        data,horario,mandante:leitura.mandante,visitante:leitura.visitante,favorito:leitura.favorito,
        entradaSugerida:`BACK ${leitura.favorito}`,
        metodos:Array.from(new Set([...(existente?.metodos||[]),"back_favorito"])),
        timesMetodo:{...(existente?.timesMetodo||{}),back_favorito:leitura.favorito},
        oddSugerida:leitura.oddFavorito,
        oddsAoVivo:{casa:leitura.oddCasa,empate:leitura.oddEmpate,fora:leitura.oddFora,fonte:leitura.origemOdd},
        valorCapturado:leitura.entrada||"",
        lucroCapturado:leitura.lucroPossivel||"",
        betIdCapturado:leitura.betId||"",
        analiseInicial: leitura.origemOdd==="COMPROVANTE BACK"
          ? `Comprovante de entrada importado. BACK ${leitura.favorito} @ ${leitura.oddFavorito.toFixed(2)}${leitura.entrada?` · Stake R$ ${leitura.entrada}`:""}${leitura.lucroPossivel?` · Lucro R$ ${leitura.lucroPossivel}`:""}${leitura.betId?` · Bet ID ${leitura.betId}`:""}.`
          : `Entrada ao vivo por print. ${leitura.origemOdd}: ${leitura.oddCasa.toFixed(2)} / ${leitura.oddEmpate.toFixed(2)} / ${leitura.oddFora.toFixed(2)}. Menor odd entre casa e fora: ${leitura.favorito} @ ${leitura.oddFavorito.toFixed(2)}.`,
        confianca:"N/D",status:"PENDENTE",statusLeitura:"OK",errosLeitura:[],origem:leitura.origemOdd==="COMPROVANTE BACK"?"OCR_COMPROVANTE_BACK":"OCR_AO_VIVO",
        imagemId:imagem.id,imagemNome:imagem.nome,atualizadoEm:Date.now(),criadoEm:existente?.criadoEm||Date.now()
      };

      persistirJogosConfirmados([j]);
      setResultadoTextoJogos({tipo:"ao_vivo",favorito:leitura.favorito,odd:leitura.oddFavorito});
      setEntradaAoVivoStatus(leitura.origemOdd==="COMPROVANTE BACK"
        ? `✓ BACK ${leitura.favorito} importado do comprovante @ ${leitura.oddFavorito.toFixed(2)}`
        : `✓ ${leitura.favorito} identificado como favorito @ ${leitura.oddFavorito.toFixed(2)}`);
      // Abre imediatamente o pré-lançamento. A stake continua vindo da configuração atual do app.
      setTimeout(()=>abrirOperacaoDoJogo(j,"back_favorito"),40);
    }catch(e){
      console.error(e); alert("Não foi possível ler o print. Tente novamente com uma imagem mais nítida.");
    }finally{
      setEntradaAoVivoCarregando(false);
      if(entradaAoVivoInputRef.current) entradaAoVivoInputRef.current.value="";
    }
  }

  // ===== LEITOR DA BOLSA (simplificado) =====
  // Único objetivo: IMAGEM -> OCR -> IDENTIFICAR TIMES (casa x visitante) -> CRIAR OPERAÇÃO.
  // Não tenta identificar favorito, odds, mercado, pressão, gráfico, confiança ou estratégia.
  // Remove lixo curto colado no nome do time causado pelo OCR "lendo" o
  // escudo/bandeira ao lado do nome (ex.: "Real Sociedad WB" ou "'F Celta de Vigo").
  // Só corta palavras de 1-2 letras nas pontas, e nunca corta siglas reais de
  // time (FC, CF, SD, CD, UD, etc.), pra não estragar nomes legítimos.
  const SIGLAS_TIME_OCR=new Set(["fc","cf","sc","ac","sd","ud","cd","rc","cp","ec","es","ca","cr","gd","se","ge","aa","ff","ii","jr"]);
  function limparRuidoEscudoOCR(cand) {
    let s=String(cand||"").trim();
    if(!s) return s;
    const aparaUmaVez=(str,doFim)=>{
      const partes=str.split(" ").filter(Boolean);
      if(partes.length<2) return {str,mudou:false};
      const idx=doFim?partes.length-1:0;
      const palavra=partes[idx].replace(/[^A-Za-zÀ-ÿ]/g,"");
      // token sem nenhuma letra (ícone/símbolo mal lido, ex.: "@}") -> remove sempre
      if(!palavra){ partes.splice(idx,1); return {str:partes.join(" ").trim(),mudou:true}; }
      if(SIGLAS_TIME_OCR.has(normBusca(palavra))) return {str,mudou:false};
      if(palavra.length<=2){ partes.splice(idx,1); return {str:partes.join(" ").trim(),mudou:true}; }
      return {str,mudou:false};
    };
    // até 2 tokens de lixo em cada ponta (ex.: ícone + seta, dois símbolos seguidos)
    for(let i=0;i<2;i++){ const r=aparaUmaVez(s,true); s=r.str; if(!r.mudou) break; }
    for(let i=0;i<2;i++){ const r=aparaUmaVez(s,false); s=r.str; if(!r.mudou) break; }
    s=s.replace(/\.+$/,"").trim(); // ponto solto no final (seta/ícone de dropdown lido como ".")
    return s.trim();
  }
  // Se o texto lido bater com um time já salvo em "times" mais um resto curto
  // de lixo colado (do escudo), corrige para o nome exato salvo. Também tenta
  // comparar sem espaços, pra pegar casos onde o OCR "colou" duas palavras do
  // nome (ex.: "GremioFBPA" lido sem o espaço de "Grêmio FBPA").
  function ajustarTimeConhecidoOCR(cand) {
    const s=String(cand||"").trim();
    if(!s) return s;
    const alvo=normBusca(s), alvoSemEspaco=alvo.replace(/\s+/g,"");
    let melhor=null, melhorResto=Infinity;
    for(const t of (times||[])) {
      const n=normBusca(t.nome), nSemEspaco=n.replace(/\s+/g,"");
      if(!n) continue;
      if(alvo===n || alvoSemEspaco===nSemEspaco) return t.nome;
      if(alvo.startsWith(n)) {
        const resto=alvo.slice(n.length).trim();
        if(resto && resto.length<=3 && resto.length<melhorResto) { melhor=t.nome; melhorResto=resto.length; }
      }
      if(alvo.endsWith(n)) {
        const resto=alvo.slice(0,alvo.length-n.length).trim();
        if(resto && resto.length<=3 && resto.length<melhorResto) { melhor=t.nome; melhorResto=resto.length; }
      }
      if(alvoSemEspaco.startsWith(nSemEspaco)) {
        const resto=alvoSemEspaco.slice(nSemEspaco.length);
        if(resto && resto.length<=3 && resto.length<melhorResto) { melhor=t.nome; melhorResto=resto.length; }
      }
      if(alvoSemEspaco.endsWith(nSemEspaco)) {
        const resto=alvoSemEspaco.slice(0,alvoSemEspaco.length-nSemEspaco.length);
        if(resto && resto.length<=3 && resto.length<melhorResto) { melhor=t.nome; melhorResto=resto.length; }
      }
    }
    return melhor||s;
  }
  function limparTimeOCRFinal(cand) { return ajustarTimeConhecidoOCR(limparRuidoEscudoOCR(cand)); }

  function extrairTimesSimplesOCR(texto) {
    const raw=String(texto||"").replace(/\r/g,"\n");
    const linhas=raw.split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
    const limparTime=t=>String(t||"")
      .replace(/\(\s*\d+\s*[º°oª]?\s*\)/gi,"")
      .replace(/\bAO\s+VIVO\b/gi,"")
      .replace(/\bLIVE\b/gi,"")
      .replace(/\b\d{1,3}\s*['’]\b/g,"")
      .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.'’\- ]+$/g,"")
      .replace(/\s+/g," ").trim();
    const pareceTime=t=>{
      const x=limparTime(t), n=normBusca(x);
      const letras=(x.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
      const digitos=(x.match(/\d/g)||[]).length;
      const palavras=x.split(/\s+/).filter(Boolean);
      const siglaCurta=/^[A-Z]{2,4}$/.test(x);
      const tamanhoNome=letras>=3 || siglaCurta;
      const dominadoPorNumero=digitos>0 && digitos>=letras;
      const fragmentoCurto=letras<3 && !siglaCurta;
      const contemSeparadorConfronto=/\s(?:x|×|vs\.?)\s/i.test(x);
      return x.length>=2 && tamanhoNome && !dominadoPorNumero && !fragmentoCurto && /[a-zà-ÿ]/i.test(x) && !contemSeparadorConfronto &&
        !/^(pre|live|ver mais odds|total|estatisticas|estatistica|suporte|ht|ao vivo|este jogo|todos|casa|fora|empate|possivel|correcao|preco|favorito)$/.test(n) &&
        !/^(e|d|v|ga|go|o|x|vs)$/.test(n) &&
        !/^\d+$/.test(n) && !/^possivel correcao/.test(n) &&
        !(palavras.length===1 && letras<4 && !siglaCurta);
    };

    let mandante="", visitante="";

    // Padrão 1: "Time A x Time B" (sem placar entre os nomes)
    for(const ln of linhas){
      let m=String(ln).match(/^(.{2,55}?)\s*\(\s*\d+\s*[º°oª]?\s*\)\s*(?:x|×|vs\.?)\s*\(\s*\d+\s*[º°oª]?\s*\)\s*(.{2,55})$/i);
      if(!m){
        const textoLinha=String(ln);
        const parentesesQuebrados=(textoLinha.match(/\(/g)||[]).length!==(textoLinha.match(/\)/g)||[]).length;
        if(!parentesesQuebrados) {
          const semRuidoParenteses=textoLinha.replace(/\([^)]{0,14}\)/g," ").replace(/\s+/g," ").trim();
          m=semRuidoParenteses.match(/^(.{2,55}?)\s+(?:x|×|vs\.?)\s+(.{2,55})$/i);
        }
      }
      if(m){
        // Se o "x"/"vs" encontrado está grudado em dígitos dos dois lados (ex.:
        // "Real Sociedad 0 x 0 Celta de Vigo"), o match caiu bem no placar, não
        // no separador real dos times. Descarta e deixa o Padrão 2 (abaixo)
        // cuidar desse caso, que já sabe separar nome + placar + nome.
        const caiuNoPlacar=/\d\s*$/.test(String(m[1])) && /^\s*\d/.test(String(m[2]));
        if(!caiuNoPlacar){
          const a=limparTimeOCRFinal(limparTime(m[1])), b=limparTimeOCRFinal(limparTime(m[2]));
          if(pareceTime(a)&&pareceTime(b)){mandante=a;visitante=b;break;}
        }
      }
    }

    // Padrão 2: "Time A <placar> Time B" (ex.: Real Sociedad 0 x 0 Celta de Vigo)
    if(!pareceTime(mandante)||!pareceTime(visitante)){
      for(let i=0;i<linhas.length;i++){
        const m=linhas[i].match(/(\d{1,2})\s*[xX×]\s*(\d{1,2})/);
        if(!m) continue;
        const pos=m.index||0, fim=pos+m[0].length;
        let esq=limparTimeOCRFinal(limparTime(linhas[i].slice(0,pos)));
        let dir=limparTimeOCRFinal(limparTime(linhas[i].slice(fim)));
        if(!pareceTime(esq)){
          for(let k=i-1;k>=Math.max(0,i-7);k--){ if(pareceTime(linhas[k])){esq=limparTimeOCRFinal(limparTime(linhas[k]));break;} }
        }
        if(!pareceTime(dir)){
          for(let k=i+1;k<=Math.min(linhas.length-1,i+7);k++){ if(pareceTime(linhas[k])){dir=limparTimeOCRFinal(limparTime(linhas[k]));break;} }
        }
        if(pareceTime(esq)&&pareceTime(dir)){ mandante=esq; visitante=dir; break; }
      }
    }

    if(!pareceTime(mandante)||!pareceTime(visitante)) return {ok:false,mandante,visitante};
    return {ok:true,mandante,visitante};
  }

  // Lê um print da bolsa com VÁRIOS jogos ao mesmo tempo (lista tipo "1 X 2"),
  // em vez de um confronto só. Separa o texto em blocos a partir de cada
  // horário (HH:MM) encontrado; dentro de cada bloco, pega os dois primeiros
  // nomes de time e as odds decimais (ignora a do empate — só interessa
  // Casa e Visitante). Tolerante a OCR que junta nome do time e odds na
  // mesma linha (comum em telas com tabela/colunas).
  function parseListaJogosBolsaOCR(texto) {
    const raw=String(texto||"").replace(/\r/g,"\n");
    const linhas=raw.split(/\n+/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);

    // limparTime só existe como const local dentro de outras funções (extrairTimesSimplesOCR
    // etc.), então repetimos aqui a mesma limpeza em vez de depender de um nome fora de escopo.
    const limparTime=t=>String(t||"")
      .replace(/\(\s*\d+\s*[º°oª]?\s*\)/gi,"")
      .replace(/\bAO\s+VIVO\b/gi,"")
      .replace(/\bLIVE\b/gi,"")
      .replace(/\b\d{1,3}\s*['’]\b/g,"")
      .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.'’\- ]+$/g,"")
      .replace(/\s+/g," ").trim();

    const idxHorarios=[];
    linhas.forEach((l,i)=>{
      const m=l.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if(m) idxHorarios.push({i,horario:`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`});
    });

    const pareceTimeLista=t=>{
      const x=String(t||"").trim(), n=normBusca(x);
      if(!x) return false;
      const letras=(x.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
      if(letras<3) return false;
      if(/^\d+$/.test(n)) return false;
      if(/^(1|x|2)$/.test(n)) return false;
      return !/^(suporte|ver mais odds|ao vivo|hoje|amanha|amanhã|destaques|favoritos|total|estatisticas|estatísticas)$/.test(n);
    };

    const jogos=[];
    for(let k=0;k<idxHorarios.length;k++){
      const ini=idxHorarios[k].i, fim=(k+1<idxHorarios.length)?idxHorarios[k+1].i:linhas.length;
      const bloco=linhas.slice(ini,fim);
      const candidatos=[];
      bloco.forEach(l=>{
        let t=l.replace(/\b\d{1,2}:\d{2}\b/g,"")
                .replace(/\b\d{1,3}[.,]\d{2}\b/g,"")
                .replace(/\b[12]\b/g,"")
                .replace(/\bx\b/gi,"")
                .trim();
        t=limparTimeOCRFinal(limparTime(t));
        if(pareceTimeLista(t)) candidatos.push(t);
      });
      const mandante=candidatos[0]||"", visitante=candidatos[1]||"";
      const blocoTexto=bloco.join(" ");
      const odds=Array.from(blocoTexto.matchAll(/\b(\d{1,3}[.,]\d{2})\b/g))
        .map(m=>Number(m[1].replace(",",".")))
        .filter(n=>isFinite(n)&&n>=1.01&&n<=999);
      if(!mandante||!visitante||mandante===visitante||odds.length<2) continue;
      const oddCasa=odds[0], oddVisitante=odds.length>=3?odds[2]:odds[1];
      if(!(oddCasa>1.01&&oddVisitante>1.01)) continue;
      jogos.push({
        id:"lb_"+k+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,5),
        horario:idxHorarios[k].horario, mandante, visitante, oddCasa, oddVisitante,
        favorito:oddCasa<=oddVisitante?mandante:visitante,
        oddFavorito:Math.min(oddCasa,oddVisitante)
      });
    }
    return jogos;
  }

  async function lerLeitorDaBolsa(file) {
    if(!file) return;
    if(!window.Tesseract || !window.Tesseract.recognize){alert("O leitor de imagem ainda não carregou. Verifique a internet e recarregue o app.");return;}
    setLeitorBolsaCarregando(true); setLeitorBolsaStatus("Lendo imagem…"); setLeitorBolsaResultado(null); setLeitorBolsaLista([]);
    try{
      const logger=m=>{if(m.status==="recognizing text") setLeitorBolsaStatus(`Lendo imagem… ${Math.round((Number(m.progress)||0)*100)}%`);};
      // Prints pequenos (comuns em recortes de bolsa) saem muito melhor no OCR
      // depois de ampliados e com contraste realçado. Se o preparo falhar por
      // qualquer motivo, cai para o arquivo original sem travar a leitura.
      let entradaOCR=file;
      try{ entradaOCR=await prepararImagemOCRAoVivo(file); }catch(e){ console.warn("Não foi possível ampliar a imagem, usando original",e); }
      let r=await window.Tesseract.recognize(entradaOCR,"por",{logger});
      let texto=r?.data?.text||"";

      // RADAR DE OPORTUNIDADE: identifica o confronto, a entrada indicada e o horário
      // e já envia o registro para ⭐ Possíveis Entradas, mesmo sem odds 1X2.
      let radar=parseRadarOportunidadeOCR(texto,tISO(new Date()),{id:"img_radar_"+Date.now().toString(36),nome:file.name});
      if(!radar.length && entradaOCR!==file){
        try{
          const rr=await window.Tesseract.recognize(file,"por",{logger});
          const tt=rr?.data?.text||"";
          const radarOriginal=parseRadarOportunidadeOCR(tt,tISO(new Date()),{id:"img_radar_"+Date.now().toString(36),nome:file.name});
          if(radarOriginal.length){ radar=radarOriginal; texto=tt; }
        }catch(e2){ console.warn("Nova leitura do Radar não pôde ser executada",e2); }
      }
      if(radar.length){
        const rj=radar[0];
        const possivel={...rj,id:"pe_radar_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),
          tipo:"radar",entrada:rj.entradaSugerida,estrategia:"RADAR DE OPORTUNIDADE",
          metodo:"N/D",origem:"OCR_RADAR",imagemNome:file.name,analiseInicial:rj.analiseInicial};
        salvarPossiveisEntradas([possivel]);
        setLeitorBolsaLista([possivel]);
        setLeitorBolsaStatus("✓ Radar de Oportunidade identificado · salvo em ⭐ Possíveis Entradas");
        return;
      }

      // Tenta primeiro como LISTA de vários jogos (tela "1 X 2" da bolsa).
      // Só cai no leitor de um confronto só se não achar nenhum jogo válido aqui.
      let lista=parseListaJogosBolsaOCR(texto);
      if(!lista.length && entradaOCR!==file){
        setLeitorBolsaStatus("Tentando novamente…");
        const r2=await window.Tesseract.recognize(file,"por",{logger});
        texto=r2?.data?.text||"";
        lista=parseListaJogosBolsaOCR(texto);
      }
      if(lista.length){
        setLeitorBolsaLista(lista);
        salvarPossiveisEntradas(lista);
        setLeitorBolsaStatus(`✓ ${lista.length} jogo${lista.length>1?"s":""} identificado${lista.length>1?"s":""} · salvo em ⭐ Possíveis Entradas`);
        return;
      }

      let times=extrairTimesSimplesOCR(texto);
      if(!times.ok && entradaOCR!==file){
        // Ampliação não ajudou (ou atrapalhou); tenta de novo com o arquivo original.
        setLeitorBolsaStatus("Tentando novamente…");
        r=await window.Tesseract.recognize(file,"por",{logger});
        texto=r?.data?.text||"";
        times=extrairTimesSimplesOCR(texto);
      }
      if(!times.ok){
        setLeitorBolsaStatus("");
        alert("Não consegui identificar os dois times nessa imagem. Tente um print mais nítido, mostrando claramente os nomes dos dois times.");
        return;
      }
      setLeitorBolsaResultado({mandante:times.mandante,visitante:times.visitante});
      setLeitorBolsaStatus("✓ Times identificados");
    }catch(e){
      console.error(e); alert("Não foi possível ler a imagem. Tente novamente.");
    }finally{
      setLeitorBolsaCarregando(false);
      if(leitorBolsaInputRef.current) leitorBolsaInputRef.current.value="";
    }
  }

  function criarOperacaoDoRadar(jogo) {
    if(!hj){ alert("O dia de hoje ainda não está dentro do ciclo ativo."); return; }
    const data=tISO(new Date());
    const confronto=`${jogo.mandante} x ${jogo.visitante}`;
    const existente=jogosDia.find(x=>mesmaPartida(x,{data,mandante:jogo.mandante,visitante:jogo.visitante}));
    const j={
      ...(existente||jogoVazio(data,null)),
      id:existente?.id||("jg_radar_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)),
      data,horario:jogo.horario,mandante:jogo.mandante,visitante:jogo.visitante,
      entradaSugerida:jogo.entrada||jogo.entradaSugerida||"N/D",
      analiseInicial:jogo.analiseInicial||`Radar de Oportunidade: ${confronto}`,
      observacoes:`Radar de Oportunidade · Entrada indicada: ${jogo.entrada||jogo.entradaSugerida||"N/D"} · Método: ${jogo.metodo||"N/D"}`,
      metodos:[],status:"PENDENTE",statusLeitura:"OK",errosLeitura:[],
      origem:"OCR_RADAR",atualizadoEm:Date.now(),criadoEm:existente?.criadoEm||Date.now()
    };
    persistirJogosConfirmados([j]);
    if(jogo.id) marcarPossivelEntrada(jogo.id,{usada:true});
    setShowLeitorBolsa(false);setLeitorBolsaLista([]);setLeitorBolsaResultado(null);setLeitorBolsaStatus("");
    setShowPossiveisEntradas(false);setPossivelEntradaBanner(null);
    abrirAddOp(hj.semana,hj.dia,null);
    setOpForm(prev=>({...prev,time:jogo.entrada||jogo.entradaSugerida||confronto,hora:jogo.horario||prev.hora,
      jogo:confronto,observacao:`Radar de Oportunidade · ${confronto} · Entrada indicada: ${jogo.entrada||jogo.entradaSugerida||"N/D"} · Método: ${jogo.metodo||"N/D"}`}));
  }

  function criarOperacaoDoListaBolsa(jogo) {
    if(jogo?.tipo==="radar"){ criarOperacaoDoRadar(jogo); return; }
    if(!hj){ alert("O dia de hoje ainda não está dentro do ciclo ativo."); return; }
    const data=tISO(new Date());
    const existente=jogosDia.find(x=>mesmaPartida(x,{data,mandante:jogo.mandante,visitante:jogo.visitante}));
    const j={
      ...(existente||jogoVazio(data,null)),
      id:existente?.id||("jg_bolsa_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)),
      data,horario:jogo.horario,mandante:jogo.mandante,visitante:jogo.visitante,favorito:jogo.favorito,
      entradaSugerida:`BACK ${jogo.favorito}`,
      metodos:Array.from(new Set([...(existente?.metodos||[]),"back_favorito"])),
      timesMetodo:{...(existente?.timesMetodo||{}),back_favorito:jogo.favorito},
      oddSugerida:jogo.oddFavorito,
      oddsAoVivo:{casa:jogo.oddCasa,empate:null,fora:jogo.oddVisitante,fonte:"LISTA_BOLSA"},
      analiseInicial:`Leitor da Bolsa (lista): ${jogo.mandante} @ ${jogo.oddCasa.toFixed(2)} x ${jogo.visitante} @ ${jogo.oddVisitante.toFixed(2)}. Favorito: ${jogo.favorito} @ ${jogo.oddFavorito.toFixed(2)}.`,
      confianca:"N/D",status:"PENDENTE",statusLeitura:"OK",errosLeitura:[],origem:"OCR_LISTA_BOLSA",
      atualizadoEm:Date.now(),criadoEm:existente?.criadoEm||Date.now()
    };
    persistirJogosConfirmados([j]);
    // Se este jogo veio de uma "Possível Entrada" salva, marca como usada para sair da lista pendente
    // sem apagar o histórico.
    if(jogo.id) marcarPossivelEntrada(jogo.id,{usada:true});
    setShowLeitorBolsa(false); setLeitorBolsaLista([]); setLeitorBolsaResultado(null); setLeitorBolsaStatus("");
    setShowPossiveisEntradas(false); setPossivelEntradaBanner(null);
    setTimeout(()=>abrirOperacaoDoJogo(j,"back_favorito"),40);
  }

  // Salva automaticamente, em "⭐ Possíveis Entradas de Hoje", os jogos que o Leitor da
  // Bolsa acabou de identificar numa lista. Não mexe na leitura/parse da imagem — só
  // persiste o resultado já pronto (evita duplicar o mesmo confronto/horário do dia).
  function salvarPossiveisEntradas(lista) {
    if(!Array.isArray(lista) || !lista.length) return;
    const dataHoje=tISO(new Date());
    setPossiveisEntradas(prev=>{
      const limpo=limparPossiveisEntradasAntigas(prev);
      const novos=[...limpo];
      for(const jg of lista) {
        const data=jg.data||dataHoje;
        const jaExiste=novos.some(e=>e.data===data && normBusca(e.mandante)===normBusca(jg.mandante) && normBusca(e.visitante)===normBusca(jg.visitante) && String(e.horario||"")===String(jg.horario||""));
        if(jaExiste) continue;
        novos.push({
          id:jg.id||("pe_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)),
          data,horario:jg.horario||"N/D",mandante:jg.mandante||"N/D",visitante:jg.visitante||"N/D",
          oddCasa:jg.oddCasa??null,oddVisitante:jg.oddVisitante??null,favorito:jg.favorito||"N/D",oddFavorito:jg.oddFavorito??null,
          tipo:jg.tipo||"bolsa",entrada:jg.entrada||jg.entradaSugerida||"",entradaSugerida:jg.entradaSugerida||jg.entrada||"N/D",
          estrategia:jg.estrategia||"back_favorito",metodo:jg.metodo||"N/D",
          origem:jg.origem||"OCR_LISTA_BOLSA",analiseInicial:jg.analiseInicial||"",
          imagemId:jg.imagemId||null,imagemNome:jg.imagemNome||"",
          usada:false,ignorada:false,criadoEm:jg.criadoEm||Date.now()
        });
      }
      // Grava imediatamente no aparelho, sem depender do próximo ciclo de renderização.
      // Isso evita que uma leitura recém-feita seja perdida por um snapshot antigo do React.
      try { localStorage.setItem("bc:possiveisEntradas", JSON.stringify(novos)); } catch(e) { console.warn("Não foi possível salvar Possíveis Entradas",e); }
      return novos;
    });
  }

  function marcarPossivelEntrada(id,mudancas) {
    setPossiveisEntradas(prev=>prev.map(e=>e.id===id?{...e,...mudancas}:e));
  }

  function descartarPossivelEntrada(id) {
    marcarPossivelEntrada(id,{ignorada:true});
  }

  function criarOperacaoDoLeitorDaBolsa() {
    if(!leitorBolsaResultado) return;
    if(!hj){ alert("O dia de hoje ainda não está dentro do ciclo ativo."); return; }
    abrirAddOp(hj.semana,hj.dia,null);
    const confronto=`${leitorBolsaResultado.mandante} x ${leitorBolsaResultado.visitante}`;
    setOpForm(prev=>({...prev,time:confronto,observacao:prev.observacao?prev.observacao:"Pré-entrada (Leitor da Bolsa)"}));
    setShowLeitorBolsa(false);
    setLeitorBolsaResultado(null);
    setLeitorBolsaStatus("");
  }

  // ===== LISTA JOGOS LAY ZEBRA =====
  // Parser independente do Leitor da Bolsa: percorre o texto inteiro e cria
  // um item para cada cabeçalho "Time A x Time B - HH:MM (NN/NN)".
  function parseListaLayZebraOCR(texto) {
    const bruto=String(texto||"")
      .replace(/\r/g,"\n")
      .replace(/[–—−]/g,"-")
      .replace(/[×]/g,"x")
      .replace(/\u00a0/g," ");
    const cabecalho=/([^\n]+?)\s+[xX]\s+([^\n]+?)\s*-\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*\(\s*(\d{1,3})\s*[\/|]\s*(\d{1,3})\s*\)/g;
    const encontrados=[];
    let m;
    while((m=cabecalho.exec(bruto))!==null) {
      encontrados.push({
        indice:m.index,
        fim:cabecalho.lastIndex,
        mandante:String(m[1]||"").replace(/^\s*[•·\-*]+\s*/,"").trim(),
        visitante:String(m[2]||"").trim(),
        hora:`${String(m[3]).padStart(2,"0")}:${m[4]}`,
        percentual:`${m[5]}/${m[6]}`
      });
    }
    return encontrados.map((j,i)=>{
      const bloco=bruto.slice(j.fim,encontrados[i+1]?.indice??bruto.length);
      const depoisLay=(bloco.match(/lay\s+a[o0]\s+([^\n]+)/i)?.[1]||"").trim();
      const alvo=[j.visitante,j.mandante].find(t=>depoisLay && (normBusca(depoisLay).includes(normBusca(t))||normBusca(t).includes(normBusca(depoisLay)))) || j.visitante;
      return {
        id:`lay_zebra_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2,6)}`,
        mandante:j.mandante,
        visitante:j.visitante,
        hora:j.hora,
        percentual:j.percentual,
        entrada:`Lay ao ${alvo}`,
        time:alvo
      };
    }).filter(j=>j.mandante&&j.visitante&&j.hora);
  }

  async function lerListaLayZebra(file) {
    if(!file) return;
    if(!window.Tesseract || !window.Tesseract.recognize){alert("O leitor de imagem ainda não carregou. Verifique a internet e recarregue o app.");return;}
    setListaLayZebraCarregando(true); setListaLayZebraJogos([]); setListaLayZebraStatus("Lendo a imagem completa…");
    const logger=m=>{if(m.status==="recognizing text") setListaLayZebraStatus(`Lendo a imagem completa… ${Math.round((Number(m.progress)||0)*100)}%`);};
    try {
      const r=await window.Tesseract.recognize(file,"por",{logger,tessedit_pageseg_mode:6});
      let jogos=parseListaLayZebraOCR(r?.data?.text||"");
      if(!jogos.length) {
        setListaLayZebraStatus("Aprimorando a imagem e tentando novamente…");
        let otimizada=file;
        try { otimizada=await prepararImagemOCRAoVivo(file); } catch(e) {}
        const r2=await window.Tesseract.recognize(otimizada,"por",{logger,tessedit_pageseg_mode:6});
        jogos=parseListaLayZebraOCR(r2?.data?.text||"");
      }
      setListaLayZebraJogos(jogos);
      setListaLayZebraStatus(jogos.length?`✓ ${jogos.length} jogo${jogos.length>1?"s":""} identificado${jogos.length>1?"s":""}.` : "Não encontrei jogos no padrão esperado.");
      if(jogos.length) {
        const hoje=tISO(new Date());
        const novos=jogos.map(j=>({...j,data:hoje,tipo:"zebra"}));
        const localAtual=(()=>{try{const p=JSON.parse(localStorage.getItem("bc:listaLayPlacarSalvas")||"[]");return Array.isArray(p)?p:[];}catch(e){return [];}})();
        const base=mesclarListasLaySalvas(listaLayPlacarSalvas,localAtual);
        persistirListaLayAgora([...base.filter(x=>!(x.data===hoje&&x.tipo==="zebra")),...novos]);
      }
      if(!jogos.length) alert("Não consegui identificar a lista. Use uma imagem nítida contendo: Time A x Time B - HH:MM (60/40) e, abaixo, Lay ao Time B.");
    } catch(e) {
      console.error(e); setListaLayZebraStatus(""); alert("Não foi possível ler a imagem. Tente novamente com um print mais nítido.");
    } finally {
      setListaLayZebraCarregando(false);
      if(listaLayZebraInputRef.current) listaLayZebraInputRef.current.value="";
    }
  }

  function abrirOperacaoDaListaLay(jogo,config={estrategiaBase:"Zebra",placar:"",origem:"Lista Jogos Lay Zebra"}) {
    if(!hj){ alert("O dia de hoje ainda não está dentro do ciclo ativo."); return; }
    abrirAddOp(hj.semana,hj.dia,null);
    const confronto=`${jogo.mandante} x ${jogo.visitante}`;
    setOpForm(prev=>({...prev,
      metodo:"LAY", estrategiaBase:config.estrategiaBase, placar:config.placar||"", placarManual:"",
      time:jogo.time||jogo.visitante, jogo:confronto, hora:jogo.hora||prev.hora,
      mercado:jogo.entrada||`Lay ao ${jogo.time||jogo.visitante}`,
      origem:config.origem,
      observacao:`${config.origem} · Jogo: ${confronto}${jogo.percentual?` · Percentual: ${jogo.percentual}`:""}`
    }));
    setShowListaLayZebra(false);
  }

  function parseListaLayPlacarOCR(texto) {
    const linhas=String(texto||"").replace(/\r/g,"\n").replace(/[–—−]/g,"-").replace(/[×]/g,"x").split(/\n+/), out=[];
    for(const original of linhas) {
      const linha=original.replace(/^[^\d\n]*?(?=\d{1,2}\s*[:.])/g,"").trim();
      const m=linha.match(/^(\d{1,2})\s*[:.]\s*(\d{2})\s*[-:–—]\s*(.+?)\s+[xX]\s+(.+?)\s*$/);
      if(!m) continue;
      const mandante=m[3].replace(/^[-–—•·\s]+/,"").trim(), visitante=m[4].replace(/[|]+$/g,"").trim();
      if(mandante.length<2||visitante.length<2||/partidas favoritas|favoritas|favoritos/i.test(mandante)) continue;
      out.push({id:`lay_placar_${Date.now().toString(36)}_${out.length}_${Math.random().toString(36).slice(2,6)}`,hora:`${String(m[1]).padStart(2,"0")}:${m[2]}`,mandante,visitante});
    }
    return out;
  }

  async function lerListaLayPlacar(file,tipo) {
    if(!file) return;
    setListaLayPlacarTipo(tipo); setListaLayZebraCarregando(true); setListaLayZebraJogos([]); setListaLayZebraStatus("Lendo a imagem completa…");
    const logger=m=>{if(m.status==="recognizing text") setListaLayZebraStatus(`Lendo a imagem completa… ${Math.round((Number(m.progress)||0)*100)}%`);};
    try { const r=await window.Tesseract.recognize(file,"por",{logger,tessedit_pageseg_mode:6}); let jogos=parseListaLayPlacarOCR(r?.data?.text||""); if(!jogos.length){let otimizada=file;try{otimizada=await prepararImagemOCRAoVivo(file);}catch(e){} const r2=await window.Tesseract.recognize(otimizada,"por",{logger,tessedit_pageseg_mode:6});jogos=parseListaLayPlacarOCR(r2?.data?.text||"");} setListaLayZebraJogos(jogos);setListaLayZebraStatus(jogos.length?`✓ ${jogos.length} jogos identificados.`:"Não encontrei jogos no padrão esperado."); if(jogos.length) { const hoje=tISO(new Date()); const novos=jogos.map(j=>({...j,data:hoje,tipo})); const localAtual=(()=>{try{const p=JSON.parse(localStorage.getItem("bc:listaLayPlacarSalvas")||"[]");return Array.isArray(p)?p:[];}catch(e){return [];}})(); const base=mesclarListasLaySalvas(listaLayPlacarSalvas,localAtual); persistirListaLayAgora([...base.filter(x=>!(x.data===hoje&&x.tipo===tipo)),...novos]); } }
    catch(e){console.error(e);setListaLayZebraStatus("");alert("Não foi possível ler a imagem.");} finally{setListaLayZebraCarregando(false);if(listaLayZebraInputRef.current)listaLayZebraInputRef.current.value="";}
  }
  function abrirOperacaoDaListaLayPlacar(jogo){abrirOperacaoDaListaLay(jogo,{estrategiaBase:"Placar Correto",placar:listaLayPlacarTipo,origem:`Lista Lay ${listaLayPlacarTipo}`});}

  // Importador por imagem mantido como alternativa/legado. A fonte principal da Central é texto colado.
  async function importarAnalisesJogos(files) {
    const lista=Array.from(files||[]); if(!lista.length) return;
    setImportJogosCarregando(true); setImportJogosProgresso({pct:1,texto:"Preparando imagens…"});
    const revisao=[]; const metas=[];
    for(let fi=0;fi<lista.length;fi++) {
      const file=lista[fi]; const imagem={id:"img_"+Date.now().toString(36)+"_"+fi+"_"+Math.random().toString(36).slice(2,6),nome:file.name,data:jogosDataFiltro||tISO(new Date())};
      try { await salvarImagemJogoLocal(imagem.id,file); } catch(e) { console.warn("Imagem não pôde ser salva localmente",e); }
      let texto=""; let erroOCR="";
      if(window.Tesseract && window.Tesseract.recognize) {
        try {
          const r=await window.Tesseract.recognize(file,"por",{logger:m=>{ if(m.status==="recognizing text") { const base=fi/lista.length, local=Number(m.progress)||0; setImportJogosProgresso({pct:Math.round((base+local/lista.length)*100),texto:`Lendo ${fi+1}/${lista.length}: ${file.name}`}); } }});
          texto=r?.data?.text||"";

          // O layout do Radar usa letras grandes e pode ficar melhor com
          // ampliação/contraste. Faz uma segunda leitura somente se necessário.
          if(!parseRadarOportunidadeOCR(texto,jogosDataFiltro,imagem).length) {
            try {
              const otimizada=await prepararImagemOCRAoVivo(file);
              const r2=await window.Tesseract.recognize(otimizada,"por",{logger:m=>{ if(m.status==="recognizing text") { const base=fi/lista.length, local=Number(m.progress)||0; setImportJogosProgresso({pct:Math.round((base+local/lista.length)*100),texto:`Aprimorando leitura ${fi+1}/${lista.length}: ${file.name}`}); } },tessedit_pageseg_mode:11});
              const t2=r2?.data?.text||"";
              if(t2 && parseRadarOportunidadeOCR(t2,jogosDataFiltro,imagem).length) texto=t2;
            } catch(e2) { console.warn("Segunda leitura do Radar não pôde ser executada",e2); }
          }
        } catch(e) { erroOCR=e?.message||"Falha na leitura"; }
      } else erroOCR="Leitor OCR não carregou. Verifique a internet e recarregue.";
      // Primeiro tenta o layout específico do RADAR DE OPORTUNIDADE.
      // Se não for esse layout, mantém o parser antigo para os demais prints.
      let encontrados=parseRadarOportunidadeOCR(texto,jogosDataFiltro,imagem);
      if(!encontrados.length) encontrados=parseAnaliseJogosOCR(texto,jogosDataFiltro,imagem);
      encontrados=encontrados.map(j=>({...j,metodos:Array.isArray(j.metodos)&&j.metodos.length?j.metodos:classificarMetodosDoTexto(j.entradaSugerida,j.mandante,j.visitante,j.favorito),statusLeitura:"REVISAR",errosLeitura:Array.isArray(j.errosLeitura)&&j.errosLeitura.length?j.errosLeitura:["Importação por imagem: confirme os dados antes de salvar."]}));
      if(!encontrados.length) encontrados=[jogoVazio(jogosDataFiltro,imagem)];
      revisao.push(...encontrados);
      metas.push({id:imagem.id,data:jogosDataFiltro,nome:file.name,qtdDetectados:encontrados.length,ocrOk:!erroOCR,erroOCR:erroOCR||null,criadoEm:Date.now()});
    }
    setAnalisesJogos(prev=>[...prev,...metas]); setJogosRevisao(prev=>[...prev,...revisao]); setShowRevisaoJogos(true);
    setImportJogosCarregando(false); setImportJogosProgresso({pct:100,texto:`${revisao.length} jogo(s) para revisar`});
  }

  function atualizarJogoRevisao(id,campo,valor) { setJogosRevisao(prev=>prev.map(j=>j.id===id?{...j,[campo]:valor}:j)); }
  function alternarMetodoRevisao(id,metodo) {
    setJogosRevisao(prev=>prev.map(j=>{if(j.id!==id)return j;const atual=Array.isArray(j.metodos)?j.metodos:[];return {...j,metodos:atual.includes(metodo)?atual.filter(x=>x!==metodo):[...atual,metodo]};}));
  }
  function normalizarJogoAntesSalvar(j) {
    const mets=Array.from(new Set([...(Array.isArray(j.metodos)?j.metodos:[]),...classificarMetodosDoTexto(j.entradaSugerida||"",j.mandante,j.visitante,j.favorito)]));
    const estrategias=Array.from(new Set([...(Array.isArray(j.estrategias)?j.estrategias:[]),j.estrategiaBase,j.entradaSugerida].map(x=>String(x||"").trim()).filter(x=>x&&x!=="N/D")));
    return {...j,data:j.data||jogosDataFiltro||tISO(new Date()),horario:String(j.horario||"N/D").trim()||"N/D",mandante:String(j.mandante||"N/D").trim()||"N/D",visitante:String(j.visitante||"N/D").trim()||"N/D",favorito:String(j.favorito||"N/D").trim()||"N/D",over25:pctJogo(j.over25),under25:pctJogo(j.under25),btts:pctJogo(j.btts),golHT:pctJogo(j.golHT),favoritoHT:pctJogo(j.favoritoHT),primeiroGolFavorito:pctJogo(j.primeiroGolFavorito),entradaSugerida:String(j.entradaSugerida||"N/D").trim()||"N/D",confianca:String(j.confianca||"N/D").trim()||"N/D",estrategias,metodos:mets,timesMetodo:j.timesMetodo||{},atualizacoes:Array.isArray(j.atualizacoes)?j.atualizacoes:[],status:j.status||"PENDENTE",atualizadoEm:Date.now()};
  }
  function errosJogoParaBanco(j) {
    const erros=[]; const a=String(j.mandante||"").trim(),b=String(j.visitante||"").trim();
    if(!a||!b||a==="N/D"||b==="N/D") erros.push("Informe exatamente os dois times.");
    if(a&&b&&normBusca(a)===normBusca(b)) erros.push("Mandante e visitante não podem ser iguais.");
    if(/\s+(?:x|×|vs\.?)\s+/i.test(b)) erros.push("O visitante parece conter outro confronto. Separe os jogos.");
    if(j.favorito&&j.favorito!=="N/D"&&![a,b].some(t=>normBusca(t)===normBusca(j.favorito))) erros.push("O favorito precisa ser um dos dois times.");
    if(!metodosDoJogo(j).length && !(Array.isArray(j.estrategias)&&j.estrategias.length) && !String(j.entradaSugerida||"").trim()) erros.push("Informe uma estratégia ou método para esta oportunidade.");
    return erros;
  }
  function mesclarJogoExistente(old,j) {
    const novo={...old,...j,id:old.id,criadoEm:old.criadoEm||j.criadoEm,status:old.status&&old.status!=="PENDENTE"?old.status:(j.status||old.status||"PENDENTE")};
    for(const campo of ["horario","favorito","entradaSugerida","confianca"]) if((j[campo]==null||j[campo]===""||j[campo]==="N/D")&&old[campo]) novo[campo]=old[campo];
    for(const campo of ["over25","under25","btts","golHT","favoritoHT","primeiroGolFavorito"]) if(numPctJogo(j[campo])==null&&numPctJogo(old[campo])!=null) novo[campo]=old[campo];
    novo.estrategias=Array.from(new Set([...(Array.isArray(old.estrategias)?old.estrategias:[]),...(Array.isArray(j.estrategias)?j.estrategias:[]),old.estrategiaBase,j.estrategiaBase,old.entradaSugerida,j.entradaSugerida].map(x=>String(x||"").trim()).filter(x=>x&&x!=="N/D")));
    novo.metodos=Array.from(new Set([...metodosDoJogo(old),...metodosDoJogo(j)]));
    novo.timesMetodo={...(old.timesMetodo||{}),...(j.timesMetodo||{})};
    novo.atualizacoes=Array.isArray(old.atualizacoes)&&old.atualizacoes.length?old.atualizacoes:(j.atualizacoes||[]);
    novo.leituraFinal=old.leituraFinal||j.leituraFinal||null;
    if(j.origem!=="TEXTO"&&!j.analiseInicial) novo.analiseInicial=old.analiseInicial||"";
    novo.atualizadoEm=Date.now();
    return novo;
  }
  function persistirJogosConfirmados(lista) {
    const norm=(Array.isArray(lista)?lista:[]).map(j=>normalizarJogoAntesSalvar({...j,data:normalizarDataJogo(j.data,jogosDataFiltro)}));
    if(!norm.length) return [];
    const consolidada=[...(Array.isArray(jogosDia)?jogosDia:[])];
    for(const j of norm){ const idx=consolidada.findIndex(x=>mesmaPartida(x,j)); if(idx>=0) consolidada[idx]=mesclarJogoExistente(consolidada[idx],j); else consolidada.push(j); }
    setJogosDia(consolidada);
    try { localStorage.setItem("bc:jogosDia",JSON.stringify(consolidada)); } catch(e) { console.warn("Não foi possível salvar jogos localmente",e); }
    if(user && firePronto && navigator.onLine && !aplicandoRemotoRef.current){
      db.collection("dados").doc(user.uid).set({jogosDia:consolidada,syncMeta:{updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:deviceIdRef.current,updatedDevice:deviceLabel}},{merge:true}).then(()=>{setUltimaSync(Date.now());setSyncStatus("sincronizado");setSyncErro(false);}).catch(()=>{setSyncErro(true);setSyncStatus("erro");});
    }
    return norm;
  }
  function salvarJogoRevisao(id) {
    const j=jogosRevisao.find(x=>x.id===id); if(!j) return;
    const pronto=normalizarJogoAntesSalvar(j), erros=errosJogoParaBanco(pronto);
    if(erros.length){setJogosRevisao(prev=>prev.map(x=>x.id===id?{...x,statusLeitura:"REVISAR",errosLeitura:erros}:x));alert("Revise este jogo antes de salvar:\n\n"+erros.join("\n"));return;}
    persistirJogosConfirmados([{...pronto,statusLeitura:"OK",errosLeitura:[]}]);
    const restantes=jogosRevisao.filter(x=>x.id!==id); setJogosRevisao(restantes); if(!restantes.length) setShowRevisaoJogos(false);
  }
  function salvarTodosJogosRevisao() {
    if(!jogosRevisao.length) return;
    const bons=[], ruins=[];
    for(const j of jogosRevisao){const pronto=normalizarJogoAntesSalvar(j),erros=errosJogoParaBanco(pronto);if(erros.length)ruins.push({...j,statusLeitura:"REVISAR",errosLeitura:erros});else bons.push({...pronto,statusLeitura:"OK",errosLeitura:[]});}
    if(bons.length) persistirJogosConfirmados(bons); setJogosRevisao(ruins); setShowRevisaoJogos(ruins.length>0);
    if(ruins.length) alert(`${bons.length} jogo(s) salvos. ${ruins.length} ainda precisam de revisão.`);
  }
  function adicionarJogoManual() { setJogosRevisao(prev=>[...prev,jogoVazio(jogosDataFiltro,null)]); setShowRevisaoJogos(true); }
  function atualizarJogo(id,patch) { setJogosDia(prev=>prev.map(j=>j.id===id?{...j,...patch,atualizadoEm:Date.now()}:j)); }
  function excluirJogo(id) { if(!confirm("Excluir este jogo do banco de oportunidades?")) return; setJogosDia(prev=>prev.filter(j=>j.id!==id)); setJogosCardSelecionados(prev=>prev.filter(x=>x!==id)); setJogosExcluirSelecionados(prev=>prev.filter(x=>x!==id)); if(jogoDetalheId===id) setJogoDetalheId(null); }
  function alternarJogoParaExcluir(j) { if(!j?.id) return; setJogosExcluirSelecionados(prev=>prev.includes(j.id)?prev.filter(id=>id!==j.id):[...prev,j.id]); }
  function excluirJogosSelecionados() { if(!jogosExcluirSelecionados.length) return; const qtd=jogosExcluirSelecionados.length; if(!confirm(`Excluir ${qtd} jogo(s) selecionado(s)?`)) return; const ids=new Set(jogosExcluirSelecionados); setJogosDia(prev=>prev.filter(j=>!ids.has(j.id))); setJogosCardSelecionados(prev=>prev.filter(id=>!ids.has(id))); setJogosExcluirSelecionados([]); if(jogoDetalheId&&ids.has(jogoDetalheId)) setJogoDetalheId(null); }
  function limparJogosDaData() { const dia=jogosDia.filter(j=>j.data===jogosDataFiltro); if(!dia.length) return; if(!confirm(`Excluir todos os ${dia.length} jogos de ${new Date(jogosDataFiltro+"T12:00:00").toLocaleDateString("pt-BR")}?`)) return; const ids=new Set(dia.map(j=>j.id)); setJogosDia(prev=>prev.filter(j=>!ids.has(j.id))); setJogosCardSelecionados([]); setJogosExcluirSelecionados([]); }
  function formatarDataNavegacao(iso){ return new Date(iso+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"}).replace(".",""); }

  function processarAnaliseColada() {
    const texto=limparTextoAnalise(textoAnaliseColada);
    if(!texto){alert("Cole a análise antes de continuar.");return;}
    // Também aceita aqui a lista estruturada com TIME CASA / TIME VISITANTE,
    // para que o usuário não precise escolher uma tela específica para importar.
    const listaEstruturada=parseListaJogosEstruturada(texto);
    if(listaEstruturada.length){
      persistirJogosConfirmados(listaEstruturada);
      const datasImportadas=Array.from(new Set(listaEstruturada.map(j=>normalizarDataJogo(j.data,jogosDataFiltro)).filter(Boolean)));
      if(datasImportadas.length===1) setJogosDataFiltro(datasImportadas[0]);
      setResultadoTextoJogos({tipo:"lista",salvos:listaEstruturada.length,revisar:0,detectados:listaEstruturada.length,data:(datasImportadas.length===1?datasImportadas[0]:null)});
      setTextoAnaliseColada(""); setShowColarAnalise(false);
      return;
    }
    const res=parseAnaliseTexto(texto,jogosDataFiltro), validos=[], revisar=[];
    for(const j of res.jogos){ if(j.statusLeitura==="OK"&&!errosJogoParaBanco(j).length) validos.push(j); else revisar.push(j); }
    if(validos.length) persistirJogosConfirmados(validos);
    if(revisar.length){setJogosRevisao(prev=>[...prev,...revisar]);setShowRevisaoJogos(true);}
    setResultadoTextoJogos({tipo:"analise",salvos:validos.length,revisar:revisar.length,detectados:res.blocosDetectados});
    if(!res.blocosDetectados){alert("Nenhum confronto foi identificado com segurança. Use uma linha como: Chelsea x Luton — GOL NO 1º TEMPO");return;}
    setTextoAnaliseColada(""); setShowColarAnalise(false);
  }

  function aplicarAtualizacaoNoJogo(jogoId,texto,leituraForcada=null) {
    const leitura=leituraForcada||extrairLeituraFinalTexto(texto), agora=Date.now();
    setJogosDia(prev=>prev.map(j=>{
      if(j.id!==jogoId) return j;
      const atualizacao={id:"atu_"+agora.toString(36)+"_"+Math.random().toString(36).slice(2,6),texto:String(texto||"").trim(),impacto:leitura.impacto,entradaFinal:leitura.entradaFinal,segundaOpcao:leitura.segundaOpcao,evitar:leitura.evitar,sinais:leitura.sinais||[],criadoEm:agora};
      return {...j,atualizacoes:[...(Array.isArray(j.atualizacoes)?j.atualizacoes:[]),atualizacao],leituraFinal:{impacto:leitura.impacto,entradaFinal:leitura.entradaFinal,segundaOpcao:leitura.segundaOpcao,evitar:leitura.evitar,sinais:leitura.sinais||[],atualizadoEm:agora},statusLeitura:"OK",atualizadoEm:agora};
    }));
  }
  function candidatosAtualizacaoSemCabecalho(texto) {
    const n=normBusca(texto), dia=jogosDia.filter(j=>j.data===jogosDataFiltro);
    const ambos=dia.filter(j=>{const a=normBusca(j.mandante),b=normBusca(j.visitante);return a&&b&&n.includes(a)&&n.includes(b);});
    if(ambos.length) return ambos;
    return dia.filter(j=>[j.mandante,j.visitante].some(t=>{const x=normBusca(t);return x&&x!=="n/d"&&x.length>=4&&n.includes(x);}));
  }
  function prepararPendenciaAtualizacao(texto,candidatos,motivo,leitura) {
    setAtualizacaoRevisar({texto:String(texto||"").trim(),candidatos:(candidatos||[]).map(j=>j.id),candidatoId:(candidatos||[]).length===1?candidatos[0].id:"",motivo,impacto:leitura?.impacto&&leitura.impacto!=="REVISAR"?leitura.impacto:"REVISAR",entradaFinal:leitura?.entradaFinal||"N/D",segundaOpcao:leitura?.segundaOpcao||"N/D",evitar:leitura?.evitar||"N/D",sinais:leitura?.sinais||[]});
  }
  function processarAtualizacaoColada() {
    const texto=limparTextoAnalise(textoAtualizacaoColada); if(!texto){alert("Cole a atualização pré-jogo antes de continuar.");return;}
    const blocos=blocosJogosDoTexto(texto); let aplicadas=0,revisar=0;
    if(blocos.length) {
      for(const b of blocos) {
        const alvo=jogosDia.find(j=>j.data===jogosDataFiltro&&mesmaPartida(j,{data:jogosDataFiltro,mandante:b.cab.mandante,visitante:b.cab.visitante}));
        const leitura=extrairLeituraFinalTexto(b.texto);
        if(!alvo){revisar++;if(!atualizacaoRevisar)prepararPendenciaAtualizacao(b.texto,[],"Confronto da atualização não foi localizado na data selecionada.",leitura);continue;}
        if(leitura.impacto==="REVISAR"){revisar++;prepararPendenciaAtualizacao(b.texto,[alvo],"O texto não informa com segurança se a tese reforçou, manteve, enfraqueceu ou foi cancelada.",leitura);continue;}
        aplicarAtualizacaoNoJogo(alvo.id,b.texto,leitura);aplicadas++;
      }
    } else {
      const candidatos=candidatosAtualizacaoSemCabecalho(texto),leitura=extrairLeituraFinalTexto(texto);
      if(candidatos.length===1&&leitura.impacto!=="REVISAR"){aplicarAtualizacaoNoJogo(candidatos[0].id,texto,leitura);aplicadas++;}
      else {revisar++;prepararPendenciaAtualizacao(texto,candidatos,candidatos.length===0?"Nenhum jogo da data foi identificado no texto.":candidatos.length>1?"Mais de um jogo pode corresponder à atualização.":"O impacto da atualização não ficou explícito.",leitura);}
    }
    setResultadoTextoJogos({tipo:"atualizacao",aplicadas,revisar});
    setTextoAtualizacaoColada(""); setShowColarAtualizacao(false);
  }
  function temSinaisDeAtualizacao(texto) {
    const n=normBusca(texto||"");
    if(impactoAtualizacaoTexto(texto)!=="REVISAR") return true;
    return /atualizacao|pre jogo|pre-jogo|escalacao|escalacoes|desfalque|desfalques|odd|odds|noticia|noticias|confirmado|confirmada|ausencia|fora do jogo|lesao|entrada final|segunda opcao|evitar/.test(n);
  }

  // Uma única porta de entrada. O sistema decide se o conteúdo cria/mescla uma
  // análise ou se deve ser aplicado como atualização de uma partida existente.
  function parseListaJogosEstruturada(texto) {
    // Formato estruturado do leitor: cada jogo começa em TIME CASA e possui
    // campos TIME VISITANTE, DATA, HORÁRIO, ODDS, ESTRATÉGIA e ENTRADA.
    // A versão anterior tratava todos os jogos separados apenas por linhas ---;
    // por isso vários blocos colados acabavam virando um único jogo ou sumiam.
    const bruto=limparTextoAnalise(texto).replace(/[：]/g,":");
    const inicios=[];
    const reInicio=/(?:^|\n)\s*TIME\s+CASA\s*:/ig;
    let mi;
    while((mi=reInicio.exec(bruto))!==null) inicios.push(mi.index+(mi[0].startsWith("\n")?1:0));
    if(!inicios.length) return [];

    const lerCampo=(bloco,nomes)=>{
      for(const nome of nomes){
        const esc=nome.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const m=bloco.match(new RegExp("(?:^|\\n)\\s*"+esc+"\\s*:\\s*([^\\n]*)","i"));
        if(m && String(m[1]||"").trim()) return String(m[1]).trim();
      }
      return "";
    };
    const normalizarHora=(h)=>{
      const x=String(h||"").trim().replace(/[.]/g,":");
      const m=x.match(/^(?:AO\s+VIVO\s*-\s*)?(\d{1,2}):(\d{2})/i);
      return m ? `${String(Number(m[1])).padStart(2,"0")}:${m[2]}` : (x||"N/D");
    };
    const jogos=[];
    for(let i=0;i<inicios.length;i++){
      const bloco=bruto.slice(inicios[i],inicios[i+1]??bruto.length).trim();
      const casa=lerCampo(bloco,["TIME CASA"]);
      const fora=lerCampo(bloco,["TIME VISITANTE","TIME FORA"]);
      if(!casa||!fora) continue;
      const data=normalizarDataJogo(lerCampo(bloco,["DATA","DIA"]),jogosDataFiltro);
      const horario=normalizarHora(lerCampo(bloco,["HORÁRIO","HORARIO","HORA"]));
      const estrategia=lerCampo(bloco,["ESTRATÉGIA","ESTRATEGIA"]);
      const entrada=lerCampo(bloco,["ENTRADA","APOSTA"]);
      const oddCasa=lerCampo(bloco,["ODD CASA"]), oddEmpate=lerCampo(bloco,["ODD EMPATE"]), oddFora=lerCampo(bloco,["ODD FORA"]);
      const textoEstrat=`${estrategia} ${entrada}`.trim();
      const n=normBusca(textoEstrat);
      const metodos=[];
      // A estratégia escrita pelo usuário é preservada, mas também recebe um
      // método interno para não aparecer como "sem sinal".
      if(/lay\s*0\s*x\s*1|lay\s*0x1/.test(n)) metodos.push("lay_0x1");
      else if(/lay\s*1\s*x\s*0|lay\s*1x0/.test(n)) metodos.push("lay_1x0");
      else if(/lay\s+goleada/.test(n)) metodos.push("lay_goleada");
      else if(/^lay\b/.test(n) || /\blay\b/.test(n)) metodos.push("lay_time");
      if(/back\b/.test(n)) metodos.push("back_favorito");
      if(/under|menos\s+de/.test(n)) metodos.push("under_gols");
      if(/over|mais\s+de|ambas\s+marcam|btts/.test(n)) metodos.push("over_btts");
      const estrategias=Array.from(new Set([estrategia,entrada].map(x=>String(x||"").trim()).filter(x=>x&&x!=="N/D")));
      const alvoLay=(estrategia.match(/^LAY\s+(.+)$/i)||entrada.match(/^LAY\s+(?:AO\s+)?(.+)$/i)||[])[1]||"";
      const timesMetodo={};
      if(metodos.includes("lay_time")||metodos.includes("lay_goleada")||metodos.includes("lay_zebra")) timesMetodo[metodos.includes("lay_goleada")?"lay_goleada": "lay_time"]=alvoLay.trim()||fora;
      if(metodos.includes("lay_0x1")) timesMetodo.lay_0x1=alvoLay.trim();
      if(metodos.includes("lay_1x0")) timesMetodo.lay_1x0=alvoLay.trim();
      jogos.push({
        id:"jg_lista_"+Date.now().toString(36)+"_"+i+"_"+Math.random().toString(36).slice(2,7),
        data,horario,mandante:casa,visitante:fora,favorito:"N/D",
        over25:"N/D",under25:"N/D",btts:"N/D",golHT:"N/D",favoritoHT:"N/D",primeiroGolFavorito:"N/D",
        entradaSugerida:entrada||estrategia||"N/D",confianca:"N/D",nota:null,classificacoes:[],estatisticas:[],metodos:Array.from(new Set(metodos)),
        timesMetodo,analiseInicial:bloco,atualizacoes:[],leituraFinal:null,observacoes:"",status:"PENDENTE",statusLeitura:"OK",errosLeitura:[],
        lembreteAtivo:false,lembreteMin:30,imagemId:null,imagemNome:"N/D",criadoEm:Date.now(),atualizadoEm:Date.now(),origem:"LISTA_TEXTO",
        estrategiaBase:estrategia||entrada||"N/D",estrategias,oddCasa,oddEmpate,oddFora
      });
    }
    return jogos;
  }

  function processarEntradaInteligente() {
    const texto=limparTextoAnalise(textoEntradaInteligente);
    if(!texto){alert("Cole a lista de jogos antes de continuar.");return;}

    const listaEstruturada=parseListaJogosEstruturada(texto);
    if(listaEstruturada.length){
      // Salva a lista e já leva a tela para a data dos jogos importados.
      // Isso evita a impressão de que "não salvou" quando a lista é de amanhã
      // ou de outra data e o filtro ainda estava em Hoje.
      persistirJogosConfirmados(listaEstruturada);
      const datasImportadas=Array.from(new Set(listaEstruturada.map(j=>normalizarDataJogo(j.data,jogosDataFiltro)).filter(Boolean)));
      if(datasImportadas.length===1) setJogosDataFiltro(datasImportadas[0]);
      setJogosCardSelecionados([]);
      setJogosExcluirSelecionados([]);
      setResultadoTextoJogos({tipo:"lista",salvos:listaEstruturada.length,revisar:0,detectados:listaEstruturada.length,data:(datasImportadas.length===1?datasImportadas[0]:null)});
      setTextoEntradaInteligente(""); setShowEntradaInteligente(false);
      setEntradasSubView("ao_vivo");
      return;
    }

    const blocos=blocosJogosDoTexto(texto);
    const validos=[], revisarAnalise=[];
    let novosOuMesclados=0, atualizadas=0, revisar=0, detectados=0;

    const tratarAtualizacao=(conteudo,alvo)=>{
      const leitura=extrairLeituraFinalTexto(conteudo);
      if(!alvo){
        revisar++;
        prepararPendenciaAtualizacao(conteudo,[],"O confronto parece ser uma atualização, mas não foi localizado na data selecionada.",leitura);
        return;
      }
      if(leitura.impacto==="REVISAR"){
        revisar++;
        prepararPendenciaAtualizacao(conteudo,[alvo],"Identifiquei uma atualização, mas o impacto na tese não ficou explícito.",leitura);
        return;
      }
      aplicarAtualizacaoNoJogo(alvo.id,conteudo,leitura);
      atualizadas++;
    };

    if(blocos.length){
      for(const b of blocos){
        const alvo=jogosDia.find(j=>j.data===jogosDataFiltro&&mesmaPartida(j,{data:jogosDataFiltro,mandante:b.cab.mandante,visitante:b.cab.visitante}));
        if(alvo && temSinaisDeAtualizacao(b.texto)){
          tratarAtualizacao(b.texto,alvo);
          continue;
        }
        const res=parseAnaliseTexto(b.texto,jogosDataFiltro);
        detectados+=res.blocosDetectados;
        for(const j of res.jogos){
          if(j.statusLeitura==="OK"&&!errosJogoParaBanco(j).length) validos.push(j);
          else revisarAnalise.push(j);
        }
      }
    } else {
      // Textos de atualização nem sempre repetem o confronto no cabeçalho.
      const candidatos=candidatosAtualizacaoSemCabecalho(texto);
      if(temSinaisDeAtualizacao(texto) && candidatos.length){
        if(candidatos.length===1) tratarAtualizacao(texto,candidatos[0]);
        else {
          const leitura=extrairLeituraFinalTexto(texto); revisar++;
          prepararPendenciaAtualizacao(texto,candidatos,"Mais de um jogo pode corresponder a esta atualização.",leitura);
        }
      } else {
        const res=parseAnaliseTexto(texto,jogosDataFiltro);
        detectados+=res.blocosDetectados;
        for(const j of res.jogos){
          if(j.statusLeitura==="OK"&&!errosJogoParaBanco(j).length) validos.push(j);
          else revisarAnalise.push(j);
        }
      }
    }

    if(validos.length){persistirJogosConfirmados(validos);novosOuMesclados=validos.length;}
    if(revisarAnalise.length){setJogosRevisao(prev=>[...prev,...revisarAnalise]);setShowRevisaoJogos(true);revisar+=revisarAnalise.length;}

    if(!detectados&&!atualizadas&&!revisar){
      alert("Não consegui identificar um confronto com segurança. Inclua uma linha como: Chelsea x Luton — GOL NO 1º TEMPO.");
      return;
    }

    setResultadoTextoJogos({tipo:"inteligente",novos:novosOuMesclados,atualizadas,revisar,detectados});
    setTextoEntradaInteligente("");
    setShowEntradaInteligente(false);
  }

  function confirmarAtualizacaoRevisada() {
    if(!atualizacaoRevisar?.candidatoId){alert("Selecione o jogo correto.");return;}
    if(!["REFORÇOU","MANTEVE","ENFRAQUECEU","CANCELOU"].includes(atualizacaoRevisar.impacto)){alert("Defina o impacto da atualização.");return;}
    aplicarAtualizacaoNoJogo(atualizacaoRevisar.candidatoId,atualizacaoRevisar.texto,{impacto:atualizacaoRevisar.impacto,entradaFinal:atualizacaoRevisar.entradaFinal||"N/D",segundaOpcao:atualizacaoRevisar.segundaOpcao||"N/D",evitar:atualizacaoRevisar.evitar||"N/D",sinais:atualizacaoRevisar.sinais||[]});
    setAtualizacaoRevisar(null);
  }

  function alternarJogoNoCard(j) {
    if(!j?.id) return;
    setJogosCardSelecionados(prev=>prev.includes(j.id) ? prev.filter(id=>id!==j.id) : [...prev,j.id]);
  }
  function limparSelecaoCard() { setJogosCardSelecionados([]); }
  function abrirCardJogosDia() {
    if(!jogosCardSelecionados.length) { alert("Selecione pelo menos um jogo para montar o Card de Jogos do Dia."); return; }
    if(jogosCardSelecionados.length>10) { alert("Selecione no máximo 10 jogos para manter o card legível."); return; }
    setShowCardJogosDia(true);
  }
  function estrategiaCardJogo(j) {
    const acumuladas=Array.isArray(j?.estrategias)?j.estrategias.filter(Boolean):[];
    if(acumuladas.length) return Array.from(new Set(acumuladas)).join(" · ");
    const ids=metodosDoJogo(j);
    if(!ids.length) return String(j.entradaSugerida||"N/D");
    return ids.map(id=>metodoDicaInfo(id).nome).join(" · ");
  }
  function gerarImagemCardJogosDia() {
    const selecionados=jogosDia.filter(j=>jogosCardSelecionados.includes(j.id)).slice().sort((a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99")));
    if(!selecionados.length) { alert("Nenhum jogo selecionado."); return; }
    const W=1080, header=210, rowH=142, footer=105, H=header+selecionados.length*rowH+footer;
    const c=document.createElement("canvas"); c.width=W; c.height=H;
    const ctx=c.getContext("2d");
    const bg=ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,"#07110d"); bg.addColorStop(1,"#10251a"); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#c6a15b"; ctx.lineWidth=4; ctx.strokeRect(18,18,W-36,H-36);
    ctx.fillStyle="#e8e0cc"; ctx.font="700 42px Arial"; ctx.fillText("⚽ JOGOS DO DIA",54,78);
    ctx.fillStyle="#c6a15b"; ctx.font="700 25px Arial"; ctx.fillText(new Date(jogosDataFiltro+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}),54,120);
    ctx.fillStyle="#8a9a8a"; ctx.font="22px Arial"; ctx.fillText(`${selecionados.length} ${selecionados.length===1?"JOGO SELECIONADO":"JOGOS SELECIONADOS"}`,54,158);
    selecionados.forEach((j,i)=>{
      const y=header+i*rowH;
      ctx.fillStyle=i%2===0?"rgba(20,36,28,.95)":"rgba(15,31,23,.95)"; ctx.fillRect(42,y,W-84,rowH-12);
      ctx.strokeStyle="rgba(198,161,91,.28)"; ctx.lineWidth=2; ctx.strokeRect(42,y,W-84,rowH-12);
      ctx.fillStyle="#c6a15b"; ctx.font="700 27px Arial"; ctx.fillText(j.horario&&j.horario!=="N/D"?j.horario:"--:--",66,y+43);
      ctx.fillStyle="#e8e0cc"; ctx.font="700 28px Arial"; ctx.fillText(`${j.mandante||"N/D"}  x  ${j.visitante||"N/D"}`,180,y+43);
      ctx.fillStyle="#81cd90"; ctx.font="700 23px Arial"; ctx.fillText("🎯  "+estrategiaCardJogo(j),180,y+82);
      const fav=j.favorito&&j.favorito!=="N/D"?`Favorito: ${j.favorito}`:"";
      if(fav){ctx.fillStyle="#8a9a8a";ctx.font="20px Arial";ctx.fillText(fav,180,y+114);}
    });
    ctx.fillStyle="#8a9a8a"; ctx.font="20px Arial"; ctx.fillText("Gerado pelo Gestor d Trader",54,H-48);
    const data=c.toDataURL("image/png");
    const nome=`jogos-do-dia-${jogosDataFiltro||"data"}.png`;
    const a=document.createElement("a"); a.href=data; a.download=nome; a.click();
    setTimeout(async()=>{
      try {
        const blob=await (await fetch(data)).blob();
        const file=new File([blob],nome,{type:"image/png"});
        if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({title:"Jogos do Dia",text:"Jogos selecionados para operar",files:[file]});
      } catch(e) {}
    },150);
  }
  async function abrirImagemOriginalJogo(j) {
    if(!j?.imagemId) { alert("Este jogo veio de texto e não possui imagem original vinculada."); return; }
    const item=await lerImagemJogoLocal(j.imagemId);
    if(!item?.blob) { alert("A imagem original não está neste aparelho. Os dados do jogo continuam sincronizados, mas a foto fica salva localmente. Para sincronizar fotos entre aparelhos seria necessário Firebase Storage ou outro armazenamento de arquivos."); return; }
    const url=URL.createObjectURL(item.blob); setImagemJogoModal({url,nome:item.nome||j.imagemNome||"Imagem original"});
  }
  function fecharImagemJogo() { if(imagemJogoModal?.url) try{URL.revokeObjectURL(imagemJogoModal.url);}catch(e){} setImagemJogoModal(null); }
  async function ativarAlertasJogos() {
    if(!("Notification" in window)) { alert("Este navegador não oferece notificações locais. Os alertas dentro do app continuarão funcionando."); return; }
    if(Notification.permission==="granted") { alert("Alertas do navegador já estão ativados."); return; }
    try { const r=await Notification.requestPermission(); alert(r==="granted"?"Alertas ativados. O navegador poderá avisar enquanto o app estiver em execução.":"Permissão não concedida. Os avisos continuarão aparecendo dentro do app."); } catch(e) { alert("Não foi possível ativar as notificações neste navegador."); }
  }
  function localizarOperacaoDoJogo(j) {
    if(!j) return null;
    for(const k of Object.keys(operacoes||{})){
      const lista=operacoes[k]||[];
      const idx=lista.findIndex(o=>o && ((j.operacaoId && o.id===j.operacaoId) || (o.jogoId && o.jogoId===j.id)));
      if(idx>=0){ const m=String(k).match(/^(\d+)-(\d+)$/); if(m) return {sem:Number(m[1]),dia:Number(m[2]),idx,op:lista[idx],k}; }
    }
    return null;
  }
  function abrirFinalizarOperacaoDoJogo(j) {
    const achado=localizarOperacaoDoJogo(j);
    if(!achado){ alert("Não encontrei a operação aberta deste jogo."); return; }
    abrirFinalizarOp(achado.sem,achado.dia,achado.idx);
  }

  function abrirOperacaoDoJogo(j, metodoForcado=null) {
    if(!ciclos.length || !cicloAtivo) { alert("Crie ou selecione um ciclo antes de transformar o jogo em operação."); return; }
    const alvo=pISO(j.data); const off=offsetDeData(dataIni,alvo); const total=(cicloCfg?.tiers||TIERS_PADRAO).reduce((s,t)=>s+t.dias,0);
    if(off<0 || off>=total) { alert("A data deste jogo está fora do ciclo ativo. Troque o ciclo ou ajuste a data do jogo antes de criar a operação."); return; }
    const diasSem=cicloCfg?.diasPorSemana??D5; const sem=Math.floor(off/diasSem), dia=off%diasSem;
    const estrategiasJogo=Array.isArray(j.estrategias)?j.estrategias.filter(Boolean):[];
    const estrategiaJogo=estrategiasJogo[0]||j.estrategiaBase||j.entradaSugerida||"";
    const metodoSelecionado=metodoForcado||dicasMetodo;
    abrirAddOp(sem,dia,null); setOpJogoOrigemId(j.id); setOpJogoMetodoOrigem(metodoSelecionado);

    const entradaFinal=j.leituraFinal?.entradaFinal&&j.leituraFinal.entradaFinal!=="N/D"?j.leituraFinal.entradaFinal:j.entradaSugerida;
    const entrada=String(entradaFinal||""); const gols=entrada.match(/\b(Over|Under)\s*(\d)[,.](\d)\b/i);
    const recBack=normBusca(j.entradaSugerida||"");
    const textoBack=normBusca(`${j.entradaSugerida||""} ${j.analiseInicial||""}`);
    const posBack=textoBack.indexOf("back");
    const trechoBack=posBack>=0?textoBack.slice(posBack,posBack+100):"";
    const favoritoPeloTexto=[j.mandante,j.visitante].find(t=>{
      const nt=normBusca(t);
      return nt && ((recBack.startsWith("back")&&recBack.includes(nt)) || (trechoBack&&trechoBack.includes(nt)));
    })||"";
    const favoritoVal=(j.timesMetodo?.back_favorito)||((j.favorito&&j.favorito!=="N/D")?j.favorito:"")||favoritoPeloTexto||(j.mandante!=="N/D"?j.mandante:"");

    let metodoPref="BACK", estrategiaPref="", golsPref="";
    if(metodoSelecionado==="back_favorito") estrategiaPref="Favorito";
    else if(metodoSelecionado==="under_gols") { estrategiaPref="Total de Gols"; golsPref="Under 2.5"; }
    else if(metodoSelecionado==="over_btts") { if(/btts|ambas marcam/i.test(entrada)&&!gols) estrategiaPref="Ambas Marcam"; else {estrategiaPref="Total de Gols";if(gols&&/^over$/i.test(gols[1]))golsPref=`Over ${gols[2]}.${gols[3]}`;} }
    else if(metodoSelecionado==="gol_ht") estrategiaPref="Gol no 1º Tempo";
    else if(metodoSelecionado==="favorito_nao_goleia") { metodoPref=""; estrategiaPref="Favorito Não Goleia"; }
    else if(gols) { estrategiaPref="Total de Gols"; golsPref=`${gols[1][0].toUpperCase()+gols[1].slice(1).toLowerCase()} ${gols[2]}.${gols[3]}`; }

    const timeOperacao=metodoSelecionado==="back_favorito" ? favoritoVal : `${j.mandante} x ${j.visitante}`;
    setOpForm(prev=>({...prev,
      time:timeOperacao||prev.time,
      hora:j.horario!=="N/D"?j.horario:prev.hora,
      mercado:metodoSelecionado==="under_gols"?"Under 2.5":((j.origem==="OCR_AO_VIVO"||j.origem==="OCR_COMPROVANTE_BACK"||j.origem==="OCR_LISTA_BOLSA")?"Back Favorito":(entradaFinal&&entradaFinal!=="N/D"?entradaFinal:prev.mercado)),
      odd:j.oddSugerida!=null?String(j.oddSugerida).replace(".",","):prev.odd,
      entrada:j.valorCapturado||prev.entrada,
      lucroPossivel:j.lucroCapturado||prev.lucroPossivel,
      betId:j.betIdCapturado||prev.betId,
      metodo:metodoPref||prev.metodo,estrategiaBase:estrategiaPref||estrategiaJogo||prev.estrategiaBase,golsSelecao:golsPref,
      origem:(j.origem==="OCR_AO_VIVO"||j.origem==="OCR_COMPROVANTE_BACK"||j.origem==="OCR_LISTA_BOLSA")?"ocr_ao_vivo":"jogos_do_dia",
      observacao:j.origem==="OCR_COMPROVANTE_BACK"
        ? `Comprovante importado: ${j.mandante} x ${j.visitante} · BACK ${favoritoVal}${j.oddSugerida?` @ ${Number(j.oddSugerida).toFixed(2)}`:""}${j.betIdCapturado?` · Bet ID ${j.betIdCapturado}`:""}`
        : j.origem==="OCR_AO_VIVO"
        ? `Entrada ao vivo por print: ${j.mandante} x ${j.visitante} · Favorito: ${favoritoVal}${j.oddSugerida?` @ ${Number(j.oddSugerida).toFixed(2)}`:""}`
        : j.origem==="OCR_LISTA_BOLSA"
        ? `Leitor da Bolsa (lista): ${j.mandante} x ${j.visitante} · Casa @ ${j.oddsAoVivo?.casa!=null?Number(j.oddsAoVivo.casa).toFixed(2):"N/D"} / Visitante @ ${j.oddsAoVivo?.fora!=null?Number(j.oddsAoVivo.fora).toFixed(2):"N/D"} · Favorito: ${favoritoVal}${j.oddSugerida?` @ ${Number(j.oddSugerida).toFixed(2)}`:""}`
        : `Jogos do Dia: ${j.mandante} x ${j.visitante}`
    }));
  }

  // ===== INTELIGÊNCIA DAS DICAS + RESULTADOS DO DIA =====
  const operacoesPorId = useMemo(()=>{
    const mapa={};
    Object.values(operacoes||{}).forEach(lista=>(lista||[]).forEach(op=>{if(op?.id) mapa[op.id]=op;}));
    return mapa;
  },[operacoes]);
  const operacaoDoJogo=j=>j?.operacaoId?operacoesPorId[j.operacaoId]:Object.values(operacoesPorId).find(op=>op?.jogoId===j?.id);
  const placarCompleto=j=>String(j?.placarMandante??"")!==""&&String(j?.placarVisitante??"")!=="";
  const placarNums=j=>placarCompleto(j)?[Number(j.placarMandante),Number(j.placarVisitante)]:[null,null];
  function atualizarPlacarJogo(id,lado,valor) {
    const limpo=String(valor??"").replace(/\D/g,"").slice(0,2);
    setJogosDia(prev=>prev.map(j=>{
      if(j.id!==id) return j;
      const patch={...j,[lado]:limpo,atualizadoEm:Date.now()};
      const a=lado==="placarMandante"?limpo:String(j.placarMandante??"");
      const b=lado==="placarVisitante"?limpo:String(j.placarVisitante??"");
      if(a!==""&&b!=="") {patch.resultadoRegistradoEm=Date.now();patch.status="FINALIZADO";}
      else {delete patch.resultadoRegistradoEm;if(j.status==="FINALIZADO")patch.status=j.operacaoId?"OPERADO":"PENDENTE";}
      return patch;
    }));
  }
  function limparResultadoJogo(id) {
    setJogosDia(prev=>prev.map(j=>{if(j.id!==id)return j;const n={...j,placarMandante:"",placarVisitante:"",resultadosManuais:{},status:j.operacaoId?"OPERADO":"PENDENTE",atualizadoEm:Date.now()};delete n.resultadoRegistradoEm;return n;}));
  }
  function definirResultadoManual(id,metodo,resultado) {
    setJogosDia(prev=>prev.map(j=>j.id===id?{...j,resultadosManuais:{...(j.resultadosManuais||{}),[metodo]:resultado||null},atualizadoEm:Date.now()}:j));
  }
  function entradaReferencia(j) { return String(j?.leituraFinal?.entradaFinal&&j.leituraFinal.entradaFinal!=="N/D"?j.leituraFinal.entradaFinal:j?.entradaSugerida||""); }
  function linhaTotalDaEntrada(j,tipo) {
    const e=entradaReferencia(j);
    const r=tipo==="under"?/\bunder\s*(\d+(?:[,.]\d+)?)\b/i:/\bover\s*(\d+(?:[,.]\d+)?)\b/i;
    const m=e.match(r); return m?Number(m[1].replace(",",".")):null;
  }
  function resultadoMetodoCalculado(j,metodo) {
    const manual=j?.resultadosManuais?.[metodo]; if(manual) return manual;
    if(!placarCompleto(j)) return "N/D";
    const [a,b]=placarNums(j), total=a+b, entrada=normBusca(entradaReferencia(j));
    if(metodo==="under_gols") { const linha=linhaTotalDaEntrada(j,"under"); return linha==null?"N/D":(total<linha?"GREEN":"RED"); }
    if(metodo==="over_btts") {
      const temBTTS=/btts|ambas marcam/.test(entrada), linha=linhaTotalDaEntrada(j,"over");
      if(temBTTS&&linha!=null) return "REVISAR"; // pode ser alternativa ou combinação; não presumir.
      if(temBTTS) return a>0&&b>0?"GREEN":"RED";
      if(linha!=null) return total>linha?"GREEN":"RED";
      return "N/D";
    }
    // Placar final sozinho não revela primeiro gol, gol HT ou a regra ainda não definida de "não goleia".
    return "N/D";
  }
  function resultadoSeMantivesseBack(j) {
    if(!placarCompleto(j)||!j?.favorito||j.favorito==="N/D") return "N/D";
    const [a,b]=placarNums(j), fav=normBusca(j.favorito), casa=normBusca(j.mandante), fora=normBusca(j.visitante);
    if(fav===casa) return a>b?"GREEN":"RED";
    if(fav===fora) return b>a?"GREEN":"RED";
    return "N/D";
  }
  function classificacaoPosJogo(j) {
    const op=operacaoDoJogo(j); if(!op||op.status==="aberta") return null;
    const metodo=op.metodoDica||j.metodoOperado;
    if(metodo!=="back_favorito") return op.status==="green"?{txt:"GREEN DA OPERAÇÃO",ico:"✅",cor:"#58a86a"}:{txt:"RED DA OPERAÇÃO",ico:"❌",cor:"#e05c4c"};
    const mant=resultadoSeMantivesseBack(j);
    if(op.status==="green"&&mant==="RED") return {txt:"GREEN PROTEGIDO PELA SAÍDA",ico:"🛡️",cor:"#58a86a"};
    if(op.status==="green"&&mant==="GREEN") return {txt:"GREEN NATURAL",ico:"🟢",cor:"#58a86a"};
    if(op.status==="red") return {txt:"RED REAL",ico:"🔴",cor:"#e05c4c"};
    return null;
  }
  function atualizarOddMetodo(id,metodo,valor) {
    const limpo=String(valor??"").replace(/[^0-9,.]/g,"").slice(0,8);
    setJogosDia(prev=>prev.map(j=>j.id===id?{...j,oddsMercado:{...(j.oddsMercado||{}),[metodo]:limpo},atualizadoEm:Date.now()}:j));
  }
  function probabilidadeReferenciaOdd(j,metodo) {
    const e=normBusca(entradaReferencia(j));
    if(metodo==="back_favorito") return numPctJogo(j?.primeiroGolFavorito);
    if(metodo==="gol_ht") return numPctJogo(j?.golHT);
    if(metodo==="under_gols") return /under\s*2[,.]5/.test(e)?numPctJogo(j?.under25):null;
    if(metodo==="over_btts") {
      if(/btts|ambas marcam/.test(e)&&!/over\s*\d/.test(e)) return numPctJogo(j?.btts);
      if(/over\s*2[,.]5/.test(e)&&!/(btts|ambas marcam)/.test(e)) return numPctJogo(j?.over25);
      return null;
    }
    return null;
  }
  function valorOddInfo(j,metodo) {
    const prob=probabilidadeReferenciaOdd(j,metodo), odd=Number(String(j?.oddsMercado?.[metodo]||"").replace(",","."));
    if(prob==null||!odd||odd<=1) return null;
    const justa=100/prob, margem=(odd*prob/100-1)*100;
    if(margem>2) return {txt:"POSSÍVEL VALOR",ico:"💰",cor:"#58a86a",justa,margem};
    if(margem>=-2) return {txt:"PERTO DA REFERÊNCIA",ico:"⚖️",cor:"#d8ae55",justa,margem};
    return {txt:"ABAIXO DA REFERÊNCIA",ico:"⚠️",cor:"#e09a4b",justa,margem};
  }
  function conflitosDoJogo(j) {
    const raw=normBusca(`${j?.analiseInicial||""} ${(j?.atualizacoes||[]).map(a=>a.texto||"").join(" ")}`), out=[];
    if(j?.cuidado) out.push("O confronto foi marcado no texto como jogo de cuidado/observação.");
    if(/modelo especifico|modelo do confronto/.test(raw)&&/histor|ultim/.test(raw)&&/(porem|mas|entretanto|nao trataria|cuidado)/.test(raw)) out.push("O texto contrapõe histórico e modelo específico; confira a leitura contextual antes da entrada.");
    if(j?.leituraFinal?.impacto==="ENFRAQUECEU") out.push("A atualização pré-jogo enfraqueceu a tese inicial.");
    if(j?.leituraFinal?.impacto==="CANCELOU") out.push("A atualização pré-jogo cancelou a tese.");
    return out;
  }
  function pontuacaoMetodo(j,metodo) {
    const nota=notaDoMetodo(j,metodo), pct=percentualDoMetodo(j,metodo); let s=0;
    if(nota!=null)s+=nota*10; if(pct!=null)s+=pct*.20; s+=confiancaPeso(j);
    const imp=j?.leituraFinal?.impacto; if(imp==="REFORÇOU")s+=8;else if(imp==="ENFRAQUECEU")s-=12;else if(imp==="CANCELOU")s-=100;
    if(conflitosDoJogo(j).length)s-=5; return s;
  }
  function semaforoMetodo(j,metodo) {
    if(j?.statusLeitura==="REVISAR") return {txt:"REVISAR",ico:"⚪",cor:"#aeb7af"};
    if(j?.leituraFinal?.impacto==="CANCELOU") return {txt:"EVITAR",ico:"🔴",cor:"#e05c4c"};
    const nota=notaDoMetodo(j,metodo), conflitos=conflitosDoJogo(j);
    if(j?.leituraFinal?.impacto==="ENFRAQUECEU"||conflitos.length) return {txt:"AGUARDAR",ico:"🟡",cor:"#d8ae55"};
    if(nota!=null&&nota>=8) return {txt:"OPERÁVEL",ico:"🟢",cor:"#58a86a"};
    return {txt:"AGUARDAR",ico:"🟡",cor:"#d8ae55"};
  }
  function melhorMetodoJogo(j) {
    const mets=metodosDoJogo(j); if(!mets.length)return null;
    return mets.slice().sort((a,b)=>pontuacaoMetodo(j,b)-pontuacaoMetodo(j,a))[0];
  }
  function motivosDaOportunidade(j,metodo) {
    const out=[],nota=notaDoMetodo(j,metodo),pct=percentualDoMetodo(j,metodo);
    if(nota!=null)out.push(`Nota ${String(nota).replace(".",",")}/10`);
    if(pct!=null)out.push(`${metodoDicaInfo(metodo).nome}: ${pct}% no dado extraído`);
    if(j?.leituraFinal?.impacto==="REFORÇOU")out.push("Atualização pré-jogo reforçou a tese");
    if(normBusca(j?.confianca)==="alta")out.push("Confiança informada: alta");
    const c=conflitosDoJogo(j); if(c.length)out.push("Há ponto contextual para revisão");
    return out.slice(0,4);
  }
  function atualizarChecklist(id,chave) {
    setJogosDia(prev=>prev.map(j=>j.id===id?{...j,checklistPreOp:{...(j.checklistPreOp||{}),[chave]:!j?.checklistPreOp?.[chave]},atualizadoEm:Date.now()}:j));
  }

  const jogosDaData = useMemo(()=>jogosDia.filter(j=>j.data===jogosDataFiltro&&j.statusLeitura!=="REVISAR").slice().sort((a,b)=>(a.horario||"99:99").localeCompare(b.horario||"99:99")),[jogosDia,jogosDataFiltro]);
  const periodoDoJogo=j=>{const m=String(j.horario||"").match(/^(\d{1,2}):/);if(!m)return "nd";const h=Number(m[1]);return h<12?"manha":h<18?"tarde":"noite";};
  const jogosDoMetodo = useMemo(()=>{
    const q=normBusca(jogosBusca);
    return jogosDaData.filter(j=>metodosDoJogo(j).includes(dicasMetodo) && (dicasPeriodo==="todos"||periodoDoJogo(j)===dicasPeriodo) && (!q||normBusca(`${j.mandante} ${j.visitante} ${j.favorito}`).includes(q)) && j.status!=="IGNORADO" && j.leituraFinal?.impacto!=="CANCELOU")
      .slice().sort((a,b)=>{
        const ha=a.horario&&a.horario!=="N/D"?a.horario:"99:99", hb=b.horario&&b.horario!=="N/D"?b.horario:"99:99";
        if(dicasOrdem==="melhores") {
          const na=notaDoMetodo(a,dicasMetodo), nb=notaDoMetodo(b,dicasMetodo);
          if(na!==nb) return (nb==null?-1:nb)-(na==null?-1:na);
          const pa=percentualDoMetodo(a,dicasMetodo), pb=percentualDoMetodo(b,dicasMetodo);
          if(pa!==pb) return (pb==null?-1:pb)-(pa==null?-1:pa);
          const cp=confiancaPeso(b)-confiancaPeso(a); if(cp) return cp;
          return ha.localeCompare(hb);
        }
        const c=ha.localeCompare(hb); if(c) return c;
        const na=notaDoMetodo(a,dicasMetodo), nb=notaDoMetodo(b,dicasMetodo);
        if(na!==nb) return (nb==null?-1:nb)-(na==null?-1:na);
        return confiancaPeso(b)-confiancaPeso(a);
      });
  },[jogosDaData,dicasMetodo,dicasPeriodo,jogosBusca,dicasOrdem]);
  const contagemMetodos = useMemo(()=>Object.fromEntries(METODOS_DICAS.map(m=>[m.id,jogosDaData.filter(j=>metodosDoJogo(j).includes(m.id)&&j.status!=="IGNORADO"&&j.leituraFinal?.impacto!=="CANCELOU").length])),[jogosDaData]);
  const nomeJogoNoMetodo=(j,metodo)=>j.timesMetodo?.[metodo] || (metodo==="back_favorito"&&j.favorito&&j.favorito!=="N/D"?j.favorito:j.mandante&&j.mandante!=="N/D"?j.mandante:`${j.mandante} x ${j.visitante}`);
  const impactoVisual=impacto=>impacto==="REFORÇOU"?{ico:"🟢",cor:"#58a86a"}:impacto==="MANTEVE"?{ico:"⚪",cor:"#aeb7af"}:impacto==="ENFRAQUECEU"?{ico:"🟡",cor:"#d8ae55"}:impacto==="CANCELOU"?{ico:"🔴",cor:"#e05c4c"}:{ico:"⚠️",cor:"#d8ae55"};
  const resumoDicas = useMemo(()=>({
    total:jogosDaData.length,
    oportunidades:jogosDaData.filter(j=>{const m=melhorMetodoJogo(j);return m&&semaforoMetodo(j,m).txt==="OPERÁVEL"&&j.status!=="IGNORADO"&&j.leituraFinal?.impacto!=="CANCELOU";}).length,
    operadas:jogosDaData.filter(j=>j.status==="OPERADO").length,
    atualizadas:jogosDaData.filter(j=>Array.isArray(j.atualizacoes)&&j.atualizacoes.length).length,
    revisar:jogosRevisao.length+(atualizacaoRevisar?1:0)
  }),[jogosDaData,jogosRevisao,atualizacaoRevisar]);
  const top3Dicas = useMemo(()=>jogosDaData.filter(j=>j.status!=="IGNORADO"&&j.leituraFinal?.impacto!=="CANCELOU").map(j=>{const metodo=melhorMetodoJogo(j);return {j,metodo,score:metodo?pontuacaoMetodo(j,metodo):-999};}).filter(x=>x.metodo).sort((a,b)=>b.score-a.score||String(a.j.horario||"99:99").localeCompare(String(b.j.horario||"99:99"))).slice(0,3),[jogosDaData]);
  const melhorDoMetodo = useMemo(()=>jogosDaData.filter(j=>metodosDoJogo(j).includes(dicasMetodo)&&j.status!=="IGNORADO"&&j.leituraFinal?.impacto!=="CANCELOU").slice().sort((a,b)=>pontuacaoMetodo(b,dicasMetodo)-pontuacaoMetodo(a,dicasMetodo)||String(a.horario||"99:99").localeCompare(String(b.horario||"99:99")))[0]||null,[jogosDaData,dicasMetodo]);
  const proximasOportunidades = useMemo(()=>{
    const hoje=tISO(new Date(relogioDicas)), agora=new Date(relogioDicas); const minsAgora=agora.getHours()*60+agora.getMinutes();
    return jogosDaData.filter(j=>{if(!j.horario||j.horario==="N/D")return false;if(jogosDataFiltro!==hoje)return true;const m=j.horario.match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2])>=minsAgora-5:false;}).slice().sort((a,b)=>String(a.horario).localeCompare(String(b.horario))).slice(0,3);
  },[jogosDaData,jogosDataFiltro,relogioDicas]);
  const jogosResultadosData = useMemo(()=>jogosDia.filter(j=>j.data===jogosDataFiltro&&j.statusLeitura!=="REVISAR").slice().sort((a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99"))),[jogosDia,jogosDataFiltro]);
  const desempenhoMetodos = useMemo(()=>METODOS_DICAS.map(m=>{
    let green=0,red=0,revisar=0,confirmados=0,naoOperadosGreen=0;
    jogosDia.filter(j=>j.statusLeitura!=="REVISAR"&&metodosDoJogo(j).includes(m.id)).forEach(j=>{const r=resultadoMetodoCalculado(j,m.id);if(r==="GREEN"){green++;confirmados++;const op=operacaoDoJogo(j),metOp=op?.metodoDica||j.metodoOperado;if(!op||metOp!==m.id)naoOperadosGreen++;}else if(r==="RED"){red++;confirmados++;}else if(r==="REVISAR")revisar++;});
    return {...m,green,red,revisar,confirmados,naoOperadosGreen,taxa:confirmados?green/confirmados*100:null};
  }),[jogosDia,operacoesPorId]);
  const desempenhoGeral = useMemo(()=>{const itens=desempenhoMetodos.filter(m=>resultadosMetodoFiltro==="todos"||m.id===resultadosMetodoFiltro);const green=itens.reduce((s,m)=>s+m.green,0),red=itens.reduce((s,m)=>s+m.red,0),confirmados=green+red,naoOperadosGreen=itens.reduce((s,m)=>s+m.naoOperadosGreen,0);return {green,red,confirmados,naoOperadosGreen,taxa:confirmados?green/confirmados*100:null};},[desempenhoMetodos,resultadosMetodoFiltro]);
  const aprendizadoHistorico = useMemo(()=>{
    const grupos={
      nota9:{rotulo:"Nota 9+",green:0,red:0},
      nota8:{rotulo:"Nota 8–8,9",green:0,red:0},
      reforcou:{rotulo:"Atualização REFORÇOU",green:0,red:0},
      semAtualizacao:{rotulo:"Sem atualização pré-jogo",green:0,red:0}
    };
    for(const j of jogosDia) for(const m of metodosDoJogo(j)) {
      const r=resultadoMetodoCalculado(j,m); if(r!=="GREEN"&&r!=="RED")continue;
      const n=notaDoMetodo(j,m);
      if(n!=null&&n>=9)grupos.nota9[r==="GREEN"?"green":"red"]++;
      else if(n!=null&&n>=8)grupos.nota8[r==="GREEN"?"green":"red"]++;
      if(j.leituraFinal?.impacto==="REFORÇOU")grupos.reforcou[r==="GREEN"?"green":"red"]++;
      if(!Array.isArray(j.atualizacoes)||!j.atualizacoes.length)grupos.semAtualizacao[r==="GREEN"?"green":"red"]++;
    }
    return Object.values(grupos).map(g=>({...g,total:g.green+g.red,taxa:g.green+g.red?g.green/(g.green+g.red)*100:null}));
  },[jogosDia]);
  const jogoDetalhe = jogoDetalheId ? jogosDia.find(j=>j.id===jogoDetalheId) : null;
  const imagensDaData = useMemo(()=>analisesJogos.filter(a=>a.data===jogosDataFiltro).slice().sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0)),[analisesJogos,jogosDataFiltro]);

  const syncUi = (() => {
    if(!online || syncStatus==="offline") return {ico:"📴",txt:"Offline",cor:"#c58a55"};
    if(syncStatus==="salvando" || syncStatus==="conectando") return {ico:"☁️",txt:syncStatus==="salvando"?"Salvando…":"Conectando…",cor:"#d8ae55"};
    if(syncStatus==="erro" || syncErro) return {ico:"⚠️",txt:"Erro de sync",cor:"#d15c48"};
    return {ico:"☁️",txt:"Sincronizado",cor:"#58a86a"};
  })();
  const fmtSyncHora = (ts) => ts ? new Date(ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "—";

  if(authLoad) return <div className="bg-app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><span className="font-mono text-xs text-[#6a7d6a]">Carregando...</span></div>;
  if(!user) return <Login />;
  if(erroAcesso) return (
    <div className="bg-app" style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",minHeight:"100vh",padding:24,textAlign:"center"}}>
      <div className="card" style={{maxWidth:360}}>
        <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
        <h1 className="text-sm font-bold mb-2">Não foi possível verificar seu acesso</h1>
        <p className="text-xs text-[#8a9a8a] mb-4">{erroAcesso}</p>
        <div className="flex flex-col gap-2">
          <button onClick={()=>window.location.reload()} className="btn-primary w-full">Tentar novamente</button>
          <button onClick={()=>auth.signOut()} className="text-[10px] text-[#6a7d6a] hover:text-[#c6a15b] font-mono" style={{background:"none",border:"none",cursor:"pointer"}}>Sair</button>
        </div>
      </div>
    </div>
  );
  if(acessoLoad) return <div className="bg-app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><span className="font-mono text-xs text-[#6a7d6a]">Verificando acesso...</span></div>;
  if(!isAdmin && clienteStatus === "bloqueado") return <TelaBloqueada />;
  return (
    <div className="bg-app">
      {locked && (
        <div className="fixed inset-0 bg-[#060d09] flex items-center justify-center z-50" style={{margin:0,padding:0}}>
          <div className="card" style={{width:300,maxWidth:"90vw"}}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">🔒</div>
              <div className="font-mono text-sm text-[#e8e0cc] font-bold">Gestor d Trader</div>
              <div className="font-mono text-[9px] text-[#6a7d6a]">Digite o PIN para desbloquear</div>
            </div>
            <div className="flex justify-center gap-2 mb-3">
              {[0,1,2,3].map(i=>(
                <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{borderColor:pinInput.length>i?"#c6a15b":"#1e3228",background:pinInput.length>i?"#c6a15b":"transparent"}}>
                  {pinInput.length>i && <div className="w-2 h-2 rounded-full bg-[#0a1410]"></div>}
                </div>
              ))}
            </div>
            {pinErro && <div className="text-center font-mono text-[10px] text-[#A6432D] mb-2">{pinErro}</div>}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n,i)=>(
                <button key={i} disabled={n===""} onClick={()=>{
                  if(n==="") return;
                  if(n==="⌫"){setPinInput(p=>p.slice(0,-1));setPinErro("");return;}
                  const next=pinInput+String(n);
                  if(next.length===4){
                    if(next===pinCode){setLocked(false);setPinInput("");setPinErro("");}
                    else{setPinErro("PIN incorreto");setPinInput("");}
                  } else {setPinInput(next);setPinErro("");}
                }} className={`h-10 rounded font-mono text-sm font-bold ${n===""?"invisible":n==="⌫"?"text-[#6a7d6a]":"text-[#e8e0cc]"}`}
                  style={{background:n!==""&&n!=="⌫"?"#0f1f17":"transparent",border:n!==""&&n!=="✓"?"1px solid #1e3228":"none",cursor:n===""?"default":"pointer"}}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showSyncInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" style={{margin:0,padding:12}}>
          <div className="card" style={{width:340,maxWidth:"94vw",padding:16}}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider" style={{color:"#d8ae55"}}>☁️ Sincronização PC ↔ Celular</div>
                <div className="font-mono text-[12px] font-bold mt-1">Mesma conta, mesmos dados</div>
              </div>
              <button onClick={()=>setShowSyncInfo(false)} className="btn-small">✕</button>
            </div>
            <div className="card-soft mb-2" style={{padding:"10px 12px"}}>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[9px] text-[#6a7d6a]">Status</span>
                <span className="font-mono text-[10px] font-bold" style={{color:syncUi.cor}}>{syncUi.ico} {syncUi.txt}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-mono text-[9px] text-[#6a7d6a]">Última sincronização</span>
                <span className="font-mono text-[10px]">{fmtSyncHora(ultimaSync)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-mono text-[9px] text-[#6a7d6a]">Aparelho atual</span>
                <span className="font-mono text-[10px]">{deviceLabel}</span>
              </div>
              {syncOrigem && <div className="flex justify-between items-center mt-2"><span className="font-mono text-[9px] text-[#6a7d6a]">Última alteração</span><span className="font-mono text-[10px]">{syncOrigem}</span></div>}
            </div>
            <div className="font-mono text-[9px] text-[#6a7d6a] leading-relaxed mb-3">
              Entre no PC e no celular com o <b style={{color:"#e8e0cc"}}>mesmo e-mail e senha</b>. Ao salvar uma operação em um aparelho, ela é enviada para a nuvem e aparece automaticamente no outro.
            </div>
            {!online && <div className="alerta mb-3"><span>📴</span><span className="text-xs">Sem internet. Suas alterações continuam salvas neste aparelho e serão enviadas quando a conexão voltar.</span></div>}
            {syncErro && online && <div className="alerta mb-3"><span>⚠️</span><span className="text-xs">A nuvem não confirmou a última alteração. Verifique a conexão e mantenha o app aberto por alguns segundos.</span></div>}
            <button onClick={()=>{ setShowSyncInfo(false); if(online){ setSyncStatus("conectando"); setFirePronto(false); setTimeout(()=>setFirePronto(true),50); } }} className="btn-primary w-full">↻ Sincronizar agora</button>
            <div className="font-mono text-[8px] text-[#4a5a4a] text-center mt-2">As preferências de tema e o planejamento do dia também acompanham sua conta.</div>
          </div>
        </div>
      )}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" style={{margin:0,padding:0}}>
          <div className="card" style={{width:300,maxWidth:"90vw"}}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-2">🔑</div>
              <div className="font-mono text-sm text-[#e8e0cc] font-bold">{pinCode?"Alterar PIN":"Definir PIN"}</div>
              <div className="font-mono text-[9px] text-[#6a7d6a]">4 dígitos numéricos</div>
            </div>
            <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" placeholder="Novo PIN" value={pinInput}
              onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,4);setPinInput(v);setPinErro("");}}
              className="w-full font-mono text-lg text-center text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-3 py-2 outline-none focus:border-[#c6a15b] mb-2 tracking-widest" autoFocus />
            {!pinCode && <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" placeholder="Confirmar PIN" value={pinConfirm}
              onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,4);setPinConfirm(v);setPinErro("");}}
              className="w-full font-mono text-lg text-center text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-3 py-2 outline-none focus:border-[#c6a15b] mb-2 tracking-widest" />}
            {pinErro && <div className="text-center font-mono text-[10px] text-[#A6432D] mb-2">{pinErro}</div>}
            <div className="flex gap-2">
              <button onClick={()=>{setShowPinSetup(false);setPinInput("");setPinConfirm("");setPinErro("");}} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={()=>{
                if(pinInput.length!==4){setPinErro("PIN deve ter 4 dígitos");return;}
                if(!pinCode && pinInput!==pinConfirm){setPinErro("PINs não conferem");return;}
                if(pinCode && pinInput===pinCode){setPinErro("PIN igual ao anterior");return;}
                setPinCode(pinInput); setLocked(false); setShowPinSetup(false); setPinInput(""); setPinConfirm(""); setPinErro("");
                try{localStorage.setItem("bc:pin",pinInput);}catch(e){}
                setHistorico(p=>[...p,{tipo:"pin_definido",data:Date.now()}]);
              }} className="btn-primary flex-1 py-2">{pinCode?"Alterar":"Ativar"}</button>
            </div>
            {pinCode && <button onClick={()=>{
              if(confirm("Remover PIN? O app não será mais bloqueado.")){
                setPinCode("");setLocked(false);setShowPinSetup(false);setPinInput("");setPinErro("");
                try{localStorage.removeItem("bc:pin");}catch(e){}
                setHistorico(p=>[...p,{tipo:"pin_removido",data:Date.now()}]);
              }
            }} className="btn-danger w-full text-[10px] py-2 mt-2">🔓 Remover PIN</button>}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="premium-brand">
          <div className="premium-brand-mark">↗</div>
          <div>
            <h1 className="text-lg font-bold" style={{fontFamily:"'Inter',sans-serif",lineHeight:1.05}}>Gestor de <span style={{color:"#e0b85f"}}>Banca</span></h1>
            <div className="premium-sub">controle total • lançamento rápido <span style={{opacity:.65}}>• {temaApp==="auto"?"tema auto":temaApp}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowSyncInfo(true)} title="Ver sincronização PC ↔ celular"
            className="font-mono text-[9px]" style={{display:"flex",alignItems:"center",gap:5,padding:"5px 8px",borderRadius:999,border:`1px solid ${syncUi.cor}55`,background:`${syncUi.cor}12`,color:syncUi.cor,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{syncUi.ico}</span><span>{syncUi.txt}</span>
          </button>
          <span className={`font-mono text-[9px] text-[#c6a15b] transition-opacity duration-300 ${salvo?"opacity-100":"opacity-0"}`}>local ✓</span>
          <button onClick={()=>auth.signOut()} className="text-[9px] text-[#6a7d6a] hover:text-[#c6a15b]" style={{background:"none",border:"none",cursor:"pointer"}}>sair</button>
        </div>
      </div>

      <div className="font-mono text-[8px] text-center mb-3" style={{color:"#806f4c"}}>VERSÃO 13 • ENTRADAS PRÉ-LIVE • RELATÓRIO DO DIA • SYNC PC ↔ CELULAR</div>

      <div className="flex mb-4 bg-[#0f1f17] rounded-lg p-1 premium-tabs" style={{gap:2}}>
        {[
          {id:"dashboard", ico:"☀", label:"Hoje"},
          {id:"jogos", ico:"🎯", label:"Pré-Live"},
          {id:"estrategia", ico:"📈", label:"Ciclos"},
          {id:"gestao", ico:"▣", label:"Operações"},
          {id:"jogosDoDia", ico:"📅", label:"Jogos do Dia"},
          ...(isAdmin ? [{id:"clientes", ico:"👥", label:"Clientes"}] : []),
          {id:"config", ico:"⚙", label:"Mais"},
        ].map(s => (
          <button key={s.id} onClick={()=>setSecao(s.id)} className="flex-1 py-2 text-center font-mono text-[9px] rounded-md transition-all"
            style={{background:secao===s.id?"#c6a15b":"transparent", color:secao===s.id?"#0a1410":"#6a7d6a", fontWeight:secao===s.id?700:500, border:"none"}}>
            <div style={{fontSize:13,lineHeight:"16px"}}>{s.ico}</div>
            {s.label}
          </button>
        ))}
      </div>

      {secao==="jogosDoDia" && (()=>{
        function limparForm() {
          setNovoJogoMandante(""); setNovoJogoVisitante(""); setNovoJogoHorario("");
          setNovoJogoCampeonato(""); setNovoJogoObs(""); setEditandoJogoId(null);
        }
        async function publicar() {
          if(!novoJogoMandante.trim() || !novoJogoVisitante.trim()) { alert("Preencha ao menos os dois times."); return; }
          const jogo = {
            mandante: novoJogoMandante.trim(),
            visitante: novoJogoVisitante.trim(),
            horario: novoJogoHorario.trim(),
            campeonato: novoJogoCampeonato.trim(),
            obs: novoJogoObs.trim(),
            publicadoEm: Date.now(),
            publicadoPor: user.email || user.uid
          };
          try {
            if(editandoJogoId) await ProductionStore.update("jogosPublicados", editandoJogoId, jogo);
            else await ProductionStore.add("jogosPublicados", jogo);
            limparForm();
          } catch(e) { alert("Falha ao publicar: " + e.message); }
        }
        function editar(j) {
          setEditandoJogoId(j.id);
          setNovoJogoMandante(j.mandante||""); setNovoJogoVisitante(j.visitante||"");
          setNovoJogoHorario(j.horario||""); setNovoJogoCampeonato(j.campeonato||""); setNovoJogoObs(j.obs||"");
        }
        async function remover(id) {
          if(!confirm("Remover este jogo publicado?")) return;
          try { await ProductionStore.remove("jogosPublicados", id); if(editandoJogoId===id) limparForm(); }
          catch(e) { alert("Falha ao remover: " + e.message); }
        }
        const ordenados = jogosPublicados.slice().sort((a,b) => (b.publicadoEm||0) - (a.publicadoEm||0));
        return (
          <div>
            <h2 className="text-sm font-bold mb-3">📅 Jogos do Dia</h2>
            {isAdmin && (
              <div className="card mb-4">
                <div className="text-xs font-bold mb-2">{editandoJogoId ? "Editar jogo" : "Publicar novo jogo"}</div>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Mandante" value={novoJogoMandante} onChange={e=>setNovoJogoMandante(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                  <input type="text" placeholder="Visitante" value={novoJogoVisitante} onChange={e=>setNovoJogoVisitante(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Horário (ex.: 16:00)" value={novoJogoHorario} onChange={e=>setNovoJogoHorario(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                  <input type="text" placeholder="Campeonato" value={novoJogoCampeonato} onChange={e=>setNovoJogoCampeonato(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                </div>
                <textarea placeholder="Observação / dica (opcional)" value={novoJogoObs} onChange={e=>setNovoJogoObs(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                <div className="flex gap-2">
                  <button onClick={publicar} className="btn-primary flex-1">{editandoJogoId ? "Salvar alteração" : "Publicar"}</button>
                  {editandoJogoId && <button onClick={limparForm} className="text-[10px] text-[#6a7d6a] hover:text-[#c6a15b] font-mono" style={{background:"none",border:"none",cursor:"pointer"}}>Cancelar</button>}
                </div>
              </div>
            )}
            {ordenados.length === 0 && <p className="text-xs text-[#6a7d6a]">Nenhum jogo publicado ainda.</p>}
            {ordenados.map(j => (
              <div key={j.id} className="card mb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-bold">{j.mandante} x {j.visitante}</div>
                    <div className="text-[10px] text-[#6a7d6a] font-mono">{[j.horario, j.campeonato].filter(Boolean).join(" · ")}</div>
                    {j.obs && <div className="text-xs mt-1">{j.obs}</div>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1" style={{flexShrink:0}}>
                      <button onClick={()=>editar(j)} className="text-[10px] px-2 py-1" style={{background:"#1e3228",border:"none",borderRadius:6,color:"#c6a15b",cursor:"pointer"}}>Editar</button>
                      <button onClick={()=>remover(j.id)} className="text-[10px] px-2 py-1" style={{background:"#1e3228",border:"none",borderRadius:6,color:"#A6432D",cursor:"pointer"}}>Remover</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {secao==="clientes" && isAdmin && (()=>{
        const termo = buscaCliente.trim().toLowerCase();
        const filtrados = listaClientes.filter(c =>
          !termo || (c.email||"").toLowerCase().includes(termo) || c.id.toLowerCase().includes(termo)
        );
        function alternarStatus(c) {
          const novo = c.status === "bloqueado" ? "ativo" : "bloqueado";
          db.collection("clientes").doc(c.id).set({ status: novo }, { merge: true })
            .catch(e => alert("Falha ao atualizar cliente: " + e.message));
        }
        async function cadastrarNovoCliente() {
          setErroCadastroCliente(""); setAvisoCadastroCliente("");
          const nome = novoClienteNome.trim();
          const email = novoClienteEmail.trim();
          const senha = novoClienteSenha;
          if(!email) { setErroCadastroCliente("Informe o e-mail do cliente."); return; }
          if(senha.length < 6) { setErroCadastroCliente("A senha inicial deve ter no mínimo 6 caracteres."); return; }
          setCadastrandoCliente(true);
          // App Firebase secundário só para criar a conta: criar um usuário
          // pelo SDK do cliente automaticamente "loga" como esse usuário no
          // app em que a chamada é feita — usar um app à parte evita que o
          // admin seja deslogado da própria sessão (auth/db principais nunca
          // são tocados aqui).
          const nomeAppSecundario = "cadastro-cliente-" + Date.now();
          const appSecundario = firebase.initializeApp(FIREBASE_CONFIG, nomeAppSecundario);
          try {
            const cred = await appSecundario.auth().createUserWithEmailAndPassword(email, senha);
            if(nome) { try { await cred.user.updateProfile({ displayName: nome }); } catch(e) {} }
            // Criado autenticado como o próprio novo cliente (uid == dono),
            // então a regra "allow create" de clientes/{uid} é satisfeita.
            await appSecundario.firestore().collection("clientes").doc(cred.user.uid).set({
              email, nome, status: "ativo", role: "cliente",
              criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
              criadoPor: user.uid
            });
            setAvisoCadastroCliente("Cliente cadastrado e já pode entrar no aplicativo.");
            setNovoClienteNome(""); setNovoClienteEmail(""); setNovoClienteSenha("");
          } catch(e) {
            let msg = e.message || String(e);
            if((e.code||"").includes("email-already-in-use")) msg = "Já existe uma conta com este e-mail.";
            else if((e.code||"").includes("invalid-email")) msg = "E-mail inválido.";
            else if((e.code||"").includes("weak-password")) msg = "Senha muito fraca (mínimo 6 caracteres).";
            setErroCadastroCliente(msg);
          } finally {
            try { await appSecundario.auth().signOut(); } catch(e) {}
            try { await appSecundario.delete(); } catch(e) {}
            setCadastrandoCliente(false);
          }
        }
        return (
          <div>
            <h2 className="text-sm font-bold mb-3">👥 Clientes</h2>
            <div className="card mb-3">
              <button onClick={()=>{ setMostrarCadastroCliente(v=>!v); setErroCadastroCliente(""); setAvisoCadastroCliente(""); }}
                className="btn-primary w-full">{mostrarCadastroCliente ? "Fechar" : "➕ Cadastrar Cliente"}</button>
              {mostrarCadastroCliente && (
                <div className="mt-3">
                  <input type="text" placeholder="Nome" value={novoClienteNome} onChange={e=>setNovoClienteNome(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                  <input type="email" placeholder="E-mail" value={novoClienteEmail} onChange={e=>setNovoClienteEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                  <input type="text" placeholder="Senha inicial (mín. 6 caracteres)" value={novoClienteSenha} onChange={e=>setNovoClienteSenha(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg mb-2 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
                  {erroCadastroCliente && <div className="alerta mb-2"><span>⚠️</span><span className="text-xs">{erroCadastroCliente}</span></div>}
                  {avisoCadastroCliente && <div className="alerta sucesso mb-2"><span>✅</span><span className="text-xs">{avisoCadastroCliente}</span></div>}
                  <button onClick={cadastrarNovoCliente} disabled={cadastrandoCliente} className="btn-primary w-full">
                    {cadastrandoCliente ? "Cadastrando..." : "Confirmar cadastro"}
                  </button>
                </div>
              )}
            </div>
            <input type="text" placeholder="Buscar por e-mail..." value={buscaCliente} onChange={e=>setBuscaCliente(e.target.value)}
              className="w-full px-3 py-2 rounded-lg mb-3 font-mono text-sm bg-[#0a1410] border border-[#1e3228] text-[#e8e0cc] outline-none focus:border-[#c6a15b]" />
            {filtrados.length === 0 && <p className="text-xs text-[#6a7d6a]">Nenhum cliente encontrado.</p>}
            {filtrados.map(c => (
              <div key={c.id} className="card mb-2" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div className="text-xs font-mono">{c.nome ? c.nome + " — " : ""}{c.email || c.id}</div>
                  <div className="text-[10px] text-[#6a7d6a]">{c.status === "bloqueado" ? "🔴 Bloqueado" : "🟢 Ativo"}</div>
                </div>
                <button onClick={()=>alternarStatus(c)} className="btn-primary" style={{padding:"6px 12px",fontSize:11}}>
                  {c.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {secao==="estrategia" && (()=>{
        const ciclo=estratCiclos.find(c=>c.id===estratCicloSel)||estratCiclos[0];
        const dadosTodos=dadosCiclosEstrat();
        const dado=dadosTodos.find(x=>x.indice===Number(estratCicloSel))||dadosTodos[0];
        const ops=ciclo?.operacoes||[];
        const banca=Number(dado?.bancaAtual||dado?.inicio||100);
        const inicioCiclo=Number(dado?.inicio||ciclo?.cap||100);
        const metaCiclo=Number(dado?.meta||inicioCiclo*(1+(Number(ciclo?.meta)||0)));
        const objetivoPct=taxaEfetivaCiclo(ciclo)*100;
        const greens=ops.filter(o=>o.resultadoTipo==="green"||o.resultadoTipo==="green_parcial").length;
        const reds=ops.filter(o=>o.resultadoTipo==="red"||o.resultadoTipo==="red_parcial").length;
        const wr=ops.filter(o=>o.status!=="aberta").length?Math.round(greens/ops.filter(o=>o.status!=="aberta").length*100):0;
        const sim=simularCincoCiclosEstrat();
        const aba=(id,label,ico)=> <button onClick={()=>setEstratAba(id)} className="btn-small" style={{flex:1,minWidth:0,borderColor:estratAba===id?"#c6a15b":"#294936",color:estratAba===id?"#c6a15b":"#8a9a8a",background:estratAba===id?"rgba(198,161,91,.08)":"transparent"}}>{ico} {label}</button>;
        return <div>
          <div className="card mb-3" style={{borderColor:"rgba(216,174,85,.45)",padding:"10px"}}>
            <div className="flex items-center justify-between gap-2">
              <div><div className="font-mono text-[12px] font-bold text-[#e8e0cc]">📈 Método de Ciclos</div><div className="font-mono text-[7px] text-[#6a7d6a]">Matriz compacta · operação por ciclo · histórico separado</div></div>
            </div>
            <div className="flex gap-1 mt-3">{aba("matriz","Matriz","📊")}{aba("operacao","Operação","⚽")}{aba("analise","Análise","📈")}{aba("historico","Histórico","🗂")}</div>
          </div>

          {estratAba==="matriz" && <div>
            <div className="card mb-3" style={{padding:0,overflow:"hidden"}}>
              <div className="px-3 py-2 border-b border-[#1e3228]"><div className="font-mono text-[10px] text-[#c6a15b] uppercase">📊 Matriz dos 5 ciclos</div><div className="font-mono text-[7px] text-[#6a7d6a] mt-1">Edite entrada inicial, % por jogo, meta e saque. Os ciclos seguintes são calculados automaticamente.</div></div>
              <div className="p-2">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div><label className="font-mono text-[7px] text-[#6a7d6a]">BANCA INICIAL</label><input type="text" inputMode="decimal" value={estratCiclos[0]?.cap??100} onChange={e=>atualizarConfigCicloEstrat(1,"cap",Math.max(0,Number(String(e.target.value).replace(",","."))||0))} className="w-full mt-1 font-mono text-sm font-bold bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></div>
                  <div><label className="font-mono text-[7px] text-[#6a7d6a]">META PADRÃO (%)</label><input type="text" inputMode="decimal" value={(Number(estratCiclos[0]?.meta||0)*100).toString().replace(".",",")} onChange={e=>{const v=Math.max(0,Number(String(e.target.value).replace(",","."))/100||0);setEstratCiclos(prev=>prev.map(c=>({...c,meta:v})))}} className="w-full mt-1 font-mono text-sm font-bold bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></div>
                </div>
                <div className="card-soft mb-3" style={{padding:"8px 10px",borderColor:"rgba(198,161,91,.28)"}}>
                  <div className="font-mono text-[9px] font-bold text-[#c6a15b] uppercase">🖥️ Monitor dos ciclos</div>
                  <div className="font-mono text-[7px] text-[#6a7d6a] mt-1">O fim real e o saque real ficam registrados. Quando você confirma o saque, o próximo ciclo passa a começar exatamente com o que sobrou.</div>
                </div>
                <div style={{overflowX:"auto"}}><div style={{minWidth:1180}}>
                  <div className="grid py-2 border-b border-[#1e3228] font-mono text-[7px] text-[#6a7d6a]" style={{gridTemplateColumns:"42px 78px 72px 62px 68px 78px 78px 78px 78px 88px 1fr"}}><span>Ciclo</span><span>Começou</span><span>Entrada</span><span>%/jogo</span><span>Meta %</span><span>Meta / teórico</span><span>Fim real</span><span>Saque teórico</span><span>Saque real</span><span>Próx. ciclo</span><span>Situação</span></div>
                  {sim.linhas.map(x=><div key={x.indice} className="grid py-2 border-b border-[#14241c] font-mono text-[8px] items-center" style={{gridTemplateColumns:"42px 78px 72px 62px 68px 78px 78px 78px 78px 88px 1fr"}}>
                    <button type="button" onClick={()=>{setEstratCicloSel(x.indice);setEstratAba("operacao")}} className="font-bold text-[#c6a15b]" style={{background:"none",border:"none",textAlign:"left",padding:0,cursor:"pointer"}}>C{x.indice}</button>
                    <span>{fmt(x.inicio)}</span>
                    <span>{fmt(x.inicio)}</span>
                    <span><input type="text" inputMode="decimal" value={(Number(x.c.objetivo||0)*100).toString().replace(".",",")} onChange={e=>atualizarConfigCicloEstrat(x.c.id,"objetivo",Math.max(0,Number(String(e.target.value).replace(",","."))/100||0))} style={{width:50,background:"transparent",border:"1px solid #294936",borderRadius:6,padding:"3px 4px",fontFamily:"JetBrains Mono,monospace",fontSize:8,color:"#e8e0cc"}} /></span>
                    <span><input type="text" inputMode="decimal" value={(Number(x.c.meta||0)*100).toString().replace(".",",")} onChange={e=>atualizarConfigCicloEstrat(x.c.id,"meta",Math.max(0,Number(String(e.target.value).replace(",","."))/100||0))} style={{width:52,background:"transparent",border:"1px solid #294936",borderRadius:6,padding:"3px 4px",fontFamily:"JetBrains Mono,monospace",fontSize:8,color:"#e8e0cc"}} />%</span>
                    <span className="text-[#4C8C5C] font-bold">{fmt(x.fim)}</span>
                    <span className={x.fimReal>=x.fim?"text-[#4C8C5C] font-bold":"text-[#e8e0cc]"}>{fmt(x.fimReal)}</span>
                    <span><input type="text" inputMode="decimal" value={String(x.c.saquePlanejado??0).replace(".",",")} onChange={e=>atualizarConfigCicloEstrat(x.c.id,"saquePlanejado",Math.max(0,Number(String(e.target.value).replace(",","."))||0))} style={{width:62,background:"transparent",border:"1px solid #294936",borderRadius:6,padding:"3px 4px",fontFamily:"JetBrains Mono,monospace",fontSize:8,color:"#e8e0cc"}} /></span>
                    <span>
                      <input type="text" inputMode="decimal" value={estratSaqueRealEdit[x.c.id]!==undefined?estratSaqueRealEdit[x.c.id]:(x.saqueReal!==null?String(x.saqueReal).replace(".",","):"")} onChange={e=>setEstratSaqueRealEdit(prev=>({...prev,[x.c.id]:e.target.value}))} placeholder="real" style={{width:62,background:"transparent",border:"1px solid #294936",borderRadius:6,padding:"3px 4px",fontFamily:"JetBrains Mono,monospace",fontSize:8,color:"#e8e0cc"}} />
                      <button type="button" onClick={()=>confirmarSaqueCicloEstrat(x.c.id,estratSaqueRealEdit[x.c.id])} className="btn-small" style={{fontSize:6,padding:"2px 4px",marginTop:2,borderColor:"#c6a15b",color:"#c6a15b"}}>{x.saqueReal!==null?"Atualizar":"Confirmar"}</button>
                    </span>
                    <span className="text-[#c6a15b] font-bold">{fmt(x.proximoInicio)}</span>
                    <span className="text-[#6a7d6a]">{x.saqueReal!==null?`✓ Sacado ${fmt(x.saqueReal)} · sobrou ${fmt(x.proximoInicio)}`:x.fimReal>=x.fim?"✓ Ciclo atingido · informe o saque real":"Em andamento"}</span>
                  </div>)}
                </div></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="card-soft text-center"><div className="font-mono text-[6px] text-[#6a7d6a]">SAQUES TEÓRICOS</div><div className="font-mono text-[12px] font-bold text-[#c6a15b]">{fmt(sim.totalSaques)}</div></div>
              <div className="card-soft text-center"><div className="font-mono text-[6px] text-[#6a7d6a]">SAQUES REAIS REGISTRADOS</div><div className="font-mono text-[12px] font-bold text-[#c6a15b]">{fmt(estratCiclos.reduce((a,c)=>a+(c.saqueConfirmado?Number(c.saqueConfirmado.valor||0):0),0))}</div></div>
              <div className="card-soft text-center"><div className="font-mono text-[6px] text-[#6a7d6a]">FINAL C5 PROJETADO</div><div className="font-mono text-[12px] font-bold text-[#4C8C5C]">{fmt(sim.finalBruto)}</div></div>
              <div className="card-soft text-center"><div className="font-mono text-[6px] text-[#6a7d6a]">CAPITAL ATUAL C5</div><div className="font-mono text-[12px] font-bold">{fmt(dadosTodos[4]?.bancaAtual||dadosTodos[4]?.inicio||0)}</div></div>
            </div>
          </div>}

          {estratAba==="operacao" && <div>
            <div className="flex gap-1 overflow-x-auto mb-3">{estratCiclos.map(c=><button key={c.id} onClick={()=>setEstratCicloSel(c.id)} className="btn-small" style={{flex:1,minWidth:58,borderColor:estratCicloSel===c.id?"#c6a15b":"#294936",color:estratCicloSel===c.id?"#c6a15b":"#8a9a8a"}}>C{c.id}</button>)}</div>
            <div className="card mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">BANCA DO CICLO</div><div className="font-mono text-sm font-bold">{fmt(inicioCiclo)}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">ENTRADA ATUAL</div><div className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(banca)}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">META</div><div className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(metaCiclo)}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">FIM REAL</div><div className="font-mono text-sm font-bold text-[#4C8C5C]">{fmt(dado?.fimReal||banca)}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">SAQUE REAL</div><div className="font-mono text-sm font-bold text-[#c6a15b]">{dado?.saqueReal!==null&&dado?.saqueReal!==undefined?fmt(dado.saqueReal):"—"}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">PRÓX. CICLO</div><div className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(dado?.proximoInicio||banca)}</div></div>
                <div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">% POR GREEN</div><div className="font-mono text-sm font-bold text-[#4C8C5C]">{objetivoPct.toFixed(2)}%</div></div>
              </div>
            </div>
            {dado?.saqueReal!==null&&dado?.saqueReal!==undefined && <div className="card-soft mb-3" style={{borderColor:"rgba(198,161,91,.35)"}}><div className="font-mono text-[8px] text-[#c6a15b] font-bold">✓ SAQUE REAL REGISTRADO</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Fim real: <b className="text-[#e8e0cc]">{fmt(dado.fimReal)}</b> · Sacado: <b className="text-[#c6a15b]">{fmt(dado.saqueReal)}</b> · Capital levado para o próximo ciclo: <b className="text-[#4C8C5C]">{fmt(dado.proximoInicio)}</b></div></div>}
            {ciclo.status!=="encerrado" && <div className="card mb-3">
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase mb-1">➕ Lançar entrada</div>
              <div className="font-mono text-[7px] text-[#6a7d6a] mb-2">A entrada e a responsabilidade já vêm preenchidas pelo valor total da banca. Você só informa o jogo, estratégia, método e odd.</div>
              <div className="card-soft mb-2"><div className="font-mono text-[7px] text-[#6a7d6a]">ENTRADA / RESPONSABILIDADE AUTOMÁTICA</div><div className="font-mono text-xl font-bold text-[#e8e0cc]">{fmt(banca)}</div></div>
              <div className="grid grid-cols-2 gap-2 mb-2"><input value={estratJogo} onChange={e=>setEstratJogo(e.target.value)} placeholder="Jogo" className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /><input value={estratTime} onChange={e=>setEstratTime(e.target.value)} placeholder="Time / seleção" className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></div>
              <div className="flex gap-1 mb-2">
                <select value={estratNome} onChange={e=>setEstratNome(e.target.value)} className="flex-1 font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]"><option value="Minha estratégia">Selecione a estratégia</option>{estrategias.filter(e=>e.ativa!==false).map(e=><option key={e.id} value={e.nome}>{e.nome}</option>)}</select>
                <button type="button" onClick={()=>{setShowGerEstrategias(true);setNovaEstrategia("");}} className="btn-small text-[8px] px-2" style={{borderColor:"#c6a15b",color:"#c6a15b",whiteSpace:"nowrap"}}>＋ Estratégia</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2"><select value={estratMetodo} onChange={e=>setEstratMetodo(e.target.value)} className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]"><option value="">BACK ou LAY</option><option value="BACK">BACK</option><option value="LAY">LAY</option></select><input type="text" inputMode="decimal" value={estratOdd} onChange={e=>setEstratOdd(e.target.value)} placeholder="Odd" className="font-mono text-xs bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></div>
              <div className="card-soft mb-2"><div className="font-mono text-[7px] text-[#6a7d6a]">GREEN PELA ODD</div><div className="font-mono text-sm font-bold text-[#4C8C5C]">+{(()=>{const o=Number(String(estratOdd).replace(",","."));return isFinite(o)&&o>1?fmt(banca*(o-1)):"—";})()}</div><div className="font-mono text-[7px] text-[#6a7d6a]">1,30 = 30% · a % do ciclo continua sendo apenas referência de planejamento</div></div>
              <input value={estratObs} onChange={e=>setEstratObs(e.target.value)} placeholder="Observação (opcional)" className="w-full font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc] mb-2" />
              <button onClick={registrarEntradaEstrat} className="btn-primary w-full">Salvar entrada aberta</button>
            </div>}

            <div className="card mb-3" style={{padding:0,overflow:"hidden"}}>
              <div className="px-3 py-2 border-b border-[#1e3228]"><div className="font-mono text-[9px] text-[#c6a15b] uppercase">📋 Operações — {ciclo.nome}</div></div>
              <div className="p-2">
                {ops.length===0?<div className="font-mono text-[8px] text-[#4a5a4a] text-center py-5">Nenhuma entrada lançada neste ciclo.</div>:ops.slice().reverse().map(o=><div key={o.id} className="card-soft mb-2" style={{borderColor:o.status==="aberta"?"#294936":o.lucro>=0?"rgba(76,140,92,.45)":"rgba(166,67,45,.45)"}}>
                  <div className="flex justify-between gap-2"><div className="min-w-0"><div className="font-mono text-[10px] font-bold truncate">#{o.numero} · {o.jogo||"Sem jogo"}</div><div className="font-mono text-[7px] text-[#6a7d6a] truncate">{o.time||"—"} · {o.estrategia||"—"} · {o.metodo} · odd {String(o.odd).replace(".",",")}</div></div><div className="text-right"><div className="font-mono text-[7px] text-[#6a7d6a]">STAKE</div><div className="font-mono text-[11px] font-bold">{fmt(o.entrada)}</div></div></div>
                  <div className="flex items-center justify-between gap-2 mt-2"><div className="font-mono text-[8px]">{o.status==="aberta"?<span className="text-[#c6a15b]">ABERTA</span>:<span className={o.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}>{o.resultadoTipo==="green"?"🟢 GREEN":o.resultadoTipo==="green_parcial"?"🟢 GREEN PARCIAL":o.resultadoTipo==="red_parcial"?"🔴 RED PARCIAL":"🔴 RED"} · {o.lucro>=0?"+":""}{fmt(o.lucro)}</span>}</div><div className="flex gap-1">{o.status==="aberta"&&<button className="btn-small" onClick={()=>abrirFinalizarEstrat(o.id)}>Registrar resultado</button>}<button className="btn-small text-[8px]" onClick={()=>abrirEditarEstrat(o.id)} style={{borderColor:"#c6a15b",color:"#c6a15b"}}>✏ Editar</button><button className="btn-small text-[8px]" onClick={()=>excluirEstratOperacao(o.id)} style={{borderColor:"#ef4444",color:"#ef4444"}}>🗑 Apagar</button></div></div>
                </div>)}
              </div>
            </div>
          </div>}

          {estratAba==="analise" && <div>
            <div className="grid grid-cols-2 gap-2 mb-3"><div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">ENTRADAS</div><div className="font-mono text-lg font-bold">{ops.length}</div></div><div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">ACERTO</div><div className="font-mono text-lg font-bold">{wr}%</div></div><div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">GREENS</div><div className="font-mono text-lg font-bold text-[#4C8C5C]">{greens}</div></div><div className="card-soft text-center"><div className="font-mono text-[7px] text-[#6a7d6a]">RED/ PARCIAL</div><div className="font-mono text-lg font-bold text-[#A6432D]">{reds}</div></div></div>
            <div className="card"><div className="font-mono text-[9px] text-[#c6a15b] uppercase">📌 Resumo do ciclo</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-2">Banca inicial: <b className="text-[#e8e0cc]">{fmt(inicioCiclo)}</b> · Atual: <b className="text-[#e8e0cc]">{fmt(banca)}</b> · Meta: <b className="text-[#c6a15b]">{fmt(metaCiclo)}</b></div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Lucro realizado: <b className={dado?.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}>{dado?.lucro>=0?"+":""}{fmt(dado?.lucro||0)}</b></div></div>
          </div>}

          {estratAba==="historico" && <div>
            <div className="card mb-3" style={{padding:0,overflow:"hidden"}}><div className="px-3 py-2 border-b border-[#1e3228]"><div className="font-mono text-[10px] text-[#c6a15b] uppercase">🗂 Histórico dos 5 ciclos</div></div><div className="p-2">{estratCiclos.flatMap(c=>(c.operacoes||[]).map(o=>({...o,cicloNumero:c.id,cicloNome:c.nome}))).sort((a,b)=>Number(b.data||0)-Number(a.data||0)).map(o=><div key={`${o.cicloNumero}-${o.id}`} className="card-soft mb-2"><div className="font-mono text-[9px] font-bold">C{o.cicloNumero} · {o.jogo||"Sem jogo"}</div><div className="font-mono text-[7px] text-[#6a7d6a]">{o.time||"—"} · {o.estrategia||"—"} · {o.metodo} · stake {fmt(o.entrada)}</div><div className="font-mono text-[8px] mt-1" style={{color:o.lucro>=0?"#4C8C5C":"#A6432D"}}>{o.status==="aberta"?"ABERTA":o.resultadoTipo==="green"?`🟢 GREEN +${fmt(o.lucro)}`:o.resultadoTipo==="green_parcial"?`🟢 GREEN PARCIAL +${fmt(o.lucro)}`:o.resultadoTipo==="red_parcial"?`🔴 RED PARCIAL ${fmt(o.lucro)}`:`🔴 RED ${fmt(o.lucro)}`}</div></div>)}{estratCiclos.every(c=>(c.operacoes||[]).length===0)&&<div className="font-mono text-[8px] text-[#4a5a4a] text-center py-5">Nenhuma operação registrada.</div>}</div></div>
          </div>}
        </div>;
      })()}

      {lembreteBanner && (
        <div className="card mb-3 plan-reminder-banner" style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:22}}>⏰</div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] text-[#d8ae55] uppercase font-bold">Lembrete de operação</div>
            <div className="font-mono text-[11px] text-[#e8e0cc] font-bold truncate">{lembreteBanner.hora} · {lembreteBanner.time}{lembreteBanner.adversario?` x ${lembreteBanner.adversario}`:""}</div>
            <div className="font-mono text-[8px] text-[#6a7d6a] truncate">{lembreteBanner.estrategia}{lembreteBanner.pretendo?` · ${lembreteBanner.pretendo}`:""}</div>
          </div>
          <div className="flex flex-col gap-1">
            <button className="premium-open-btn" onClick={()=>{abrirOperacaoDoPlano(lembreteBanner);setLembreteBanner(null);}}>LANÇAR</button>
            <button className="btn-small" onClick={()=>setLembreteBanner(null)}>fechar</button>
          </div>


        </div>
      )}


      {jogoLembreteBanner && (
        <div className="card mb-3 plan-reminder-banner" style={{display:"flex",alignItems:"center",gap:10,borderColor:"rgba(88,168,106,.7)"}}>
          <div style={{fontSize:22}}>⚽</div><div className="flex-1 min-w-0"><div className="font-mono text-[9px] text-[#58a86a] uppercase font-bold">Jogo próximo de começar</div><div className="font-mono text-[11px] font-bold truncate">{jogoLembreteBanner.horario} · {jogoLembreteBanner.mandante} x {jogoLembreteBanner.visitante}</div><div className="font-mono text-[8px] text-[#6a7d6a] truncate">{jogoLembreteBanner.leituraFinal?.entradaFinal&&jogoLembreteBanner.leituraFinal.entradaFinal!=="N/D"?jogoLembreteBanner.leituraFinal.entradaFinal:jogoLembreteBanner.entradaSugerida} · Confiança: {jogoLembreteBanner.confianca}</div></div>
          <div className="flex flex-col gap-1"><button className="premium-open-btn" onClick={()=>{abrirOperacaoDoJogo(jogoLembreteBanner);setJogoLembreteBanner(null);}}>LANÇAR</button><button className="btn-small" onClick={()=>setJogoLembreteBanner(null)}>fechar</button></div>
        </div>
      )}

      {possivelEntradaBanner && (
        <div className="card mb-3 plan-reminder-banner" style={{display:"flex",alignItems:"center",gap:10,borderColor:"rgba(216,174,85,.7)"}}>
          <div style={{fontSize:22}}>🔔</div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] text-[#d8ae55] uppercase font-bold">Alerta de jogo · Possível Entrada</div>
            <div className="font-mono text-[11px] font-bold truncate">{possivelEntradaBanner.horario} · {possivelEntradaBanner.mandante} x {possivelEntradaBanner.visitante}</div>
            <div className="font-mono text-[8px] text-[#6a7d6a] truncate">⭐ {possivelEntradaBanner.favorito} · 🎯 Back Favorito</div>
          </div>
          <div className="flex flex-col gap-1">
            <button className="premium-open-btn" onClick={()=>criarOperacaoDoListaBolsa(possivelEntradaBanner)}>CRIAR OPERAÇÃO</button>
            <button className="btn-small" onClick={()=>setPossivelEntradaBanner(null)}>fechar</button>
          </div>
        </div>
      )}

      {secao==="jogos" && (
        <>
          {entradasSubView===null ? (
            <>
              <div className="card mb-3 jogos-top" style={{padding:12}}>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold tracking-tight">🎯 Entradas Pré-Live</div>
                  <div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>Escolha como deseja iniciar a operação</div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <button type="button" className="card w-full text-left" style={{display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",borderColor:"rgba(88,168,106,.45)"}}
                  onClick={()=>setEntradasSubView("ao_vivo")}>
                  <span style={{fontSize:22}}>⚽</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] font-bold text-[#e8e0cc]">Jogos do Dia</div>
                    <div className="font-mono text-[8px] text-[#6a7d6a]">Importe suas listas, junte estratégias do mesmo jogo, organize por horário e gere o Card do Dia</div>
                  </div>
                  <span className="font-mono text-[14px] text-[#c6a15b]">›</span>
                </button>

                <button type="button" className="card w-full text-left" disabled={entradaAoVivoCarregando} style={{display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",opacity:entradaAoVivoCarregando?0.65:1}}
                  onClick={()=>entradaAoVivoInputRef.current?.click()}>
                  <span style={{fontSize:22}}>📸</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] font-bold text-[#e8e0cc]">{entradaAoVivoCarregando?"Lendo…":"Ler Comprovante"}</div>
                    <div className="font-mono text-[8px] text-[#6a7d6a]">Foto do comprovante já apostado → cria operação</div>
                  </div>
                  <span className="font-mono text-[14px] text-[#c6a15b]">›</span>
                </button>
                <input ref={entradaAoVivoInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>importarEntradaAoVivo(e.target.files?.[0])}/>
              </div>

              {entradaAoVivoStatus&&<div className="font-mono text-[8px] mb-3" style={{color:entradaAoVivoCarregando?"#d8ae55":"#81cd90"}}>{entradaAoVivoStatus}</div>}
              {resultadoTextoJogos && <div className="card-soft mb-3" style={{padding:"8px 10px",border:"1px solid rgba(88,168,106,.22)"}}><div className="font-mono text-[8px]" style={{color:"#81cd90"}}>{resultadoTextoJogos.tipo==="ao_vivo"?`✓ Print lido: ${resultadoTextoJogos.favorito} @ ${Number(resultadoTextoJogos.odd).toFixed(2)} identificado como BACK favorito.`:resultadoTextoJogos.tipo==="lista"?`✓ ${resultadoTextoJogos.salvos} jogo(s) salvo(s)${resultadoTextoJogos.data?` em ${formatarDataNavegacao(resultadoTextoJogos.data)}`:"."}`:"✓ Análise do dia atualizada."}</div></div>}
            </>
          ) : (
            <>
              <button type="button" className="btn-small mb-3" onClick={()=>setEntradasSubView(null)}>← Voltar</button>

              <div className="card mb-3" style={{padding:10,borderColor:"rgba(198,161,91,.28)"}}>
                <div className="font-mono text-[8px] text-[#6a7d6a] uppercase mb-2">📅 Opções do dia</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[{d:tISO(new Date()),l:"Hoje"},{d:(()=>{const x=new Date();x.setDate(x.getDate()+1);return tISO(x)})(),l:"Amanhã"}].map(x=><button key={x.d} type="button" className={`jogos-chip ${jogosDataFiltro===x.d?"active":""}`} onClick={()=>{setJogosDataFiltro(x.d);setJogosCardSelecionados([]);setJogosExcluirSelecionados([]);}}>{x.l}<span style={{opacity:.65,marginLeft:5}}>{formatarDataNavegacao(x.d)}</span></button>)}
                </div>
                <div className="flex gap-2 items-center">
                  <input type="date" value={jogosDataFiltro} onChange={e=>{setJogosDataFiltro(e.target.value||tISO(new Date()));setJogosCardSelecionados([]);setJogosExcluirSelecionados([]);}} className="review-field flex-1" />
                  <button type="button" className={autoLimpezaJogos?"btn-primary":"btn-secondary"} style={{width:"auto",padding:"8px 9px",fontSize:8}} onClick={()=>setAutoLimpezaJogos(v=>!v)}>{autoLimpezaJogos?"🧹 Auto ON":"🧹 Auto OFF"}</button>
                </div>
                <div className="font-mono text-[7px] text-[#6a7d6a] mt-2">A limpeza automática remove jogos pendentes 15 min depois do horário. Operações já feitas ficam preservadas.</div>
              </div>

              <div className="card mb-3" style={{padding:10,borderColor:"rgba(88,168,106,.32)"}}>
                <button type="button" className="btn-primary w-full" style={{padding:"10px 8px",fontSize:10}} onClick={()=>setShowEntradaInteligente(true)}>📋 IMPORTAR LISTA DE JOGOS</button>
                <div className="font-mono text-[8px] text-[#6a7d6a] mt-2 text-center">Cole uma ou mais listas. Jogos repetidos são unidos e recebem todas as estratégias encontradas.</div>
              </div>

              <div className="card mb-3 jogos-top" style={{padding:12}}>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold tracking-tight">⚽ Jogos do Dia</div>
                  <div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>{new Date(jogosDataFiltro+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</div>
                  <div className="font-mono text-[8px] mt-2" style={{color:"#81cd90"}}>{jogosCardSelecionados.length} selecionado(s) para o card</div>
                </div>
                <div className="flex flex-col gap-1.5" style={{minWidth:135}}>
                  <button type="button" className="btn-primary" style={{padding:"9px 8px",fontSize:10}} onClick={abrirCardJogosDia}>🃏 GERAR CARD</button>
                  {jogosCardSelecionados.length>0&&<button type="button" className="btn-small" onClick={limparSelecaoCard}>LIMPAR SELEÇÃO</button>}
                </div>
              </div>

              {(()=>{
                const ordenar=(a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99"));
                const todos=jogosDaData.slice().sort(ordenar);
                const nomesEstrategias=Array.from(new Set(todos.flatMap(j=>Array.isArray(j.estrategias)?j.estrategias:[j.estrategiaBase||j.entradaSugerida||"N/D"]).map(x=>String(x||"N/D").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"));
                const filtrados=todos.filter(j=>jogosEstrategiaFiltro==="todas"||((Array.isArray(j.estrategias)?j.estrategias:[j.estrategiaBase||j.entradaSugerida||"N/D"]).some(e=>normBusca(e)===normBusca(jogosEstrategiaFiltro))));
                const comSinal=todos.filter(j=>{const m=melhorMetodoJogo(j);return !!m&&semaforoMetodo(j,m).txt==="OPERÁVEL";}).length;
                const semSinal=todos.length-comSinal;
                const grupos=[];
                filtrados.forEach(j=>{const h=j.horario&&j.horario!=="N/D"?j.horario:"SEM HORÁRIO";let g=grupos.find(x=>x.h===h);if(!g){g={h,itens:[]};grupos.push(g);}g.itens.push(j);});
                return <div className="space-y-3">
                  <div className="card-soft" style={{padding:10,border:"1px solid rgba(88,168,106,.28)"}}>
                    <div className="font-mono text-[9px] font-bold" style={{color:"#81cd90"}}>📊 RESUMO DOS JOGOS DO DIA</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      <div><div className="font-mono text-[8px]" style={{color:"#6a7d6a"}}>TOTAL</div><div className="text-[16px] font-bold">{todos.length}</div></div>
                      <div><div className="font-mono text-[8px]" style={{color:"#6a7d6a"}}>COM SINAL</div><div className="text-[16px] font-bold" style={{color:"#81cd90"}}>{comSinal}</div></div>
                      <div><div className="font-mono text-[8px]" style={{color:"#6a7d6a"}}>SEM SINAL</div><div className="text-[16px] font-bold" style={{color:"#d8ae55"}}>{semSinal}</div></div>
                      <div><div className="font-mono text-[8px]" style={{color:"#6a7d6a"}}>OPERADOS</div><div className="text-[16px] font-bold" style={{color:"#c6a15b"}}>{todos.filter(j=>j.status==="OPERADO").length}</div></div>
                    </div>
                    <div className="font-mono text-[8px] mt-2" style={{color:"#6a7d6a"}}>O indicador “SEM SINAL” mostra em cada jogo o motivo pelo qual ele não foi liberado.</div>
                    <select value={jogosEstrategiaFiltro} onChange={e=>setJogosEstrategiaFiltro(e.target.value)} className="review-field w-full mt-2" style={{fontSize:10}}>
                      <option value="todas">🔎 Todas as estratégias ({todos.length})</option>
                      {estrategias.filter(e=>e.ativa!==false).map(e=><option key={e.id} value={e.nome}>{e.nome}</option>)}
                    </select>
                    {jogosEstrategiaFiltro!=="todas"&&<button type="button" className="btn-small mt-2" onClick={()=>setJogosEstrategiaFiltro("todas")}>LIMPAR FILTRO</button>}
                  </div>
                  <div className="card-soft" style={{padding:10,border:"1px solid rgba(198,161,91,.25)"}}>
                    <div className="font-mono text-[9px] font-bold text-[#c6a15b]">📋 GERENCIAR JOGOS DO DIA</div>
                    <div className="font-mono text-[8px] text-[#6a7d6a] mt-1 mb-2">Toque no jogo para <b>Gerar Operação</b>. Use os botões abaixo para apagar jogos.</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="btn-danger" onClick={excluirJogosSelecionados} disabled={!jogosExcluirSelecionados.length} style={{opacity:jogosExcluirSelecionados.length?1:.5}}>🗑 APAGAR SELECIONADOS{jogosExcluirSelecionados.length?` (${jogosExcluirSelecionados.length})`:""}</button>
                      <button type="button" className="btn-small" onClick={limparJogosDaData} disabled={!todos.length} style={{whiteSpace:"nowrap",opacity:todos.length?1:.5}}>🗑 LIMPAR ESTE DIA</button>
                    </div>
                    <div className="font-mono text-[7px] text-[#6a7d6a] mt-2">☑ A primeira caixa de cada jogo seleciona para apagar. ☑ A segunda seleciona para o Card.</div>
                  </div>
                  {grupos.map(g=><div key={g.h} className="card" style={{padding:0,overflow:"hidden"}}>
                    <div className="simple-games-title"><strong>🕐 {g.h}</strong><span className="simple-games-count">{g.itens.length}</span></div>
                    {g.itens.map(j=>{const metodo=melhorMetodoJogo(j);const sinal=metodo?semaforoMetodo(j,metodo):{txt:"SEM SINAL",ico:"⚪",cor:"#d8ae55"};const motivo=!metodo?"Nenhuma estratégia reconhecida para este jogo.":sinal.txt==="OPERÁVEL"?"Sinal disponível.":sinal.txt==="EVITAR"?"Estratégia cancelada pela atualização pré-jogo.":sinal.txt==="REVISAR"?"Dados incompletos: revisar leitura.":(motivosDaOportunidade(j,metodo).join(" · ")||"A estratégia existe, mas ainda não atingiu os critérios do sinal.");return <div key={j.id} className="simple-game-row" style={{cursor:"default",gridTemplateColumns:"26px 26px 62px minmax(0,1fr) 28px"}}>
                      <label className="flex items-center justify-center" style={{width:24,cursor:"pointer"}} onClick={e=>e.stopPropagation()} title="Selecionar para apagar">
                        <input type="checkbox" checked={jogosExcluirSelecionados.includes(j.id)} onChange={()=>alternarJogoParaExcluir(j)} style={{width:15,height:15,accentColor:"#A6432D"}} aria-label={`Selecionar ${j.mandante} x ${j.visitante} para apagar`} />
                      </label>
                      <label className="flex items-center justify-center" style={{width:24,cursor:"pointer"}} onClick={e=>e.stopPropagation()} title="Selecionar para o Card de Jogos do Dia">
                        <input type="checkbox" checked={jogosCardSelecionados.includes(j.id)} onChange={()=>alternarJogoNoCard(j)} style={{width:15,height:15,accentColor:"#c6a15b"}} aria-label={`Selecionar ${j.mandante} x ${j.visitante} para o card`} />
                      </label>
                      <span className="simple-game-time">{j.horario&&j.horario!=="N/D"?j.horario:"--:--"}</span>
                      <button type="button" className="simple-game-match text-left" style={{background:"none",border:0,color:"inherit",padding:0,cursor:"pointer"}} onClick={()=>abrirOperacaoDoJogo(j)}>
                        <div>{j.mandante} x {j.visitante}</div>
                        <div className="font-mono text-[14px] font-bold mt-1" style={{color:"#f0cb77",whiteSpace:"normal",lineHeight:"1.4"}}>🎯 {(Array.isArray(j.estrategias)&&j.estrategias.length?j.estrategias:[j.estrategiaBase||j.entradaSugerida||"N/D"]).join(" · ")}</div>
                        <div className="font-mono text-[11px] font-bold mt-1" style={{color:sinal.cor,whiteSpace:"normal",lineHeight:"1.35"}}>{sinal.ico} {sinal.txt} — {motivo}</div>
                      </button>
                      {(()=>{ const ach=localizarOperacaoDoJogo(j); const aberta=!!(ach&&ach.op&&ach.op.status==="aberta"); return aberta ? <button type="button" className="btn-small" onClick={()=>abrirFinalizarOperacaoDoJogo(j)} style={{fontSize:7,padding:"5px 4px",borderColor:"#c6a15b",color:"#c6a15b",whiteSpace:"nowrap"}}>FINALIZAR</button> : <span className="simple-game-arrow">›</span>; })()}
                    </div>})}
                  </div>)}
                  {!todos.length&&<div className="card-soft" style={{padding:18,textAlign:"center"}}><div className="font-mono text-[10px] font-bold">Nenhum jogo salvo para esta data.</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Toque em “Importar lista de jogos” para colar sua lista.</div></div>}
                  {todos.length>0&&!filtrados.length&&<div className="card-soft" style={{padding:18,textAlign:"center"}}><div className="font-mono text-[10px] font-bold">Nenhum jogo encontrado neste filtro.</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Escolha outra estratégia ou limpe o filtro.</div></div>}
                </div>;
              })()}
            </>
          )}
        </>
      )}

      {secao==="config" && <>
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider font-bold">🎨 Aparência</div>
              <div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Mude o estilo sem alterar suas operações ou cálculos.</div>
            </div>
            <span className="font-mono text-[8px] text-[#6a7d6a]">salvo automaticamente</span>
          </div>

          <div className="font-mono text-[9px] text-[#6a7d6a] uppercase mb-2">Tema</div>
          <div className="theme-grid mb-3">
            {[
              {id:"auto",nome:"Automático",sub:"Claro de dia • Escuro à noite",preview:"tp-morning",ico:"◐"},
              {id:"morning",nome:"Manhã",sub:"Claro • verde • dourado",preview:"tp-morning",ico:"☀"},
              {id:"dark",nome:"Noite",sub:"Verde escuro • dourado",preview:"tp-dark",ico:"☾"},
              {id:"executive",nome:"Executivo",sub:"Grafite • branco • dourado",preview:"tp-executive",ico:"◆"},
              {id:"clean",nome:"Verde Clean",sub:"Branco • verde suave",preview:"tp-clean",ico:"❖"},
            ].map(t=>(
              <button key={t.id} onClick={()=>setTemaApp(t.id)} className={`theme-choice ${temaApp===t.id?"active":""}`} style={t.id==="auto"?{gridColumn:"1 / -1"}:null}>
                <div className={`theme-preview ${t.preview}`}></div>
                <div className="font-mono text-[10px] font-bold"><span className="mr-1">{t.ico}</span>{t.nome}{temaApp===t.id?"  ✓":""}</div>
                <div className="font-mono text-[8px] text-[#6a7d6a] mt-0.5">{t.sub}</div>
              </button>
            ))}
          </div>

          <div className="font-mono text-[9px] text-[#6a7d6a] uppercase mb-2">Layout do painel</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              {id:"compact",nome:"Compacto",ico:"▦",sub:"Mais dados"},
              {id:"comfortable",nome:"Confortável",ico:"▣",sub:"Equilibrado"},
              {id:"operational",nome:"Operacional",ico:"⚡",sub:"Foco no ao vivo"},
            ].map(l=>(
              <button key={l.id} onClick={()=>setLayoutApp(l.id)} className={`layout-choice ${layoutApp===l.id?"active":""}`}>
                <div className="text-base mb-1">{l.ico}</div>
                <div className="font-mono text-[9px] font-bold">{l.nome}</div>
                <div className="font-mono text-[7px] text-[#6a7d6a] mt-0.5">{l.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 card-soft">
            <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Capital</label>
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="font-mono text-xs text-[#6a7d6a]">R$</span>
              <input type="text" inputMode="decimal" value={inpCap}
                onChange={e=>{const r=e.target.value; setInpCap(r); const n=Number(r.replace(",",".")); if(!isNaN(n)&&n>0) setCap(n);}}
                className="font-mono text-sm text-[#e8e0cc] bg-transparent border-b border-[#c6a15b] focus:outline-none w-full" />
            </div>
          </div>
          <div className="flex-1 card-soft">
            <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Início</label>
            <input type="date" value={tISO(dataIni)}
              onChange={e=>{if(e.target.value) setDataIni(pISO(e.target.value)); setSemAtual(null);}}
              className="font-mono text-sm text-[#e8e0cc] bg-transparent border-b border-[#c6a15b] focus:outline-none w-full mt-0.5" />
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={()=>{setShowGerEstrategias(true);setShowConfig(false);}} className="btn-small flex-1" style={{padding:"6px 8px"}}>📋 Gerenciar Estratégias</button>
          <button onClick={()=>{setShowGerTimes(true);setShowConfig(false);}} className="btn-small flex-1" style={{padding:"6px 8px"}}>⚽ Gerenciar Times</button>
        </div>
      </>}

      {(secao==="dashboard"||secao==="gestao") && ciclos.length === 0 && carreg && (
        <div className="card text-center py-8 mb-4">
          <div className="text-lg mb-2">📋</div>
          <div className="font-mono text-sm text-[#e8e0cc] mb-2">Nenhum ciclo criado</div>
          <div className="font-mono text-[10px] text-[#6a7d6a] mb-4">Crie seu primeiro ciclo para começar</div>
          <button onClick={()=>setShowNovoCiclo(true)} className="btn-primary" style={{maxWidth:200,margin:"0 auto"}}>+ Novo Ciclo</button>
        </div>
      )}

      {secao==="dashboard" && ciclos.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-[9px] text-[#6a7d6a] uppercase">📋</span>
            <select value={cicloAtivo||""} onChange={e=>trocarCiclo(e.target.value)}
              className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#14241c] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]"
              style={{WebkitAppearance:"none",appearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236a7d6a'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center",paddingRight:"24px"}}>
              {ciclos.map(c=>(
                <option key={c.id} value={c.id}>{c.nome}{c.status==="encerrado"?" 🔒":""}</option>
              ))}
            </select>
          </div>
          <button onClick={()=>setShowNovoCiclo(true)} className="btn-small ml-2" style={{padding:"4px 8px"}} title="Novo ciclo">+</button>
          <button onClick={()=>setShowGerCiclo(true)} className="btn-small ml-1" style={{padding:"4px 8px"}} title="Gerenciar ciclos">⚙</button>
        </div>
      )}

      {(secao==="dashboard"||secao==="gestao") && ciclos.length > 0 && cicloEncerrado && (
        <div className="alerta mb-3"><span>🔒</span><span className="text-xs">Ciclo encerrado — <button onClick={()=>reabrirCiclo(cicloAtivo)} className="text-[#3b82f6] underline" style={{background:"none",border:"none",cursor:"pointer",fontSize:12}}>reabrir para editar</button></span></div>
      )}


      {secao==="gestao" && ciclos.length > 0 && espelhoStatus && (
        <button type="button" onClick={()=>setShowEspelhoDetalhe(true)} className="card w-full text-left mb-3"
          style={{padding:"10px 12px",cursor:"pointer",borderColor:espelhoStatus.diff>=0?"rgba(76,140,92,.4)":"rgba(166,67,45,.4)"}}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] text-[#6a7d6a] uppercase tracking-wider font-bold">🧠 Status do Espelho</span>
            <span className="font-mono text-[8px] text-[#4a5a4a]">Ver detalhes ›</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="font-mono text-[10px] font-bold" style={{color:espelhoStatus.diff>=0?"#4C8C5C":"#A6432D"}}>
              {espelhoStatus.diff>=0?"🟢 À FRENTE DO PLANO":"🔴 ATRÁS DO PLANO"}
            </span>
            <span className="font-mono text-[11px] font-bold" style={{color:espelhoStatus.diff>=0?"#4C8C5C":"#A6432D"}}>
              {espelhoStatus.diff>=0?"+":"-"}{fmt(Math.abs(espelhoStatus.diff))} {espelhoStatus.diff>=0?"acima":"abaixo"} do espelho
            </span>
          </div>
        </button>
      )}

      {secao==="dashboard" && ciclos.length > 0 && resumoAtivo && (()=>{
        const opsHoje = hj ? (operacoes[kw(hj.semana,hj.dia)] || []) : [];
        const hojeChave = tISO(new Date());
        const possiveisEntradasHoje = possiveisEntradas.filter(e=>e.data===hojeChave && !e.usada && !e.ignorada).slice().sort((a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99")));
        return (
          <>
            <div className="card mb-3" style={{borderColor:"rgba(216,174,85,.38)",background:"linear-gradient(145deg,rgba(216,174,85,.10),rgba(20,36,28,.96))"}}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider font-bold" style={{color:"#d8ae55"}}>☀ Minhas Operações do Dia</div>
                  <div className="font-mono text-[13px] font-bold text-[#f4efe2] mt-1">{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</div>
                </div>
                <div className="font-mono text-[8px]" style={{padding:"4px 7px",borderRadius:999,border:`1px solid ${syncUi.cor}55`,color:syncUi.cor,background:`${syncUi.cor}10`}}>{syncUi.ico} {syncUi.txt}</div>
              </div>
            </div>

            {(()=>{
              const agora=new Date();
              const sexta=agora.getDay()===5;
              const saqueSemana=sm ? Math.max(0, sm.saque||0) : 0;
              const confirmado=!!(hj && saquesConfirmados[hj.semana]);
              const valorConfirmado=confirmado ? Number(saquesConfirmados[hj.semana].valor||0) : 0;
              const valorExibir=confirmado ? valorConfirmado : saqueSemana;
              const proximaSexta=new Date(agora);
              const diasAteSexta=(5-agora.getDay()+7)%7;
              proximaSexta.setDate(agora.getDate()+(diasAteSexta===0?0:diasAteSexta));
              return (
                <div className="card mb-3" style={{padding:"10px 12px",borderColor:confirmado?"rgba(76,140,92,.5)":"rgba(198,161,91,.45)",background:"linear-gradient(145deg,rgba(198,161,91,.08),rgba(20,36,28,.96))"}}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider font-bold" style={{color:"#c6a15b"}}>💸 {sexta?"Saque de hoje":"Próximo saque"}</div>
                      <div className="font-mono text-[8px] text-[#6a7d6a] mt-0.5">{sexta ? (confirmado?"Saque semanal confirmado":"Valor previsto para hoje") : `Sexta-feira · ${fd(proximaSexta)}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[16px] font-bold" style={{color:valorExibir>0?"#4C8C5C":"#6a7d6a"}}>{fmt(valorExibir)}</div>
                      <div className="font-mono text-[7px] uppercase" style={{color:confirmado?"#4C8C5C":"#6a7d6a"}}>{confirmado?"Realizado":"Previsto"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <button type="button" className="card w-full text-left mb-3" style={{display:"flex",alignItems:"center",gap:10,padding:12,cursor:"pointer",borderColor:"rgba(198,161,91,.4)"}}
              onClick={()=>setShowPossiveisEntradas(true)}>
              <span style={{fontSize:20}}>⭐</span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] font-bold text-[#e8e0cc]">Possíveis Entradas</div>
                <div className="font-mono text-[8px] text-[#6a7d6a]">Jogos identificados pelo Leitor da Bolsa hoje</div>
              </div>
              {possiveisEntradasHoje.length>0 && <span className="font-mono text-[10px] font-bold" style={{background:"#c6a15b",color:"#0a1410",borderRadius:999,padding:"2px 8px"}}>{possiveisEntradasHoje.length}</span>}
            </button>

            {opsHoje.length===0 ? (
              <div className="card text-center py-8 mb-4">
                <div className="text-lg mb-2">📋</div>
                <div className="font-mono text-sm text-[#e8e0cc] mb-2">Nenhuma operação hoje</div>
                <div className="font-mono text-[10px] text-[#6a7d6a]">Suas operações do dia aparecerão aqui</div>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {opsHoje.map((o,i)=>{
                  const aberta = o.status==="aberta";
                  const resultadoCor = aberta ? "#c6a15b" : (o.resultado>0?"#4C8C5C":o.resultado<0?"#A6432D":"#e8e0cc");
                  const resultadoTexto = aberta
                    ? "🟡 Em aberto"
                    : (o.resultado>0?`🟢 +${fmt(o.resultado)}`:o.resultado<0?`🔴 ${fmt(o.resultado)}`:`⚪ ${fmt(o.resultado)}`);
                  return (
                    <div key={o.id||i} className="card">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] font-bold" style={{color:"#c6a15b"}}>{o.hora||"—"}</div>
                          <div className="font-mono text-[13px] font-bold text-[#e8e0cc] mt-0.5">{o.time||"Não informado"}</div>
                        </div>
                        {aberta && <button className="premium-open-btn" onClick={()=>abrirFinalizarOp(hj.semana,hj.dia,i)}>FINALIZAR</button>}
                      </div>
                      <div className="flex justify-between items-center border-t border-[#14241c] pt-1.5 mt-1.5">
                        <span className="font-mono text-[8px] text-[#6a7d6a] uppercase">Entrada</span>
                        <span className="font-mono text-[10px] text-[#e8e0cc]">{o.estrategia||"—"}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-mono text-[8px] text-[#6a7d6a] uppercase">Stake</span>
                        <span className="font-mono text-[10px] text-[#e8e0cc]">{o.entrada!=null?fmt(o.entrada):"—"}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-mono text-[8px] text-[#6a7d6a] uppercase">Resultado</span>
                        <span className="font-mono text-[11px] font-bold" style={{color:resultadoCor}}>{resultadoTexto}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}


      {secao==="gestao" && ((!sm) ? (
        <div className="card text-center font-mono text-xs text-[#6a7d6a] py-8">
          Nenhuma semana disponível.
        </div>
      ) : (
        <>
          <div className="flex mb-4 bg-[#0f1f17] rounded-lg p-1" style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            {["dia","semana","mes","espelho","saques","extrato","pesquisa","graficos","painel"].map(m => (
              <button key={m} onClick={()=>setModo(m)} className="py-2 text-center font-mono text-[10px] rounded-md transition-all"
                style={{background:modo===m?"#c6a15b":"transparent", color:modo===m?"#0a1410":"#6a7d6a", fontWeight:modo===m?700:500, border:"none",minWidth:m==="graficos"?72:58,flex:"0 0 auto"}}>
                {m==="dia"?"Dia":m==="semana"?"Sem":m==="mes"?"Mês":m==="espelho"?"Espelho":m==="saques"?"Saques":m==="extrato"?"Extrato":m==="pesquisa"?"Pesquisar":m==="graficos"?"Gráficos":"Painel"}
              </button>
            ))}
          </div>

          {(totalSaqEmerg>0||totalDepositos>0) && (
            <div className="card mb-3" style={{padding:"8px 12px",borderColor:"#c6a15b",background:"#0f1f17"}}>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[9px] text-[#6a7d6a]">💰 Saldo Real</span>
                <span className="font-mono text-[12px] font-bold text-[#c6a15b]">{fmt(dashData.bancaFinal - totalSaqEmerg + totalDepositos)}</span>
              </div>
              <div className="flex gap-3 mt-0.5">
                {totalSaqEmerg>0 && <span className="font-mono text-[8px] text-[#A6432D]">🚨 Saques emerg: −{fmt(totalSaqEmerg)}</span>}
                {totalDepositos>0 && <span className="font-mono text-[8px] text-[#4C8C5C]">🏦 Depósitos: +{fmt(totalDepositos)}</span>}
              </div>
              <div className="font-mono text-[8px] text-[#4a5a4a] mt-0.5">Banca op.: {fmt(dashData.bancaFinal)} · Espelho inalterado</div>
            </div>
          )}

          {modo==="dia" && (()=>{
            const dIdx = selDia!==null ? selDia : (hj ? hj.dia : 0);
            const hd = sm.dias[dIdx];
            const projDia = smProj?.dias[dIdx];
            const bancaModelo = projDia ? projDia.base : cap;
            const hojeFlag = hj && semIdx===hj.semana && dIdx===hj.dia;
            const pct = bancaModelo>0 ? Math.min(100, hd.base/bancaModelo*100) : 0;
            const metaMod = projDia ? projDia.meta : 0;
            const fechou = diaFechado(semIdx, dIdx);
            const status = hd.tem ? (hd.soma>=metaMod?"atingiu":hd.soma>0?"parcial":hd.soma<0?"negativo":"sem_op") : "sem_op";
            const corStatus = status==="atingiu"?"#22c55e":status==="negativo"?"#ef4444":status==="parcial"?"#f59e0b":"#4a5a4a";
            return (
              <>
                <div className="flex items-center gap-1 mb-3">
                  <button onClick={()=>setSelDia(Math.max(0,dIdx-1))} className="btn-small" disabled={dIdx<=0}>◀</button>
                  {sm.dias.map((d,i)=>{
                    const pD = smProj?.dias[i];
                    const mM = pD ? pD.meta : 0;
                    const st = d.tem ? (d.soma>=mM?"atingiu":d.soma>0?"parcial":d.soma<0?"negativo":"sem_op") : "sem_op";
                    const c = st==="atingiu"?"#22c55e":st==="negativo"?"#ef4444":st==="parcial"?"#f59e0b":diaFechado(semIdx,i)?"#f59e0b":"#4a5a4a";
                    return (
                      <button key={i} onClick={()=>setSelDia(i)} className="flex-1 py-2.5 text-center font-mono rounded-md transition-all relative"
                        style={{background:i===dIdx?"#c6a15b":"#14241c",color:i===dIdx?"#0a1410":"#6a7d6a",border:"none",fontWeight:i===dIdx?700:500}}>
                        <div className="text-[13px] leading-tight">{d.label}</div>
                        <div className="text-[10px] leading-tight opacity-80">{fd(d.date)}</div>
                        {d.tem && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{background:c}}></div>}
                        {diaFechado(semIdx,i) && <div className="absolute -bottom-0.5 -right-0.5 text-[6px]">🔒</div>}
                      </button>
                    );
                  })}
                  <button onClick={()=>setSelDia(Math.min(D5ATUAL-1,dIdx+1))} className="btn-small" disabled={dIdx>=D5ATUAL-1}>▶</button>
                </div>

                <div className="card mb-3" style={{background:"#1a2e22",borderColor:"#c6a15b"}}>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{color:corStatus}}>
                        {status==="atingiu"?"✅ Atingiu":status==="negativo"?"🔴 Negativo":status==="parcial"?"🟡 Parcial":""}
                        {" "}{hojeFlag?"Hoje":fd(hd.date)}
                      </span>
                      {fechou && <span className="text-[9px] text-[#f59e0b] font-mono">🔒</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Banca</div>
                        <div className="font-mono text-lg font-bold text-[#e8e0cc]">{fmt(bancaModelo)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Meta Mod.</div>
                        <div className="font-mono text-lg font-bold text-[#c6a15b]">{fmt(metaMod)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Resultado</div>
                        <div className="font-mono text-lg font-bold" style={{color:corStatus}}>{hd.tem?(hd.soma===0?"—":fmt(hd.soma)):"—"}</div>
                      </div>
                    </div>
                    <div className="font-mono text-[9px] text-[#6a7d6a] mt-1">{hd.label} · {fd(hd.date)} · {Math.round(hd.taxa*100)}%</div>
                    <div className="mt-2 bar-container">
                      <div className="bar-fill" style={{width:`${pct}%`, background:pct>=100?"#4C8C5C":"#c6a15b"}}></div>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] px-2 mt-1">
                      <span className="text-[#6a7d6a]">Banca real</span>
                      <span className={hd.base>=bancaModelo?"text-[#4C8C5C]":"text-[#e8e0cc]"}>{fmt(hd.base)}</span>
                    </div>
                    {hd.tem && (
                      <div className="flex justify-between font-mono text-[12px] px-2 border-t border-[#1e3228] pt-1 mt-1">
                        <span className="text-[#6a7d6a]">💰 Resultado</span>
                        <span style={{color:corStatus}}>{hd.soma>=0?"+":""}{fmt(hd.soma)}</span>
                      </div>
                    )}
                    {hd.tem && (operacoes[kw(semIdx,dIdx)]||[]).length>0 && <div className="flex gap-2 mt-1">
                      <button onClick={()=>{desfazer(semIdx,dIdx);setOperacoes(p=>{const n={...p};delete n[kw(semIdx,dIdx)];return n;});}} className="btn-danger text-xs py-0.5 px-2" style={{fontSize:10}}>🗑️ Limpar</button>
                    </div>}
                    {!cicloEncerrado && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={()=>abrirAddOp(semIdx,dIdx,null)} className="btn-primary text-xs py-2" style={{flex:1}}>+ Adicionar Operação</button>
                        {!hd.tem && <button onClick={()=>{naoOperei(semIdx,dIdx);}} className="btn-danger text-xs py-2" style={{flex:0.6}}>🚫 Não operei</button>}
                      </div>
                    )}
                    {cicloEncerrado && !hd.tem && <div className="font-mono text-[10px] text-[#6a7d6a] mt-3 text-center">Ciclo encerrado</div>}
                  </div>
                </div>

                {(operacoes[kw(semIdx,dIdx)]||[]).length > 0 && (()=>{
                  const ops = operacoes[kw(semIdx,dIdx)];
                  const totalOp = ops.reduce((s,o)=>s+(o.resultado||0),0);
                  const greens = ops.filter(o=>o.status!=="aberta" && o.resultado>0);
                  const reds = ops.filter(o=>o.status!=="aberta" && o.resultado<0);
                  const abertas = ops.filter(o=>o.status==="aberta");
                  const porEstr = {};
                  ops.forEach(o=>{const e=normEstrategia(o.estrategia)||"Sem nome";if(!porEstr[e])porEstr[e]={lucro:0,count:0};porEstr[e].lucro+=(o.resultado||0);porEstr[e].count++;});
                  return (
                    <div className="card mb-2" style={{padding:0}}>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e3228]">
                        <span className="font-mono text-[10px] text-[#6a7d6a] uppercase">📊 Operações ({ops.length})</span>
                        <div className="flex gap-2 font-mono text-[9px]">
                          <span className="text-[#4C8C5C]">✓ {greens.length}</span>
                          <span className="text-[#A6432D]">✗ {reds.length}</span>
                          {abertas.length>0 && <span className="text-[#c6a15b]">🟡 {abertas.length}</span>}
                          <span className="text-[#c6a15b]">Média: {(greens.length+reds.length)>0?fmt(totalOp/(greens.length+reds.length)):"—"}</span>
                        </div>
                      </div>
                      {ops.map((op, idx)=>(
                        <div key={op.id} className="flex items-center px-3 py-2 border-b border-[#14241c] last:border-0">
                          <span className="font-mono text-[9px] text-[#4a5a4a] w-5">#{op.num}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] text-[#e8e0cc] truncate">{op.estrategia?op.estrategia:"Não informado"}{op.time?(" · "+op.time):""}</div>
                            <div className="font-mono text-[8px] text-[#4a5a4a]">{op.hora||"—"}{op.observacao?" · "+op.observacao:""}{op.status==="aberta"?" · 🟡 Aberta":op.status==="green"?" · 🟢 Green finalizada":op.status==="red"?" · 🔴 Red finalizada":""}{op.origem==="bolsa"?" · 📊 Bolsa":""}{op.minutoSaida?" · ⏱ Saída "+rotuloMinuto(op.minutoSaida):""}</div>
                          </div>
                          {op.status==="aberta" ? (
                            <button onClick={()=>abrirFinalizarOp(semIdx,dIdx,idx)} className="btn-small text-[8px] mr-1" style={{borderColor:"#c6a15b",color:"#c6a15b",whiteSpace:"nowrap"}}>Finalizar</button>
                          ) : (
                            <span className={`font-mono text-[11px] font-bold mr-1 ${op.resultado>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{op.resultado>=0?"+":""}{fmt(op.resultado)}</span>
                          )}
                          <div className="flex gap-0.5">
                            <button onClick={()=>abrirAddOp(semIdx,dIdx,idx)} className="text-[9px] px-1" style={{background:"none",border:"none",cursor:"pointer",color:"#6a7d6a"}}>✏</button>
                            <button onClick={()=>duplicarOp(semIdx,dIdx,idx)} className="text-[9px] px-1" style={{background:"none",border:"none",cursor:"pointer",color:"#6a7d6a"}}>📋</button>
                            <button onClick={()=>excluirOp(semIdx,dIdx,idx)} className="text-[9px] px-1" style={{background:"none",border:"none",cursor:"pointer",color:"#A6432D"}}>✕</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 bg-[#0f1f17]">
                        <span className="font-mono text-[10px] text-[#c6a15b] font-bold">Total do dia</span>
                        <span className={`font-mono text-[12px] font-bold ${totalOp>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{totalOp>=0?"+":""}{fmt(totalOp)}</span>
                      </div>
                    </div>
                  );
                })()}

                {(()=>{
                  const ops = operacoes[kw(semIdx,dIdx)]||[];
                  if(ops.length===0 && !hd.tem) return null;
                  const finalizadas = ops.filter(o=>o.status!=="aberta");
                  const greensD = finalizadas.filter(o=>o.resultado>0);
                  const redsD = finalizadas.filter(o=>o.resultado<0);
                  const lucroAcum = greensD.reduce((s,o)=>s+o.resultado,0);
                  const prejuizoAcum = redsD.reduce((s,o)=>s+o.resultado,0);
                  const lucroAtual = hd.soma||0;
                  const metaDia = metaMod;
                  const pctAtingido = metaDia>0 ? Math.max(0,Math.min(999,(lucroAtual/metaDia)*100)) : 0;
                  const faltaMeta = metaDia - lucroAtual;
                  const totalStakes = finalizadas.reduce((s,o)=>s+(o.entrada||0),0);
                  const roi = totalStakes>0 ? (lucroAtual/totalStakes)*100 : null;
                  const taxaAcerto = finalizadas.length>0 ? (greensD.length/finalizadas.length)*100 : null;
                  return (
                    <div className="card mb-3" style={{padding:10}}>
                      <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2">📈 Painel do Dia</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Meta do dia</div>
                          <div className="font-mono text-sm font-bold text-[#e8e0cc]">{fmt(metaDia)}</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Lucro atual</div>
                          <div className={`font-mono text-sm font-bold ${lucroAtual>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{lucroAtual>=0?"+":""}{fmt(lucroAtual)}</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">% atingido</div>
                          <div className="font-mono text-sm font-bold text-[#c6a15b]">{pctAtingido.toFixed(0)}%</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Falta p/ meta</div>
                          <div className="font-mono text-sm font-bold text-[#e8e0cc]">{faltaMeta>0?fmt(faltaMeta):"Atingida"}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Banca inicial do dia</div>
                          <div className="font-mono text-sm font-bold text-[#e8e0cc]">{fmt(hd.base)}</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Banca atual</div>
                          <div className="font-mono text-sm font-bold text-[#e8e0cc]">{fmt(hd.base+lucroAtual)}</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Lucro acumulado</div>
                          <div className="font-mono text-sm font-bold text-[#4C8C5C]">+{fmt(lucroAcum)}</div>
                        </div>
                        <div className="card-soft" style={{padding:8}}>
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Prejuízo acumulado</div>
                          <div className="font-mono text-sm font-bold text-[#A6432D]">{fmt(prejuizoAcum)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Operações</div>
                          <div className="font-mono text-xs font-bold text-[#e8e0cc]">{ops.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Greens</div>
                          <div className="font-mono text-xs font-bold text-[#4C8C5C]">{greensD.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Reds</div>
                          <div className="font-mono text-xs font-bold text-[#A6432D]">{redsD.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Taxa de acerto</div>
                          <div className="font-mono text-xs font-bold text-[#c6a15b]">{taxaAcerto!=null?taxaAcerto.toFixed(0)+"%":"—"}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">ROI</div>
                          <div className={`font-mono text-xs font-bold ${roi!=null&&roi>=0?"text-[#4C8C5C]":roi!=null?"text-[#A6432D]":"text-[#e8e0cc]"}`}>{roi!=null?(roi>=0?"+":"")+roi.toFixed(1)+"%":"—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="card-soft flex justify-between items-center mb-2">
                  <div className="text-center flex-1">
                    <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Banca real</div>
                    <div className="font-mono text-sm font-bold">{fmt(hd.base)}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Banca mod.</div>
                    <div className="font-mono text-sm text-[#6a7d6a]">{fmt(bancaModelo)}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Diferença</div>
                    <div className={`font-mono text-sm font-bold ${hd.base>=bancaModelo?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{hd.base>=bancaModelo?"+":""}{fmt(hd.base-bancaModelo)}</div>
                  </div>
                </div>
                {hd.tem && (
                  <div className="flex justify-end">
                    {fechou ? (
                      <button onClick={()=>desfecharDia(semIdx,dIdx)} className="btn-small text-[9px]">🔓 Reabrir dia</button>
                    ) : (
                      <button onClick={()=>fecharDia(semIdx,dIdx)} className="btn-small text-[9px]">🔒 Fechar dia</button>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {modo==="semana" && (()=>(
            <>
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                <button onClick={()=>setSemAtual(Math.max(0,semIdx-1))} className="btn-small" disabled={semIdx<=0}>◀</button>
                {semanas.map((_,i)=>(
                  <button key={i} onClick={()=>setSemAtual(i)} className="w-7 h-7 text-center font-mono text-[9px] rounded transition-all"
                    style={{background:i===semIdx?"#c6a15b":"#14241c",color:i===semIdx?"#0a1410":"#6a7d6a",border:"1px solid #1e3228"}}>
                    {i+1}
                  </button>
                ))}
                <button onClick={()=>setSemAtual(Math.min(numSemAtu-1,semIdx+1))} className="btn-small" disabled={semIdx>=numSemAtu-1}>▶</button>
              </div>
              <div className="flex justify-between mb-3">
                <span className="font-mono text-[9px] text-[#6a7d6a]">{sm.tier.label} · Semana {sm.semana}/{numSemAtu}</span>
                <span className="font-mono text-[9px] text-[#6a7d6a]">{fd(sm.dias[0].date)} a {fd(sm.dias[4].date)}</span>
              </div>

              {diaAtual && semIdx===diaAtual.semana && (()=>{
                const hd = sm.dias[diaAtual.dia];
                const projDia = smProj?.dias[diaAtual.dia];
                const bancaModelo = projDia ? projDia.base : cap;
                const metaMod = projDia ? projDia.meta : 0;
                const fechou = diaFechado(semIdx, diaAtual.dia);
                const status = hd.tem ? (hd.soma>=metaMod?"atingiu":hd.soma>0?"parcial":hd.soma<0?"negativo":"sem_op") : "sem_op";
                const corStatus = status==="atingiu"?"#22c55e":status==="negativo"?"#ef4444":status==="parcial"?"#f59e0b":"#4a5a4a";
                return (
                <div className="card mb-3" style={{background:"#1a2e22",borderColor:"#c6a15b"}}>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <span className="text-[10px] text-[#6a7d6a] font-mono uppercase tracking-wider">🎯 {focoDia?"Foco":"Hoje"}</span>
                      {fechou && <span className="text-[9px] text-[#f59e0b] font-mono">🔒</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Banca</div>
                        <div className="font-mono text-lg font-bold text-[#e8e0cc]">{fmt(bancaModelo)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Meta Mod.</div>
                        <div className="font-mono text-lg font-bold text-[#c6a15b]">{fmt(metaMod)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Meta Real</div>
                        <div className="font-mono text-lg font-bold" style={{color:corStatus}}>{hd.tem?(hd.soma===0?"—":fmt(hd.soma)):"—"}</div>
                      </div>
                    </div>
                    <div className="font-mono text-[9px] text-[#6a7d6a] mt-1">{hd.label} · {fd(hd.date)} · {Math.round(hd.taxa*100)}%</div>
                    <div className="mt-2 bar-container">
                      <div className="bar-fill" style={{width:`${(bancaModelo>0?Math.min(100,hd.base/bancaModelo*100):0)}%`, background:"rgba(255,255,255,0.1)"}}></div>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] px-2 mt-1">
                      <span className="text-[#6a7d6a]">Banca real</span>
                      <span className={hd.base>=bancaModelo?"text-[#4C8C5C]":"text-[#e8e0cc]"}>{fmt(hd.base)}</span>
                    </div>
                    {hd.tem && (operacoes[kw(semIdx,diaAtual.dia)]||[]).length>0 && <div className="flex gap-2 mt-1">
                      <button onClick={e=>{e.stopPropagation();desfazer(semIdx,diaAtual.dia);setOperacoes(p=>{const n={...p};delete n[kw(semIdx,diaAtual.dia)];return n;});}} className="btn-danger text-xs py-0.5 px-2" style={{fontSize:10}}>🗑️ Limpar</button>
                    </div>}
                    {!cicloEncerrado && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={e=>{e.stopPropagation();abrirAddOp(semIdx,diaAtual.dia,null);}} className="btn-primary text-xs py-2" style={{flex:1}}>+ Adicionar Operação</button>
                        {!hd.tem && <button onClick={e=>{e.stopPropagation();naoOperei(semIdx,diaAtual.dia);}} className="btn-danger text-xs py-2" style={{flex:0.6}}>🚫 Não operei</button>}
                      </div>
                    )}
                    {cicloEncerrado && !hd.tem && <div className="font-mono text-[10px] text-[#6a7d6a] mt-3 text-center">Ciclo encerrado</div>}
                  </div>
                </div>
                );
              })()}

              {semIdx===(hj?hj.semana:-1) && hj && (()=>{
                const perdidos = sm.dias.filter((d,i)=>!d.tem && i<hj.dia);
                if(perdidos.length>0) return (
                  <div className="alerta mb-3"><span>⚠️</span><span><strong>{perdidos.length} dia(s)</strong> sem registro.</span></div>
                );
                return null;
              })()}

              <div className="card mb-4">
                <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-[#1e3228]">
                  <div className="text-center">
                    <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Banca</div>
                    <div className="font-mono text-sm font-bold">{fmt(bancaAtu)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Lucro</div>
                    <div className={`font-mono text-sm font-bold ${lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{lucro>=0?"+":""}{fmt(lucro)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[#6a7d6a] font-mono uppercase">Diferença</div>
                    <div className={`font-mono text-sm font-bold ${diff>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{diff>=0?"+":""}{fmt(diff)}</div>
                  </div>
                </div>
                {(()=>{
                  const hjSem = hj && hj.semana===semIdx ? hj : null;
                  const diasPassados = hjSem ? hjSem.dia : sm.dias.length;
                  const metaTotal = sm.dias.reduce((s,d,i)=>(smProj?.dias[i]?.meta||0)+s, 0);
                  const realTotal = sm.dias.reduce((s,d,i)=>i<diasPassados?s+(d.tem?d.soma:0):s, 0);
                  const restante = metaTotal - realTotal;
                  const folga = realTotal - sm.dias.reduce((s,d,i)=>i<diasPassados?s+(smProj?.dias[i]?.meta||0):s, 0);
                  const diasRest = sm.dias.length - diasPassados;
                  return (
                  <div className="flex justify-between items-center px-2 mb-3 text-[10px] font-mono">
                    <span className="text-[#6a7d6a]">📈 Folga</span>
                    <span className={folga>=0?"text-[#4C8C5C] font-bold":"text-[#A6432D] font-bold"}>{folga>=0?"+":""}{fmt(folga)}</span>
                    {diasRest>0 && <span className="text-[#6a7d6a]">· Meta restante <span className={restante<=0?"text-[#4C8C5C]":"text-[#c6a15b]"}>{fmt(Math.max(0,restante))}</span></span>}
                  </div>
                  );
                })()}
                <div className="text-center">
                  <div className="text-[10px] text-[#6a7d6a] font-mono uppercase mb-1">💸 Saque (30%)</div>
                  <div className="font-mono text-3xl font-bold text-[#c6a15b]">{fmt(saque)}</div>
                </div>
              </div>

              <div className="card mb-3">
                <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📅 Dias · Espelho</div>
                <div className="s-table-header">
                  <span>Dia</span><span>Banca Mod.</span><span>Meta Mod.</span><span>Meta Real</span>
                </div>
                {sm.dias.map((d,i)=> {
                  const projDia = smProj?.dias[i];
                  const bancaMod = projDia ? projDia.base : cap;
                  const metaMod = projDia ? projDia.meta : 0;
                  const hojeFlag=diaAtual && semIdx===diaAtual.semana && i===diaAtual.dia;
                  const passadoFlag=hj && semIdx===hj.semana && i<hj.dia;
                  const difMeta=d.soma-metaMod;
                  const fechou = diaFechado(semIdx, i);
                  return (
                    <div key={i} className={`s-table-row ${hojeFlag?"hoje":""} ${passadoFlag && !d.tem?"passou":""}`} onClick={()=>{setSelDia(i);setModo("dia");}}>
                      <span className="font-mono text-[10px] text-[#6a7d6a]">{d.label}<span className="text-[#5a4a3a] ml-0.5">{d.date.getDate()}</span>{fechou?" 🔒":""}</span>
                      <span className="font-mono text-[11px] text-[#e8e0cc]">{fmt(bancaMod)}</span>
                      <span className="font-mono text-[11px] text-[#c6a15b]">{fmt(metaMod)}</span>
                      <span className={`font-mono text-[11px] font-bold ${!d.tem?"text-[#4a5a4a]":difMeta>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{d.tem?fmt(d.soma):"—"}</span>
                    </div>
                  );
                })}
              </div>

              {!cicloEncerrado && (
              <div className="flex flex-col gap-2 mb-5">
                <div className="flex gap-2">
                  <button onClick={()=>{const d=diaAtual?diaAtual.dia:0;abrirAddOp(semIdx,d,null);}} className="btn-primary flex-1">+ Adicionar Operação</button>
                  <button onClick={()=>{const d=diaAtual?diaAtual.dia:0;naoOperei(semIdx,d);}} className="btn-danger" style={{flex:0.6}}>🚫 Não operei</button>
                </div>
                <button onClick={()=>{
                  if(confirm("Resetar dados deste ciclo?")){
                    setCiclos(prev=>prev.map(c=>c.id===cicloAtivo?{...c,cap:200,dataIni:tISO(new Date()),ent:{},fechados:{},senha:"",historico:[],movimentacoes:[],saquesConfirmados:{},operacoes:{}}:c));
                    setCap(200);setInpCap("200");const h=new Date();h.setHours(0,0,0);setDataIni(h);setEnt({});setFechados({});setSenhaAdmin("");setHistorico([]);setMovimentacoes([]);setSaquesConfirmados({});setOperacoes({});setSemAtual(null);setFocoDia(null);
                  }
                }} className="btn-secondary w-full">Resetar dados do ciclo</button>
              </div>
              )}
            </>
          ))()}

          {modo==="mes" && (()=>{
            const activeTiers = cicloCfg?.tiers || TIERS_PADRAO;
            const activeD5 = cicloCfg?.diasPorSemana || D5;
            let a=0, semAtrib=0;
            const meses=activeTiers.map((t,idx)=>{
              a+=t.dias;
              const inicioS=semAtrib;
              const fimS = idx===activeTiers.length-1 ? numSemAtu-1 : Math.floor((a-1)/activeD5);
              semAtrib = fimS+1;
              return {...t, inicioS, fimS};
            });
            const ms=meses[selMes]; if(!ms) return null;
            const semMes=semanas.slice(ms.inicioS,ms.fimS+1);
            const semMesProj=semanasProj.slice(ms.inicioS,ms.fimS+1);
            const bancaIniMes=semMes.length>0?semMes[0].inicial:cap;
            const bancaFimMes=semMes.length>0?semMes[semMes.length-1].prox:cap;
            const bancaEspMes=semMesProj.length>0?semMesProj[semMesProj.length-1].prox:cap;
            const lucroMes=semMes.reduce((s,w)=>s+w.lucro,0);
            const saqueMes=semMes.reduce((s,w)=>s+w.saque,0);
            return (
              <>
                <div className="flex gap-2 mb-3">
                  {meses.map((m,i)=>(
                    <button key={i} onClick={()=>setSelMes(i)} className="flex-1 py-2 text-center font-mono text-xs rounded-md transition-all"
                      style={{background:i===selMes?"#c6a15b":"#14241c",color:i===selMes?"#0a1410":"#6a7d6a",border:"none",fontWeight:i===selMes?700:500}}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="card mb-3">
                  <div className="text-center mb-2">
                    <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">{ms.label} · {ms.taxa*100}% ao dia</div>
                    <div className="font-mono text-[8px] text-[#4a5a4a]">Semanas {ms.inicioS+1} a {ms.fimS+1}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-xs px-1"><span className="text-[#6a7d6a]">Banca início</span><span className="font-bold">{fmt(bancaIniMes)}</span></div>
                    <div className="flex justify-between font-mono text-xs px-1"><span className="text-[#6a7d6a]">Banca fim</span><span className="font-bold">{fmt(bancaFimMes)}</span></div>
                    <div className="flex justify-between font-mono text-xs px-1"><span className="text-[#6a7d6a]">Projeção</span><span className="text-[#6a7d6a]">{fmt(bancaEspMes)}</span></div>
                    <div className="flex justify-between font-mono text-xs px-1">
                      <span className="text-[#6a7d6a]">Diferença</span>
                      <span className={`font-bold ${(bancaFimMes-bancaEspMes)>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{(bancaFimMes-bancaEspMes)>=0?"+":""}{fmt(bancaFimMes-bancaEspMes)}</span>
                    </div>
                    <div className="border-t border-[#1e3228] my-2"></div>
                    <div className="flex justify-between font-mono text-xs px-1">
                      <span className="text-[#6a7d6a]">Lucro total</span>
                      <span className={lucroMes>=0?"text-[#4C8C5C] font-bold":"text-[#A6432D] font-bold"}>{lucroMes>=0?"+":""}{fmt(lucroMes)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs px-1">
                      <span className="text-[#6a7d6a]">Saque (30%)</span>
                      <span className="text-[#c6a15b] font-bold">{fmt(saqueMes)}</span>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">Semanas do {ms.label}</div>
                  <div className="space-y-1">
                    {semMes.map((w,i)=>(
                      <div key={i} className="flex justify-between items-center font-mono text-xs px-1 py-1.5 border-b border-[#14241c] last:border-0">
                        <div><span className="text-[#6a7d6a]">Sem {w.semana}</span><span className="text-[#4a5a4a] ml-1">{fd(w.dias[0].date)}-{fd(w.dias[4].date)}</span></div>
                        <div className="flex gap-3">
                          <span className={w.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}>{w.lucro>=0?"+":""}{fmt(w.lucro)}</span>
                          <span className="text-[#c6a15b]">{fmt(w.saque)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          {modo==="espelho" && (()=>{
            const totalSaqEmerg=movimentacoes.filter(m=>m.tipo==="saque_emergencial").reduce((s,m)=>s+m.valor,0);
            const totalDepositos=movimentacoes.filter(m=>m.tipo==="deposito").reduce((s,m)=>s+m.valor,0);
            const rows=[];
            for(let w=0;w<semanas.length;w++) {
              for(let d=0;d<semanas[w].dias.length;d++) {
                const real=semanas[w].dias[d], proj=semanasProj[w]?.dias[d];
                if(!real||!proj) continue;
                const cor = !real.tem ? "#4a5a4a" : real.soma < 0 ? "#ef4444" : real.soma >= proj.meta ? "#22c55e" : "#f59e0b";
                rows.push({date:real.date,label:real.label,semana:w+1,bancaModelo:proj.base,metaModelo:proj.meta,metaReal:real.soma,cor,tipo:"dia"});
              }
              if(w<semanas.length-1) {
                rows.push({tipo:"saque",semana:w+1,saque:semanas[w].saque,fim:semanas[w].fim,prox:semanas[w].prox});
                rows.push({tipo:"sep",semana:w+2});
              }
            }
            return (
              <>
                <div className="card mb-3" style={{borderColor:"#3b82f6"}}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={()=>setShowPlanejamento(!showPlanejamento)}>
                    <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">📋 Planejamento do Ciclo</span>
                    <span className="font-mono text-[10px] text-[#3b82f6]">{showPlanejamento?"▲ Ocultar":"▼ Configurar"}</span>
                  </div>
                  {showPlanejamento && (
                    <div className="mt-3 space-y-2">
                      <div className="font-mono text-[9px] text-[#4a5a4a] mb-1">Defina a % de cada mês. O espelho recalcula automaticamente.</div>
                      {(cicloCfg?.tiers || TIERS_PADRAO).map((t,i)=>(
                        <div key={i} className="flex items-center gap-2 bg-[#0f1f17] rounded px-2 py-1.5">
                          <span className="font-mono text-[9px] text-[#e8e0cc] flex-1">{t.label}</span>
                          <input type="text" inputMode="decimal" defaultValue={Math.round(t.taxa*100)} onBlur={e=>{
                            const nv=Number(e.target.value.replace(",","."))/100;
                            if(isNaN(nv)||nv<=0) return;
                            const novosTiers=(cicloCfg?.tiers||TIERS_PADRAO).map((tt,j)=>j===i?{...tt,taxa:nv}:tt);
                            setCiclos(prev=>prev.map(c=>c.id===cicloAtivo?{...c,tiers:novosTiers}:c));
                          }} className="w-12 font-mono text-[11px] text-[#c6a15b] text-center bg-transparent border-b border-[#1e3228] outline-none" />
                          <span className="font-mono text-[9px] text-[#6a7d6a]">%</span>
                        </div>
                      ))}
                      <div className="mt-2 pt-2 border-t border-[#1e3228]">
                        <div className="font-mono text-[9px] text-[#4a5a4a] uppercase mb-1">Projeção mensal</div>
                        {(()=>{
                          const sem=semanasProj;
                          const totalDias=(cicloCfg?.tiers||TIERS_PADRAO).reduce((s,t)=>s+t.dias,0);
                          const diasPS=cicloCfg?.diasPorSemana||D5;
                          let acum=cap, mesIdx=0;
                          const meses=[];
                          const tiers=cicloCfg?.tiers||TIERS_PADRAO;
                          let diasRest=tiers[0]?.dias||30, tierT=tiers[0]?.taxa||0.06;
                          for(const s of sem) {
                            for(let d=0;d<s.dias.length;d++) {
                              if(diasRest<=0 && mesIdx<tiers.length-1) { mesIdx++; diasRest=tiers[mesIdx].dias; tierT=tiers[mesIdx].taxa; }
                              acum*=(1+tierT);
                              diasRest--;
                            }
                          }
                          let acum2=cap, mesIdx2=0, diasRest2=tiers[0]?.dias||30;
                          for(const s of sem) {
                            const lucroSem=s.fim-s.inicial;
                            const saqSem=s.saque;
                            const fimSem=s.fim;
                            if(!meses[mesIdx2]) meses[mesIdx2]={lucro:0,saque:0,bancaIni:acum2};
                            meses[mesIdx2].lucro+=lucroSem;
                            meses[mesIdx2].saque+=saqSem;
                            meses[mesIdx2].bancaFim=fimSem;
                            diasRest2-=diasPS;
                            if(diasRest2<=0 && mesIdx2<tiers.length-1) { mesIdx2++; diasRest2=tiers[mesIdx2].dias; }
                            acum2=fimSem-saqSem;
                          }
                          return meses.map((m,i)=>(
                            <div key={i} className="flex justify-between items-center py-0.5">
                              <span className="font-mono text-[9px] text-[#6a7d6a]">{tiers[i]?.label||`Mês ${i+1}`}</span>
                              <span className="font-mono text-[9px] text-[#4C8C5C]">+{fmt(m.lucro)}</span>
                              <span className="font-mono text-[9px] text-[#c6a15b]">{fmt(m.bancaFim)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">📋 Espelho</span>
                  <span className="font-mono text-[9px] text-[#4a5a4a]">{rows.filter(r=>r.tipo==="dia"&&r.date<=new Date()).length} dias</span>
                </div>
                <div className="card" style={{maxHeight:420,overflowY:"auto",padding:0}}>
                  <div className="esp-header"><span>Data</span><span>Banca</span><span>Meta</span><span>Resultado</span></div>
                  {rows.map((r,i)=>{
                    if(r.tipo==="saque") return (
                      <div key={i} className="esp-row" style={{background:"#0f1f17",borderBottom:"1px solid #1e3228"}}>
                        <span className="font-mono text-[8px] text-[#6a7d6a]">💸</span>
                        <span className="font-mono text-[10px] text-[#c6a15b]">{fmt(r.fim)}</span>
                        <span className="font-mono text-[9px] text-[#A6432D]">−{fmt(r.saque)}</span>
                        <span className="font-mono text-[10px] text-[#4C8C5C]">→ {fmt(r.prox)}</span>
                      </div>
                    );
                    if(r.tipo==="sep") return (
                      <div key={i} className="esp-sem" style={{padding:"8px 8px 4px"}}>Semana {r.semana}</div>
                    );
                    const hoje=new Date(); hoje.setHours(0,0,0,0);
                    const futuro=r.date>hoje;
                    return (
                      <div key={i} className="esp-row" style={{opacity:futuro?0.35:1}}>
                        <span className="font-mono text-[9px] text-[#6a7d6a]">{fd(r.date)}</span>
                        <span className="font-mono text-[11px] text-[#e8e0cc]">{fmt(r.bancaModelo)}</span>
                        <span className="font-mono text-[11px] text-[#c6a15b]">{fmt(r.metaModelo)}</span>
                        {futuro ? (
                          <span className="font-mono text-[10px] text-[#4a5a4a]">—</span>
                        ) : (
                          <span className={`font-mono text-[11px] font-bold`}>{r.metaReal===0?"—":<span style={{color:r.cor}}>{fmt(r.metaReal)}</span>}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {modo==="saques" && (()=>{
            const saqPct = cicloCfg?.saqPct || SAQ;
            const proxData = new Date();
            proxData.setDate(proxData.getDate()+1);
            const hojeIdx = offsetHoje(dataIni);
            const semanaAtual = Math.floor(hojeIdx / (cicloCfg?.diasPorSemana || D5));
            let proximoSaquesem = null;
            let saqueHoje = 0;
            for(const sem of semanasProj) {
              for(const d of sem.dias) {
                if(d.tem) saqueHoje += d.soma * saqPct / sem.dias.length;
              }
            }
            const semReal = semanas[semanaAtual];
            if(semReal) saqueHoje = semReal.saque;
            for(let w=semanaAtual+1;w<semanasProj.length;w++) {
              const sp = semanasProj[w];
              if(sp && sp.saque>0) {
                const ultimodia = sp.dias[sp.dias.length-1];
                proximoSaquesem = {semana:w+1, valor:sp.saque, data:ultimodia?.date};
                break;
              }
            }
            const saqDispHoje = semReal ? semReal.saque : 0;
            const saqueConfirmadoAtual = saquesConfirmados[semanaAtual];
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">💸 Projeção dos Saques</span>
                  <span className="font-mono text-[9px] text-[#4a5a4a]">{Math.round(saqPct*100)}% do lucro</span>
                </div>

                <div className="card mb-3" style={{padding:"10px 12px",borderColor:"#c6a15b"}}>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9px] text-[#6a7d6a]">💸 Saque disponível hoje</span>
                    <span className="font-mono text-[11px] font-bold text-[#c6a15b]">{fmt(saqDispHoje)}</span>
                  </div>
                  {proximoSaquesem && (
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="font-mono text-[8px] text-[#6a7d6a]">Próximo saque · Sem {proximoSaquesem.semana} · {proximoSaquesem.data ? fd(proximoSaquesem.data) : "—"}</span>
                      <span className="font-mono text-[9px] text-[#4C8C5C]">{fmt(proximoSaquesem.valor)}</span>
                    </div>
                  )}

                  {saqDispHoje>0 && (
                    <div className="mt-2 pt-2" style={{borderTop:"1px solid rgba(198,161,91,.25)"}}>
                      {saqueConfirmadoAtual ? (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-[#4C8C5C]">✅ SAQUE EFETUADO</span>
                          <span className="font-mono text-[8px] text-[#6a7d6a]">{fd(pISO(saqueConfirmadoAtual.data))} · {fmt(saqueConfirmadoAtual.valor)}</span>
                        </div>
                      ) : confirmandoSaqueSemana ? (
                        <div>
                          <div className="font-mono text-[9px] text-[#e8e0cc] mb-2">Confirmar saque de {fmt(saqDispHoje)} como efetuado?</div>
                          <div className="flex gap-2">
                            <button onClick={()=>setConfirmandoSaqueSemana(false)} className="btn-secondary flex-1" style={{padding:"6px 0"}}>Cancelar</button>
                            <button onClick={()=>confirmarSaqueSemanal(semanaAtual, saqDispHoje)} className="btn-primary flex-1" style={{padding:"6px 0"}}>Confirmar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>setConfirmandoSaqueSemana(true)} className="btn-primary w-full" style={{padding:"7px 0"}}>💰 CONFIRMAR SAQUE</button>
                      )}
                    </div>
                  )}
                </div>

                <div className="card mb-3" style={{padding:0}}>
                  <div className="s-table-header" style={{gridTemplateColumns:"50px 1fr 1fr 80px"}}>
                    <span>Sem</span><span>Lucro Prev.</span><span>Saque Prev.</span><span>Saldo Pós-Saq.</span>
                  </div>
                  {semanasProj.map((sp,i)=>{
                    const isAtual = i===semanaAtual;
                    return (
                      <div key={i} className="s-table-row" style={{gridTemplateColumns:"50px 1fr 1fr 80px",opacity:isAtual?1:i<semanaAtual?0.5:0.7,background:isAtual?"#1a2e22":"transparent",borderLeft:isAtual?"2px solid #c6a15b":"none"}}>
                        <span className="font-mono text-[10px] text-[#6a7d6a]">{sp.semana}{saquesConfirmados[i] ? " ✅" : ""}</span>
                        <span className="font-mono text-[10px] text-[#e8e0cc]">{fmt(sp.lucro)}</span>
                        <span className="font-mono text-[10px] text-[#A6432D]">−{fmt(sp.saque)}</span>
                        <span className="font-mono text-[10px] text-[#4C8C5C]">{fmt(sp.fim)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📊 Resumo dos Saques</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">Total saques previstos</span><span className="font-bold text-[#c6a15b]">{fmt(semanasProj.reduce((s,sp)=>s+sp.saque,0))}</span></div>
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">Saques realizados</span><span className="font-bold text-[#A6432D]">{fmt(totalSaq)}</span></div>
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">✅ Confirmados como efetuados</span><span className="font-bold text-[#4C8C5C]">{fmt(Object.values(saquesConfirmados).reduce((s,sc)=>s+sc.valor,0))}</span></div>
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">Saques emergenciais</span><span className="font-bold text-[#A6432D]">{fmt(totalSaqEmerg)}</span></div>
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">Depósitos</span><span className="font-bold text-[#4C8C5C]">{fmt(totalDepositos)}</span></div>
                    <div className="border-t border-[#1e3228] my-1"></div>
                    <div className="flex justify-between font-mono text-xs font-bold">
                      <span className="text-[#e8e0cc]">Banca disponível</span>
                      <span className="text-[#c6a15b]">{fmt(dashData.bancaFinal - totalSaqEmerg + totalDepositos)}</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {modo==="extrato" && (()=>{
            const itens=[];
            let saldoCorrente=cap;
            for(const sem of semanas) {
              for(const d of sem.dias) {
                if(d.tem && d.soma!==0) {
                  const k=kw(sem.semana-1, sem.dias.indexOf(d));
                  const ops=operacoes[k];
                  let detalhe;
                  if(ops && ops.length>0) {
                    detalhe = ops.map((o,i)=>o.status==="aberta"?`${o.estrategia||"Op"+(i+1)}: Aberta`:`${o.estrategia||"Op"+(i+1)}: ${o.resultado>=0?"+":""}${o.resultado}`).join("; ");
                  } else {
                    const vals=ent[k]||["","","",""];
                    detalhe=vals.filter(v=>v!=="").join(", ");
                  }
                  saldoCorrente+=d.soma;
                  const labelOps = ops && ops.length>0 ? ` (${ops.length} op)` : "";
                  itens.push({tipo:"entrada",data:d.date,label:`Sem ${sem.semana} — ${d.label}${labelOps}`,valor:d.soma,detalhe,saldo:saldoCorrente,operacoes:ops||[]});
                }
              }
              if(sem.saque>0) {
                saldoCorrente-=sem.saque;
                itens.push({tipo:"saque",data:sem.dias[sem.dias.length-1]?.date,label:`Saque Sem ${sem.semana}`,valor:-sem.saque,detalhe:`30% do lucro`,saldo:saldoCorrente});
              }
            }
            for(const m of movimentacoes) {
              const d=m.data.split("-").map(Number);
              const date=new Date(d[0],d[1]-1,d[2]);
              const val=m.tipo==="aporte"||m.tipo==="deposito"?m.valor:-m.valor;
              saldoCorrente+=val;
              const labelMap={aporte:"📥 Aporte",retirada:"📤 Retirada",saque_emergencial:"🚨 Saque Emergencial",deposito:"🏦 Depósito"};
              itens.push({tipo:m.tipo,data:date,label:labelMap[m.tipo]||m.tipo,valor:val,detalhe:m.nota||"—",saldo:saldoCorrente});
            }
            itens.sort((a,b)=>a.data-b.data);
            const filtrados = itens.filter(it=>{
              if(extTipoFiltro!=="todos" && it.tipo!==extTipoFiltro) return false;
              if(extDataIni) {
                const dIni=pISO(extDataIni); dIni.setHours(0,0,0,0);
                if(it.data<dIni) return false;
              }
              if(extDataFim) {
                const dFim=pISO(extDataFim); dFim.setHours(23,59,59,999);
                if(it.data>dFim) return false;
              }
              if(extBusca) {
                const q=extBusca.toLowerCase();
                const matchLabel=it.label.toLowerCase().includes(q);
                const matchDet=it.detalhe.toLowerCase().includes(q);
                const matchVal=fmt(it.valor).toLowerCase().includes(q);
                if(!matchLabel&&!matchDet&&!matchVal) return false;
              }
              return true;
            });
            const totalEntradas=itens.filter(i=>i.tipo==="entrada").reduce((s,i)=>s+i.valor,0);
            const totalSaques=itens.filter(i=>i.tipo==="saque").reduce((s,i)=>s+Math.abs(i.valor),0);
            const totalAportes=itens.filter(i=>i.tipo==="aporte").reduce((s,i)=>s+i.valor,0);
            const totalRetiradas=itens.filter(i=>i.tipo==="retirada").reduce((s,i)=>s+Math.abs(i.valor),0);
            const totalSaqEmerg=itens.filter(i=>i.tipo==="saque_emergencial").reduce((s,i)=>s+Math.abs(i.valor),0);
            const totalDepositos=itens.filter(i=>i.tipo==="deposito").reduce((s,i)=>s+i.valor,0);
            const opsEncontradas=[];
            for(const sem of semanas) {
              for(const d of sem.dias) {
                if(!d.tem) continue;
                const k=kw(sem.semana-1, sem.dias.indexOf(d));
                const opsDia=operacoes[k];
                if(!opsDia || opsDia.length===0) continue;
                for(const op of opsDia) {
                  if(extTipoFiltro!=="todos" && extTipoFiltro!=="entrada") continue;
                  const data=d.date;
                  if(extDataIni) {
                    const dIni=pISO(extDataIni); dIni.setHours(0,0,0,0);
                    if(data<dIni) continue;
                  }
                  if(extDataFim) {
                    const dFim=pISO(extDataFim); dFim.setHours(23,59,59,999);
                    if(data>dFim) continue;
                  }
                  if(extBusca) {
                    const q=extBusca.toLowerCase();
                    const mEst=(op.estrategia||"").toLowerCase().includes(q);
                    const mTime=(op.time||"").toLowerCase().includes(q);
                    const mObs=(op.observacao||"").toLowerCase().includes(q);
                    const mHora=(op.hora||"").toLowerCase().includes(q);
                    const mVal=fmt(op.resultado).toLowerCase().includes(q);
                    if(!mEst&&!mTime&&!mObs&&!mHora&&!mVal) continue;
                  }
                  opsEncontradas.push({...op, data, label:`Sem ${sem.semana} — ${d.label}`});
                }
              }
            }
            opsEncontradas.sort((a,b)=>a.data-b.data);
            const opsFechadasEnc=opsEncontradas.filter(o=>o.status!=="aberta");
            const opsGanhas=opsEncontradas.filter(o=>o.resultado>0);
            const opsPerdidas=opsEncontradas.filter(o=>o.resultado<0);
            const prejuizoTotal=opsPerdidas.reduce((s,o)=>s+o.resultado,0);
            const lucroMedio=opsFechadasEnc.length>0?opsFechadasEnc.reduce((s,o)=>s+o.resultado,0)/opsFechadasEnc.length:0;
            const taxaAcerto=opsFechadasEnc.length>0?Math.round(opsGanhas.length/opsFechadasEnc.length*100):0;
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">📄 Extrato</span>
                  <span className="font-mono text-[9px] text-[#4a5a4a]">{filtrados.length} registros</span>
                </div>
                <div className="card mb-3" style={{padding:"8px 10px"}}>
                  <input type="text" value={extBusca} onChange={e=>setExtBusca(e.target.value)} placeholder="🔍 Buscar no extrato..."
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[{k:"todos",l:"Todos"},{k:"entrada",l:"📈 Entradas"},{k:"saque",l:"💸 Saques"},{k:"saque_emergencial",l:"🚨 Emerg."},{k:"deposito",l:"🏦 Depósitos"},{k:"aporte",l:"📥 Aportes"},{k:"retirada",l:"📤 Retiradas"}].map(({k,l})=>(
                      <button key={k} onClick={()=>setExtTipoFiltro(k)} className="btn-small text-[8px]"
                        style={{borderColor:extTipoFiltro===k?"#c6a15b":"#1e3228",color:extTipoFiltro===k?"#c6a15b":"#6a7d6a"}}>{l}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    <input type="date" value={extDataIni} onChange={e=>setExtDataIni(e.target.value)}
                      className="flex-1 font-mono text-[9px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-1.5 py-1 outline-none" style={{fontSize:9}} />
                    <span className="font-mono text-[8px] text-[#4a5a4a] self-center">até</span>
                    <input type="date" value={extDataFim} onChange={e=>setExtDataFim(e.target.value)}
                      className="flex-1 font-mono text-[9px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-1.5 py-1 outline-none" style={{fontSize:9}} />
                    {(extDataIni||extDataFim) && <button onClick={()=>{setExtDataIni("");setExtDataFim("");}} className="btn-small text-[8px]">✕</button>}
                  </div>
                </div>
                <div className="card mb-3" style={{padding:0,maxHeight:400,overflowY:"auto"}}>
                  {filtrados.length===0 ? (
                    <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-6">Nenhum registro encontrado</div>
                  ) : filtrados.map((it,i)=>{
                    const cor = it.tipo==="entrada"?(it.valor>=0?"#4C8C5C":"#A6432D"):it.tipo==="saque"?"#c6a15b":it.tipo==="saque_emergencial"?"#A6432D":it.tipo==="deposito"?"#4C8C5C":it.tipo==="aporte"?"#4C8C5C":"#A6432D";
                    const ico = it.tipo==="entrada"?"📈":it.tipo==="saque"?"💸":it.tipo==="saque_emergencial"?"🚨":it.tipo==="deposito"?"🏦":it.tipo==="aporte"?"📥":"📤";
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#14241c] last:border-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[11px]">{ico}</span>
                          <div className="min-w-0">
                            <div className="font-mono text-[10px] text-[#e8e0cc] truncate">{it.label}</div>
                            <div className="font-mono text-[8px] text-[#4a5a4a]">{fd(it.data)} · {it.detalhe}</div>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="font-mono text-[11px] font-bold" style={{color:cor}}>{it.valor>=0?"+":""}{fmt(it.valor)}</div>
                          <div className="font-mono text-[8px] text-[#4a5a4a]">→ {fmt(it.saldo)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="card mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">🔍 Operações Encontradas</span>
                    <span className="font-mono text-[9px] text-[#4a5a4a]">{opsEncontradas.length} operação(ões)</span>
                  </div>
                  {opsEncontradas.length>0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#A6432D] font-mono uppercase mb-1">Prejuízo Total</div>
                          <div className="font-mono text-[12px] font-bold text-[#A6432D]">{prejuizoTotal<0?"−":""}{fmt(Math.abs(prejuizoTotal))}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase mb-1">Lucro Médio</div>
                          <div className={`font-mono text-[12px] font-bold ${lucroMedio>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{lucroMedio>=0?"+":""}{fmt(lucroMedio)}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase mb-1">Taxa de Acerto</div>
                          <div className="font-mono text-[12px] font-bold" style={{color:taxaAcerto>=60?"#4C8C5C":taxaAcerto>=40?"#c6a15b":"#A6432D"}}>{taxaAcerto}%</div>
                        </div>
                      </div>
                      <div style={{maxHeight:320,overflowY:"auto"}}>
                        {opsEncontradas.map((op,i)=>(
                          <div key={i} className="flex items-center px-3 py-2 border-b border-[#14241c] last:border-0">
                            <span className="font-mono text-[9px] text-[#4a5a4a] w-6 shrink-0">#{op.num}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[10px] text-[#e8e0cc] truncate">Estratégia: {op.estrategia?op.estrategia:"Não informado"} · Time: {op.time?op.time:"Não informado"}</div>
                              <div className="font-mono text-[8px] text-[#4a5a4a] truncate">{fd(op.data)} · {op.label}{op.hora?" · "+op.hora:""}{op.observacao?" · "+op.observacao:""}</div>
                            </div>
                            {op.status==="aberta" ? (
                              <span className="font-mono text-[10px] font-bold ml-2 shrink-0 text-[#c6a15b]">🟡 Aberta</span>
                            ) : (
                              <span className={`font-mono text-[11px] font-bold ml-2 shrink-0 ${op.resultado>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{op.resultado>=0?"+":""}{fmt(op.resultado)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-4">Nenhuma operação encontrada</div>
                  )}
                </div>
                <div className="flex gap-2 mb-3">
                  <button onClick={()=>{
                    const linhas=[["Data","Dia","Estratégia","Time","Horário","Resultado","Observação"]];
                    opsEncontradas.forEach(op=>{
                      linhas.push([tISO(op.data),op.label,op.estrategia?op.estrategia:"Não informado",op.time?op.time:"Não informado",op.hora||"—",resultadoCSV(op),op.observacao||"—"]);
                    });
                    linhas.push([]);
                    linhas.push(["RESUMO","","","","","",""]);
                    linhas.push(["Prejuízo Total","","","","",String(prejuizoTotal).replace(".",","),""]);
                    linhas.push(["Lucro Médio","","","","",String(lucroMedio).replace(".",","),""]);
                    linhas.push(["Taxa de Acerto","","","","",taxaAcerto+"%",""]);
                    const csv=linhas.map(l=>l.join(";")).join("\n");
                    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download=`pesquisa_operacoes_${tISO(new Date())}.csv`; a.click();
                    URL.revokeObjectURL(url);
                  }} className="btn-secondary flex-1 text-[10px] py-2">📥 Exportar Pesquisa</button>
                  <button onClick={()=>{
                    let html='<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:bold}.pos{color:green}.neg{color:red}</style></head><body><h2>Operações Encontradas</h2><table><tr><th>Data</th><th>Dia</th><th>Estratégia</th><th>Time</th><th>Horário</th><th>Resultado</th><th>Observação</th></tr>';
                    opsEncontradas.forEach(op=>{
                      html+='<tr><td>'+fd(op.data)+'</td><td>'+op.label+'</td><td>'+(op.estrategia?op.estrategia:"Não informado")+'</td><td>'+(op.time?op.time:"Não informado")+'</td><td>'+(op.hora||"—")+'</td><td class="'+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td>'+(op.observacao||"—")+'</td></tr>';
                    });
                    html+='<tr><td colspan="6"><b>Prejuízo Total: '+fmt(prejuizoTotal)+'</b></td><td></td></tr>';
                    html+='<tr><td colspan="6"><b>Lucro Médio: '+fmt(lucroMedio)+'</b></td><td></td></tr>';
                    html+='<tr><td colspan="6"><b>Taxa de Acerto: '+taxaAcerto+'%</b></td><td></td></tr>';
                    html+='</table></body></html>';
                    const blob=new Blob([html],{type:"application/vnd.ms-excel"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download=`pesquisa_operacoes_${tISO(new Date())}.xls`; a.click();
                    URL.revokeObjectURL(url);
                  }} className="btn-secondary flex-1 text-[10px] py-2">📊 Excel</button>
                  <button onClick={()=>{
                    let html='<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{body{margin:0}}body{font-family:monospace;padding:20px;max-width:640px;margin:0 auto;color:#000}h2{font-size:14px;border-bottom:2px solid #000;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}td.num{text-align:right}.pos{color:green}.neg{color:red}.tot{font-weight:bold;border-top:2px solid #000}</style></head><body><h2>Operações Encontradas</h2><table><tr><th>Data</th><th>Dia</th><th>Estratégia</th><th>Time</th><th>Resultado</th><th>Horário</th></tr>';
                    opsEncontradas.forEach(op=>{
                      html+='<tr><td>'+fd(op.data)+'</td><td>'+op.label+'</td><td>'+(op.estrategia?op.estrategia:"Não informado")+'</td><td>'+(op.time?op.time:"Não informado")+'</td><td class="num '+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td>'+(op.hora||"—")+'</td></tr>';
                    });
                    html+='<tr class="tot"><td colspan="4">Prejuízo Total: '+fmt(prejuizoTotal)+'</td><td class="num">Lucro Médio: '+fmt(lucroMedio)+'</td><td class="num">Acerto: '+taxaAcerto+'%</td></tr>';
                    html+='</table></body></html>';
                    const win=window.open("","","width=700,height=500");
                    win.document.write(html); win.document.close(); win.print();
                  }} className="btn-secondary flex-1 text-[10px] py-2">🖨 PDF</button>
                </div>
                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">Resumo</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">📈 Entradas operacionais</span><span className="font-bold text-[#4C8C5C]">+{fmt(totalEntradas)}</span></div>
                    <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">💸 Saques semanais</span><span className="font-bold text-[#c6a15b]">−{fmt(totalSaques)}</span></div>
                    {totalAportes>0 && <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">📥 Aportes</span><span className="font-bold text-[#4C8C5C]">+{fmt(totalAportes)}</span></div>}
                    {totalRetiradas>0 && <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">📤 Retiradas</span><span className="font-bold text-[#A6432D]">−{fmt(totalRetiradas)}</span></div>}
                    {totalSaqEmerg>0 && <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">🚨 Saque Emergencial</span><span className="font-bold text-[#A6432D]">−{fmt(totalSaqEmerg)}</span></div>}
                    {totalDepositos>0 && <div className="flex justify-between font-mono text-xs"><span className="text-[#6a7d6a]">🏦 Depósitos</span><span className="font-bold text-[#4C8C5C]">+{fmt(totalDepositos)}</span></div>}
                    <div className="border-t border-[#1e3228] my-1"></div>
                    <div className="flex justify-between font-mono text-xs font-bold">
                      <span className="text-[#e8e0cc]">Saldo final</span>
                      <span style={{color: saldoCorrente>=cap?"#4C8C5C":"#A6432D"}}>{fmt(saldoCorrente)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mb-5">
                  <button onClick={()=>{
                    const linhas=[["Data","Hora","Tipo","Detalhe","Valor","Saldo"]];
                    filtrados.forEach(it=>{
                      linhas.push([fd(it.data),"",it.tipo,it.detalhe,String(it.valor).replace(".",","),String(it.saldo).replace(".",",")]);
                      if(it.operacoes && it.operacoes.length>1) {
                        it.operacoes.forEach(op=>{
                          linhas.push(["","",`  Op ${op.num}`,`${op.estrategia||"—"}${op.hora?" "+op.hora:""}`,resultadoCSV(op),""]);
                        });
                      }
                    });
                    const csv=linhas.map(l=>l.join(";")).join("\n");
                    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download=`extrato_${cicloAtivo||"ciclo"}_${tISO(new Date())}.csv`; a.click();
                    URL.revokeObjectURL(url);
                  }} className="btn-secondary flex-1 text-[10px] py-2">📥 CSV</button>
                  <button onClick={()=>{
                    let html='<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:bold}.pos{color:green}.neg{color:red}.op{font-size:9px;color:#666;padding-left:20px}</style></head><body><h2>Extrato - '+new Date().toLocaleDateString("pt-BR")+'</h2><table><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th>Valor</th><th>Saldo</th></tr>';
                    filtrados.forEach(it=>{
                      html+='<tr><td>'+fd(it.data)+'</td><td>'+it.tipo+'</td><td>'+it.detalhe+'</td><td class="'+(it.valor>=0?"pos":"neg")+'">'+fmt(it.valor)+'</td><td>'+fmt(it.saldo)+'</td></tr>';
                      if(it.operacoes && it.operacoes.length>1) {
                        it.operacoes.forEach(op=>{
                          html+='<tr class="op"><td></td><td></td><td>Op '+op.num+': '+(op.estrategia||"—")+(op.hora?" "+op.hora:"")+'</td><td class="'+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td></td></tr>';
                        });
                      }
                    });
                    html+='</table><br><p>Total entradas: '+fmt(totalEntradas)+' | Total saques: '+fmt(totalSaques)+' | Banca disp.: '+fmt(dashData.bancaFinal-totalSaqEmerg+totalDepositos)+'</p></body></html>';
                    const blob=new Blob([html],{type:"application/vnd.ms-excel"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download=`extrato_${tISO(new Date())}.xls`; a.click();
                    URL.revokeObjectURL(url);
                  }} className="btn-secondary flex-1 text-[10px] py-2">📊 Excel</button>
                  <button onClick={()=>{
                    let html='<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{body{margin:0}}body{font-family:monospace;padding:20px;max-width:600px;margin:0 auto;color:#000}h2{font-size:14px;border-bottom:2px solid #000;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #999;padding:4px 6px}th{background:#eee}td.num{text-align:right}.pos{color:green}.neg{color:red}.tot{font-weight:bold;border-top:2px solid #000}.op{font-size:9px;color:#666;padding-left:16px}</style></head><body><h2>Extrato - '+new Date().toLocaleDateString("pt-BR")+'</h2><table><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th>Valor</th><th>Saldo</th></tr>';
                    filtrados.forEach(it=>{
                      html+='<tr><td>'+fd(it.data)+'</td><td>'+it.tipo+'</td><td>'+it.detalhe+'</td><td class="num '+(it.valor>=0?"pos":"neg")+'">'+fmt(it.valor)+'</td><td class="num">'+fmt(it.saldo)+'</td></tr>';
                      if(it.operacoes && it.operacoes.length>1) {
                        it.operacoes.forEach(op=>{
                          html+='<tr class="op"><td></td><td></td><td>Op '+op.num+': '+(op.estrategia||"—")+(op.hora?" "+op.hora:"")+'</td><td class="num '+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td></td></tr>';
                        });
                      }
                    });
                    html+='<tr class="tot"><td colspan="3">RESUMO</td><td></td><td></td></tr>';
                    html+='<tr><td colspan="3">Entradas</td><td class="num pos">+'+fmt(totalEntradas)+'</td><td></td></tr>';
                    html+='<tr><td colspan="3">Saques semanais</td><td class="num neg">-'+fmt(totalSaques)+'</td><td></td></tr>';
                    if(totalSaqEmerg>0) html+='<tr><td colspan="3">Saques emergenciais</td><td class="num neg">-'+fmt(totalSaqEmerg)+'</td><td></td></tr>';
                    if(totalDepositos>0) html+='<tr><td colspan="3">Depósitos</td><td class="num pos">+'+fmt(totalDepositos)+'</td><td></td></tr>';
                    html+='</table></body></html>';
                    const win=window.open("","","width=700,height=500");
                    win.document.write(html); win.document.close(); win.print();
                  }} className="btn-secondary flex-1 text-[10px] py-2">🖨 PDF</button>
                </div>
              </>
            );
          })()}

          {modo==="pesquisa" && (()=>{
            const alvos = pCiclo==="todos" ? ciclos : (pCiclo==="ativo" ? ciclos.filter(c=>c.id===cicloAtivo) : ciclos.filter(c=>c.id===pCiclo));
            const pOps=[];
            for(const c of alvos) {
              const cfgC={tiers:c.tiers, diasPorSemana:c.diasPorSemana||7, saqueIntervalo:(c.saqueIntervalo!==undefined?c.saqueIntervalo:(c.diasPorSemana||7)), saqPct:c.saqPct||0.3};
              const semsC=calc(c.cap, pISO(c.dataIni), c.ent||{}, false, cfgC);
              const opsC=c.operacoes||{};
              for(let w=0;w<semsC.length;w++) {
                const sem=semsC[w];
                for(let d=0;d<sem.dias.length;d++) {
                  const dia=sem.dias[d];
                  if(!dia.tem) continue;
                  const ky=kw(w,d);
                  const opsDia=opsC[ky];
                  if(!opsDia || opsDia.length===0) continue;
                  const data=dia.date;
                  if(pDataIni) { const di=pISO(pDataIni); di.setHours(0,0,0,0); if(data<di) continue; }
                  if(pDataFim) { const df=pISO(pDataFim); df.setHours(23,59,59,999); if(data>df) continue; }
                  if(pDiaSem!=="todos" && data.getDay()!==Number(pDiaSem)) continue;
                  for(const op of opsDia) {
                    if(pEstrategia && normEstrategia(op.estrategia)!==normEstrategia(pEstrategia)) continue;
                    if(pTime && op.time!==pTime) continue;
                    if(pResultado==="green" && !(op.resultado>0)) continue;
                    if(pResultado==="red" && !(op.resultado<0)) continue;
                    if(pResultado==="void" && !(op.status!=="aberta" && op.resultado===0)) continue;
                    if(pResultado==="aberta" && op.status!=="aberta") continue;
                    pOps.push({...op, data, label:`Sem ${sem.semana} — ${dia.label}`, ciclo:c.nome});
                  }
                }
              }
            }
            pOps.sort((a,b)=>a.data-b.data);
            const pTotalOps=pOps.length;
            const pAbertas=pOps.filter(o=>o.status==="aberta").length;
            const pGreens=pOps.filter(o=>o.resultado>0).length;
            const pReds=pOps.filter(o=>o.resultado<0).length;
            const pVoids=pOps.filter(o=>o.status!=="aberta" && o.resultado===0).length;
            const pValorGreens=pOps.filter(o=>o.resultado>0).reduce((s,o)=>s+o.resultado,0);
            const pValorReds=pOps.filter(o=>o.resultado<0).reduce((s,o)=>s+o.resultado,0);
            const pLucroTotal=pValorGreens+pValorReds;
            const pPrejuizoTotal=pValorReds;
            const pFechadas=pTotalOps-pAbertas;
            const pLucroMedio=pFechadas>0?pLucroTotal/pFechadas:0;
            const pTaxaAcerto=pFechadas>0?Math.round(pGreens/pFechadas*100):0;
            const pFiltrosAtivos = pEstrategia||pTime||pResultado!=="todos"||pDataIni||pDataFim||pDiaSem!=="todos"||pCiclo!=="todos";
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">🔍 Pesquisar Operações</span>
                  <span className="font-mono text-[9px] text-[#4a5a4a]">{pTotalOps} resultado(s)</span>
                </div>
                <div className="card mb-3" style={{padding:"8px 10px"}}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Estratégia</label>
                      <select value={pEstrategia} onChange={e=>setPEstrategia(e.target.value)}
                        className="w-full font-mono text-[10px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-0.5">
                        <option value="">Todas</option>
                        {estrategias.map(e=><option key={e.id} value={e.nome}>{e.nome}{e.ativa?"":" (desativada)"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Time</label>
                      <select value={pTime} onChange={e=>setPTime(e.target.value)}
                        className="w-full font-mono text-[10px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-0.5">
                        <option value="">Todos</option>
                        {times.map(e=><option key={e.id} value={e.nome}>{e.nome}{e.ativa?"":" (desativada)"}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {[{k:"todos",l:"Todos"},{k:"aberta",l:"🟡 Aberta"},{k:"green",l:"🟢 Green"},{k:"red",l:"🔴 Red"},{k:"void",l:"⚪ Void"}].map(({k,l})=>(
                      <button key={k} onClick={()=>setPResultado(k)} className="btn-small text-[8px]"
                        style={{borderColor:pResultado===k?"#c6a15b":"#1e3228",color:pResultado===k?"#c6a15b":"#6a7d6a"}}>{l}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-[8px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Ciclo</label>
                      <select value={pCiclo} onChange={e=>setPCiclo(e.target.value)}
                        className="w-full font-mono text-[10px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-0.5">
                        <option value="todos">Todos os ciclos</option>
                        <option value="ativo">Ciclo atual ({ciclos.find(c=>c.id===cicloAtivo)?.nome||"—"})</option>
                        {ciclos.map(c=><option key={c.id} value={c.id}>{c.nome}{c.status==="encerrado"?" 🔒":""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Dia da semana</label>
                      <select value={pDiaSem} onChange={e=>setPDiaSem(e.target.value)}
                        className="w-full font-mono text-[10px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-0.5">
                        <option value="todos">Todos</option>
                        {[0,1,2,3,4,5,6].map(i=><option key={i} value={i}>{DM7[i]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <input type="date" value={pDataIni} onChange={e=>setPDataIni(e.target.value)}
                      className="flex-1 font-mono text-[9px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-1.5 py-1 outline-none" />
                    <span className="font-mono text-[8px] text-[#4a5a4a] self-center">até</span>
                    <input type="date" value={pDataFim} onChange={e=>setPDataFim(e.target.value)}
                      className="flex-1 font-mono text-[9px] text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-1.5 py-1 outline-none" />
                  </div>
                  {pFiltrosAtivos && <div className="flex justify-end mt-1.5">
                    <button onClick={()=>{setPEstrategia("");setPTime("");setPResultado("todos");setPCiclo("todos");setPDataIni("");setPDataFim("");setPDiaSem("todos");}}
                      className="btn-small text-[8px]" style={{borderColor:"#A6432D",color:"#A6432D"}}>✕ Limpar filtros</button>
                  </div>}
                </div>
                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📊 Resumo da Pesquisa</div>
                  {pTotalOps>0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Operações</div>
                          <div className="font-mono text-[13px] font-bold text-[#e8e0cc]">{pTotalOps}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#4C8C5C] font-mono uppercase">Greens</div>
                          <div className="font-mono text-[13px] font-bold text-[#4C8C5C]">{pGreens}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#A6432D] font-mono uppercase">Reds</div>
                          <div className="font-mono text-[13px] font-bold text-[#A6432D]">{pReds}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Void</div>
                          <div className="font-mono text-[13px] font-bold text-[#6a7d6a]">{pVoids}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#c6a15b] font-mono uppercase">🟡 Abertas</div>
                          <div className="font-mono text-[13px] font-bold text-[#c6a15b]">{pAbertas}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#4C8C5C] font-mono uppercase">💚 Valor dos Greens</div>
                          <div className="font-mono text-[13px] font-bold text-[#4C8C5C]">+{fmt(pValorGreens)}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#A6432D] font-mono uppercase">🔴 Valor dos Reds</div>
                          <div className="font-mono text-[13px] font-bold text-[#A6432D]">−{fmt(Math.abs(pValorReds))}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center" style={{border:`1px solid ${pLucroTotal>=0?"rgba(76,140,92,0.45)":"rgba(166,67,45,0.45)"}`}}>
                          <div className={`text-[8px] font-mono uppercase ${pLucroTotal>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>💰 Resultado Líquido</div>
                          <div className={`font-mono text-[14px] font-bold ${pLucroTotal>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{pLucroTotal>=0?"+":""}{fmt(pLucroTotal)}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Lucro Médio</div>
                          <div className={`font-mono text-[13px] font-bold ${pLucroMedio>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{pLucroMedio>=0?"+":""}{fmt(pLucroMedio)}</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Taxa de Acerto</div>
                          <div className="font-mono text-[13px] font-bold" style={{color:pTaxaAcerto>=60?"#4C8C5C":pTaxaAcerto>=40?"#c6a15b":"#A6432D"}}>{pTaxaAcerto}%</div>
                        </div>
                        <div className="bg-[#0f1f17] rounded px-2 py-2 text-center">
                          <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Ciclos pesquisados</div>
                          <div className="font-mono text-[13px] font-bold text-[#e8e0cc]">{alvos.length}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>{
                          const linhas=[["Data","Dia","Ciclo","Estratégia","Time","Horário","Resultado","Observação"]];
                          pOps.forEach(op=>{
                            linhas.push([tISO(op.data),op.label,op.ciclo,op.estrategia?op.estrategia:"Não informado",op.time?op.time:"Não informado",op.hora||"—",resultadoCSV(op),op.observacao||"—"]);
                          });
                          linhas.push([]);
                          linhas.push(["RESUMO","","","","","","",""]);
                          linhas.push(["Operações","","","","","",pTotalOps,""]);
                          linhas.push(["Greens","","","","","",pGreens,""]);
                          linhas.push(["Reds","","","","","",pReds,""]);
                          linhas.push(["Void","","","","","",pVoids,""]);
                          linhas.push(["Valor dos Greens","","","","","",String(pValorGreens).replace(".",","),""]);
                          linhas.push(["Valor dos Reds","","","","","",String(pValorReds).replace(".",","),""]);
                          linhas.push(["Resultado Líquido","","","","","",String(pLucroTotal).replace(".",","),""]);
                          linhas.push(["Lucro Médio","","","","","",String(pLucroMedio).replace(".",","),""]);
                          linhas.push(["Taxa de Acerto","","","","","",pTaxaAcerto+"%",""]);
                          const csv=linhas.map(l=>l.join(";")).join("\n");
                          const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
                          const url=URL.createObjectURL(blob);
                          const a=document.createElement("a"); a.href=url; a.download=`pesquisa_${tISO(new Date())}.csv`; a.click();
                          URL.revokeObjectURL(url);
                        }} className="btn-secondary flex-1 text-[10px] py-2">📥 Exportar Pesquisa</button>
                        <button onClick={()=>{
                          let html='<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}th{background:#f0f0f0;font-weight:bold}.pos{color:green}.neg{color:red}</style></head><body><h2>Pesquisa de Operações</h2><table><tr><th>Data</th><th>Dia</th><th>Ciclo</th><th>Estratégia</th><th>Time</th><th>Horário</th><th>Resultado</th><th>Observação</th></tr>';
                          pOps.forEach(op=>{
                            html+='<tr><td>'+fd(op.data)+'</td><td>'+op.label+'</td><td>'+op.ciclo+'</td><td>'+(op.estrategia?op.estrategia:"Não informado")+'</td><td>'+(op.time?op.time:"Não informado")+'</td><td>'+(op.hora||"—")+'</td><td class="'+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td>'+(op.observacao||"—")+'</td></tr>';
                          });
                          html+='<tr><td colspan="7"><b>Operações: '+pTotalOps+' | Greens: '+pGreens+' | Reds: '+pReds+' | Void: '+pVoids+'</b></td><td></td></tr>';
                          html+='<tr><td colspan="7"><b>Greens: +'+fmt(pValorGreens)+' | Reds: −'+fmt(Math.abs(pValorReds))+' | Resultado Líquido: '+fmt(pLucroTotal)+' | Lucro Médio: '+fmt(pLucroMedio)+' | Acerto: '+pTaxaAcerto+'%</b></td><td></td></tr>';
                          html+='</table></body></html>';
                          const blob=new Blob([html],{type:"application/vnd.ms-excel"});
                          const url=URL.createObjectURL(blob);
                          const a=document.createElement("a"); a.href=url; a.download=`pesquisa_${tISO(new Date())}.xls`; a.click();
                          URL.revokeObjectURL(url);
                        }} className="btn-secondary flex-1 text-[10px] py-2">📊 Excel</button>
                        <button onClick={()=>{
                          let html='<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{body{margin:0}}body{font-family:monospace;padding:20px;max-width:680px;margin:0 auto;color:#000}h2{font-size:14px;border-bottom:2px solid #000;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}td.num{text-align:right}.pos{color:green}.neg{color:red}.tot{font-weight:bold;border-top:2px solid #000}</style></head><body><h2>Pesquisa de Operações</h2><table><tr><th>Data</th><th>Dia</th><th>Ciclo</th><th>Estratégia</th><th>Time</th><th>Resultado</th><th>Horário</th></tr>';
                          pOps.forEach(op=>{
                            html+='<tr><td>'+fd(op.data)+'</td><td>'+op.label+'</td><td>'+op.ciclo+'</td><td>'+(op.estrategia?op.estrategia:"Não informado")+'</td><td>'+(op.time?op.time:"Não informado")+'</td><td class="num '+(op.resultado>=0?"pos":"neg")+'">'+fmt(op.resultado)+'</td><td>'+(op.hora||"—")+'</td></tr>';
                          });
                          html+='<tr class="tot"><td colspan="5">Greens: '+pGreens+' · Reds: '+pReds+' · Void: '+pVoids+'</td><td class="num">Acerto: '+pTaxaAcerto+'%</td><td></td></tr>';
                          html+='<tr><td colspan="5">Greens: +'+fmt(pValorGreens)+' · Reds: −'+fmt(Math.abs(pValorReds))+' · Resultado: '+fmt(pLucroTotal)+'</td><td class="num">Lucro Médio: '+fmt(pLucroMedio)+'</td><td></td></tr>';
                          html+='</table></body></html>';
                          const win=window.open("","","width=700,height=500");
                          win.document.write(html); win.document.close(); win.print();
                        }} className="btn-secondary flex-1 text-[10px] py-2">🖨 PDF</button>
                      </div>
                    </>
                  ) : (
                    <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-4">Ajuste os filtros para encontrar operações</div>
                  )}
                </div>
                <div className="card mb-5" style={{padding:0,maxHeight:400,overflowY:"auto"}}>
                  <div className="px-3 py-2 border-b border-[#1e3228]">
                    <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">📋 Operações Encontradas ({pTotalOps})</span>
                  </div>
                  {pTotalOps===0 ? (
                    <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-6">Nenhuma operação encontrada</div>
                  ) : pOps.map((op,i)=>(
                    <div key={i} className="flex items-center px-3 py-2 border-b border-[#14241c] last:border-0">
                      <span className="font-mono text-[9px] text-[#4a5a4a] w-6 shrink-0">#{op.num}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-[#e8e0cc] truncate">Estratégia: {op.estrategia?op.estrategia:"Não informado"} · Time: {op.time?op.time:"Não informado"}</div>
                        <div className="font-mono text-[8px] text-[#4a5a4a] truncate">{fd(op.data)} · {op.label} · {op.ciclo}{op.hora?" · "+op.hora:""}{op.observacao?" · "+op.observacao:""}</div>
                      </div>
                      {op.status==="aberta" ? (
                        <span className="font-mono text-[10px] font-bold ml-2 shrink-0 text-[#c6a15b]">🟡 Aberta</span>
                      ) : (
                        <span className={`font-mono text-[11px] font-bold ml-2 shrink-0 ${op.resultado>0?"text-[#4C8C5C]":op.resultado<0?"text-[#A6432D]":"text-[#6a7d6a]"}`}>{op.resultado>0?"+":""}{op.resultado===0?"Void ":""}{fmt(op.resultado)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {modo==="graficos" && (()=>{
            const lucro=a=>[...a].sort((x,y)=>y.lucro-x.lucro), greens=a=>[...a].sort((x,y)=>y.greens-x.greens||y.lucro-x.lucro);
            const melhores=a=>[...a].filter(x=>x.ops>=3).sort((x,y)=>y.score-x.score||y.lucro-x.lucro);
            const evitar=a=>[...a].filter(x=>x.ops>=3&&x.lucro<0).sort((x,y)=>x.lucro-y.lucro);
            const top=(a,n=10)=>a.slice(0,n);
            const ranking=(titulo,dados,metrica="lucro")=>(<div className="card mb-3" style={{padding:"10px 12px"}}><div className="font-mono text-[9px] text-[#6a7d6a] uppercase tracking-wider mb-2">{titulo}</div>{dados.length===0?<div className="font-mono text-[9px] text-[#4a5a4a] text-center py-4">Sem dados suficientes neste período.</div>:dados.map((x,i)=>{const v=metrica==="greens"?x.greens:metrica==="score"?x.score:x.lucro;const mx=Math.max(1,...dados.map(z=>Math.abs(metrica==="greens"?z.greens:metrica==="score"?z.score:z.lucro)));return <div key={x.nome} className="mb-2"><div className="flex justify-between gap-2 mb-1"><span className="font-mono text-[9px] text-[#e8e0cc] truncate">{i+1}. {x.nome}</span><span className="font-mono text-[9px] font-bold shrink-0" style={{color:metrica==="lucro"&&v<0?"#A6432D":"#4C8C5C"}}>{metrica==="greens"?`${v} greens`:metrica==="score"?`${v} pts`:`${v>0?"+":""}${fmt(v)}`}</span></div><div className="h-2 rounded overflow-hidden" style={{background:"#0a1410"}}><div className="h-full rounded" style={{width:`${Math.max(3,Math.abs(v)/mx*100)}%`,background:metrica==="lucro"&&v<0?"#A6432D":"#4C8C5C"}}></div></div><div className="flex justify-between mt-0.5"><span className="font-mono text-[7px] text-[#4a5a4a]">{x.ops} ops · {x.greens}G · {x.reds}R</span><span className="font-mono text-[7px] text-[#4a5a4a]">acerto {x.winRate}%</span></div></div>})}</div>);
            const mt=melhores(graficosData.times)[0], me=melhores(graficosData.estrategias)[0], md=melhores(graficosData.dias)[0];
            return <>
              <div className="flex items-center justify-between mb-3"><div><div className="font-mono text-[11px] text-[#e8e0cc] font-bold">📊 Central de Análises</div><div className="font-mono text-[8px] text-[#4a5a4a]">Decisões baseadas no seu histórico registrado</div></div><span className="font-mono text-[8px] text-[#6a7d6a]">{graficosData.totalOps} ops</span></div>
              <div className="card mb-3" style={{padding:"9px"}}><div className="font-mono text-[8px] text-[#6a7d6a] mb-2">PERÍODO</div><div className="flex gap-1 flex-wrap">{[["7","7 dias"],["30","30 dias"],["ciclo","Ciclo atual"],["todos","Todos"],["personalizado","Personalizado"]].map(([v,l])=><button key={v} onClick={()=>setGrafPeriodo(v)} className="btn-small" style={{borderColor:grafPeriodo===v?"#c6a15b":"#4a5a4a",color:grafPeriodo===v?"#c6a15b":"#8a9a8a"}}>{l}</button>)}</div>{grafPeriodo==="personalizado"&&<div className="flex gap-2 mt-2"><input type="date" value={grafDataIni} onChange={e=>setGrafDataIni(e.target.value)} className="flex-1 font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1 text-[#e8e0cc]"/><input type="date" value={grafDataFim} onChange={e=>setGrafDataFim(e.target.value)} className="flex-1 font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1 text-[#e8e0cc]"/></div>}</div>
              <div className="grid grid-cols-3 gap-2 mb-4">{[["⚽ Melhor time",mt],["🎯 Melhor estratégia",me],["📅 Melhor dia",md]].map(([l,x])=><div key={l} className="card text-center" style={{padding:"8px 5px"}}><div className="font-mono text-[7px] text-[#6a7d6a] uppercase">{l}</div><div className="font-mono text-[9px] text-[#e8e0cc] font-bold truncate mt-1">{x?.nome||"—"}</div><div className="font-mono text-[7px] text-[#4C8C5C]">{x?`${x.winRate}% · ${x.ops} ops`:"mín. 3 ops"}</div></div>)}</div>
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2">⚽ 1. Times</div>{ranking("🔥 Melhores para operar",top(melhores(graficosData.times)),"score")}{ranking("💰 Mais lucrativos",top(lucro(graficosData.times)))}{ranking("✅ Mais greens",top(greens(graficosData.times)),"greens")}{ranking("⚠️ Times para evitar",top(evitar(graficosData.times)))}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">🎯 2. Estratégias</div>{ranking("🔥 Melhores estratégias",top(melhores(graficosData.estrategias)),"score")}{ranking("💰 Mais lucrativas",top(lucro(graficosData.estrategias)))}{ranking("⚠️ Estratégias para evitar",top(evitar(graficosData.estrategias)))}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">📅 3. Dias</div>{ranking("💰 Dias por lucro",lucro(graficosData.dias))}{ranking("⚠️ Dias para ter cautela",evitar(graficosData.dias))}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">🧩 4. Combinações vencedoras</div>{ranking("Time + estratégia + dia",top(melhores(graficosData.combos),12),"score")}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">🕐 5. Melhor horário</div>{ranking("Lucro por período",lucro(graficosData.horarios))}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">🧮 6. Lucro por estratégia</div>{ranking("Favorito / Zebra / Vários Resultados / Total de Gols / Placar Correto",lucro(graficosData.estrategiasBase))}
              {(()=>{
                const ant=graficosData.momentoSaida.antes, apo=graficosData.momentoSaida.apos;
                const maxLucro=Math.max(1,Math.abs(ant.lucro),Math.abs(apo.lucro));
                let msgMomento="Registre o minuto de saída das suas operações para comparar o desempenho antes e após o intervalo.";
                if(ant.ops>0 && apo.ops>0) {
                  const diffLucro=apo.lucro-ant.lucro;
                  if(Math.abs(diffLucro)>=0.01) {
                    msgMomento = diffLucro>0
                      ? "Suas saídas após o intervalo apresentam melhor resultado."
                      : "Suas saídas antes do intervalo apresentam melhor resultado.";
                  } else if(ant.winRate!==apo.winRate) {
                    msgMomento = ant.winRate>apo.winRate
                      ? "Suas saídas antes do intervalo possuem maior taxa de acerto."
                      : "Suas saídas após o intervalo possuem maior taxa de acerto.";
                  } else {
                    msgMomento = "Antes e depois do intervalo têm performance parecida até agora.";
                  }
                } else if(ant.ops>0 || apo.ops>0) {
                  msgMomento = "Registre saídas nos dois momentos (antes e após o intervalo) para uma comparação completa.";
                }
                return (
                  <>
                  <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">⏱️ 7. Momento da saída</div>
                  <div className="card mb-3" style={{padding:"10px 12px"}}>
                    <div className="font-mono text-[9px] text-[#6a7d6a] uppercase tracking-wider mb-2">⏱️ ANTES x APÓS O INTERVALO</div>
                    {[["⏱️ Saída antes do intervalo (1'–45')",ant],["⏱️ Saída após o intervalo (46'+)",apo]].map(([label,x])=>(
                      <div key={label} className="mb-2">
                        <div className="flex justify-between gap-2 mb-1">
                          <span className="font-mono text-[9px] text-[#e8e0cc] truncate">{label}</span>
                          <span className="font-mono text-[9px] font-bold shrink-0" style={{color:x.lucro<0?"#A6432D":"#4C8C5C"}}>{x.lucro>0?"+":""}{fmt(x.lucro)}</span>
                        </div>
                        <div className="h-2 rounded overflow-hidden" style={{background:"#0a1410"}}>
                          <div className="h-full rounded" style={{width:`${x.ops>0?Math.max(3,Math.abs(x.lucro)/maxLucro*100):0}%`,background:x.lucro<0?"#A6432D":"#4C8C5C"}}></div>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="font-mono text-[7px] text-[#4a5a4a]">{x.ops} ops · {x.greens}G · {x.reds}R</span>
                          <span className="font-mono text-[7px] text-[#4a5a4a]">acerto {x.winRate}%</span>
                        </div>
                      </div>
                    ))}
                    <div className="font-mono text-[8px] mt-2 pt-2 border-t border-[#1e3228]" style={{color:"#c6a15b"}}>🏆 MELHOR MOMENTO DE SAÍDA</div>
                    <div className="font-mono text-[9px] text-[#e8e0cc] mt-1">{msgMomento}</div>
                  </div>
                  </>
                );
              })()}
              <div className="font-mono text-[10px] text-[#c6a15b] uppercase tracking-wider mb-2 mt-4">💹 8. Mercado mais rentável</div>{ranking("Top mercados (método + estratégia)",top(lucro(graficosData.estrategias),5))}
              {graficosData.mediaEsperado!=null && (
                <div className="card mb-5" style={{padding:"10px 12px"}}>
                  <div className="font-mono text-[9px] text-[#6a7d6a] uppercase tracking-wider mb-2">📐 10. Média de lucro: esperado x realizado</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center"><div className="font-mono text-[8px] text-[#6a7d6a] uppercase">Esperado (média)</div><div className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(graficosData.mediaEsperado)}</div></div>
                    <div className="text-center"><div className="font-mono text-[8px] text-[#6a7d6a] uppercase">Realizado (média)</div><div className={`font-mono text-sm font-bold ${graficosData.mediaRealizado>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{fmt(graficosData.mediaRealizado)}</div></div>
                  </div>
                </div>
              )}
              <div className="card mb-5" style={{padding:"9px 11px"}}><div className="font-mono text-[8px] text-[#6a7d6a] leading-relaxed">ℹ️ “Melhores” exige no mínimo 3 operações e combina lucro, taxa de acerto e amostra. Rankings históricos ajudam na análise, mas não garantem resultados futuros.</div></div>
            </>;
          })()}

          {modo==="painel" && (()=>{
            const d=dashData;
            const diasRest=totalDiasAtu - d.diasOperados;
            const lucroTotalReal=semanas.reduce((s,w)=>s+w.lucro,0);
            const saldoCalc = sm ? sm.prox : cap;
            const saldoReal = smInt && smInt.dias.length > 0 ? smInt.dias[smInt.dias.length-1].base : cap;
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider">📊 Painel</span>
                  <span className="font-mono text-[8px] text-[#4a5a4a]">v9.8.0</span>
                </div>

                <div className="card mb-3">
                  <div className="text-center mb-3 pb-3 border-b border-[#1e3228]">
                    <div className="text-[9px] text-[#6a7d6a] font-mono uppercase mb-1">Banca Atual</div>
                    <div className="font-mono text-2xl font-bold text-[#e8e0cc]">{fmt(d.bancaFinal)}</div>
                    <div className="font-mono text-[10px] text-[#6a7d6a]">Projeção: {fmt(d.bancaProj)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-[#1e3228]">
                    <div className="text-center">
                      <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Lucro</div>
                      <div className={`font-mono text-sm font-bold ${d.totalLucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{d.totalLucro>=0?"+":""}{fmt(d.totalLucro)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Saque</div>
                      <div className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(d.totalSaque)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Diferença</div>
                      <div className={`font-mono text-sm font-bold ${d.diff>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{d.diff>=0?"+":""}{fmt(d.diff)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">📅 Dias operados</span>
                      <span className="font-mono text-[11px] font-bold">{d.diasOperados}<span className="text-[#4a5a4a]">/{totalDiasAtu}</span></span>
                    </div>
                    <div className="bar-container mb-1">
                      <div className="bar-fill" style={{width:`${(d.diasOperados/totalDiasAtu)*100}%`,background:"#c6a15b"}}></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">🎯 Win rate</span>
                      <span className={`font-mono text-[11px] font-bold ${d.winRate>=60?"text-[#4C8C5C]":d.winRate>=40?"text-[#c6a15b]":"text-[#A6432D]"}`}>{d.winRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">🔥 Melhor sequência</span>
                      <span className="font-mono text-[11px] font-bold text-[#4C8C5C]">{d.seqAtual} dias</span>
                    </div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🏆 Recordes</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono text-[10px] text-[#4C8C5C]">Melhor dia</div>
                        <div className="font-mono text-[8px] text-[#4a5a4a]">{d.melhorDia.data ? fd(d.melhorDia.data) : "—"}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#4C8C5C]">+{fmt(d.melhorDia.soma)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono text-[10px] text-[#A6432D]">Pior dia</div>
                        <div className="font-mono text-[8px] text-[#4a5a4a]">{d.piorDia.data && d.piorDia.soma<0 ? fd(d.piorDia.data) : "—"}</div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#A6432D]">{d.piorDia.soma<0?fmt(d.piorDia.soma):"—"}</span>
                    </div>
                  </div>
                </div>

                {d.diasOperados>=3 && (()=>{
                  const porDia={}; const nomesDom=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                  semanas.forEach(sem=>sem.dias.forEach(di=>{
                    if(di.tem&&di.soma!==0) {
                      const dw=di.date.getDay();
                      if(!porDia[dw]) porDia[dw]={soma:0,count:0,win:0};
                      porDia[dw].soma+=di.soma; porDia[dw].count++;
                      if(di.soma>0) porDia[dw].win++;
                    }
                  }));
                  const diasRank=Object.entries(porDia).map(([dw,v])=>({dw:Number(dw),soma:v.soma,wr:v.count>0?Math.round(v.win/v.count*100):0,count:v.count})).sort((a,b)=>b.soma-a.soma);
                  let maxDD=0, dd=0;
                  const bf=semanas.reduce((s,w)=>s+w.lucro,0)+cap;
                  let peak=cap;
                  semanas.forEach(sem=>sem.dias.forEach(di=>{if(di.tem){peak=Math.max(peak,di.base+di.soma);dd=peak-(di.base+di.soma);maxDD=Math.max(maxDD,dd);}}));
                  const consNeg=semanas.reduce((acc,sem)=>{sem.dias.forEach(di=>{if(di.tem){if(di.soma<0){acc.atual++;acc.max=Math.max(acc.max,acc.atual)}else{acc.atual=0;}}});return acc;},{atual:0,max:0});
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🧠 Inteligência</div>
                      <div className="font-mono text-[9px] text-[#4a5a4a] mb-2">Melhores dias da semana:</div>
                      <div className="space-y-1 mb-3">
                        {diasRank.map(({dw,soma,wr,count},i)=>(
                          <div key={dw} className="flex items-center justify-between">
                            <span className="font-mono text-[9px] text-[#6a7d6a]">{i===0?"⭐ ":"  "}{nomesDom[dw]} <span className="text-[#4a5a4a]">({count}x)</span></span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[8px] text-[#4a5a4a]">WR {wr}%</span>
                              <span className={`font-mono text-[9px] font-bold ${soma>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{soma>=0?"+":""}{fmt(soma)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📉 Max Drawdown</span>
                          <span className={`font-mono text-[10px] font-bold ${maxDD<=cap*0.05?"text-[#4C8C5C]":maxDD<=cap*0.15?"text-[#c6a15b]":"text-[#A6432D]"}`}>{fmt(maxDD)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🔴 Maior sequência negativa</span>
                          <span className="font-mono text-[10px] font-bold text-[#A6432D]">{consNeg.max} dias</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📈 Tendência</span>
                          <span className={`font-mono text-[10px] font-bold ${trajetoria.status==="ahead"?"text-[#4C8C5C]":trajetoria.status==="behind"?"text-[#A6432D]":"text-[#c6a15b]"}`}>
                            {trajetoria.status==="ahead"?"📈 Em alta":trajetoria.status==="behind"?"📉 Em queda":"➡️ Estável"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const todasOps = [];
                  Object.entries(operacoes).forEach(([k,ops]) => {
                    if(Array.isArray(ops)) ops.forEach(op => todasOps.push({...op, key:k}));
                  });
                  if(todasOps.length === 0) return null;
                  const totalOp = todasOps.length;
                  const greens = todasOps.filter(o=>o.resultado>0);
                  const reds = todasOps.filter(o=>o.resultado<0);
                  const mediaOp = totalOp>0 ? todasOps.reduce((s,o)=>s+o.resultado,0)/totalOp : 0;
                  const maiorGreen = greens.length>0 ? greens.reduce((a,b)=>b.resultado>a.resultado?b:a) : null;
                  const maiorRed = reds.length>0 ? reds.reduce((a,b)=>b.resultado<a.resultado?b:a) : null;
                  const porEst = {};
                  todasOps.forEach(o => {
                    const e = normEstrategia(o.estrategia)||"Sem nome";
                    if(!porEst[e]) porEst[e]={lucro:0,count:0,greens:0};
                    porEst[e].lucro+=o.resultado; porEst[e].count++;
                    if(o.resultado>0) porEst[e].greens++;
                  });
                  const estRank = Object.entries(porEst).sort((a,b)=>b[1].lucro-a[1].lucro);
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📊 Análise por Operação</div>
                      <div className="grid grid-cols-3 gap-2 mb-3 pb-2 border-b border-[#1e3228]">
                        <div className="text-center"><div className="text-[8px] text-[#6a7d6a] font-mono">Total Ops</div><div className="font-mono text-sm font-bold">{totalOp}</div></div>
                        <div className="text-center"><div className="text-[8px] text-[#4C8C5C] font-mono">Greens</div><div className="font-mono text-sm font-bold text-[#4C8C5C]">{greens.length}</div></div>
                        <div className="text-center"><div className="text-[8px] text-[#A6432D] font-mono">Reds</div><div className="font-mono text-sm font-bold text-[#A6432D]">{reds.length}</div></div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center"><span className="font-mono text-[9px] text-[#6a7d6a]">Lucro médio/op</span><span className={`font-mono text-[10px] font-bold ${mediaOp>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{mediaOp>=0?"+":""}{fmt(mediaOp)}</span></div>
                        {maiorGreen && <div className="flex justify-between items-center"><span className="font-mono text-[9px] text-[#4C8C5C]">Maior Green</span><span className="font-mono text-[10px] font-bold text-[#4C8C5C]">+{fmt(maiorGreen.resultado)} <span className="text-[#4a5a4a]">{maiorGreen.estrategia||"—"}</span></span></div>}
                        {maiorRed && <div className="flex justify-between items-center"><span className="font-mono text-[9px] text-[#A6432D]">Maior Red</span><span className="font-mono text-[10px] font-bold text-[#A6432D]">{fmt(maiorRed.resultado)} <span className="text-[#4a5a4a]">{maiorRed.estrategia||"—"}</span></span></div>}
                      </div>
                      {estRank.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#1e3228]">
                          <div className="font-mono text-[9px] text-[#4a5a4a] uppercase mb-1">Lucro por estratégia</div>
                          <div className="space-y-1">
                            {estRank.map(([nome,dados],i)=>(
                              <div key={nome} className="flex items-center justify-between">
                                <span className="font-mono text-[9px] text-[#6a7d6a]">{i===0?"⭐ ":"  "}{nome} <span className="text-[#4a5a4a]">({dados.count}x, {dados.count>0?Math.round(dados.greens/dados.count*100):0}% WR)</span></span>
                                <span className={`font-mono text-[9px] font-bold ${dados.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{dados.lucro>=0?"+":""}{fmt(dados.lucro)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {ciclos.length>=2 && (()=>{
                  const ciclosComp=ciclos.filter(c=>c.resultados).map(c=>({
                    id:c.id,nome:c.nome,cap:c.cap,
                    lucro:c.resultados.totalLucro,wr:c.resultados.winRate,
                    bancaFim:c.resultados.bancaFinal,saque:c.resultados.totalSaque,
                    dias:c.resultados.diasOperados,status:c.status
                  })).sort((a,b)=>b.lucro-a.lucro);
                  if(ciclosComp.length<2) return null;
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🔄 Comparação de Ciclos</div>
                      <div className="overflow-x-auto">
                        <table className="w-full font-mono text-[9px]">
                          <thead>
                            <tr className="border-b border-[#1e3228]">
                              <th className="text-left py-1 text-[#6a7d6a]">Ciclo</th>
                              <th className="text-right py-1 text-[#6a7d6a]">Lucro</th>
                              <th className="text-right py-1 text-[#6a7d6a]">WR%</th>
                              <th className="text-right py-1 text-[#6a7d6a]">Banca</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ciclosComp.map((c,i)=>(
                              <tr key={c.id} className="border-b border-[#14241c]">
                                <td className="py-1">
                                  <span className="text-[#e8e0cc]">{c.nome}</span>
                                  <span className="text-[#4a5a4a] ml-1">{c.status==="encerrado"?"🔒":"🟢"}</span>
                                </td>
                                <td className={`text-right font-bold ${c.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{c.lucro>=0?"+":""}{fmt(c.lucro)}</td>
                                <td className="text-right" style={{color:c.wr>=60?"#4C8C5C":c.wr>=40?"#c6a15b":"#A6432D"}}>{c.wr}%</td>
                                <td className="text-right text-[#e8e0cc]">{fmt(c.bancaFim)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {ciclosComp.length>=2 && (
                        <div className="mt-2 pt-2 border-t border-[#1e3228]">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9px] text-[#6a7d6a]">Melhor ciclo</span>
                            <span className="font-mono text-[10px] font-bold text-[#4C8C5C]">{ciclosComp[0].nome} (+{fmt(ciclosComp[0].lucro)})</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-mono text-[9px] text-[#6a7d6a]">Lucro total acumulado</span>
                            <span className={`font-mono text-[10px] font-bold ${ciclosComp.reduce((s,c)=>s+c.lucro,0)>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{ciclosComp.reduce((s,c)=>s+c.lucro,0)>=0?"+":""}{fmt(ciclosComp.reduce((s,c)=>s+c.lucro,0))}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-mono text-[9px] text-[#6a7d6a]">WR médio</span>
                            <span className="font-mono text-[10px] font-bold text-[#c6a15b]">{Math.round(ciclosComp.reduce((s,c)=>s+c.wr,0)/ciclosComp.length)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {d.diasOperados>=3 && (()=>{
                  let diasFechados=0, diasComDados=0, diasComLucro=0;
                  const todasEntradas=[];
                  semanas.forEach(sem=>sem.dias.forEach(di=>{if(di.tem){diasComDados++;if(di.soma!==0) diasFechados++;if(di.soma>0) diasComLucro++;todasEntradas.push(di.soma);}}));
                  const disciplinaScore=diasComDados>0?Math.min(100,Math.round((diasFechados/diasComDados)*100+(d.winRate>=50?10:0)+(trajetoria.status==="ahead"?10:trajetoria.status==="on_track"?5:-5))):0;
                  const media=todasEntradas.length>0?todasEntradas.reduce((s,v)=>s+v,0)/todasEntradas.length:0;
                  const variancia=todasEntradas.length>0?todasEntradas.reduce((s,v)=>s+Math.pow(v-media,2),0)/todasEntradas.length:0;
                  const desvio=Math.sqrt(variancia);
                  const consistencia=media!==0?Math.max(0,Math.min(100,Math.round(100-desvio/Math.abs(media)*50))):0;
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📏 Índice de Disciplina</div>
                      <div className="text-center mb-3">
                        <div className="font-mono text-3xl font-bold" style={{color:disciplinaScore>=70?"#4C8C5C":disciplinaScore>=40?"#c6a15b":"#A6432D"}}>{disciplinaScore}<span className="text-sm">%</span></div>
                        <div className="font-mono text-[10px] font-bold" style={{color:disciplinaScore>=80?"#4C8C5C":disciplinaScore>=60?"#c6a15b":disciplinaScore>=40?"#f59e0b":"#A6432D"}}>{disciplinaScore>=80?"Excelente":disciplinaScore>=60?"Bom":disciplinaScore>=40?"Regular":"Precisa melhorar"}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📅 Dias fechados</span>
                          <span className="font-mono text-[10px]">{diasFechados}/{diasComDados}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🎯 Win Rate</span>
                          <span className="font-mono text-[10px]" style={{color:d.winRate>=60?"#4C8C5C":d.winRate>=40?"#c6a15b":"#A6432D"}}>{d.winRate}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📏 Consistência</span>
                          <span className="font-mono text-[10px]" style={{color:consistencia>=60?"#4C8C5C":consistencia>=30?"#c6a15b":"#A6432D"}}>{consistencia}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📈 Trajetória</span>
                          <span className="font-mono text-[10px]" style={{color:trajetoria.cor}}>{trajetoria.status==="ahead"?"Acima":trajetoria.status==="behind"?"Abaixo":"No plano"}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#1e3228]">
                        <div className="bar-container"><div className="bar-fill" style={{width:`${disciplinaScore}%`,background:disciplinaScore>=70?"#4C8C5C":disciplinaScore>=40?"#c6a15b":"#A6432D"}}></div></div>
                      </div>
                    </div>
                  );
                })()}

                {d.diasOperados>=3 && (()=>{
                  const ciclosEnc=ciclos.filter(c=>c.resultados);
                  const totalInvestido=ciclos.reduce((s,c)=>s+c.cap,0);
                  const totalLucroGeral=ciclosEnc.reduce((s,c)=>s+(c.resultados?.totalLucro||0),0);
                  const totalSaqueGeral=ciclosEnc.reduce((s,c)=>s+(c.resultados?.totalSaque||0),0);
                  const bancaAtual=trajetoria.totalLucro+cap;
                  const totalSaqEmerg=movimentacoes.filter(m=>m.tipo==="saque_emergencial").reduce((s,m)=>s+m.valor,0);
                  const totalDepositos=movimentacoes.filter(m=>m.tipo==="deposito").reduce((s,m)=>s+m.valor,0);
                  const patrimonioLiquido=bancaAtual+totalSaqueGeral;
                  const roi=totalInvestido>0?((totalLucroGeral/totalInvestido)*100).toFixed(1):0;
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💼 Patrimônio</div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">💰 Banca atual</span>
                          <span className="font-mono text-[11px] font-bold text-[#e8e0cc]">{fmt(bancaAtual)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🏦 Total investido</span>
                          <span className="font-mono text-[11px] font-bold text-[#c6a15b]">{fmt(totalInvestido)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">💸 Total sacado</span>
                          <span className="font-mono text-[11px] font-bold text-[#4C8C5C]">{fmt(totalSaqueGeral)}</span>
                        </div>
                        {totalSaqEmerg>0 && <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🚨 Saque emergencial</span>
                          <span className="font-mono text-[11px] font-bold text-[#A6432D]">−{fmt(totalSaqEmerg)}</span>
                        </div>}
                        {totalDepositos>0 && <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🏦 Depósitos</span>
                          <span className="font-mono text-[11px] font-bold text-[#4C8C5C]">+{fmt(totalDepositos)}</span>
                        </div>}
                        <div className="border-t border-[#1e3228] my-1"></div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📊 Lucro acumulado</span>
                          <span className={`font-mono text-[11px] font-bold ${totalLucroGeral>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{totalLucroGeral>=0?"+":""}{fmt(totalLucroGeral)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">📈 Patrimônio líquido</span>
                          <span className={`font-mono text-[11px] font-bold ${patrimonioLiquido>=totalInvestido?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{fmt(patrimonioLiquido)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] text-[#6a7d6a]">🎯 ROI</span>
                          <span className={`font-mono text-[11px] font-bold ${Number(roi)>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{roi}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {d.diasOperados>=3 && (()=>{
                  const sugestoes=[];
                  if(d.winRate<50) sugestoes.push({ico:"⚠️",txt:"Win rate abaixo de 50%. Considere revisar seu método de seleção de entradas.",cor:"#A6432D"});
                  else if(d.winRate>=70) sugestoes.push({ico:"⭐",txt:`Win rate de ${d.winRate}% — excelente! Mantenha a disciplina.`,cor:"#4C8C5C"});
                  if(trajetoria.status==="behind") sugestoes.push({ico:"📉",txt:`A ${fmt(Math.abs(trajetoria.diff))} abaixo do plano. Considere reduzir posições ou aumentar win rate.`,cor:"#c6a15b"});
                  if(d.totalSaque>cap*0.2) sugestoes.push({ico:"💸",txt:"Saques altos (>20% do capital). Considere reinvestir parte para crescer a banca.",cor:"#c6a15b"});
                  if(d.seqAtual>=3) sugestoes.push({ico:"🔥",txt:`Sequência de ${d.seqAtual} dias positivos. Aproveite o momento!`,cor:"#4C8C5C"});
                  const diaStats={};
                  for(const sem of semanas) {
                    for(const d2 of sem.dias) {
                      if(!d2.tem || d2.soma===0) continue;
                      const nome=d2.label;
                      if(!diaStats[nome]) diaStats[nome]={total:0,count:0,positivos:0};
                      diaStats[nome].total+=d2.soma;
                      diaStats[nome].count++;
                      if(d2.soma>0) diaStats[nome].positivos++;
                    }
                  }
                  const diasOrdenados=Object.entries(diaStats).sort((a,b)=>b[1].total-a[1].total);
                  if(diasOrdenados.length>=2) {
                    const [melhorDiaNome,melhorDiaDados]=diasOrdenados[0];
                    const [piorDiaNome,piorDiaDados]=diasOrdenados[diasOrdenados.length-1];
                    if(melhorDiaDados.count>=2) sugestoes.push({ico:"🏆",txt:`Você lucra mais nas ${melhorDiaNome}s (média ${fmt(melhorDiaDados.total/melhorDiaDados.count)}/dia).`,cor:"#4C8C5C"});
                    if(piorDiaDados.count>=2 && piorDiaDados.total<0) {
                      const pctPrej=Math.round((piorDiaDados.count-piorDiaDados.positivos)/piorDiaDados.count*100);
                      sugestoes.push({ico:"⚠️",txt:`${pctPrej}% dos ${piorDiaNome}s tiveram prejuízo. Considere não operar neste dia.`,cor:"#A6432D"});
                    }
                  }
                  const mediaDiaria=d.totalLucro/Math.max(1,d.diasOperados);
                  const mediaPlanejada=cap*(cicloCfg?.tiers||TIERS_PADRAO)[0].taxa;
                  if(d.diasOperados>=5 && mediaDiaria>mediaPlanejada) sugestoes.push({ico:"🎯",txt:`Sua média diária (${fmt(mediaDiaria)}) está acima do planejado (${fmt(mediaPlanejada)}).`,cor:"#4C8C5C"});
                  const diasNoEspeho=semanas.filter(sem=>sem.dias.some(dd=>dd.tem)).length;
                  const diasFechadosCount=Object.keys(fechados).length;
                  if(diasFechadosCount>=5 && diasFechadosCount===d.diasOperados) sugestoes.push({ico:"✅",txt:"Está seguindo o espelho corretamente. Todos os dias foram registrados!",cor:"#4C8C5C"});
                  const ciclosEnc2=ciclos.filter(c=>c.resultados);
                  if(ciclos.length>=3 && ciclosEnc2.length>=2) {
                    const tendencia=ciclosEnc2[ciclosEnc2.length-1].resultados.totalLucro>ciclosEnc2[ciclosEnc2.length-2].resultados.totalLucro;
                    if(tendencia) sugestoes.push({ico:"📈",txt:"Lucro em tendência de alta entre ciclos. Continue no caminho!",cor:"#4C8C5C"});
                    else sugestoes.push({ico:"📉",txt:"Lucro em tendência de baixa entre ciclos. Revise sua estratégia.",cor:"#A6432D"});
                  }
                  if(totalSaqEmerg>0) sugestoes.push({ico:"🚨",txt:`Você fez ${fmt(totalSaqEmerg)} em saques emergenciais. Tente construir uma reserva para evitar isso.`,cor:"#A6432D"});
                  if(trajetoria.status==="ahead") sugestoes.push({ico:"🚀",txt:`À frente do plano em ${fmt(trajetoria.diff)}. Continue assim!`,cor:"#4C8C5C"});
                  if(sugestoes.length===0) sugestoes.push({ico:"💡",txt:"Continue operando para gerar sugestões personalizadas.",cor:"#6a7d6a"});
                  return (
                    <div className="card mb-3">
                      <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💡 Sugestões Inteligentes</div>
                      <div className="space-y-2">
                        {sugestoes.slice(0,6).map((s,i)=>(
                          <div key={i} className="flex items-start gap-2 bg-[#0f1f17] rounded px-2.5 py-2">
                            <span className="text-[11px] mt-0.5">{s.ico}</span>
                            <span className="font-mono text-[9px] leading-relaxed" style={{color:s.cor}}>{s.txt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📊 Desempenho</div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-[9px] text-[#6a7d6a]">Win Rate</span>
                        <span className="font-mono text-[10px] font-bold" style={{color:d.winRate>=60?"#4C8C5C":d.winRate>=40?"#c6a15b":"#A6432D"}}>{d.winRate}%</span>
                      </div>
                      <div className="bar-container"><div className="bar-fill" style={{width:`${d.winRate}%`,background:d.winRate>=60?"#4C8C5C":d.winRate>=40?"#c6a15b":"#A6432D"}}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-[9px] text-[#6a7d6a]">Meta Banca ({fmt(d.bancaProj)})</span>
                        <span className="font-mono text-[10px] font-bold" style={{color:d.bancaFinal>=d.bancaProj?"#4C8C5C":"#c6a15b"}}>{d.bancaProj>0?Math.min(100,Math.round((d.bancaFinal/d.bancaProj)*100)):0}%</span>
                      </div>
                      <div className="bar-container"><div className="bar-fill" style={{width:`${d.bancaProj>0?Math.min(100,(d.bancaFinal/d.bancaProj)*100):0}%`,background:d.bancaFinal>=d.bancaProj?"#4C8C5C":"#c6a15b"}}></div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-[#0f1f17] rounded px-2 py-1.5 text-center">
                        <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Pior sequência</div>
                        <div className="font-mono text-[11px] font-bold text-[#A6432D]">{d.seqAtual} dias</div>
                      </div>
                      <div className="bg-[#0f1f17] rounded px-2 py-1.5 text-center">
                        <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Lucro médio/dia</div>
                        <div className={`font-mono text-[11px] font-bold ${d.diasOperados>0&&lucroTotalReal/d.diasOperados>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{d.diasOperados>0?fmt(lucroTotalReal/d.diasOperados):"—"}</div>
                      </div>
                      <div className="bg-[#0f1f17] rounded px-2 py-1.5 text-center">
                        <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Total Lucro</div>
                        <div className={`font-mono text-[11px] font-bold ${lucroTotalReal>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{lucroTotalReal>=0?"+":""}{fmt(lucroTotalReal)}</div>
                      </div>
                      <div className="bg-[#0f1f17] rounded px-2 py-1.5 text-center">
                        <div className="text-[8px] text-[#6a7d6a] font-mono uppercase">Total Saques</div>
                        <div className="font-mono text-[11px] font-bold text-[#c6a15b]">{fmt(d.totalSaque)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📈 Trajetória</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Banca atual</span>
                      <span className="font-mono text-[11px] font-bold">{fmt(trajetoria.totalLucro+cap)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Projeção atual</span>
                      <span className="font-mono text-[11px] font-bold" style={{color:trajetoria.cor}}>{fmt(trajetoria.trajBanca)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Plano original</span>
                      <span className="font-mono text-[11px] font-bold">{fmt(trajetoria.bancaProj)}</span>
                    </div>
                    <div className="border-t border-[#1e3228] my-1"></div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Lucro médio/dia</span>
                      <span className="font-mono text-[11px] font-bold">{fmt(trajetoria.lucroMedioDia)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Diferença vs plano</span>
                      <span className={`font-mono text-[11px] font-bold ${trajetoria.diff>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{trajetoria.diff>=0?"+":""}{fmt(trajetoria.diff)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Status</span>
                      <span className="font-mono text-[11px] font-bold" style={{color:trajetoria.cor}}>
                        {trajetoria.status==="sem_dados"?"⏳ Aguardando dados":trajetoria.status==="ahead"?"🟢 Acima do plano":trajetoria.status==="behind"?"🔴 Abaixo do plano":"🟡 No plano"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Dias restantes</span>
                      <span className="font-mono text-[11px] font-bold">{trajetoria.diasRestantes}</span>
                    </div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🎯 Cenários</div>
                  <div className="space-y-2">
                    {[
                      {label:"🔵 Conservador", data:cenarios.conservador, cor:"#3b82f6"},
                      {label:"🟡 Normal", data:cenarios.normal, cor:"#c6a15b"},
                      {label:"🟢 Otimista", data:cenarios.otimista, cor:"#22c55e"}
                    ].map(({label,data,cor})=>(
                      <div key={label} className="bg-[#0f1f17] rounded px-3 py-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px]" style={{color:cor}}>{label}</span>
                          <span className="font-mono text-[11px] font-bold" style={{color:cor}}>{fmt(data.bancaFim)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="font-mono text-[8px] text-[#4a5a4a]">Lucro: {fmt(data.lucroTotal)}</span>
                          <span className="font-mono text-[8px] text-[#4a5a4a]">Saque: {fmt(data.saqueTotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💰 Movimentações</div>
                  {movimentacoes.length>0 ? (
                    <div className="space-y-1 mb-2">
                      {movimentacoes.slice().reverse().slice(0,10).map((m,i)=>(
                        <div key={i} className="flex justify-between items-center py-1 border-b border-[#14241c] last:border-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px]">{m.tipo==="aporte"?"📥":m.tipo==="saque_emergencial"?"🚨":m.tipo==="deposito"?"🏦":"📤"}</span>
                            <span className="font-mono text-[9px] text-[#6a7d6a]">{m.data}</span>
                          </div>
                          <span className={`font-mono text-[10px] font-bold ${m.tipo==="aporte"||m.tipo==="deposito"?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{m.tipo==="aporte"||m.tipo==="deposito"?"+":"−"}{fmt(m.valor)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="font-mono text-[9px] text-[#4a5a4a] text-center py-2">Nenhuma movimentação</div>
                  )}
                  <button onClick={()=>setShowNovaMov(true)} className="btn-secondary w-full text-[10px] py-2">+ Nova Movimentação</button>
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={()=>setShowSaqEmerg(true)} className="btn-secondary flex-1 text-[9px] py-1.5" style={{borderColor:"#A6432D",color:"#A6432D"}}>🚨 Saque Emergencial</button>
                    <button onClick={()=>setShowDeposito(true)} className="btn-secondary flex-1 text-[9px] py-1.5" style={{borderColor:"#4C8C5C",color:"#4C8C5C"}}>🏦 Depósito</button>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🔒 Verificação de Banca</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Saldo calculado</span>
                      <span className="font-mono text-[11px] font-bold">{fmt(saldoCalc)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Saldo real</span>
                      <span className="font-mono text-[11px] font-bold">{fmt(saldoReal)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#1e3228] pt-2">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Diferença</span>
                      <span className={`font-mono text-[11px] font-bold ${Math.abs(saldoCalc-saldoReal)<0.01?"text-[#4C8C5C]":"text-[#A6432D]"}`}>
                        {Math.abs(saldoCalc-saldoReal)<0.01?"✅ OK":fmt(saldoCalc-saldoReal)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💰 Stake fixa</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#6a7d6a]">Valor da stake</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-[#6a7d6a]">R$</span>
                        <input type="text" inputMode="decimal" value={inpStakeFixa}
                          onChange={e=>{
                            const r=e.target.value; setInpStakeFixa(r);
                            const n=Number(r.replace(",","."));
                            if(!isNaN(n)&&n>0) setStakeFixa(n);
                          }}
                          onBlur={()=>{ if(isFinite(stakeFixa)&&stakeFixa>0) setInpStakeFixa(stakeFixa.toFixed(2).replace(".",",")); }}
                          className="w-24 font-mono text-xs text-right bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1 text-[#e8e0cc]" />
                      </div>
                    </div>
                    <div className="font-mono text-[8px] text-[#6a7d6a]">Esse valor é preenchido automaticamente em toda nova operação. Você pode alterar manualmente em cada operação — e ao mudar aqui, as próximas operações passam a usar o novo valor.</div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">⚙️ Senha Admin</div>
                  <div className="flex gap-2">
                    <input type="password" placeholder={senhaAdmin?"••••••":"Definir senha"} value={inpSenha}
                      onChange={e=>setInpSenha(e.target.value)}
                      className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                    <button onClick={()=>{
                      if(!inpSenha){setSenhaAdmin("");setHistorico(p=>[...p,{tipo:"senha",data:Date.now()}]);return;}
                      setSenhaAdmin(inpSenha); setInpSenha("");
                      setHistorico(p=>[...p,{tipo:"senha",data:Date.now()}]);
                    }} className="btn-secondary py-1 px-3 text-[10px]">{senhaAdmin?"Alterar":"Salvar"}</button>
                    {senhaAdmin && <button onClick={()=>{setSenhaAdmin("");setInpSenha("");setHistorico(p=>[...p,{tipo:"remover_senha",data:Date.now()}]);}} className="btn-small text-[9px]">✕</button>}
                  </div>
                  {senhaAdmin && <div className="font-mono text-[8px] text-[#4C8C5C] mt-1">Senha ativa — dias fechados bloqueados</div>}
                </div>

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🔒 Segurança</div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-mono text-[10px] text-[#e8e0cc]">Bloqueio por PIN</div>
                      <div className="font-mono text-[8px] text-[#4a5a4a]">{pinCode?"Ativo — 4 dígitos":"Não configurado"}</div>
                    </div>
                    <button onClick={()=>{setShowPinSetup(true);setPinInput("");setPinConfirm("");setPinErro("");}} className="btn-secondary py-1 px-3 text-[10px]">{pinCode?"Alterar":"Configurar"}</button>
                  </div>
                </div>

                <div className="card mb-3">
                  <button onClick={()=>{
                    const lines=[["Data","Hora","Tipo","Detalhe"]];
                    historico.forEach(h=>{
                      const d=new Date(h.data);
                      const data=fd(d);
                      const hora=`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                      let tipo=h.tipo;
                      let det=h.k||"";
                      if(h.tipo==="entrada") det+=` slot ${h.slot} = ${h.val}`;
                      lines.push([data,hora,tipo,det]);
                    });
                    const csv=lines.map(l=>l.join(";")).join("\n");
                    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a"); a.href=url; a.download=`gestor_historico_${tISO(new Date())}.csv`; a.click();
                    URL.revokeObjectURL(url);
                  }} className="btn-secondary w-full text-[10px] py-2">
                    📥 Exportar histórico (CSV)
                  </button>
                </div>

                {historico.length > 0 && (
                  <div className="card mb-3">
                    <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📋 Histórico ({historico.length})</div>
                    <div style={{maxHeight:200,overflowY:"auto"}}>
                      {historico.slice().reverse().slice(0,50).map((h,i)=>{
                        const d=new Date(h.data);
                        const cor = h.tipo==="fechar"?"#f59e0b":h.tipo==="desfechar"?"#3b82f6":h.tipo==="entrada"?"#22c55e":h.tipo==="limpar"?"#ef4444":"#6a7d6a";
                        return (
                          <div key={i} className="flex justify-between items-center py-1 border-b border-[#14241c] last:border-0">
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{background:cor}}></span>
                              <span className="font-mono text-[9px] text-[#6a7d6a]">{fd(d)}</span>
                            </div>
                            <span className="font-mono text-[9px]" style={{color:cor}}>
                              {h.tipo==="fechar"?"🔒 Fechou":h.tipo==="desfechar"?"🔓 Abriu":h.tipo==="entrada"?"✏️ "+h.val:h.tipo==="limpar"?"🗑️ Limpo":h.tipo==="naoOperei"?"🚫 Não operei":h.tipo==="senha"?"🔑 Senha alterada":h.tipo}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="card mb-3">
                  <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💾 Backup & Restore</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[9px] text-[#6a7d6a]">☁️ Firestore</span>
                      <span className="font-mono text-[9px] text-[#4C8C5C]">Sincronizado</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[9px] text-[#6a7d6a]">📦 Ciclos</span>
                      <span className="font-mono text-[9px] text-[#e8e0cc]">{ciclos.length} ciclo(s)</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>{
                      const dados={versao:"7.3",data:tISO(new Date()),ciclos:ciclos,cicloAtivo:cicloAtivo};
                      const blob=new Blob([JSON.stringify(dados,null,2)],{type:"application/json"});
                      const url=URL.createObjectURL(blob);
                      const a=document.createElement("a"); a.href=url; a.download=`backup_gestor_${tISO(new Date())}.json`; a.click();
                      URL.revokeObjectURL(url);
                    }} className="btn-secondary flex-1 text-[10px] py-2">📥 Exportar JSON</button>
                    <label className="btn-secondary flex-1 text-[10px] py-2 text-center cursor-pointer">
                      📤 Importar JSON
                      <input type="file" accept=".json" className="hidden" onChange={e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const reader=new FileReader();
                        reader.onload=ev=>{
                          try {
                            const dados=JSON.parse(ev.target.result);
                            if(dados.ciclos && Array.isArray(dados.ciclos)) {
                              if(confirm(`Restaurar backup com ${dados.ciclos.length} ciclo(s)? Os dados atuais serão substituídos.`)){
                                setCiclos(dados.ciclos);
                                setCicloAtivo(dados.cicloAtivo||dados.ciclos[0]?.id||null);
                                const ativo=dados.ciclos.find(c=>c.id===(dados.cicloAtivo||dados.ciclos[0]?.id));
                                if(ativo){
                                  setCap(ativo.cap);setInpCap(String(ativo.cap));
                                  setDataIni(new Date(ativo.dataIni));setEnt(ativo.ent||{});
                                  setFechados(ativo.fechados||{});setSenhaAdmin(ativo.senha||"");
                                  setHistorico(ativo.historico||[]);setMovimentacoes(ativo.movimentacoes||[]);setSaquesConfirmados(ativo.saquesConfirmados||{});setOperacoes(ativo.operacoes||{});
                                }
                                alert("Backup restaurado com sucesso!");
                              }
                            } else {
                              alert("Arquivo inválido. Formato esperado: {ciclos: [...], cicloAtivo: \"id\"}");
                            }
                          } catch(err) { alert("Erro ao ler arquivo: "+err.message); }
                        };
                        reader.readAsText(file);
                        e.target.value="";
                      }} />
                    </label>
                  </div>
                  <button onClick={()=>{
                    if(confirm("Limpar dados locais e ressincronizar do Firestore?")){
                      try{["bc:ciclos","bc:cicloAtivo","bc:cap","bc:ini","bc:ent","bc:fech","bc:senha","bc:hist"].forEach(k=>localStorage.removeItem(k));}catch(e){}
                      window.location.reload();
                    }
                  }} className="btn-secondary w-full text-[10px] py-2 mt-1.5">🔄 Ressincronizar</button>
                </div>

                <div className="flex flex-col gap-2 mb-5">
                  <button onClick={()=>{
                    if(confirm("Resetar TODOS os dados e todos os ciclos?")){
                      setCap(200);setInpCap("200");const h=new Date();h.setHours(0,0,0);setDataIni(h);setEnt({});setFechados({});setSenhaAdmin("");setHistorico([]);setMovimentacoes([]);setOperacoes({});setSemAtual(null);setFocoDia(null);setCiclos([]);setCicloAtivo(null);
                      try{["bc:ciclos","bc:cicloAtivo","bc:cap","bc:ini","bc:ent","bc:fech","bc:senha","bc:hist"].forEach(k=>localStorage.removeItem(k));}catch(e){}
                      if(user) db.collection("dados").doc(user.uid).delete().catch(()=>{});}
                  }} className="btn-danger w-full text-[11px]">🗑️ Resetar tudo</button>
                </div>
              </>
            );
          })()}
        </>
      ))}

      {secao==="gestao" && sm && (
      <div className="flex justify-center mt-4">
        <span className="font-mono text-[8px] text-[#4a5a4a]">{(cicloCfg?.tiers||TIERS_PADRAO).map(t=>`${Math.round(t.taxa*100)}%`).join(" → ")} ao dia · saque {Math.round((cicloCfg?.saqPct||SAQ)*100)}%</span>
      </div>
      )}

      {secao==="gestao" && (totalSaqEmerg>0||totalDepositos>0) && (
        <div className="card mb-3" style={{padding:"8px 12px",borderColor:"#c6a15b",background:"#0f1f17"}}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] text-[#6a7d6a]">💰 Saldo Real</span>
            <span className="font-mono text-[12px] font-bold text-[#c6a15b]">{fmt(dashData.bancaFinal - totalSaqEmerg + totalDepositos)}</span>
          </div>
          <div className="flex gap-3 mt-0.5">
            {totalSaqEmerg>0 && <span className="font-mono text-[8px] text-[#A6432D]">🚨 Saques emerg: −{fmt(totalSaqEmerg)}</span>}
            {totalDepositos>0 && <span className="font-mono text-[8px] text-[#4C8C5C]">🏦 Depósitos: +{fmt(totalDepositos)}</span>}
          </div>
          <div className="font-mono text-[8px] text-[#4a5a4a] mt-0.5">Banca op.: {fmt(dashData.bancaFinal)} · Espelho inalterado</div>
        </div>
      )}

      {showNovoCiclo && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"92%",maxHeight:"85vh",overflowY:"auto",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>✨</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Novo Ciclo</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Nome</label>
                <input type="text" value={ncNome} onChange={e=>setNcNome(e.target.value)} placeholder={"Ciclo "+(ciclos.length+1)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Capital</label>
                  <div className="flex items-center gap-0.5 mt-1">
                    <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                    <input type="text" inputMode="decimal" value={ncCap} onChange={e=>setNcCap(e.target.value)}
                      className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Início</label>
                  <input type="date" value={ncIni} onChange={e=>setNcIni(e.target.value)}
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Saque a cada</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {[0,5,6,7,15,30].map(v=>(
                      <button key={v} onClick={()=>setNcSaqueIntervalo(v)} className="flex-1 py-1.5 font-mono text-[10px] rounded"
                        style={{background:ncSaqueIntervalo===v?"#c6a15b":"#14241c",color:ncSaqueIntervalo===v?"#0a1410":"#6a7d6a",border:"1px solid #1e3228",fontWeight:ncSaqueIntervalo===v?700:500}}>{v===0?"0 — sem saque":v+" dias"}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Saque %</label>
                  <div className="flex items-center gap-0.5 mt-1">
                    <input type="text" inputMode="decimal" value={ncSaq} onChange={e=>setNcSaq(e.target.value)}
                      className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                    <span className="font-mono text-[10px] text-[#6a7d6a]">%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Taxas por período</label>
                <div className="space-y-1.5 mt-1">
                  {ncTiers.map((t,i)=>(
                    <div key={i} className="flex items-center gap-1 bg-[#0f1f17] rounded px-2 py-1.5">
                      <input type="text" value={t.label} onChange={e=>{const n=[...ncTiers];n[i]={...n[i],label:e.target.value};setNcTiers(n);}}
                        className="w-16 font-mono text-[10px] text-[#e8e0cc] bg-transparent outline-none" placeholder="Label" />
                      <input type="text" inputMode="numeric" value={t.dias} onChange={e=>{const n=[...ncTiers];n[i]={...n[i],dias:Number(e.target.value)||0};setNcTiers(n);}}
                        className="w-10 font-mono text-[10px] text-[#e8e0cc] bg-transparent border-b border-[#1e3228] outline-none text-center" />
                      <span className="font-mono text-[8px] text-[#6a7d6a]">d</span>
                      <input type="text" inputMode="decimal" value={Math.round(t.taxa*100)} onChange={e=>{const n=[...ncTiers];n[i]={...n[i],taxa:(Number(e.target.value)||0)/100};setNcTiers(n);}}
                        className="w-10 font-mono text-[10px] text-[#c6a15b] bg-transparent border-b border-[#1e3228] outline-none text-center" />
                      <span className="font-mono text-[8px] text-[#6a7d6a]">%</span>
                      {ncTiers.length>1 && <button onClick={()=>setNcTiers(p=>p.filter((_,j)=>j!==i))} className="text-[10px] text-[#A6432D] ml-1" style={{background:"none",border:"none",cursor:"pointer"}}>✕</button>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setNcTiers(p=>[...p,{dias:30,taxa:0.03,label:"Período "+(p.length+1)}])}
                  className="btn-small mt-1.5 w-full text-[9px]">+ Adicionar período</button>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowNovoCiclo(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={criarNovoCiclo} className="btn-primary py-2" style={{flex:1.5}}>Criar Ciclo</button>
            </div>
          </div>
        </div>
      )}

      {showGerCiclo && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"92%",maxHeight:"85vh",overflowY:"auto",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>⚙</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Gerenciar Ciclos</div>
            </div>
            <div className="space-y-2">
              {ciclos.map(c=>{
                const r = resumoCiclo(c);
                return (
                <div key={c.id} className="bg-[#0f1f17] rounded px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-[#e8e0cc] font-bold">{c.nome}</div>
                      <div className="font-mono text-[9px] text-[#6a7d6a]">{fmt(c.cap)} · {c.tiers.length} tiers · {c.status==="encerrado"?"🔒 Encerrado":"● Ativo"}</div>
                      <div className="font-mono text-[8px] text-[#4a5a4a]">Início: {c.dataIni}{c.dataEncerramento?" · Fim: "+c.dataEncerramento:""} · {Object.keys(c.ent||{}).length} registros</div>
                      {r && (
                        <div className="font-mono text-[8px] text-[#4a5a4a] mt-0.5">
                          Dias: {r.diasOperados} · Lucro: <span className={r.totalLucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}>{r.totalLucro>=0?"+":""}{fmt(r.totalLucro)}</span> · Rent: <span className={r.rentabilidade>=0?"text-[#4C8C5C]":"text-[#A6432D]"}>{r.rentabilidade>=0?"+":""}{r.rentabilidade.toFixed(1)}%</span>
                        </div>
                      )}
                      {r && (
                        <div className="font-mono text-[8px] text-[#4a5a4a]">
                          Ops: {r.totalOps} (✓{r.greens} ✗{r.reds}) · Saques: {fmt(r.totalSaque)} · Acerto: {r.taxaAcerto}%
                        </div>
                      )}
                      {r && (r.totalDepositos>0||r.totalSaqEmerg>0) && (
                        <div className="font-mono text-[8px] text-[#4a5a4a]">
                          {r.totalSaqEmerg>0 && <span className="text-[#A6432D]">Emerg: {fmt(r.totalSaqEmerg)} </span>}
                          {r.totalDepositos>0 && <span className="text-[#4C8C5C]">Dep: {fmt(r.totalDepositos)}</span>}
                        </div>
                      )}
                    </div>
                    {c.id === cicloAtivo && <span className="font-mono text-[9px] text-[#4C8C5C] mr-2">● Ativo</span>}
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <button onClick={()=>{setShowGerCiclo(false);setHistCicloId(c.id);setShowHistoricoCiclo(true);}}
                      className="btn-small text-[8px]" style={{borderColor:"#c6a15b",color:"#c6a15b"}}>📜 Histórico</button>
                    <button onClick={()=>{setShowGerCiclo(false);abrirEditarCiclo(c.id);}}
                      className="btn-small text-[8px]">✏ Editar</button>
                    {c.status==="encerrado" ? (
                      <button onClick={()=>reabrirCiclo(c.id)}
                        className="btn-small text-[8px]" style={{borderColor:"#3b82f6",color:"#3b82f6"}}>🔓 Reabrir</button>
                    ) : c.id===cicloAtivo && (
                      <button onClick={()=>{setShowGerCiclo(false);setShowWizardEnc(true);}}
                        className="btn-small text-[8px]" style={{borderColor:"#f59e0b",color:"#f59e0b"}}>🔒 Encerrar</button>
                    )}
                    {c.resultados && (
                      <button onClick={()=>{setResultadoEnc(c.resultados);setShowEncerrarCiclo(true);setShowGerCiclo(false);}}
                        className="btn-small text-[8px]" style={{borderColor:"#22c55e",color:"#22c55e"}}>📊 Ver resultado</button>
                    )}
                    {ciclos.length > 1 && c.id !== cicloAtivo && c.status!=="encerrado" && (
                      <button onClick={()=>{if(confirm("Excluir ciclo "+c.nome+"?")) excluirCiclo(c.id);}}
                        className="btn-small text-[8px]" style={{borderColor:"#ef4444",color:"#ef4444"}}>✕ Excluir</button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowGerCiclo(false)} className="btn-secondary flex-1 py-2">Fechar</button>
              <button onClick={()=>{setShowGerCiclo(false);setShowNovoCiclo(true);}} className="btn-primary py-2" style={{flex:1}}>+ Novo</button>
            </div>
          </div>
        </div>
      )}

      {showWizardEnc && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"94%",padding:18,borderColor:"rgba(216,174,85,.35)",boxShadow:"0 28px 80px rgba(0,0,0,.55)"}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>🔒</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Encerrar Ciclo</div>
              <div className="font-mono text-[9px] text-[#6a7d6a] mt-0.5">Confirme os valores finais do ciclo</div>
            </div>
            <div className="space-y-3">
              <div className="bg-[#0f1f17] rounded px-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] text-[#6a7d6a]">📊 Banca calculada (espelho)</span>
                  <span className="font-mono text-[10px] text-[#c6a15b]">{fmt(semanas.length>0?semanas[semanas.length-1].prox:cap)}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="font-mono text-[9px] text-[#6a7d6a]">💸 Saque semanal total</span>
                  <span className="font-mono text-[10px] text-[#A6432D]">{fmt(totalSaq)}</span>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Saldo Final (real)</label>
                <input type="text" inputMode="decimal" value={encSaldoFinal} onChange={e=>setEncSaldoFinal(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1"
                  placeholder={fmt(semanas.length>0?semanas[semanas.length-1].prox:cap).replace("R$ ","")} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Valor Sacado</label>
                <input type="text" inputMode="decimal" value={encValorSacado} onChange={e=>setEncValorSacado(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1"
                  placeholder={fmt(totalSaq).replace("R$ ","")} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Valor que Permanece na Banca</label>
                <input type="text" inputMode="decimal" value={encValorPermanece} onChange={e=>setEncValorPermanece(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1"
                  placeholder="Será a banca do próximo ciclo" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setShowWizardEnc(false);setEncSaldoFinal("");setEncValorSacado("");setEncValorPermanece("");}} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={encerrarCiclo} className="btn-primary py-2" style={{flex:1.5}}>🔒 Encerrar</button>
            </div>
          </div>
        </div>
      )}

      {showEncerrarCiclo && resultadoEnc && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:340,width:"92%",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:24}}>🏆</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Resultado do Ciclo</div>
              <div className="font-mono text-[9px] text-[#6a7d6a]">Encerrado em {resultadoEnc.dataEncerramento}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#122a1a] rounded px-3 py-2">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Banca Final</span>
                <span className="font-mono text-sm font-bold text-[#4C8C5C]">{fmt(resultadoEnc.bancaFinal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Lucro Total</span>
                <span className={`font-mono text-xs font-bold ${resultadoEnc.totalLucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{resultadoEnc.totalLucro>=0?"+":""}{fmt(resultadoEnc.totalLucro)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Saque Total</span>
                <span className="font-mono text-xs font-bold text-[#c6a15b]">{fmt(resultadoEnc.totalSaque)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Win Rate</span>
                <span className={`font-mono text-xs font-bold ${resultadoEnc.winRate>=60?"text-[#4C8C5C]":resultadoEnc.winRate>=40?"text-[#c6a15b]":"text-[#A6432D]"}`}>{resultadoEnc.winRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Dias Operados</span>
                <span className="font-mono text-xs font-bold">{resultadoEnc.diasOperados}</span>
              </div>
              <div className="border-t border-[#1e3228] my-1"></div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#4C8C5C]">Melhor dia</span>
                <span className="font-mono text-[10px] text-[#4C8C5C]">+{fmt(resultadoEnc.melhorDia.soma)} <span className="text-[#4a5a4a]">{resultadoEnc.melhorDia.data}</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#A6432D]">Pior dia</span>
                <span className="font-mono text-[10px] text-[#A6432D]">{fmt(resultadoEnc.piorDia.soma)} <span className="text-[#4a5a4a]">{resultadoEnc.piorDia.data}</span></span>
              </div>
              {resultadoEnc.totalSaqEmerg>0 && <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#A6432D]">🚨 Saques Emergenciais</span>
                <span className="font-mono text-[10px] text-[#A6432D]">−{fmt(resultadoEnc.totalSaqEmerg)}</span>
              </div>}
              {resultadoEnc.totalDepositos>0 && <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#4C8C5C]">🏦 Depósitos</span>
                <span className="font-mono text-[10px] text-[#4C8C5C]">+{fmt(resultadoEnc.totalDepositos)}</span>
              </div>}
              {resultadoEnc.valorPermanece!=null && <div className="border-t border-[#1e3228] my-1"></div>}
              {resultadoEnc.valorPermanece!=null && <div className="flex justify-between items-center bg-[#14241c] rounded px-3 py-2">
                <span className="font-mono text-[10px] text-[#c6a15b]">💰 Próxima Banca</span>
                <span className="font-mono text-sm font-bold text-[#c6a15b]">{fmt(resultadoEnc.valorPermanece)}</span>
              </div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setShowEncerrarCiclo(false);setResultadoEnc(null);}} className="btn-secondary flex-1 py-2">Fechar</button>
              <button onClick={criarNovoCicloAposEncerramento} className="btn-primary py-2" style={{flex:1.5}}>🔄 Criar Próximo Ciclo</button>
            </div>
          </div>
        </div>
      )}

      {showEditarCiclo && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"92%",maxHeight:"85vh",overflowY:"auto",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>✏</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Editar Ciclo</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Nome</label>
                <input type="text" value={ecNome} onChange={e=>setEcNome(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
              </div>
              <div className="flex gap-2">
                
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Saque a cada</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {[0,5,6,7,15,30].map(v=>(
                      <button key={v} onClick={()=>setEcSaqueIntervalo(v)} className="flex-1 py-1.5 font-mono text-[10px] rounded"
                        style={{background:ecSaqueIntervalo===v?"#c6a15b":"#14241c",color:ecSaqueIntervalo===v?"#0a1410":"#6a7d6a",border:"1px solid #1e3228",fontWeight:ecSaqueIntervalo===v?700:500}}>{v===0?"0 — sem saque":v+" dias"}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Saque %</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <input type="text" inputMode="decimal" value={ecSaq} onChange={e=>setEcSaq(e.target.value)}
                    className="w-20 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                  <span className="font-mono text-[10px] text-[#6a7d6a]">%</span>
                </div>
              </div>
              
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Taxas por período</label>
                <div className="space-y-1.5 mt-1">
                  {ecTiers.map((t,i)=>(
                    <div key={i} className="flex items-center gap-1 bg-[#0f1f17] rounded px-2 py-1.5">
                      <input type="text" value={t.label} onChange={e=>{const n=[...ecTiers];n[i]={...n[i],label:e.target.value};setEcTiers(n);}}
                        className="w-16 font-mono text-[10px] text-[#e8e0cc] bg-transparent outline-none" placeholder="Label" />
                      <input type="text" inputMode="numeric" value={t.dias} onChange={e=>{const n=[...ecTiers];n[i]={...n[i],dias:Number(e.target.value)||0};setEcTiers(n);}}
                        className="w-10 font-mono text-[10px] text-[#e8e0cc] bg-transparent border-b border-[#1e3228] outline-none text-center" />
                      <span className="font-mono text-[8px] text-[#6a7d6a]">d</span>
                      <input type="text" inputMode="decimal" value={Math.round(t.taxa*100)} onChange={e=>{const n=[...ecTiers];n[i]={...n[i],taxa:(Number(e.target.value)||0)/100};setEcTiers(n);}}
                        className="w-10 font-mono text-[10px] text-[#c6a15b] bg-transparent border-b border-[#1e3228] outline-none text-center" />
                      <span className="font-mono text-[8px] text-[#6a7d6a]">%</span>
                      {ecTiers.length>1 && <button onClick={()=>setEcTiers(p=>p.filter((_,j)=>j!==i))} className="text-[10px] text-[#A6432D] ml-1" style={{background:"none",border:"none",cursor:"pointer"}}>✕</button>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setEcTiers(p=>[...p,{dias:30,taxa:0.03,label:"Período "+(p.length+1)}])}
                  className="btn-small mt-1.5 w-full text-[9px]">+ Adicionar período</button>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowEditarCiclo(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={salvarEditarCiclo} className="btn-primary py-2" style={{flex:1.5}}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showNovaMov && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:350,width:"94%",padding:18,borderColor:"rgba(216,174,85,.35)",boxShadow:"0 28px 80px rgba(0,0,0,.55)"}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>💰</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Nova Movimentação</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Tipo</label>
                <div className="flex gap-2 mt-1">
                  {[{k:"aporte",l:"📥 Aporte",c:"#4C8C5C"},{k:"retirada",l:"📤 Retirada",c:"#A6432D"}].map(({k,l,c})=>(
                    <button key={k} onClick={()=>setMovTipo(k)} className="flex-1 py-2 font-mono text-xs rounded transition-all"
                      style={{background:movTipo===k?"#14241c":"transparent",color:movTipo===k?c:"#6a7d6a",border:movTipo===k?`1px solid ${c}`:"1px solid #1e3228",fontWeight:movTipo===k?700:500}}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Valor</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                  <input type="text" inputMode="decimal" value={movValor} onChange={e=>setMovValor(e.target.value)}
                    className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" placeholder="0,00" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Nota (opcional)</label>
                <input type="text" value={movNota} onChange={e=>setMovNota(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" placeholder="Ex: Lucro reinvestido..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowNovaMov(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={registrarMovimentacao} className="btn-primary py-2" style={{flex:1.5}}>
                {movTipo==="aporte"?"📥 Adicionar":"📤 Retirar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaqEmerg && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:320,width:"92%",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>🚨</span>
              <div className="font-mono text-sm text-[#A6432D] mt-1 font-bold">Saque Emergencial</div>
              <div className="font-mono text-[9px] text-[#6a7d6a] mt-0.5">Valor será deduzido diretamente da banca</div>
              <div className="font-mono text-[9px] text-[#c6a15b] mt-0.5">Banca atual: {fmt(cap)}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Valor</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                  <input type="text" inputMode="decimal" value={saqEmergValor} onChange={e=>setSaqEmergValor(e.target.value)}
                    className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#A6432D] rounded px-2 py-1.5 outline-none focus:border-[#A6432D]" placeholder="0,00" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Motivo</label>
                <input type="text" value={saqEmergNota} onChange={e=>setSaqEmergNota(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" placeholder="Ex: Emergência pessoal..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowSaqEmerg(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={registrarSaqueEmergencial} className="btn-primary py-2" style={{flex:1.5,background:"#A6432D",borderColor:"#A6432D"}}>🚨 Confirmar Saque</button>
            </div>
          </div>
        </div>
      )}

      {showDeposito && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:320,width:"92%",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>🏦</span>
              <div className="font-mono text-sm text-[#4C8C5C] mt-1 font-bold">Depósito</div>
              <div className="font-mono text-[9px] text-[#6a7d6a] mt-0.5">Adicionar valor à banca (reposição)</div>
              <div className="font-mono text-[9px] text-[#c6a15b] mt-0.5">Banca atual: {fmt(cap)}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Valor</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                  <input type="text" inputMode="decimal" value={depValor} onChange={e=>setDepValor(e.target.value)}
                    className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#4C8C5C] rounded px-2 py-1.5 outline-none focus:border-[#4C8C5C]" placeholder="0,00" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Nota (opcional)</label>
                <input type="text" value={depNota} onChange={e=>setDepNota(e.target.value)}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" placeholder="Ex: Repor saque emergencial..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowDeposito(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={registrarDeposito} className="btn-primary py-2" style={{flex:1.5,background:"#4C8C5C",borderColor:"#4C8C5C"}}>🏦 Confirmar Depósito</button>
            </div>
          </div>
        </div>
      )}

      {showModalSenha && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:300,width:"90%",padding:20}}>
            <div className="text-center mb-3">
              <span style={{fontSize:24}}>🔒</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-2 font-bold">Dia fechado</div>
              <div className="font-mono text-[10px] text-[#6a7d6a] mt-1">Digite a senha admin para editar</div>
            </div>
            {senhaErro && <div className="alerta mb-2"><span className="text-xs">{senhaErro}</span></div>}
            <input type="password" placeholder="Senha" value={inpSenha}
              onChange={e=>{setInpSenha(e.target.value);setSenhaErro("");}}
              onKeyDown={e=>{if(e.key==="Enter")confirmarSenha();if(e.key==="Escape")setShowModalSenha(false);}}
              className="w-full font-mono text-sm text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-3 py-2 outline-none focus:border-[#c6a15b] mb-3" autoFocus />
            <div className="flex gap-2">
              <button onClick={()=>setShowModalSenha(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={confirmarSenha} className="btn-primary py-2" style={{flex:1.5}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showGerEstrategias && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"92%",maxHeight:"85vh",overflowY:"auto",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>📋</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Gerenciar Estratégias</div>
            </div>
            <div className="mb-2">
              <input type="text" value={novaEstrategia} list="dl-ger-estrategias" onChange={e=>{setNovaEstrategia(e.target.value);setEstratMsg("")}}
                onKeyDown={e=>{if(e.key==="Enter"){const ok=adicionarEstrategia(novaEstrategia);if(ok)setNovaEstrategia("");}}}
                placeholder="Digite o nome da nova estratégia"
                className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#c6a15b] rounded px-3 py-2 outline-none focus:border-[#c6a15b]" />
              <datalist id="dl-ger-estrategias">
                {sugestoesLista(estrategias,novaEstrategia,10).map(e=><option key={e.id} value={e.nome} />)}
              </datalist>
              <button onClick={()=>{const ok=adicionarEstrategia(novaEstrategia);if(ok)setNovaEstrategia("");}} className="btn-primary w-full mt-2 py-2">＋ Adicionar estratégia</button>
              {estratMsg&&<div className="font-mono text-[8px] mt-1 text-[#4C8C5C]">{estratMsg}</div>}
            </div>
            <input type="text" value={estrBusca} onChange={e=>setEstrBusca(e.target.value)} placeholder="🔍 Pesquisar estratégia"
              className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mb-2" />
            <div className="space-y-2">
              {estrategias.filter(e=>!estrBusca||e.nome.toLowerCase().includes(estrBusca.toLowerCase())).map(e=>{
                const uso=usoEstrategia(e.nome);
                return (
                  <div key={e.id} className="bg-[#0f1f17] rounded px-3 py-2">
                    {editEstr && editEstr.id===e.id ? (
                      <div className="flex gap-1">
                        <input type="text" defaultValue={e.nome} ref={el=>{if(el)el.focus();}}
                          onChange={ev=>setEditEstr({...editEstr,nome:ev.target.value})}
                          onKeyDown={ev=>{if(ev.key==="Enter"){salvarEstratEdit(e.id,editEstr.nome);setEditEstr(null);}if(ev.key==="Escape")setEditEstr(null);}}
                          className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1 outline-none focus:border-[#c6a15b]" />
                        <button onClick={()=>{salvarEstratEdit(e.id,editEstr.nome);setEditEstr(null);}} className="btn-small text-[9px]" style={{borderColor:"#4C8C5C",color:"#4C8C5C"}}>Salvar</button>
                        <button onClick={()=>setEditEstr(null)} className="btn-small text-[9px]">✕</button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[#e8e0cc] font-bold">{e.nome}</span>
                          <span className={`font-mono text-[8px] ${e.ativa?"text-[#4C8C5C]":"text-[#6a7d6a]"}`}>{e.ativa?"● Ativa":"○ Desativada"}</span>
                        </div>
                        <div className="font-mono text-[8px] text-[#4a5a4a]">{uso} operação(ões)</div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          <button onClick={()=>setEditEstr({id:e.id,nome:e.nome})} className="btn-small text-[8px]">✏ Editar</button>
                          <button onClick={()=>setEstrategias(p=>p.map(x=>x.id===e.id?{...x,ativa:!x.ativa}:x))}
                            className="btn-small text-[8px]" style={{borderColor:e.ativa?"#f59e0b":"#4C8C5C",color:e.ativa?"#f59e0b":"#4C8C5C"}}>{e.ativa?"⏸ Desativar":"▶ Reativar"}</button>
                          <button onClick={()=>excluirEstrategia(e.id)}
                            className="btn-small text-[8px]" style={{borderColor:"#ef4444",color:"#ef4444"}}>✕ Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {estrategias.length===0 && <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-4">Nenhuma estratégia cadastrada</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setShowGerEstrategias(false);setEditEstr(null);}} className="btn-secondary flex-1 py-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showGerTimes && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:360,width:"92%",maxHeight:"85vh",overflowY:"auto",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>⚽</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Gerenciar Times</div>
            </div>
            <div className="flex gap-1 mb-2">
              <div className="flex-1" style={{position:"relative"}}>
                <input type="text" value={novaTime} list="dl-ger-times" onChange={e=>setNovaTime(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){adicionarTime(novaTime);setNovaTime("");}}}
                  placeholder="Digite para buscar ou cadastrar..."
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                <datalist id="dl-ger-times">
                  {sugestoesLista(times,novaTime,10).map(t=><option key={t.id} value={t.nome} />)}
                </datalist>
              </div>
              <button onClick={()=>{adicionarTime(novaTime);setNovaTime("");}} className="btn-primary text-[10px] px-2 py-1" style={{flex:"0 0 auto"}}>Adicionar</button>
            </div>
            <input type="text" value={timeBusca} onChange={e=>setTimeBusca(e.target.value)} placeholder="🔍 Pesquisar time"
              className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mb-2" />
            <div className="space-y-2">
              {times.filter(t=>!timeBusca||t.nome.toLowerCase().includes(timeBusca.toLowerCase())).map(t=>{
                const uso=usoTime(t.nome);
                return (
                  <div key={t.id} className="bg-[#0f1f17] rounded px-3 py-2">
                    {editTime && editTime.id===t.id ? (
                      <div className="flex gap-1">
                        <input type="text" defaultValue={t.nome} ref={el=>{if(el)el.focus();}}
                          onChange={ev=>setEditTime({...editTime,nome:ev.target.value})}
                          onKeyDown={ev=>{if(ev.key==="Enter"){salvarTimeEdit(t.id,editTime.nome);setEditTime(null);}if(ev.key==="Escape")setEditTime(null);}}
                          className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1 outline-none focus:border-[#c6a15b]" />
                        <button onClick={()=>{salvarTimeEdit(t.id,editTime.nome);setEditTime(null);}} className="btn-small text-[9px]" style={{borderColor:"#4C8C5C",color:"#4C8C5C"}}>Salvar</button>
                        <button onClick={()=>setEditTime(null)} className="btn-small text-[9px]">✕</button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[#e8e0cc] font-bold">{t.nome}</span>
                          <span className={`font-mono text-[8px] ${t.ativa?"text-[#4C8C5C]":"text-[#6a7d6a]"}`}>{t.ativa?"● Ativo":"○ Desativado"}</span>
                        </div>
                        <div className="font-mono text-[8px] text-[#4a5a4a]">{uso} operação(ões)</div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          <button onClick={()=>setEditTime({id:t.id,nome:t.nome})} className="btn-small text-[8px]">✏ Editar</button>
                          <button onClick={()=>setTimes(p=>p.map(x=>x.id===t.id?{...x,ativa:!x.ativa}:x))}
                            className="btn-small text-[8px]" style={{borderColor:t.ativa?"#f59e0b":"#4C8C5C",color:t.ativa?"#f59e0b":"#4C8C5C"}}>{t.ativa?"⏸ Desativar":"▶ Reativar"}</button>
                          <button onClick={()=>excluirTime(t.id)}
                            className="btn-small text-[8px]" style={{borderColor:"#ef4444",color:"#ef4444"}}>✕ Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {times.length===0 && <div className="font-mono text-[10px] text-[#4a5a4a] text-center py-4">Nenhum time cadastrado</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setShowGerTimes(false);setEditTime(null);}} className="btn-secondary flex-1 py-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showHistoricoCiclo && (()=>{
        const hc = ciclos.find(x=>x.id===histCicloId);
        const r = resumoCiclo(hc);
        if(!hc || !r) return null;
        const maxAbs = Math.max(1, ...r.diasList.map(d=>Math.abs(d.soma)));
        const topEstrategias = Object.entries(r.porEstrategia).sort((a,b)=>b[1].lucro-a[1].lucro);
        const topTimes = Object.entries(r.porTime).sort((a,b)=>b[1].lucro-a[1].lucro);
        return (
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
            <div className="card" style={{maxWidth:400,width:"94%",maxHeight:"88vh",overflowY:"auto",padding:16}}>
              <div className="text-center mb-3">
                <span style={{fontSize:22}}>📜</span>
                <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">{hc.nome}</div>
                <div className="font-mono text-[9px] text-[#6a7d6a]">Histórico completo do ciclo</div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="bg-[#0f1f17] rounded px-3 py-2">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Início</div><div className="font-mono text-[9px] text-[#e8e0cc] text-right">{r.dataIni}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Encerramento</div><div className="font-mono text-[9px] text-[#e8e0cc] text-right">{r.dataEncerramento||"—"}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Dias operados</div><div className="font-mono text-[9px] text-[#e8e0cc] text-right">{r.diasOperados}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Banca inicial</div><div className="font-mono text-[9px] text-[#e8e0cc] text-right">{fmt(r.cap)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Banca final</div><div className={`font-mono text-[9px] font-bold text-right ${r.bancaFinal>=r.cap?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{fmt(r.bancaFinal)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Lucro total</div><div className={`font-mono text-[9px] font-bold text-right ${r.totalLucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{r.totalLucro>=0?"+":""}{fmt(r.totalLucro)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Rentabilidade</div><div className={`font-mono text-[9px] font-bold text-right ${r.rentabilidade>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{r.rentabilidade>=0?"+":""}{r.rentabilidade.toFixed(2)}%</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Saques</div><div className="font-mono text-[9px] text-[#c6a15b] text-right">{fmt(r.totalSaque)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Depósitos</div><div className="font-mono text-[9px] text-[#4C8C5C] text-right">{r.totalDepositos>0?"+":""}{fmt(r.totalDepositos)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Saques emerg.</div><div className="font-mono text-[9px] text-[#A6432D] text-right">{r.totalSaqEmerg>0?"−":""}{fmt(r.totalSaqEmerg)}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Total operações</div><div className="font-mono text-[9px] text-[#e8e0cc] text-right">{r.totalOps}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Greens / Reds</div><div className="font-mono text-[9px] text-right"><span className="text-[#4C8C5C]">✓{r.greens}</span> <span className="text-[#A6432D]">✗{r.reds}</span> <span className="text-[#6a7d6a]">·{r.voids}</span></div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Taxa de acerto</div><div className="font-mono text-[9px] text-right" style={{color:r.taxaAcerto>=60?"#4C8C5C":r.taxaAcerto>=40?"#c6a15b":"#A6432D"}}>{r.taxaAcerto}%</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Melhor dia</div><div className="font-mono text-[9px] text-[#4C8C5C] text-right">{r.melhorDia?("+ "+fmt(r.melhorDia.soma)+" ("+fd(r.melhorDia.data)+")"):"—"}</div>
                    <div className="font-mono text-[9px] text-[#6a7d6a]">Pior dia</div><div className="font-mono text-[9px] text-[#A6432D] text-right">{r.piorDia?(fmt(r.piorDia.soma)+" ("+fd(r.piorDia.data)+")"):"—"}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0f1f17] rounded px-3 py-2">
                    <div className="font-mono text-[8px] text-[#6a7d6a] uppercase mb-1">🏆 Estratégia + lucrativa</div>
                    <div className="font-mono text-[10px] text-[#e8e0cc] font-bold truncate">{r.melhorEstrategia?r.melhorEstrategia[0]:"Não informado"}</div>
                    <div className="font-mono text-[8px] text-[#4C8C5C]">{r.melhorEstrategia?("+ "+fmt(r.melhorEstrategia[1].lucro)+" · "+r.melhorEstrategia[1].count+" ops"):"—"}</div>
                  </div>
                  <div className="flex-1 bg-[#0f1f17] rounded px-3 py-2">
                    <div className="font-mono text-[8px] text-[#6a7d6a] uppercase mb-1">⚽ Time + lucrativo</div>
                    <div className="font-mono text-[10px] text-[#e8e0cc] font-bold truncate">{r.melhorTime?r.melhorTime[0]:"Não informado"}</div>
                    <div className="font-mono text-[8px] text-[#4C8C5C]">{r.melhorTime?("+ "+fmt(r.melhorTime[1].lucro)+" · "+r.melhorTime[1].count+" ops"):"—"}</div>
                  </div>
                </div>
              </div>

              <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📈 Gráfico (resultado por dia)</div>
              <div className="card mb-3" style={{padding:"8px 10px",maxHeight:220,overflowY:"auto"}}>
                {r.diasList.map((d,i)=>{
                  const h = d.soma>0 ? (d.soma/maxAbs*100) : (d.tem?Math.abs(d.soma)/maxAbs*100:0);
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[7px] text-[#4a5a4a] w-12 shrink-0">{fd(d.date)}</span>
                      <div className="flex-1 h-3 rounded bg-[#0a1410] relative" style={{background:"#0f1f17"}}>
                        {d.tem && d.soma!==0 && <div className="absolute top-0 bottom-0 rounded" style={{left:d.soma>0?"50%":"50%",width:0}}></div>}
                        {d.tem && d.soma!==0 && <div className="absolute" style={{width:`${Math.max(2,h)}%`,height:"100%",background:d.soma>=0?"#4C8C5C":"#A6432D",...(d.soma>0?{left:"50%"}:{right:"50%"}),borderRadius:2}}></div>}
                      </div>
                      <span className={`font-mono text-[8px] w-16 text-right shrink-0 ${d.soma>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{d.tem?fmt(d.soma):"—"}</span>
                    </div>
                  );
                })}
                {r.diasList.length===0 && <div className="font-mono text-[9px] text-[#4a5a4a] text-center py-2">Sem dias</div>}
              </div>

              <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📊 Todas as Operações ({r.totalOps})</div>
              <div className="card mb-3" style={{padding:0,maxHeight:260,overflowY:"auto"}}>
                {r.totalOps===0 ? <div className="font-mono text-[9px] text-[#4a5a4a] text-center py-3">Nenhuma operação</div> : (
                  r.diasList.map((d,i)=>{
                    const ops=r.porDia[kw(Math.floor(i/(hc.diasPorSemana||7)), i%(hc.diasPorSemana||7))]||[];
                    return ops.map((op,idx)=>(
                      <div key={op.id||idx} className="flex items-center px-3 py-1.5 border-b border-[#14241c] last:border-0">
                        <span className="font-mono text-[8px] text-[#4a5a4a] w-5 shrink-0">#{op.num}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[9px] text-[#e8e0cc] truncate">{op.estrategia?op.estrategia:"Não informado"}{op.time?(" · "+op.time):""}</div>
                          <div className="font-mono text-[7px] text-[#4a5a4a]">{fd(d.date)}{op.hora?" · "+op.hora:""}{op.observacao?" · "+op.observacao:""}</div>
                        </div>
                        {op.status==="aberta" ? (
                          <span className="font-mono text-[8px] font-bold ml-2 shrink-0 text-[#c6a15b]">🟡 Aberta</span>
                        ) : (
                          <span className={`font-mono text-[9px] font-bold ml-2 shrink-0 ${op.resultado>=0?"text-[#4C8C5C]":"text-[#A6432D]"}`}>{op.resultado>=0?"+":""}{fmt(op.resultado)}</span>
                        )}
                      </div>
                    ));
                  })
                )}
              </div>

              <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">🧾 Extrato do Ciclo</div>
              <div className="card mb-3" style={{padding:0,maxHeight:240,overflowY:"auto"}}>
                {r.diasList.map((d,i)=>{
                  const bancaSem=r.sems[Math.floor(i/(hc.diasPorSemana||7))];
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-[#14241c] last:border-0">
                      <div className="min-w-0">
                        <div className="font-mono text-[9px] text-[#e8e0cc]">{d.label} {fd(d.date)}</div>
                        <div className="font-mono text-[7px] text-[#4a5a4a]">Base: {fmt(d.base)} · Meta: {fmt(d.meta)}</div>
                      </div>
                      <div className="text-right ml-2">
                        <div className={`font-mono text-[9px] font-bold ${d.tem?(d.soma>=0?"text-[#4C8C5C]":"text-[#A6432D]"):"text-[#4a5a4a]"}`}>{d.tem?(d.soma>=0?"+":""):""}{d.tem?fmt(d.soma):"—"}</div>
                        <div className="font-mono text-[7px] text-[#4a5a4a]">→ {fmt(d.base+(d.tem?d.soma:0))}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">💸 Movimentações ({r.movimentacoes.length})</div>
              <div className="card mb-3" style={{padding:0,maxHeight:200,overflowY:"auto"}}>
                {r.movimentacoes.length===0 ? <div className="font-mono text-[9px] text-[#4a5a4a] text-center py-3">Nenhuma movimentação</div> : r.movimentacoes.map((m,i)=>{
                  const cor=m.tipo==="saque_emergencial"||m.tipo==="retirada"?"#A6432D":"#4C8C5C";
                  const ico=m.tipo==="aporte"?"📥":m.tipo==="retirada"?"📤":m.tipo==="deposito"?"🏦":"🚨";
                  return (
                    <div key={m.id||i} className="flex items-center justify-between px-3 py-1.5 border-b border-[#14241c] last:border-0">
                      <div className="min-w-0">
                        <div className="font-mono text-[9px] text-[#e8e0cc]">{ico} {m.tipo==="aporte"?"Aporte":m.tipo==="retirada"?"Retirada":m.tipo==="deposito"?"Depósito":"Saque emergencial"}</div>
                        <div className="font-mono text-[7px] text-[#4a5a4a]">{m.data}{m.hora?" · "+m.hora:""}{m.nota?" · "+m.nota:""}</div>
                      </div>
                      <span className="font-mono text-[9px] font-bold ml-2" style={{color:cor}}>{m.tipo==="saque_emergencial"||m.tipo==="retirada"?"−":"+"}{fmt(m.valor)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="font-mono text-[10px] text-[#6a7d6a] uppercase tracking-wider mb-2">📑 Relatórios</div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1 card" style={{padding:"8px 10px"}}>
                  <div className="font-mono text-[9px] text-[#6a7d6a] mb-1">Por Estratégia</div>
                  {topEstrategias.map(([nome,dados],i)=>(
                    <div key={i} className="flex justify-between font-mono text-[8px] py-0.5">
                      <span className="text-[#e8e0cc] truncate mr-1">{nome}</span>
                      <span className={`${dados.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"} shrink-0`}>{dados.lucro>=0?"+":""}{fmt(dados.lucro)} <span className="text-[#4a5a4a]">({dados.count})</span></span>
                    </div>
                  ))}
                  {topEstrategias.length===0 && <div className="font-mono text-[8px] text-[#4a5a4a]">Sem dados</div>}
                </div>
                <div className="flex-1 card" style={{padding:"8px 10px"}}>
                  <div className="font-mono text-[9px] text-[#6a7d6a] mb-1">Por Time</div>
                  {topTimes.map(([nome,dados],i)=>(
                    <div key={i} className="flex justify-between font-mono text-[8px] py-0.5">
                      <span className="text-[#e8e0cc] truncate mr-1">{nome}</span>
                      <span className={`${dados.lucro>=0?"text-[#4C8C5C]":"text-[#A6432D]"} shrink-0`}>{dados.lucro>=0?"+":""}{fmt(dados.lucro)} <span className="text-[#4a5a4a]">({dados.count})</span></span>
                    </div>
                  ))}
                  {topTimes.length===0 && <div className="font-mono text-[8px] text-[#4a5a4a]">Sem dados</div>}
                </div>
              </div>

              <button onClick={()=>setShowHistoricoCiclo(false)} className="btn-secondary w-full py-2">Fechar</button>
            </div>
          </div>
        );
      })()}


      {showEntradaInteligente && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="text-[12px] font-bold" style={{color:"#58a86a"}}>📋 Importar lista de jogos do dia</div><div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>Cole sua lista completa. O app salva os jogos e depois mostra todos por horário para você selecionar e gerar o Card de Jogos do Dia.</div></div><button className="btn-small" onClick={()=>setShowEntradaInteligente(false)}>✕</button></div>
          <div className="card-soft mb-2" style={{padding:9}}><div className="font-mono text-[8px]" style={{color:"#6a7d6a"}}>Você pode colar no formato da sua lista, por exemplo: <strong>TIME CASA:</strong> … · <strong>TIME VISITANTE:</strong> … · <strong>HORÁRIO:</strong> … · <strong>ESTRATÉGIA:</strong> … · <strong>ENTRADA:</strong> …, usando <strong>---</strong> entre os jogos.</div></div>
          <textarea className="dicas-textarea" value={textoEntradaInteligente} onChange={e=>setTextoEntradaInteligente(e.target.value)} placeholder={'BACK FAVORITO\n15:00 — Milan x Venezia — BACK MILAN\n17:30 — Rio Ave x Sporting — BACK SPORTING\n\nUNDER 2.5 GOLS\n18:00 — Time A x Time B — UNDER 2.5'}></textarea>
          <div className="grid grid-cols-2 gap-2 mt-3"><button className="btn-secondary" onClick={()=>setShowEntradaInteligente(false)}>Cancelar</button><button className="btn-primary" onClick={processarEntradaInteligente}>SALVAR JOGOS DO DIA</button></div>
        </div></div>
      )}

      {showListaLayZebra && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}>
          <div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-[12px] font-bold" style={{color:"#d8ae55"}}>{listaLayPlacarTipo==="zebra"?"🦓 Lista Jogos Lay Zebra":`🎯 Lista Lay ${listaLayPlacarTipo}`}</div>
                <div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>Envie um print com vários jogos. A imagem inteira será lida e cada partida virará um card.</div>
              </div>
              <button className="btn-small" onClick={()=>setShowListaLayZebra(false)}>✕</button>
            </div>
            <input ref={listaLayZebraInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>listaLayPlacarTipo==="zebra"?lerListaLayZebra(e.target.files?.[0]):lerListaLayPlacar(e.target.files?.[0],listaLayPlacarTipo)}/>
            <button className="btn-primary w-full" disabled={listaLayZebraCarregando} style={{opacity:listaLayZebraCarregando?.65:1}} onClick={()=>listaLayZebraInputRef.current?.click()}>{listaLayZebraCarregando?"LENDO A IMAGEM COMPLETA…":"📷 SUBIR LISTA DE JOGOS"}</button>
            {listaLayZebraStatus&&<div className="font-mono text-[8px] mt-2" style={{color:listaLayZebraJogos.length?"#81cd90":"#d8ae55"}}>{listaLayZebraStatus}</div>}

            {listaLayZebraJogos.length>0&&<div className="space-y-2 mt-3" style={{maxHeight:"58vh",overflowY:"auto"}}>
              {listaLayZebraJogos.map(jg=><div key={jg.id} className="card-soft" style={{padding:12,border:"1px solid rgba(216,174,85,.22)"}}>
                <div className="font-mono text-[9px] font-bold" style={{color:"#d8ae55"}}>{listaLayPlacarTipo==="zebra"?"🦓 LAY ZEBRA":`🎯 LAY ${listaLayPlacarTipo}`}</div>
                <div className="font-mono text-[9px] mt-2" style={{color:"#aab7ac"}}>⏰ {jg.hora}</div>
                <div className="font-mono text-[11px] font-bold mt-1 text-[#e8e0cc]">⚽ {jg.mandante} x {jg.visitante}</div>
                {listaLayPlacarTipo==="zebra"&&<><div className="font-mono text-[9px] mt-2">📊 {jg.percentual}</div><div className="font-mono text-[9px] mt-1" style={{color:"#e05252"}}>🎯 {jg.entrada}</div></>}
                {listaLayPlacarTipo!=="zebra"&&<div className="font-mono text-[9px] mt-2" style={{color:"#e05252"}}>🎯 Lay {listaLayPlacarTipo}</div>}
                <button className="btn-primary w-full mt-3" style={{padding:9,fontSize:9}} onClick={()=>listaLayPlacarTipo==="zebra"?abrirOperacaoDaListaLay(jg):abrirOperacaoDaListaLayPlacar(jg)}>➡️ CRIAR OPERAÇÃO</button>
              </div>)}
            </div>}

            <div className="card-soft mt-3" style={{padding:10,opacity:.7}}>
              <div className="font-mono text-[8px] font-bold text-[#e8e0cc]">🎯 Listas Lay Placar</div>
              <div className="grid grid-cols-2 gap-2 mt-2"><button className="btn-small" onClick={()=>{setListaLayPlacarTipo("0x1");setListaLayZebraJogos([]);listaLayZebraInputRef.current?.click();}}>📤 Subir Lay 0x1</button><button className="btn-small" onClick={()=>{setListaLayPlacarTipo("1x0");setListaLayZebraJogos([]);listaLayZebraInputRef.current?.click();}}>📤 Subir Lay 1x0</button></div>
            </div>
          </div>
        </div>
      )}

      {showLeitorBolsa && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="text-[12px] font-bold" style={{color:"#58a86a"}}>{leitorBolsaLista.length?"⭐ Possíveis Entradas do Dia":"📷 Leitor da Bolsa"}</div>
              <div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>{leitorBolsaLista.length?`${leitorBolsaLista.length} jogo${leitorBolsaLista.length>1?"s":""} lido${leitorBolsaLista.length>1?"s":""} do print. Escolha um para criar a operação.`:"Envie um print do confronto ou de uma lista de jogos da bolsa (com odds 1 X 2)."}</div>
            </div>
            <button className="btn-small" onClick={()=>{setShowLeitorBolsa(false);setLeitorBolsaResultado(null);setLeitorBolsaLista([]);setLeitorBolsaStatus("");}}>✕</button>
          </div>

          <input ref={leitorBolsaInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>lerLeitorDaBolsa(e.target.files?.[0])}/>
          {leitorBolsaLista.length ? (
            <>
              <div className="space-y-2 mb-3" style={{maxHeight:"60vh",overflowY:"auto"}}>
                {leitorBolsaLista.map(jg=>(
                  <div key={jg.id} className="card-soft" style={{padding:11}}>
                    <div className="font-mono text-[11px] font-bold text-[#e8e0cc]">⚽ {jg.mandante} x {jg.visitante}</div>
                    <div className="font-mono text-[9px] mt-0.5" style={{color:"#6a7d6a"}}>⏰ {jg.horario||"N/D"}</div>
                    {jg.tipo==="radar" ? (
                      <>
                        <div className="font-mono text-[9px] mt-2" style={{color:"#d8ae55"}}>🎯 Entrada indicada: <strong>{jg.entrada||jg.entradaSugerida||"N/D"}</strong></div>
                        <div className="font-mono text-[8px] mt-1" style={{color:"#6a7d6a"}}>📌 Método: {jg.metodo||"N/D"}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-[9px] mt-2">Odd {jg.mandante}: <strong>{Number(jg.oddCasa).toFixed(2)}</strong></div>
                        <div className="font-mono text-[9px]">Odd {jg.visitante}: <strong>{Number(jg.oddVisitante).toFixed(2)}</strong></div>
                        <div className="font-mono text-[9px] mt-2" style={{color:"#d8ae55"}}>Favorito identificado:<br/>⭐ {jg.favorito} @ {Number(jg.oddFavorito).toFixed(2)}</div>
                      </>
                    )}
                    <div className="font-mono text-[8px] mt-1" style={{color:"#6a7d6a"}}>Estratégia: {jg.estrategia||"back_favorito"}</div>
                    <button className="btn-primary w-full mt-2" style={{padding:8,fontSize:9}} onClick={()=>criarOperacaoDoListaBolsa(jg)}>🎯 CRIAR OPERAÇÃO</button>
                  </div>
                ))}
              </div>
              <button className="btn-secondary w-full" onClick={()=>{setLeitorBolsaLista([]);setLeitorBolsaStatus("");}}>↺ Ler outra imagem</button>
            </>
          ) : !leitorBolsaResultado ? (
            <>
              <button className="btn-primary w-full" disabled={leitorBolsaCarregando} style={{opacity:leitorBolsaCarregando?0.65:1}} onClick={()=>leitorBolsaInputRef.current?.click()}>
                {leitorBolsaCarregando?"LENDO…":"📷 Selecionar Imagem"}
              </button>
              {leitorBolsaStatus && <div className="font-mono text-[8px] mt-2" style={{color:"#81cd90"}}>{leitorBolsaStatus}</div>}
            </>
          ) : (
            <>
              <div className="card-soft mb-3" style={{padding:12}}>
                <div className="font-mono text-[8px] text-[#6a7d6a] uppercase">Casa</div>
                <div className="font-mono text-[13px] font-bold text-[#e8e0cc] mb-2">{leitorBolsaResultado.mandante}</div>
                <div className="font-mono text-[8px] text-[#6a7d6a] uppercase">Visitante</div>
                <div className="font-mono text-[13px] font-bold text-[#e8e0cc]">{leitorBolsaResultado.visitante}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary" onClick={()=>{setLeitorBolsaResultado(null);setLeitorBolsaStatus("");}}>↺ Tentar outra</button>
                <button className="btn-primary" onClick={criarOperacaoDoLeitorDaBolsa}>➡️ Criar Operação</button>
              </div>
            </>
          )}
        </div></div>
      )}

      {showPossiveisEntradas && (()=>{
        const hojeChave = tISO(new Date());
        const lista = possiveisEntradas.filter(e=>e.data===hojeChave && !e.usada && !e.ignorada).slice().sort((a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99")));
        return (
          <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-[12px] font-bold" style={{color:"#d8ae55"}}>⭐ Possíveis Entradas de Hoje</div>
                <div className="text-[9px] mt-1" style={{color:"#6a7d6a"}}>{lista.length?`${lista.length} jogo${lista.length>1?"s":""} identificado${lista.length>1?"s":""} pelo Leitor da Bolsa. Escolha um para criar a operação.`:"Nenhum jogo pendente hoje. Use o 📷 Leitor da Bolsa para identificar jogos automaticamente."}</div>
              </div>
              <button className="btn-small" onClick={()=>setShowPossiveisEntradas(false)}>✕</button>
            </div>

            {lista.length ? (
              <div className="space-y-2" style={{maxHeight:"65vh",overflowY:"auto"}}>
                {lista.map(jg=>{
                  const hm=String(jg.horario||"").match(/(\d{1,2})[:.](\d{2})/);
                  let alertaTxt="—";
                  if(hm) { const alvo=new Date(); alvo.setHours(Number(hm[1]),Number(hm[2]),0,0); alvo.setMinutes(alvo.getMinutes()-5); alertaTxt=`${String(alvo.getHours()).padStart(2,"0")}:${String(alvo.getMinutes()).padStart(2,"0")}`; }
                  return (
                    <div key={jg.id} className="card-soft" style={{padding:11}}>
                      <div className="font-mono text-[11px] font-bold text-[#e8e0cc]">⚽ {jg.mandante} x {jg.visitante}</div>
                      <div className="font-mono text-[9px] mt-0.5" style={{color:"#6a7d6a"}}>⏰ {jg.horario}</div>
                      {jg.tipo==="radar" ? (
                        <>
                          <div className="font-mono text-[9px] mt-2" style={{color:"#d8ae55"}}>🎯 Entrada indicada: <strong>{jg.entrada||jg.entradaSugerida||"N/D"}</strong></div>
                          <div className="font-mono text-[8px] mt-1" style={{color:"#6a7d6a"}}>📌 Método: {jg.metodo||"N/D"}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono text-[9px] mt-2">Odd {jg.mandante}: <strong>{Number(jg.oddCasa).toFixed(2)}</strong></div>
                          <div className="font-mono text-[9px]">Odd {jg.visitante}: <strong>{Number(jg.oddVisitante).toFixed(2)}</strong></div>
                          <div className="font-mono text-[9px] mt-2" style={{color:"#d8ae55"}}>⭐ Favorito: {jg.favorito} @ {Number(jg.oddFavorito).toFixed(2)}</div>
                        </>
                      )}
                      <div className="font-mono text-[8px] mt-1" style={{color:"#6a7d6a"}}>🎯 Estratégia: {jg.estrategia||"Back Favorito"}</div>
                      <div className="font-mono text-[8px] mt-1" style={{color:"#6a7d6a"}}>🔔 Alerta: {alertaTxt}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button className="btn-secondary" style={{padding:8,fontSize:9}} onClick={()=>descartarPossivelEntrada(jg.id)}>✕ Descartar</button>
                        <button className="btn-primary" style={{padding:8,fontSize:9}} onClick={()=>criarOperacaoDoListaBolsa(jg)}>🎯 CRIAR OPERAÇÃO</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={()=>{setShowPossiveisEntradas(false);setLeitorBolsaResultado(null);setLeitorBolsaLista([]);setLeitorBolsaStatus("");setShowLeitorBolsa(true);}}>📷 Abrir Leitor da Bolsa</button>
            )}
          </div></div>
        );
      })()}

      {showColarAnalise && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="font-mono text-[10px] text-[#58a86a] uppercase font-bold">📋 COLAR ANÁLISE</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Cole o texto completo do ChatGPT. Cada linha de confronto vira um registro independente.</div></div><button className="btn-small" onClick={()=>setShowColarAnalise(false)}>✕</button></div>
          <div className="card-soft mb-2"><div className="font-mono text-[8px] text-[#6a7d6a]">Formato recomendado</div><div className="font-mono text-[8px] mt-1">1. Chelsea x Luton — GOL NO 1º TEMPO<br/>Análise...<br/>Minha classificação: 8,5/10.</div></div>
          <textarea className="dicas-textarea" value={textoAnaliseColada} onChange={e=>setTextoAnaliseColada(e.target.value)} placeholder="Cole aqui várias análises de jogos..."></textarea>
          <div className="font-mono text-[7px] text-[#6a7d6a] mt-2">Resíduos como “Mutating +1” e caracteres quebrados são ignorados. O sistema não cria N/D x N/D automaticamente.</div>
          <div className="grid grid-cols-2 gap-2 mt-3"><button className="btn-secondary" onClick={()=>setShowColarAnalise(false)}>Cancelar</button><button className="btn-primary" onClick={processarAnaliseColada}>IDENTIFICAR JOGOS</button></div>
        </div></div>
      )}

      {showColarAtualizacao && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="font-mono text-[10px] text-[#d8ae55] uppercase font-bold">🔄 COLAR ATUALIZAÇÃO PRÉ-JOGO</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Escalações, desfalques, odds e notícias entram na ficha existente — nunca como jogo duplicado.</div></div><button className="btn-small" onClick={()=>setShowColarAtualizacao(false)}>✕</button></div>
          <textarea className="dicas-textarea" value={textoAtualizacaoColada} onChange={e=>setTextoAtualizacaoColada(e.target.value)} placeholder="Cole a atualização. Se possível, inclua o confronto no início, ex: Chelsea x Luton"></textarea>
          <div className="font-mono text-[7px] text-[#6a7d6a] mt-2">O sistema só aplica automaticamente quando identifica o jogo e o impacto textual com segurança: REFORÇOU, MANTEVE, ENFRAQUECEU ou CANCELOU.</div>
          <div className="grid grid-cols-2 gap-2 mt-3"><button className="btn-secondary" onClick={()=>setShowColarAtualizacao(false)}>Cancelar</button><button className="btn-primary" onClick={processarAtualizacaoColada}>CRUZAR COM O BANCO</button></div>
        </div></div>
      )}

      {atualizacaoRevisar && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card dicas-review" style={{width:430,maxWidth:"95vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="font-mono text-[10px] font-bold" style={{color:"#d8ae55"}}>⚠️ REVISAR ATUALIZAÇÃO</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">{atualizacaoRevisar.motivo}</div></div><button className="btn-small" onClick={()=>setAtualizacaoRevisar(null)}>✕</button></div>
          <label className="font-mono text-[7px] text-[#6a7d6a]">Jogo correto</label>
          <select className="review-field mb-2" value={atualizacaoRevisar.candidatoId||""} onChange={e=>setAtualizacaoRevisar(p=>({...p,candidatoId:e.target.value}))}><option value="">Selecione…</option>{jogosDia.filter(j=>j.data===jogosDataFiltro).map(j=><option key={j.id} value={j.id}>{j.horario} · {j.mandante} x {j.visitante}</option>)}</select>
          <label className="font-mono text-[7px] text-[#6a7d6a]">Impacto</label>
          <select className="review-field mb-2" value={atualizacaoRevisar.impacto||"REVISAR"} onChange={e=>setAtualizacaoRevisar(p=>({...p,impacto:e.target.value}))}><option value="REVISAR">⚠️ REVISAR</option><option value="REFORÇOU">🟢 REFORÇOU</option><option value="MANTEVE">⚪ MANTEVE</option><option value="ENFRAQUECEU">🟡 ENFRAQUECEU</option><option value="CANCELOU">🔴 CANCELOU</option></select>
          <div className="grid grid-cols-1 gap-2"><div><label className="font-mono text-[7px] text-[#6a7d6a]">Entrada final</label><input className="review-field" value={atualizacaoRevisar.entradaFinal||"N/D"} onChange={e=>setAtualizacaoRevisar(p=>({...p,entradaFinal:e.target.value}))}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Segunda opção</label><input className="review-field" value={atualizacaoRevisar.segundaOpcao||"N/D"} onChange={e=>setAtualizacaoRevisar(p=>({...p,segundaOpcao:e.target.value}))}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Evitar</label><input className="review-field" value={atualizacaoRevisar.evitar||"N/D"} onChange={e=>setAtualizacaoRevisar(p=>({...p,evitar:e.target.value}))}/></div></div>
          <div className="card-soft mt-2"><div className="dicas-raw">{atualizacaoRevisar.texto}</div></div>
          <button className="btn-primary w-full mt-3" onClick={confirmarAtualizacaoRevisada}>APLICAR À FICHA</button>
        </div></div>
      )}

      {showRevisaoJogos && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"14px 0",overflowY:"auto"}}><div className="card" style={{width:440,maxWidth:"95vw",padding:14}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="font-mono text-[10px] text-[#d8ae55] uppercase font-bold">⚠️ REVISAR LEITURA</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Corrija somente o que estiver claro no texto. Não invente dados ausentes.</div></div><button className="btn-small" onClick={()=>setShowRevisaoJogos(false)}>✕</button></div>
          <div className="space-y-3">{jogosRevisao.map((j,idx)=><div key={j.id} className="card-soft dicas-review" style={{padding:10}}>
            <div className="flex items-start justify-between gap-2 mb-2"><div className="font-mono text-[8px] text-[#d8ae55]">JOGO {idx+1}</div>{j.nota!=null&&<span className="dicas-note">{String(j.nota).replace(".",",")}/10</span>}</div>
            {Array.isArray(j.errosLeitura)&&j.errosLeitura.length>0&&<div className="mb-2">{j.errosLeitura.map((e,i)=><div key={i} className="font-mono text-[7px]" style={{color:"#d8ae55"}}>• {e}</div>)}</div>}
            <div className="grid grid-cols-2 gap-2"><div><label className="font-mono text-[7px] text-[#6a7d6a]">Data</label><input type="date" className="review-field" value={j.data||""} onChange={e=>atualizarJogoRevisao(j.id,"data",e.target.value)}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Horário</label><input className="review-field" value={j.horario||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"horario",e.target.value)}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Mandante</label><input className="review-field" value={j.mandante||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"mandante",e.target.value)}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Visitante</label><input className="review-field" value={j.visitante||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"visitante",e.target.value)}/></div></div>
            <div className="mt-2"><label className="font-mono text-[7px] text-[#6a7d6a]">Favorito (se informado)</label><input className="review-field" value={j.favorito||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"favorito",e.target.value)}/></div>
            <div className="mt-2"><label className="font-mono text-[7px] text-[#6a7d6a]">Métodos</label><div className="dicas-method-tags mt-1">{METODOS_DICAS.map(m=><button key={m.id} type="button" className={`jogos-chip ${(j.metodos||[]).includes(m.id)?"active":""}`} onClick={()=>alternarMetodoRevisao(j.id,m.id)}>{m.ico} {m.nome}</button>)}</div></div>
            <div className="grid grid-cols-3 gap-2 mt-2">{MERCADOS_JOGOS.map(m=><div key={m.id}><label className="font-mono text-[7px] text-[#6a7d6a]">{m.rotulo}</label><input inputMode="decimal" className="review-field" value={j[m.id]??"N/D"} onChange={e=>atualizarJogoRevisao(j.id,m.id,e.target.value)}/></div>)}</div>
            <div className="grid grid-cols-2 gap-2 mt-2"><div><label className="font-mono text-[7px] text-[#6a7d6a]">Nota /10</label><input inputMode="decimal" className="review-field" value={j.nota??""} onChange={e=>atualizarJogoRevisao(j.id,"nota",e.target.value===""?null:Number(e.target.value.replace(",",".")))}/></div><div><label className="font-mono text-[7px] text-[#6a7d6a]">Confiança</label><select className="review-field" value={j.confianca||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"confianca",e.target.value)}><option>N/D</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div></div>
            <div className="mt-2"><label className="font-mono text-[7px] text-[#6a7d6a]">Entrada / recomendação</label><textarea className="review-field" rows="2" value={j.entradaSugerida||"N/D"} onChange={e=>atualizarJogoRevisao(j.id,"entradaSugerida",e.target.value)}></textarea></div>
            {j.analiseInicial&&<details className="mt-2"><summary className="font-mono text-[7px] text-[#6a7d6a]" style={{cursor:"pointer"}}>Ver texto de origem</summary><div className="card-soft mt-1"><div className="dicas-raw">{j.analiseInicial}</div></div></details>}
            <div className="flex gap-2 mt-2"><button className="btn-danger" style={{padding:8,fontSize:9}} onClick={()=>setJogosRevisao(prev=>prev.filter(x=>x.id!==j.id))}>Remover</button><button className="btn-primary" style={{padding:8,fontSize:9}} onClick={()=>salvarJogoRevisao(j.id)}>SALVAR JOGO</button></div>
          </div>)}</div>
          <button className="btn-small w-full mt-3" style={{padding:8}} onClick={()=>setJogosRevisao(prev=>[...prev,jogoVazio(jogosDataFiltro,null)])}>＋ ADICIONAR JOGO MANUAL</button><button className="btn-primary w-full mt-2" onClick={salvarTodosJogosRevisao}>SALVAR TODOS VÁLIDOS</button>
        </div></div>
      )}

      {jogoDetalhe && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50" style={{margin:0,padding:"18px 0",overflowY:"auto"}}><div className="card" style={{width:410,maxWidth:"94vw",padding:15}}>
          <div className="flex items-start justify-between gap-2 mb-3"><div><div className="font-mono text-[8px] text-[#58a86a] uppercase font-bold">{jogoDetalhe.data} · {jogoDetalhe.horario}</div><div className="font-mono text-[14px] font-bold mt-1">{jogoDetalhe.mandante} x {jogoDetalhe.visitante}</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Favorito: {jogoDetalhe.favorito||"N/D"}</div></div><button className="btn-small" onClick={()=>setJogoDetalheId(null)}>✕</button></div>
          <div className="dicas-method-tags mb-3">{metodosDoJogo(jogoDetalhe).map(id=>{const m=metodoDicaInfo(id);return <span key={id} className="dicas-method-tag">{m.ico} {m.nome}</span>})}</div>

          {(()=>{const metodo=metodosDoJogo(jogoDetalhe).includes(dicasMetodo)?dicasMetodo:melhorMetodoJogo(jogoDetalhe),sem=metodo?semaforoMetodo(jogoDetalhe,metodo):null,mot=metodo?motivosDaOportunidade(jogoDetalhe,metodo):[],confs=conflitosDoJogo(jogoDetalhe);return <><div className="card mb-2" style={{padding:10}}><div className="flex items-center justify-between gap-2"><div><div className="font-mono text-[7px] text-[#6a7d6a] uppercase">Leitura rápida</div><div className="font-mono text-[9px] font-bold mt-1">{metodo?metodoDicaInfo(metodo).nome:"Método não definido"}</div></div>{sem&&<span className="semaforo" style={{color:sem.cor}}>{sem.ico} {sem.txt}</span>}</div>{mot.map((x,i)=><div key={i} className="why-line">✓ {x}</div>)}{confs.length>0&&<div className="card-soft mt-2" style={{border:"1px solid rgba(216,174,85,.28)"}}><div className="font-mono text-[7px] font-bold" style={{color:"#d8ae55"}}>⚠️ DETECTOR DE CONFLITO</div>{confs.map((x,i)=><div key={i} className="font-mono text-[7px] text-[#aab7ac] mt-1">• {x}</div>)}</div>}</div>{metodo&&<div className="odd-box mb-2"><div className="font-mono text-[7px] text-[#6a7d6a] uppercase mb-1">💰 Valor da odd · referência da análise</div><div className="flex gap-2 items-center"><input className="review-field" inputMode="decimal" value={jogoDetalhe.oddsMercado?.[metodo]||""} onChange={e=>atualizarOddMetodo(jogoDetalhe.id,metodo,e.target.value)} placeholder="Odd atual, ex: 1,80" style={{flex:1}}/>{(()=>{const v=valorOddInfo(jogoDetalhe,metodo);return v?<span className="result-pill" style={{color:v.cor}}>{v.ico} {v.txt}</span>:null})()}</div>{(()=>{const v=valorOddInfo(jogoDetalhe,metodo);return v?<div className="font-mono text-[7px] text-[#6a7d6a] mt-1">Odd de referência pela porcentagem: {v.justa.toFixed(2).replace(".",",")} · diferença estimada: {v.margem>=0?"+":""}{v.margem.toFixed(1).replace(".",",")}%</div>:<div className="font-mono text-[7px] text-[#6a7d6a] mt-1">Preencha a odd quando houver percentual estruturado para comparar. É uma referência, não garantia de valor real.</div>})()}</div>}</>})()}

          {jogoDetalhe.leituraFinal&&(()=>{const v=impactoVisual(jogoDetalhe.leituraFinal.impacto);return <div className="card mb-3" style={{padding:11,borderColor:v.cor}}><div className="flex items-center justify-between mb-2"><div className="font-mono text-[8px] text-[#6a7d6a] uppercase">Leitura final</div><span className="dicas-impact" style={{color:v.cor}}>{v.ico} {jogoDetalhe.leituraFinal.impacto}</span></div><div className="card-soft mb-1"><div className="font-mono text-[7px] text-[#6a7d6a]">ENTRADA FINAL</div><div className="font-mono text-[10px] font-bold mt-0.5">{jogoDetalhe.leituraFinal.entradaFinal||"N/D"}</div></div><div className="grid grid-cols-2 gap-1"><div className="card-soft"><div className="font-mono text-[7px] text-[#6a7d6a]">2ª OPÇÃO</div><div className="font-mono text-[8px] mt-0.5">{jogoDetalhe.leituraFinal.segundaOpcao||"N/D"}</div></div><div className="card-soft"><div className="font-mono text-[7px] text-[#6a7d6a]">EVITAR</div><div className="font-mono text-[8px] mt-0.5">{jogoDetalhe.leituraFinal.evitar||"N/D"}</div></div></div>{Array.isArray(jogoDetalhe.leituraFinal.sinais)&&jogoDetalhe.leituraFinal.sinais.length>0&&<div className="mt-2">{jogoDetalhe.leituraFinal.sinais.map((x,i)=><div key={i} className="font-mono text-[8px] text-[#81cd90]">{x}</div>)}</div>}</div>})()}

          <div className="card-soft mb-2"><div className="font-mono text-[7px] text-[#6a7d6a] uppercase">Análise inicial</div><div className="font-mono text-[9px] font-bold mt-1">{jogoDetalhe.entradaSugerida||"N/D"}</div>{jogoDetalhe.nota!=null&&<div className="font-mono text-[8px] text-[#d8ae55] mt-1">Classificação: {String(jogoDetalhe.nota).replace(".",",")}/10</div>}{jogoDetalhe.analiseInicial&&<details className="mt-2"><summary className="font-mono text-[7px] text-[#6a7d6a]" style={{cursor:"pointer"}}>Ver análise completa</summary><div className="dicas-raw mt-2">{jogoDetalhe.analiseInicial}</div></details>}</div>

          {(MERCADOS_JOGOS.some(m=>numPctJogo(jogoDetalhe[m.id])!=null))&&<details className="card-soft mb-2"><summary className="font-mono text-[8px] text-[#6a7d6a]" style={{cursor:"pointer"}}>Estatísticas estruturadas</summary><div className="jogo-market-grid mt-2">{MERCADOS_JOGOS.map(m=><div key={m.id} className="jogo-market"><span>{m.rotulo}</span><b>{numPctJogo(jogoDetalhe[m.id])==null?"N/D":`${numPctJogo(jogoDetalhe[m.id])}%`}</b></div>)}</div>{Array.isArray(jogoDetalhe.estatisticas)&&jogoDetalhe.estatisticas.length>0&&<div className="mt-2">{jogoDetalhe.estatisticas.map((x,i)=><div key={i} className="font-mono text-[7px] text-[#6a7d6a]">• {x}</div>)}</div>}</details>}

          {Array.isArray(jogoDetalhe.atualizacoes)&&jogoDetalhe.atualizacoes.length>0&&<details className="card-soft mb-3" open><summary className="font-mono text-[8px] text-[#6a7d6a]" style={{cursor:"pointer"}}>Atualizações pré-jogo ({jogoDetalhe.atualizacoes.length})</summary><div className="space-y-2 mt-2">{jogoDetalhe.atualizacoes.map((a,i)=>{const v=impactoVisual(a.impacto);return <div key={a.id||i} style={{borderTop:i?"1px solid #1e3228":"none",paddingTop:i?8:0}}><span className="dicas-impact" style={{color:v.cor}}>{v.ico} {a.impacto}</span><div className="dicas-raw mt-1">{a.texto}</div></div>})}</div></details>}

          <div className="card-soft mb-2"><div className="font-mono text-[8px] text-[#d8ae55] font-bold mb-2">🧾 CHECKLIST PRÉ-OPERAÇÃO</div><div className="space-y-1">{[["analise","Análise revisada"],["atualizacao","Atualização/escalação conferida"],["odd","Odd conferida"],["mercado","Mercado correto"],["noticias","Notícia de última hora conferida"]].map(([k,t])=><div key={k} className={`check-row ${jogoDetalhe.checklistPreOp?.[k]?"done":""}`} onClick={()=>atualizarChecklist(jogoDetalhe.id,k)}><div className="check-box">{jogoDetalhe.checklistPreOp?.[k]?"✓":""}</div><div className="font-mono text-[8px]">{t}</div></div>)}</div></div>

          <details className="card-soft mb-2"><summary className="font-mono text-[8px] text-[#6a7d6a]" style={{cursor:"pointer"}}>🕒 Linha do tempo da tese</summary><div className="timeline mt-2">{[{ts:jogoDetalhe.criadoEm,t:"Análise inicial cadastrada",d:jogoDetalhe.entradaSugerida},...(jogoDetalhe.atualizacoes||[]).map(a=>({ts:a.criadoEm,t:`Atualização: ${a.impacto||"MANTEVE"}`,d:a.entradaFinal||"Atualização pré-jogo"})),...(()=>{const op=operacaoDoJogo(jogoDetalhe);return op?[{ts:op.criadoEm,t:"Operação criada",d:op.estrategia},{ts:op.dataFechamento,t:op.status==="green"?"Operação fechada GREEN":op.status==="red"?"Operação fechada RED":"Operação em aberto",d:op.resultado!=null?fmt(op.resultado):""}].filter(x=>x.ts):[]})(),...(jogoDetalhe.resultadoRegistradoEm?[{ts:jogoDetalhe.resultadoRegistradoEm,t:"Placar final registrado",d:`${jogoDetalhe.mandante} ${jogoDetalhe.placarMandante} x ${jogoDetalhe.placarVisitante} ${jogoDetalhe.visitante}`}]:[])].filter(x=>x.ts).sort((a,b)=>a.ts-b.ts).map((x,i)=><div key={i} className="timeline-item"><div className="font-mono text-[7px] text-[#d8ae55]">{new Date(x.ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div><div className="font-mono text-[8px] font-bold mt-0.5">{x.t}</div>{x.d&&<div className="font-mono text-[7px] text-[#6a7d6a] mt-0.5">{x.d}</div>}</div>)}</div></details>

          {placarCompleto(jogoDetalhe)&&<div className="card-soft mb-2"><div className="font-mono text-[7px] text-[#6a7d6a] uppercase">Resultado final</div><div className="font-mono text-[14px] font-bold mt-1 text-center">{jogoDetalhe.mandante} {jogoDetalhe.placarMandante} x {jogoDetalhe.placarVisitante} {jogoDetalhe.visitante}</div>{(()=>{const p=classificacaoPosJogo(jogoDetalhe);return p?<div className="font-mono text-[8px] text-center mt-1" style={{color:p.cor}}>{p.ico} {p.txt}</div>:null})()}</div>}

          <div className="mb-3"><div className="font-mono text-[8px] text-[#6a7d6a] mb-1">Status</div><div className="jogos-filtros">{["PENDENTE","OPERADO","IGNORADO","FINALIZADO"].map(st=><button key={st} className={`jogos-chip ${jogoDetalhe.status===st?"active":""}`} onClick={()=>atualizarJogo(jogoDetalhe.id,{status:st})}>{st}</button>)}</div></div>
          <div className="card-soft mb-3"><div className="font-mono text-[8px] text-[#d8ae55] font-bold mb-2">🔔 Lembrete</div><div className="flex gap-1 mb-2">{[60,30,15].map(n=><button key={n} className={`jogos-chip ${Number(jogoDetalhe.lembreteMin)===n?"active":""}`} onClick={()=>atualizarJogo(jogoDetalhe.id,{lembreteMin:n,lembreteAtivo:true})}>{n} min</button>)}</div><div className="flex gap-2"><input type="number" min="1" max="240" className="review-field" value={jogoDetalhe.lembreteMin||30} onChange={e=>atualizarJogo(jogoDetalhe.id,{lembreteMin:Math.max(1,Number(e.target.value)||1)})}/><button className={jogoDetalhe.lembreteAtivo?"btn-danger":"btn-primary"} style={{width:"auto",padding:"8px 10px",fontSize:9}} onClick={()=>atualizarJogo(jogoDetalhe.id,{lembreteAtivo:!jogoDetalhe.lembreteAtivo})}>{jogoDetalhe.lembreteAtivo?"DESATIVAR":"ATIVAR"}</button></div></div>
          <div className="grid grid-cols-2 gap-2"><button className="btn-secondary" disabled={!jogoDetalhe.imagemId} style={!jogoDetalhe.imagemId?{opacity:.45,cursor:"default"}:null} onClick={()=>jogoDetalhe.imagemId&&abrirImagemOriginalJogo(jogoDetalhe)}>🖼 {jogoDetalhe.imagemId?"VER IMAGEM":"SEM IMAGEM"}</button><button className="btn-primary" onClick={()=>abrirOperacaoDoJogo(jogoDetalhe)}>＋ CRIAR OPERAÇÃO</button></div><button className="btn-danger w-full mt-2" onClick={()=>excluirJogo(jogoDetalhe.id)}>Excluir jogo</button>
        </div></div>
      )}

      {showCardJogosDia && <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" style={{margin:0,padding:12}} onClick={()=>setShowCardJogosDia(false)}>
        <div className="card" style={{maxWidth:390,width:"100%",maxHeight:"90vh",overflowY:"auto",padding:14}} onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3"><div><div className="font-mono text-[12px] font-bold text-[#e8e0cc]">🃏 Card de Jogos do Dia</div><div className="font-mono text-[8px] text-[#6a7d6a] mt-1">{jogosCardSelecionados.length} jogo(s) selecionado(s)</div></div><button className="btn-small" onClick={()=>setShowCardJogosDia(false)}>✕</button></div>
          <div className="card-soft mb-3"><div className="font-mono text-[8px] text-[#c6a15b] font-bold mb-2">PRÉVIA</div>{jogosDia.filter(j=>jogosCardSelecionados.includes(j.id)).slice().sort((a,b)=>String(a.horario||"99:99").localeCompare(String(b.horario||"99:99"))).map(j=><div key={j.id} className="py-2" style={{borderBottom:"1px solid #1e3228"}}><div className="font-mono text-[9px] text-[#c6a15b]">{j.horario||"--:--"}</div><div className="font-mono text-[10px] font-bold text-[#e8e0cc]">{j.mandante} x {j.visitante}</div><div className="font-mono text-[8px] text-[#81cd90] mt-1">🎯 {estrategiaCardJogo(j)}</div></div>)}</div>
          <button type="button" className="btn-primary" onClick={gerarImagemCardJogosDia}>⬇️ GERAR E BAIXAR CARD</button>
          <div className="font-mono text-[7px] text-[#6a7d6a] text-center mt-2">No celular, depois do download você também poderá compartilhar a imagem pelo menu do aparelho.</div>
        </div>
      </div>}

      {imagemJogoModal && <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" style={{margin:0,padding:12}} onClick={fecharImagemJogo}><div style={{maxWidth:520,width:"100%"}} onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-2"><div className="font-mono text-[9px] text-[#e8e0cc] truncate">{imagemJogoModal.nome}</div><button className="btn-small" onClick={fecharImagemJogo}>✕</button></div><img src={imagemJogoModal.url} alt="Imagem original da análise" style={{width:"100%",maxHeight:"84vh",objectFit:"contain",borderRadius:12}}/></div></div>}

      {showAddOp && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,overflowY:"auto",padding:"20px 0"}}>
          <div className="card" style={{maxWidth:340,width:"92%",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>📊</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">{opEditIdx!=null?"Editar Operação":"Nova Operação"}</div>
              {opForm.metodo && opForm.estrategiaBase && (
                <div className="font-mono text-[11px] text-[#c6a15b] font-bold mt-1">
                  {rotuloOperacao(opForm.metodo, opForm.estrategiaBase, opForm.golsSelecao, opForm.estrategiaBase==="Placar Correto"?(opForm.placar||opForm.placarManual):"")}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Método</label>
                  <select value={opForm.metodo||""} onChange={e=>{setOpForm(p=>({...p,metodo:e.target.value}));setOpCalcTocado(false);}} className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1">
                    <option value="">Selecione...</option><option value="BACK">BACK</option><option value="LAY">LAY</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Estratégia</label>
                  <div className="flex gap-1 mt-1">
                    <select value={opForm.estrategiaBase||""} onChange={e=>setOpForm(p=>({...p,estrategiaBase:e.target.value}))} className="flex-1 min-w-0 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b]">
                      <option value="">Selecione...</option>
                      {[...ESTRATEGIAS_FIXAS,...(estrategias||[]).filter(e=>e&&e.ativa!==false).map(e=>e.nome)].filter((v,i,a)=>v&&a.indexOf(v)===i).map(est=><option key={est} value={est}>{est}</option>)}
                    </select>
                    <button type="button" className="btn-small" style={{minWidth:38,padding:"6px 8px"}} title="Adicionar estratégia" onClick={()=>{const n=prompt("Nome da nova estratégia:");if(n&&adicionarEstrategia(n)){setOpForm(p=>({...p,estrategiaBase:n.trim()}));}}}>＋</button>
                    <button type="button" className="btn-small" style={{minWidth:38,padding:"6px 8px",color:"#ef654f",borderColor:"#ef654f"}} title="Excluir estratégia selecionada" onClick={()=>{
                      const nome=opForm.estrategiaBase;
                      if(!nome){alert("Selecione uma estratégia primeiro.");return;}
                      if(confirm("Excluir a estratégia '"+nome+"' da lista?")){
                        setEstrategias(prev=>prev.filter(e=>e.nome!==nome));
                        setOpForm(p=>({...p,estrategiaBase:""}));
                      }
                    }}>🗑</button>
                  </div>
                </div>
              </div>
              {opForm.estrategiaBase==="Total de Gols" && (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Total de Gols</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {GOLS_OPCOES.map(g=>(
                      <button key={g} type="button" onClick={()=>setOpForm(p=>({...p,golsSelecao:g}))}
                        className="btn-small py-1.5 text-[9px]" style={{flex:"1 0 30%",...(opForm.golsSelecao===g?{borderColor:"#c6a15b",color:"#c6a15b",background:"rgba(198,161,91,0.1)"}:{})}}>{g}</button>
                    ))}
                  </div>
                </div>
              )}
              {opForm.estrategiaBase==="Placar Correto" && (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Placar</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {PLACARES_RAPIDOS.map(pl=>(
                      <button key={pl} type="button" onClick={()=>setOpForm(p=>({...p,placar:pl,placarManual:""}))}
                        className="btn-small py-1.5 text-[9px]" style={{flex:"1 0 21%",...(opForm.placar===pl?{borderColor:"#c6a15b",color:"#c6a15b",background:"rgba(198,161,91,0.1)"}:{})}}>{pl}</button>
                    ))}
                  </div>
                  <input type="text" value={opForm.placarManual} onChange={e=>setOpForm(p=>({...p,placarManual:e.target.value,placar:""}))}
                    placeholder="Outro placar, ex: 3x1"
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1.5" />
                </div>
              )}
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Time</label>
                <input ref={opTimeInputRef} type="text" value={opForm.time.startsWith("__")?"":opForm.time} list="dl-op-times"
                  onChange={e=>{setOpForm(p=>({...p,time:e.target.value}));setOpNovaTime(e.target.value);}}
                  placeholder="Digite: ex. Arsenal"
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
                <datalist id="dl-op-times">
                  {sugestoesLista(times,opForm.time,10).map(t=><option key={t.id} value={t.nome} />)}
                </datalist>
                {opForm.time && !times.some(t=>normBusca(t.nome)===normBusca(opForm.time)) && (
                  <div className="flex items-center justify-between mt-1 px-1">
                    <span className="font-mono text-[8px] text-[#f59e0b]">Time ainda não cadastrado</span>
                    <button type="button" onClick={()=>{const n=opForm.time.trim();if(!n)return;adicionarTime(n);setLastTime(n);}} className="btn-small text-[8px]">+ Cadastrar</button>
                  </div>
                )}
              </div>
              {opForm.jogo&&<div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Jogo</label>
                <input type="text" value={opForm.jogo} onChange={e=>setOpForm(p=>({...p,jogo:e.target.value}))}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
              </div>}
              {opForm.origem&&opForm.origem!=="manual"&&<div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Origem</label>
                <input type="text" value={opForm.origem} readOnly
                  className="w-full font-mono text-xs text-[#aab7ac] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 mt-1" />
              </div>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">{opForm.metodo==="LAY"?"Responsabilidade":"Valor da entrada"}</label>
                  <div className="flex items-center gap-0.5 mt-1">
                    <span className="font-mono text-[10px]" style={{color:opForm.metodo==="LAY"?"#A6432D":"#6a7d6a"}}>{opForm.metodo==="LAY"?"-R$":"R$"}</span>
                    {opForm.metodo==="LAY" ? (
                      <input type="text" inputMode="decimal" value={opForm.responsabilidade} onChange={e=>{setOpForm(p=>({...p,responsabilidade:e.target.value}));setOpCalcTocado(false);}}
                        placeholder="180,00"
                        className="flex-1 font-mono text-xs text-[#A6432D] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                    ) : (
                      <input type="text" inputMode="decimal" value={opForm.entrada} onChange={e=>{setOpForm(p=>({...p,entrada:e.target.value}));setOpCalcTocado(false);}}
                        placeholder="100,00"
                        className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                    )}
                  </div>
                  {opForm.metodo==="LAY" && <div className="font-mono text-[8px] text-[#6a7d6a] mt-1 px-0.5">O que você topa perder se o LAY for RED.</div>}
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Odd</label>
                  <input type="text" inputMode="decimal" value={opForm.odd} onChange={e=>{setOpForm(p=>({...p,odd:e.target.value}));setOpCalcTocado(false);}}
                    placeholder="Ex: 1.50"
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
                </div>
              </div>
              {opForm.metodo!=="LAY" && stakeMultiplierRow("entrada", false)}
              {opForm.metodo==="LAY" && (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Entrada (Stake) — calculada</label>
                  <div className="flex items-center gap-0.5 mt-1">
                    <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                    <input type="text" inputMode="decimal" value={opForm.entrada} onChange={e=>{setOpForm(p=>({...p,entrada:e.target.value}));setOpCalcTocado(true);}}
                      placeholder="0,00"
                      className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                  </div>
                  <div className="font-mono text-[8px] text-[#6a7d6a] mt-1 px-0.5">Calculada como Responsabilidade ÷ (Odd − 1). Edite se necessário.</div>
                  {stakeMultiplierRow("entrada", true)}
                </div>
              )}
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Lucro possível</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="font-mono text-[10px] text-[#4C8C5C]">+R$</span>
                  <input type="text" inputMode="decimal" value={opForm.lucroPossivel} onChange={e=>{setOpForm(p=>({...p,lucroPossivel:e.target.value}));setOpCalcTocado(true);}}
                    placeholder="0,00"
                    className="flex-1 font-mono text-xs text-[#4C8C5C] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]" />
                </div>
                <div className="font-mono text-[8px] text-[#6a7d6a] mt-1 px-0.5">{opForm.metodo==="LAY"?"Igual ao Stake — o que você ganha se o LAY for GREEN.":"Calculado como Entrada × (Odd − 1)."} Edite se necessário.</div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Horário (opcional)</label>
                <input type="time" value={opForm.hora} onChange={e=>setOpForm(p=>({...p,hora:e.target.value}))}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1" />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Observação (opcional)</label>
                <input type="text" value={opForm.observacao} onChange={e=>setOpForm(p=>({...p,observacao:e.target.value}))}
                  onKeyDown={e=>{if(e.key==="Enter")salvarOp();}}
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1"
                  placeholder="Anotação rápida..." />
              </div>
              {opEditIdx==null && (
                <div className="font-mono text-[8px] text-[#6a7d6a] px-0.5">🟡 A operação é salva como "Aberta" — você Finaliza (Green/Red) depois.</div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setShowAddOp(false);setOpJogoOrigemId(null);setOpJogoMetodoOrigem(null);}} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={salvarOp} disabled={!opForm.metodo || !opForm.estrategiaBase} className="btn-primary py-2" style={{flex:1.5, opacity:(!opForm.metodo||!opForm.estrategiaBase)?0.5:1}}>
                {opEditIdx!=null?"Salvar":"Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanoHoje && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" style={{margin:0,padding:12}}>
          <div className="card" style={{width:390,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto"}}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-mono text-[9px] text-[#d8ae55] uppercase tracking-wider font-bold">🎯 Planejamento de hoje</div>
                <div className="font-mono text-sm text-[#e8e0cc] font-bold mt-1">{planoEditId?"Editar jogo":"Adicionar time para trabalhar"}</div>
                <div className="font-mono text-[8px] text-[#6a7d6a] mt-1">Defina antes do jogo o que pretende fazer. O histórico entra como apoio, não como decisão automática.</div>
              </div>
              <button className="btn-small" onClick={()=>setShowPlanoHoje(false)}>✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Time</label>
                  <input list="times-plano-hoje" value={planoForm.time} onChange={e=>setPlanoForm(p=>({...p,time:e.target.value}))} placeholder="Ex: Palmeiras"
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1" autoFocus />
                  <datalist id="times-plano-hoje">{times.filter(t=>t.ativa!==false).map(t=><option key={t.id} value={t.nome}/>)}</datalist>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Adversário</label>
                  <input value={planoForm.adversario} onChange={e=>setPlanoForm(p=>({...p,adversario:e.target.value}))} placeholder="Opcional"
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Horário</label>
                  <input type="time" value={planoForm.hora} onChange={e=>setPlanoForm(p=>({...p,hora:e.target.value}))}
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Lembrar antes</label>
                  <select value={planoForm.lembrete} onChange={e=>setPlanoForm(p=>({...p,lembrete:Number(e.target.value)}))}
                    className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1">
                    {[5,10,15,30,60].map(n=><option key={n} value={n}>{n} minutos</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Estratégia planejada</label>
                <input list="estrategias-plano-hoje" value={planoForm.estrategia} onChange={e=>setPlanoForm(p=>({...p,estrategia:e.target.value}))} placeholder="Ex: BACK FAVORITO"
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1" />
                <datalist id="estrategias-plano-hoje">
                  {["BACK FAVORITO","BACK ZEBRA","BACK VARIOS RESULTADOS","LAY 1X1","LAY 0X1",...estrategias.filter(e=>e.ativa!==false).map(e=>e.nome)].filter((v,i,a)=>v&&a.indexOf(v)===i).map(v=><option key={v} value={v}/>)}
                </datalist>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">O que pretendo fazer</label>
                <textarea value={planoForm.pretendo} onChange={e=>setPlanoForm(p=>({...p,pretendo:e.target.value}))} rows={3}
                  placeholder="Ex: entrar só se o favorito pressionar; buscar saída no intervalo; não entrar acima de odd 1,80..."
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 outline-none focus:border-[#c6a15b] mt-1 resize-none" />
              </div>
              {planoForm.estrategia && planoForm.time && (()=>{
                const temp={...planoForm,estrategia:normEstrategia(planoForm.estrategia)};
                const ins=insightsDoPlano(temp);
                return <div><div className="font-mono text-[8px] text-[#6a7d6a] uppercase mb-1">Pré-análise do histórico</div>{ins.map((m,i)=><div key={i} className={`plan-insight ${m.tipo}`}>{m.tipo==="bad"?"⚠️ ":m.tipo==="good"?"💡 ":"ℹ️ "}{m.texto}</div>)}</div>;
              })()}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1 py-2" onClick={()=>setShowPlanoHoje(false)}>Cancelar</button>
              <button className="btn-primary py-2" style={{flex:1.4}} onClick={salvarPlanoHoje}>Salvar planejamento</button>
            </div>
          </div>
        </div>
      )}

      {estratEditarOpId && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.84)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:125}}>
        <div className="card" style={{width:"92%",maxWidth:360,maxHeight:"88vh",overflowY:"auto"}}>
          <div className="font-mono text-[11px] text-[#c6a15b] font-bold uppercase mb-1">✏ Editar operação</div>
          <div className="font-mono text-[8px] text-[#6a7d6a] mb-3">A entrada/responsabilidade continua automática e não é editada aqui.</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={estratEditarForm.jogo} onChange={e=>setEstratEditarForm(p=>({...p,jogo:e.target.value}))} placeholder="Jogo" className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" />
            <input value={estratEditarForm.time} onChange={e=>setEstratEditarForm(p=>({...p,time:e.target.value}))} placeholder="Time / seleção" className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" />
          </div>
          <div className="flex gap-1 mb-2">
            <select value={estratEditarForm.estrategia} onChange={e=>setEstratEditarForm(p=>({...p,estrategia:e.target.value}))} className="flex-1 font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]"><option value="Não definida">Estratégia</option>{estrategias.filter(e=>e.ativa!==false).map(e=><option key={e.id} value={e.nome}>{e.nome}</option>)}</select>
            <button type="button" onClick={()=>setShowGerEstrategias(true)} className="btn-small text-[8px] px-2" style={{borderColor:"#c6a15b",color:"#c6a15b"}}>＋</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2"><select value={estratEditarForm.metodo} onChange={e=>setEstratEditarForm(p=>({...p,metodo:e.target.value}))} className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]"><option value="">BACK ou LAY</option><option value="BACK">BACK</option><option value="LAY">LAY</option></select><input type="text" inputMode="decimal" value={estratEditarForm.odd} onChange={e=>setEstratEditarForm(p=>({...p,odd:e.target.value}))} placeholder="Odd" className="font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></div>
          <div className="card-soft mb-2"><div className="font-mono text-[7px] text-[#6a7d6a]">RESULTADO</div><div className="grid grid-cols-3 gap-1 mt-1">{[["","ABERTA"],["green","🟢 GREEN"],["red","🔴 RED"],["green_parcial","🟢 GREEN PARCIAL"],["red_parcial","🔴 RED PARCIAL"]].map(([v,l])=><button key={v||"aberta"} type="button" onClick={()=>setEstratEditarForm(p=>({...p,resultadoTipo:v}))} className="btn-small text-[8px]" style={estratEditarForm.resultadoTipo===v?{borderColor:"#c6a15b",color:"#c6a15b",background:"rgba(198,161,91,.08)"}:{}}>{l}</button>)}</div>{(estratEditarForm.resultadoTipo==="red_parcial"||estratEditarForm.resultadoTipo==="green_parcial")&&<input type="text" inputMode="decimal" value={estratEditarForm.resultadoValor} onChange={e=>setEstratEditarForm(p=>({...p,resultadoValor:e.target.value}))} placeholder={estratEditarForm.resultadoTipo==="green_parcial"?"Lucro realizado":"Perda realizada"} className="w-full mt-2 font-mono text-xs bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" />}</div>
          <input value={estratEditarForm.observacao} onChange={e=>setEstratEditarForm(p=>({...p,observacao:e.target.value}))} placeholder="Observação" className="w-full font-mono text-[9px] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc] mb-3" />
          <div className="flex gap-2"><button className="btn-secondary flex-1" onClick={()=>setEstratEditarOpId(null)}>Cancelar</button><button className="btn-primary flex-1" onClick={salvarEdicaoEstrat}>Salvar alterações</button></div>
        </div>
      </div>}

      {estratFinalizarId && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:120}}>
        <div className="card" style={{width:"92%",maxWidth:340}}>
          <div className="font-mono text-[11px] text-[#c6a15b] font-bold uppercase mb-1">🏁 Registrar resultado</div>
          <div className="font-mono text-[8px] text-[#6a7d6a] mb-3">Escolha o resultado e informe o valor realizado.</div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[['green','🟢 GREEN'],['red','🔴 RED'],['green_parcial','🟢 GREEN PARCIAL'],['red_parcial','🔴 RED PARCIAL']].map(([v,l])=><button key={v} type="button" onClick={()=>setEstratFinalizarTipo(v)} className="btn-small py-3 font-bold text-[10px]" style={estratFinalizarTipo===v?{borderColor:v==='green'?"#4C8C5C":"#A6432D",color:v==='green'?"#4C8C5C":"#A6432D",background:"rgba(198,161,91,.10)"}:{}}>{l}</button>)}
          </div>
          {estratFinalizarTipo==="green" ? <div className="card-soft mt-2"><div className="font-mono text-[8px] text-[#6a7d6a]">GREEN AUTOMÁTICO PELA ODD</div><div className="font-mono text-lg font-bold text-[#4C8C5C]">+{(()=>{const c=estratCiclos.find(c=>c.id===estratCicloSel);const o=(c?.operacoes||[]).find(o=>o.id===estratFinalizarId);return fmt(lucroGreenPorOdd(o));})()}</div><div className="font-mono text-[7px] text-[#6a7d6a]">entrada × (odd − 1) · ex.: 1,30 = 30%</div></div> : estratFinalizarTipo==="red" ? <div className="card-soft mt-2"><div className="font-mono text-[8px] text-[#6a7d6a]">RED AUTOMÁTICO</div><div className="font-mono text-lg font-bold text-[#A6432D]">-{(()=>{const c=estratCiclos.find(c=>c.id===estratCicloSel);const o=(c?.operacoes||[]).find(o=>o.id===estratFinalizarId);return fmt(Number(o?.entrada||0));})()}</div></div> : estratFinalizarTipo==="green_parcial" ? <><label className="font-mono text-[8px] text-[#6a7d6a] uppercase">Lucro realizado</label><input type="text" inputMode="decimal" value={estratFinalizarValor} onChange={e=>{setEstratFinalizarValor(e.target.value);setEstratFinalizarErro("")}} placeholder="Ex.: 18,50" className="w-full mt-1 font-mono text-sm bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></> : <><label className="font-mono text-[8px] text-[#6a7d6a] uppercase">Perda realizada</label><input type="text" inputMode="decimal" value={estratFinalizarValor} onChange={e=>{setEstratFinalizarValor(e.target.value);setEstratFinalizarErro("")}} placeholder="Ex.: 8,50" className="w-full mt-1 font-mono text-sm bg-[#0a1410] border border-[#1e3228] rounded px-2 py-2 text-[#e8e0cc]" /></>}
          {estratFinalizarErro && <div className="font-mono text-[8px] text-[#e05252] mt-1">{estratFinalizarErro}</div>}
          <div className="flex gap-2 mt-3"><button className="btn-secondary flex-1" onClick={()=>{setEstratFinalizarId(null);setEstratFinalizarTipo("");setEstratFinalizarValor("")}}>Cancelar</button><button className="btn-primary flex-1" onClick={confirmarFinalizarEstrat}>Salvar resultado</button></div>
        </div>
      </div>}

      {showFinalizarOp && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div className="card" style={{maxWidth:320,width:"92%",padding:16}}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>🏁</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Finalizar Operação</div>
              <div className="font-mono text-[9px] text-[#6a7d6a] mt-1">Escolha o resultado e registre a saída</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Resultado</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <button type="button" onClick={()=>{
                      setFinalizarTipo("green");setFinalizarErro("");
                      const op = finalizarAlvo && (operacoes[kw(finalizarAlvo.sem,finalizarAlvo.dia)]||[])[finalizarAlvo.idx];
                      if(op) {
                        const sugestao = op.lucroPossivel!=null ? op.lucroPossivel : (op.tipo==="LAY" && op.entrada!=null ? op.entrada : null);
                        if(sugestao!=null) setFinalizarValor(String(sugestao).replace(".",","));
                      }
                    }}
                    className="btn-small py-4 text-[14px] font-bold" style={finalizarTipo==="green"?{borderColor:"#4C8C5C",color:"#4C8C5C",background:"rgba(76,140,92,0.15)"}:{}}>🟢 GREEN</button>
                  <button type="button" onClick={()=>{
                      setFinalizarTipo("red");setFinalizarErro("");
                      const op = finalizarAlvo && (operacoes[kw(finalizarAlvo.sem,finalizarAlvo.dia)]||[])[finalizarAlvo.idx];
                      if(op) {
                        const sugestao = op.tipo==="LAY" ? (op.responsabilidade!=null?op.responsabilidade:null) : (op.entrada!=null?op.entrada:null);
                        if(sugestao!=null) setFinalizarValor(String(sugestao).replace(".",","));
                      }
                    }}
                    className="btn-small py-4 text-[14px] font-bold" style={finalizarTipo==="red"?{borderColor:"#A6432D",color:"#A6432D",background:"rgba(166,67,45,0.15)"}:{}}>🔴 RED</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Lucro realizado</label>
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="font-mono text-[10px] text-[#6a7d6a]">R$</span>
                  <input type="text" inputMode="decimal" value={finalizarValor} onChange={e=>{setFinalizarValor(e.target.value);setFinalizarErro("");}}
                    onKeyDown={e=>{if(e.key==="Enter")confirmarFinalizarOp();if(e.key==="Escape")setShowFinalizarOp(false);}}
                    className="flex-1 font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b]"
                    placeholder="Ex: 18,00" autoFocus />
                </div>
                <div className="font-mono text-[8px] text-[#6a7d6a] mt-1 px-0.5">Digite sempre um valor positivo — o sinal é definido pela opção escolhida acima. Já vem preenchido com o valor calculado (Lucro possível/Responsabilidade); edite para registrar saída parcial (cash out).</div>
                {finalizarErro && <div className="font-mono text-[8px] text-[#e05252] mt-1 px-0.5">{finalizarErro}</div>}
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[#6a7d6a] font-semibold">Minuto da saída</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {MINUTOS_SAIDA.map(m=>(
                    <button key={m} type="button" onClick={()=>setFinalizarMinuto(m)}
                      className="btn-small py-1.5 text-[9px]" style={{flex:"1 0 21%",...(finalizarMinuto===m?{borderColor:"#c6a15b",color:"#c6a15b",background:"rgba(198,161,91,0.1)"}:{})}}>{rotuloMinuto(m)}</button>
                  ))}
                </div>
                <input type="text" value={finalizarMinuto} onChange={e=>setFinalizarMinuto(e.target.value)}
                  placeholder="Outro minuto, ex: 25"
                  className="w-full font-mono text-xs text-[#e8e0cc] bg-[#0a1410] border border-[#1e3228] rounded px-2 py-1.5 outline-none focus:border-[#c6a15b] mt-1.5" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowFinalizarOp(false)} className="btn-secondary flex-1 py-2">Cancelar</button>
              <button onClick={()=>{ if(!finalizarTipo){setFinalizarErro("Escolha uma opção de resultado.");return;} confirmarFinalizarOp(); }} className="btn-primary py-2" style={{flex:1.5}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showEspelhoDetalhe && espelhoStatus && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}
          onClick={()=>setShowEspelhoDetalhe(false)}>
          <div className="card" style={{maxWidth:320,width:"92%",padding:16}} onClick={e=>e.stopPropagation()}>
            <div className="text-center mb-3">
              <span style={{fontSize:20}}>🧠</span>
              <div className="font-mono text-sm text-[#e8e0cc] mt-1 font-bold">Status do Espelho</div>
              <div className="font-mono text-[10px] mt-1 font-bold" style={{color:espelhoStatus.diff>=0?"#4C8C5C":"#A6432D"}}>
                {espelhoStatus.diff>=0?"🟢 À FRENTE DO PLANO":"🔴 ATRÁS DO PLANO"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Esperado pelo espelho hoje</span>
                <span className="font-mono text-[11px] font-bold text-[#c6a15b]">{fmt(espelhoStatus.espelho)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Banca atual</span>
                <span className="font-mono text-[11px] font-bold text-[#e8e0cc]">{fmt(espelhoStatus.atual)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Diferença</span>
                <span className="font-mono text-[11px] font-bold" style={{color:espelhoStatus.diff>=0?"#4C8C5C":"#A6432D"}}>{espelhoStatus.diff>=0?"+":""}{fmt(espelhoStatus.diff)}</span>
              </div>
              <div className="bar-container mt-1">
                <div className="bar-fill" style={{width:`${Math.max(0,Math.min(100,espelhoStatus.progresso))}%`,background:espelhoStatus.diff>=0?"#4C8C5C":"#c6a15b"}}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#6a7d6a]">Progresso frente ao espelho</span>
                <span className="font-mono text-[11px] font-bold" style={{color:espelhoStatus.diff>=0?"#4C8C5C":"#A6432D"}}>{espelhoStatus.progresso}%</span>
              </div>
            </div>
            <button onClick={()=>setShowEspelhoDetalhe(false)} className="btn-secondary w-full py-2 mt-4">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

class ErroLimite extends React.Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) { console.error(erro, info); }
  render() {
    if (this.state.erro) {
      return (
        <div className="bg-app" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:20,textAlign:"center"}}>
          <span style={{fontSize:28}}>⚠️</span>
          <h2 style={{color:"#c6a15b",fontFamily:"'Inter',sans-serif"}}>Algo deu errado</h2>
          <p className="font-mono text-xs text-[#6a7d6a]" style={{maxWidth:280}}>{this.state.erro.message}</p>
          <p className="font-mono text-[10px] text-[#4a5a4a]">Seus dados estão salvos, pode recarregar sem perder nada.</p>
          <button onClick={()=>window.location.reload()} className="btn-primary" style={{marginTop:14,maxWidth:200}}>Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}
