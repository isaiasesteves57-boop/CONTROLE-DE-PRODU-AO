/* =====================================================================
   CONTROLE DE PRODUÇÃO — Leitura de Pedido por Foto/PDF (Etapa 5)

   Lê uma imagem (foto do pedido em papel) ou um PDF recebido do cliente
   e tenta extrair automaticamente:
     • Código do produto
     • Descrição do produto
     • Quantidade solicitada

   Usa duas bibliotecas carregadas SOB DEMANDA (só quando o gestor usa
   "Ler pedido"), direto de CDN — não pesam no carregamento normal do
   app nem entram no cache do Service Worker:
     • PDF.js       → lê o texto de PDFs digitais e desenha páginas
                       escaneadas (sem camada de texto) num canvas
     • Tesseract.js → OCR (reconhecimento de texto em imagem), em
                       português

   IMPORTANTE: é preciso ter internet na PRIMEIRA vez que este recurso
   for usado, só para baixar essas duas bibliotecas (o navegador guarda
   em cache depois). Isso não afeta o restante do app, que continua
   funcionando 100% offline como antes.

   Este módulo só faz a EXTRAÇÃO de texto/valores brutos a partir do
   arquivo — quem decide o que fazer com o resultado (achar o produto
   no catálogo, o cliente cadastrado, etc.) é o app.js, que já tem esse
   cadastro em memória. Nada aqui salva dado nenhum sozinho.
   ===================================================================== */
