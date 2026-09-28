/* =====================================================================
 * OP (Ordem de Produção) + APONTAMENTO POR ÁUDIO
 * ---------------------------------------------------------------------
 * Modelo de dados (localStorage, chave "apontamento-industrial-v1"):
 *   pedido     -> numero_op : string ("" quando não há OP)      [NOVO, opcional]
 *   apontamento-> op        : string ("" quando não há OP)      [NOVO]
 *                 origin    : "manual" | "audio"                [NOVO]
 *                 user      : string (quem lançou)              [NOVO]
 *                 createdAt : ISO string (data/hora do lançamento) [NOVO]
 * Registros antigos não são reescritos: opNormalize() só preenche os campos
 * novos com valores padrão na leitura (migração sem perda de dados).
 * ===================================================================== */

/** Migração na leitura: pedidos antigos ganham numero_op:"" e apontamentos
 *  antigos ganham op:"", origin:"manual", user:"". Nada existente é alterado. */
function opNormalize(st) {
  try {
    return {
      ...st,
      orders: (st.orders || []).map((o) => ({ numero_op: "", ...o })),
      productions: (st.productions || []).map((p) => ({ op: "", origin: "manual", user: "", ...p })),
    };
  } catch {
    return st;
  }
}

/** Remove separador de milhar ("1.500" -> "1500") sem juntar números separados por espaço. */
function opThousands(t) {
  let prev;
  do {
    prev = t;
    t = t.replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
  } while (t !== prev);
  return t;
}

/**
 * Extrai pedido, OP e quantidade de uma frase falada.
 *  "apontar pedido 12548 OP 202600145 quantidade 100"
 *  "pedido 12548 quantidade 50"
 *  "OP 202600145 apontar 200 peças"
 */
function opParseVoice(raw) {
  const t = opThousands(String(raw || "").toLowerCase());
  const opM = t.match(/\bop\b\s*(?:n[úu]mero\s*)?(\d{3,})/) ||
    t.match(/ordem\s+de\s+produ[çc][ãa]o\s*(?:n[úu]mero\s*)?(\d{3,})/);
  const pedM = t.match(/pedido\s*(?:n[úu]mero\s*)?(\d+)/);
  let rest = t;
  [opM, pedM].forEach((m) => { if (m) rest = rest.replace(m[0], " "); });
  const qM =
    rest.match(/(?:quantidade|qtd|apontar|apontei|produzi(?:das?)?)\s*(?:de\s*)?(\d+(?:,\d+)?)\s*(mil)?/) ||
    rest.match(/(\d+(?:,\d+)?)\s*(mil)?\s*(?:pe[çc]as?|unidades?|un\b|cadernos|agendas)/) ||
    rest.match(/(\d+(?:,\d+)?)\s*(mil)?/);
  const qty = qM ? Math.round(Number(qM[1].replace(",", ".")) * (qM[2] ? 1000 : 1)) : 0;
  return { pedido: pedM ? pedM[1] : "", op: opM ? opM[1] : "", qty };
}

/**
 * Valida o que foi falado contra os pedidos cadastrados.
 * Retorna { ok, order, op, qty, msg }. Só registra quando ok === true.
 *  - pedido existe? OP existe/está vinculada? quantidade válida?
 *  - sem pedido e sem OP  -> pede pedido ou OP
 *  - pedido/OP sem quantidade -> pede a quantidade
 *  - OP diferente da OP cadastrada no pedido -> bloqueia e avisa
 */
function opResolveVoice(text, orders) {
  const p = opParseVoice(text);
  const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);
  if (!p.pedido && !p.op) {
    return {
      ok: false,
      msg: p.qty
        ? `Identifiquei a quantidade ${fmt(p.qty)}, informe o número do pedido ou OP.`
        : "Não entendi. Diga, por exemplo: pedido 0118 OP 202600145 quantidade 100.",
    };
  }
  const byPed = p.pedido ? orders.find((o) => Number(o.number) === Number(p.pedido)) : null;
  const byOp = p.op ? orders.find((o) => o.numero_op && String(o.numero_op) === p.op) : null;
  if (p.pedido && !byPed) return { ok: false, msg: `Pedido ${p.pedido} não encontrado.` };
  if (!p.pedido && !byOp) {
    return { ok: false, msg: `OP ${p.op} não está vinculada a nenhum pedido. Informe o número do pedido.` };
  }
  const order = byPed || byOp;
  if (byPed && p.op && byPed.numero_op && String(byPed.numero_op) !== p.op) {
    return { ok: false, msg: `A OP ${p.op} não é a OP do pedido ${byPed.number} (OP cadastrada: ${byPed.numero_op}).` };
  }
  const op = p.op || order.numero_op || "";
  if (!(p.qty > 0)) {
    return { ok: false, order, op, msg: `Identifiquei o pedido ${order.number}${op ? ` (OP ${op})` : ""}, informe a quantidade.` };
  }
  return { ok: true, order, op, qty: p.qty };
}

