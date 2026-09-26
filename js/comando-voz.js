/* =====================================================================
   CONTROLE DE PRODUÇÃO — Comando por Voz (Etapa 8)

   Exemplo de frase que o operador fala:
     "Cliente Papelaria, código AG C BCP 27, produzi 500 unidades,
      10 defeitos."

   Usa o reconhecimento de voz NATIVO do navegador (Web Speech API) —
   não baixa nada de CDN e não funciona sem internet nem em navegadores
   sem suporte (a tela sempre confere se está disponível antes de
   mostrar o botão de microfone).

   IMPORTANTE — mesma filosofia da Leitura de Pedido (Etapa 5/6): este
   módulo só TRANSCREVE e EXTRAI os números da fala. Nada é salvo
   sozinho — quem usa o resultado (preenche os campos, confere e toca
   em "Salvar produção") é a tela do operador (js/operador-app.js).
   ===================================================================== */
(function () {
  function suportado() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /* Ouve UMA frase do microfone e devolve o texto reconhecido (bruto). */
  function ouvir() {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { reject(new Error("Reconhecimento de voz não é compatível com este navegador.")); return; }
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let resolved = false;
      rec.onresult = function (e) {
        resolved = true;
        const texto = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "";
        resolve(texto);
      };
      rec.onerror = function (e) {
        if (resolved) return;
        const msg = e && e.error === "not-allowed"
          ? "Permissão do microfone negada."
          : (e && e.error === "no-speech" ? "Não ouvi nada — tente novamente." : "Não foi possível reconhecer a fala.");
        reject(new Error(msg));
      };
      rec.onend = function () {
        if (!resolved) reject(new Error("Não ouvi nada — tente novamente."));
      };
      try { rec.start(); } catch (e) { reject(new Error("Não foi possível acessar o microfone.")); }
    });
  }

  function onlyDigits(s) { return String(s || "").replace(/[^\d]/g, ""); }

  function normalizeCodigoFalado(s) {
    const parts = String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
    /* O reconhecimento costuma separar "27" em "2 7". Junta apenas
       blocos numéricos unitários consecutivos, preservando o restante. */
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      if (/^\d$/.test(parts[i]) && /^\d$/.test(parts[i + 1] || "")) out.push(parts[i] + parts[++i]);
      else out.push(parts[i]);
    }
    return out.join(" ");
  }

  /* Extrai cliente / código / quantidade produzida / defeitos de uma
     frase como "Cliente Papelaria, código AG C BCP 27, produzi 500
     unidades, 10 defeitos." Aceita variações comuns:
       "produzi 500", "quantidade 500", "500 unidades"
       "10 defeitos", "10 de refugo", "10 perdas" */
  function parseComando(textoBruto) {
    const t = String(textoBruto || "");

    let cliente = "";
    const mCliente = t.match(/cliente\s+([a-zà-úçã-õ0-9 ]+?)(?=,|\s+c[oó]digo\b|\s+produzi\b|\s+quantidade\b|$)/i);
    if (mCliente) cliente = mCliente[1].trim();

   let codigo = "";
   const mCodigo = t.match(/c[oó]digo\s+([a-z0-9 ]+?)(?=,|\s+cliente\b|\s+produzi\b|\s+quantidade\b|$)/i);
   if (mCodigo) codigo = normalizeCodigoFalado(mCodigo[1]);

    let numeroPedido = "";
    const mPedido = t.match(/(?:pedido|ordem)\s*(?:n[uú]mero|n[º°o.]?)?\s*(\d[\d.\s]*\d|\d)/i);
    if (mPedido) numeroPedido = onlyDigits(mPedido[1]);

    let quantidade = "";
    const mQtd = t.match(/(?:produzi|quantidade)\D{0,10}?(\d[\d.\s]*\d|\d)/i);
    if (mQtd) quantidade = onlyDigits(mQtd[1]);

    let defeitos = "";
    const mDef = t.match(/(\d[\d.\s]*\d|\d)\s*(?:de\s+)?(?:defeitos?|refugos?|perdas?)/i);
    if (mDef) defeitos = onlyDigits(mDef[1]);

    return {
      rawText: t,
      clienteRaw: cliente,
      codigoRaw: codigo,
      numeroPedido: numeroPedido,
      quantidade: quantidade ? Number(quantidade) : "",
      defeitos: defeitos ? Number(defeitos) : ""
    };
  }

  window.ComandoVoz = { suportado: suportado, ouvir: ouvir, parseComando: parseComando };
})();