(function () {
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js";

  let pdfjsReady = null;
  let tesseractReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Não foi possível baixar o leitor (" + src + "). Verifique sua conexão com a internet."));
      document.head.appendChild(s);
    });
  }

  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (!pdfjsReady) {
      pdfjsReady = loadScript(PDFJS_URL).then(() => {
        if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        }
      });
    }
    return pdfjsReady;
  }

  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tesseractReady) tesseractReady = loadScript(TESSERACT_URL);
    return tesseractReady;
  }

  /* Aceita File, Blob ou <canvas> — o Tesseract.js lida com os três. */
  async function ocrImageLike(source) {
    await ensureTesseract();
    const { data } = await window.Tesseract.recognize(source, "por");
    return (data && data.text) || "";
  }

  async function readPdf(file) {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    /* Pedidos reais às vezes trazem observações/itens em páginas extras.
       Lemos até cinco páginas para preservar a cobertura sem travar o
       navegador em anexos muito grandes. */
    const maxPages = Math.min(pdf.numPages, 5);
    let text = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(" ").trim() + "\n";
    }
    /* PDF sem camada de texto (digitalizado/escaneado): desenha a 1ª
       página num canvas em boa resolução e faz OCR nela, igual a uma
       foto comum. */
    if (text.trim().length < 15) {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
      text = await ocrImageLike(canvas);
    }
    return text;
  }

  /* Localiza o valor de um campo rotulado — formato comum em pedidos
     digitados ou escritos à mão:
       "Código: AG C BCP 27"           (valor na mesma linha)
       "Código" \n "AG C BCP 27"       (valor na linha seguinte) */
  function extractLabeled(lines, labelRegex) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(labelRegex);
      if (!m) continue;
      const afterLabel = lines[i].slice(m[0].length).replace(/^[:\-\s]+/, "").trim();
      if (afterLabel) return afterLabel;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) return lines[j].trim();
      }
    }
    return "";
  }

  function onlyDigits(s) {
    return String(s || "").replace(/[^\d]/g, "");
  }

  function cleanLine(s) {
    return String(s || "").replace(/[|]/g, " ").replace(/[“”‘’]/g, "").replace(/\s+/g, " ").trim();
  }

  function normText(s) {
    return String(s || "").toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  /* Códigos impressos normalmente misturam blocos de letras e números,
     como "AG C BCP 27". Aceita pontuação/espaços extras do OCR sem
     transformar uma descrição inteira em código. */
  function looksLikeProductCode(line) {
    const s = normText(line);
    if (!s || s.length < 3 || s.length > 80 || /\d{3,}/.test(s)) return false;
    const parts = s.split(" ");
    if (parts.length < 2 || !parts.some(p => /\d/.test(p)) || !parts.some(p => /[A-Z]/.test(p))) return false;
    if (parts.every(p => /^\d+$/.test(p))) return false;
    return parts.every(p => /^[A-Z0-9]{1,12}$/.test(p));
  }

  function codeFromUnlabeled(lines) {
    const candidates = lines.filter(looksLikeProductCode);
    if (!candidates.length) return "";
    return candidates.sort((a, b) => {
      const score = x => {
        const parts = normText(x).split(" ");
        return parts.length * 3 + parts.filter(p => /\d/.test(p)).length * 2 - normText(x).length / 100;
      };
      return score(b) - score(a);
    })[0].trim();
  }

  function descriptionFromUnlabeled(lines, code, quantity) {
    const codeN = normText(code);
    const qty = String(quantity || "");
    return lines.find(line => {
      const n = normText(line);
      if (!n || (codeN && n === codeN)) return false;
      if (qty && onlyDigits(line) === qty) return false;
      if (looksLikeProductCode(line)) return false;
      return /[A-ZÀ-ÚÇÃÕ]/i.test(line) && line.length >= 5 && !/^\d[\d.\s]*$/.test(line);
    }) || "";
  }

  function parsePedido(rawText) {
    const lines = String(rawText || "").split(/\r?\n/).map(cleanLine).filter(Boolean);

    const codeRaw = extractLabeled(lines, /^c[oó]digo\b/i);
    const descRaw = extractLabeled(lines, /^(produto|descri[cç][aã]o)\b/i);
    const qtyRaw = extractLabeled(lines, /^quantidade\b/i);
    const clientRaw = extractLabeled(lines, /^(cliente|raz[aã]o\s+social)\b/i);
    const orderRaw = extractLabeled(lines, /^(?:n[º°o.]?\s*)?(?:do\s+)?pedido\b/i);

    /* Sem rótulo "Quantidade" reconhecido: usa como último recurso o
       maior número encontrado no texto (pedidos costumam ter só uma
       quantidade grande em destaque). */
    let quantity = onlyDigits(qtyRaw);
    if (!quantity) {
      const numbers = (String(rawText || "").match(/\d[\d.\s]{2,}\d/g) || []).map(onlyDigits).filter(Boolean);
      if (numbers.length) quantity = numbers.sort((a, b) => Number(b) - Number(a))[0];
    }

    const guessedCode = codeRaw || codeFromUnlabeled(lines);
    const guessedDescription = descRaw || descriptionFromUnlabeled(lines, guessedCode, quantity);
    const inlineOrder = String(rawText || "").match(/(?:pedido|ordem)\s*(?:n[º°o.]?\s*)?[:#\-]?\s*(\d{3,})/i);
    const guessedOrderNumber = onlyDigits(orderRaw) || (inlineOrder ? inlineOrder[1] : "");
    const fieldsFound = [guessedCode, guessedDescription, quantity, clientRaw, guessedOrderNumber].filter(Boolean).length;
    return {
      rawText: rawText || "",
      guessedCode: guessedCode,
      guessedDescription: guessedDescription,
      guessedQuantity: quantity ? Number(quantity) : "",
      guessedClient: clientRaw,
      guessedOrderNumber: guessedOrderNumber,
      confidence: fieldsFound >= 4 ? "alta" : (fieldsFound >= 2 ? "media" : "baixa")
    };
  }

  async function lerArquivo(file) {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const rawText = isPdf ? await readPdf(file) : await ocrImageLike(file);
    return parsePedido(rawText);
  }

  window.LeituraPedido = { lerArquivo: lerArquivo, parsePedido: parsePedido };
})();