/** Resumo exibido após salvar (Pedido / OP / Quantidade / Data / Origem). */
function opSummary(d, orders) {
  const od = orders.find((x) => x.id === d.orderId);
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const linhas = [
    "Pedido: " + (od ? od.number : "-"),
    "OP: " + (d.op || "-"),
    "Quantidade: " + Yt(d.produced) + " unidades",
    "Data: " + bm(d.date) + " " + hora,
    "Origem: " + (d.origin === "audio" ? "Áudio" : "Manual"),
  ];
  return s.jsx("div", { className: "op-summary", children: linhas.map((l) => s.jsx("div", { children: l }, l)) });
}

/** Modal "Novo apontamento": manual (Pedido, OP, Quantidade, Data, Usuário) + voz. */
function $p({ store: r, saving: y, onClose: g, onSave: o }) {
  const first = r.orders[0];
  const [C, N] = bt.useState(first?.id ?? "");                  // pedido selecionado
  const [E, z] = bt.useState("");                              // quantidade produzida
  const [O, S] = bt.useState("");                              // defeituosa
  const [q, h] = bt.useState(mn);                              // data
  const [k, Tt] = bt.useState("");                             // observação
  const [st, Ct] = bt.useState("");                            // texto reconhecido
  const [opv, setOp] = bt.useState(first?.numero_op ?? "");    // OP (auto pelo pedido, editável)
  const [usr, setUsr] = bt.useState(() => {
    try { return localStorage.getItem("apontamento-usuario") || ""; } catch { return ""; }
  });
  const [lst, setLst] = bt.useState(false);                    // gravando?
  const [vm, setVm] = bt.useState(null);                       // feedback da voz {type,text}
  const recRef = bt.useRef(null);
  bt.useEffect(() => () => { try { recRef.current && recRef.current.abort(); } catch {} }, []);

  const Gt = r.orders.find((W) => W.id === C);
  const K = Math.max(0, Number(E || 0) - Number(O || 0));
  const It = Math.max(0, (Gt?.requested ?? 0) - ca(r.productions, C));

  /** Envia o lançamento ao salvamento existente do app (mesmo fluxo do manual). */
  function commit(order, opVal, prod, def, origin, note) {
    try { localStorage.setItem("apontamento-usuario", usr); } catch {}
    o({
      orderId: order.id, op: String(opVal || "").trim(), produced: prod, defective: def,
      date: q, note, origin, user: (usr || "").trim() || "Operador",
    });
  }

  /** Interpreta a frase, preenche o formulário e registra sozinho se estiver completa. */
  function handleTranscript(t) {
    const res = opResolveVoice(t, r.orders);
    if (res.order) { N(res.order.id); setOp(res.op); }
    if (res.qty) z(String(res.qty));
    S("");
    if (!res.ok) { setVm({ type: "warn", text: res.msg }); return; }
    setVm({ type: "ok", text: `Reconhecido: pedido ${res.order.number}${res.op ? ` · OP ${res.op}` : ""} · quantidade ${Yt(res.qty)}. Registrando…` });
    commit(res.order, res.op, res.qty, 0, "audio", "Lançado por voz");
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; // Chrome usa o prefixo webkit
    if (!SR) {
      je.info("Seu navegador não oferece reconhecimento de voz", { description: "Use o preenchimento manual." });
      return;
    }
    if (lst && recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = "pt-BR"; rec.interimResults = true; rec.maxAlternatives = 1;
    recRef.current = rec;
    let finalText = "";
    rec.onstart = () => { setLst(true); setVm({ type: "info", text: "Ouvindo… fale o pedido, a OP e a quantidade." }); };
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      finalText = t; Ct(t);
    };
    rec.onerror = (e) => {
      setLst(false);
      setVm({ type: "error", text: e.error === "not-allowed" ? "Permissão do microfone negada." : e.error === "no-speech" ? "Não ouvi nada. Tente novamente." : "Não foi possível ouvir o lançamento." });
    };
    rec.onend = () => { setLst(false); if (finalText.trim()) handleTranscript(finalText); };
    try { rec.start(); } catch {}
  }

  return s.jsxs(Hm, {
    title: "Novo apontamento", eyebrow: "LANÇAMENTO DIÁRIO", onClose: () => !y && g(), wide: !0,
    children: [
      s.jsxs("div", { className: `modal-saving-bar ${y ? "is-saving" : ""}`, "aria-live": "polite", children: [
        s.jsx("span", { className: "save-spinner" }), " ",
        y ? "Salvando apontamento com segurança..." : "Os dados serão salvos localmente neste dispositivo.",
      ] }),
      s.jsxs("div", { className: `voice-capture ${lst ? "is-listening" : ""}`, children: [
        s.jsx("div", { className: "voice-icon", children: s.jsx(sm, { size: 21 }) }),
        s.jsxs("div", { children: [
          s.jsx("strong", { children: "Entrada rápida por voz" }),
          s.jsx("span", { children: "Ex.: “pedido 0118 OP 202600145 quantidade 100” ou “pedido 0118 quantidade 50”." }),
        ] }),
        lst && s.jsxs("span", { className: "voice-wave", "aria-hidden": !0, children: [s.jsx("i", {}), s.jsx("i", {}), s.jsx("i", {}), s.jsx("i", {})] }),
        s.jsxs("button", { className: `voice-btn ${lst ? "is-listening" : ""}`, onClick: startVoice, disabled: y, children: [
          s.jsx(sm, { size: 16 }), lst ? " Gravando… toque para parar" : " Ouvir agora",
        ] }),
      ] }),
      vm && s.jsx("div", { className: `voice-feedback vf-${vm.type}`, role: "status", children: vm.text }),
      s.jsx("div", { className: "or-divider", children: s.jsx("span", { children: "ou preencha manualmente" }) }),
      s.jsxs("div", { className: "modal-form", children: [
        s.jsxs("div", { className: "form-grid", children: [
          s.jsx(Ft, { label: "Pedido de produção", children: s.jsx("select", {
            value: C, disabled: y,
            onChange: (W) => { N(W.target.value); const od = r.orders.find((x) => x.id === W.target.value); setOp(od?.numero_op ?? ""); },
            children: r.orders.map((W) => s.jsxs("option", { value: W.id, children: [
              "#", W.number, W.numero_op ? ` · OP ${W.numero_op}` : "", " · ", Ce(r.products, W.productId), " ", Ta(r.models, W.modelId),
              " · saldo ", Yt(Math.max(0, W.requested - ca(r.productions, W.id))),
            ] }, W.id)),
          }) }),
          s.jsx(Ft, { label: "OP (opcional)", children: s.jsx("input", {
            value: opv, disabled: y, inputMode: "numeric", placeholder: "Preenche pelo pedido",
            onChange: (W) => setOp(W.target.value.replace(/\D/g, "")),
          }) }),
        ] }),
        s.jsxs("div", { className: "form-grid three", children: [
          s.jsx(Ft, { label: "Quantidade produzida", children: s.jsx("input", { autoFocus: !0, type: "number", value: E, onChange: (W) => z(W.target.value), placeholder: "2.000", disabled: y }) }),
          s.jsx(Ft, { label: "Quantidade defeituosa (opcional)", children: s.jsx("input", { type: "number", value: O, onChange: (W) => S(W.target.value), placeholder: "20", disabled: y }) }),
          s.jsx(Ft, { label: "Data", children: s.jsx("input", { type: "date", value: q, onChange: (W) => h(W.target.value), disabled: y }) }),
        ] }),
        s.jsxs("div", { className: "validity-preview", children: [
          s.jsxs("div", { children: [s.jsx("span", { children: "Produção válida" }), s.jsxs("strong", { children: [Yt(K), " ", s.jsx("small", { children: "unidades" })] })] }),
          s.jsx("div", { className: "preview-arrow", children: s.jsx(kh, { size: 17 }) }),
          s.jsxs("div", { children: [s.jsx("span", { children: "Saldo após lançamento" }), s.jsxs("strong", { children: [Yt(Math.max(0, It - K)), " ", s.jsx("small", { children: "unidades" })] })] }),
        ] }),
        s.jsxs("div", { className: "form-grid", children: [
          s.jsx(Ft, { label: "Observação", children: s.jsx("input", { value: k, onChange: (W) => Tt(W.target.value), placeholder: "Turno, máquina, observações do lote...", disabled: y }) }),
          s.jsx(Ft, { label: "Usuário", children: s.jsx("input", { value: usr, onChange: (W) => setUsr(W.target.value), placeholder: "Quem está lançando", disabled: y }) }),
        ] }),
        st && s.jsxs("div", { className: "interpreted", children: [s.jsx(hn, { size: 15 }), " Interpretado de: “", st, "”"] }),
      ] }),
      s.jsx(jm, {
        saving: y, onClose: g, label: "Salvar apontamento",
        onSave: () => !Gt ? je.error("Selecione um pedido")
          : Number(E) > 0 && Number(O || 0) <= Number(E)
            ? commit(Gt, opv, Number(E), Number(O || 0), "manual", k)
            : je.error("Confira as quantidades informadas"),
      }),
    ],
  });
}

