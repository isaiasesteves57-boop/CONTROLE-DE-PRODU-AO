/* =====================================================================
   CONTROLE DE PRODUÇÃO — App do Operador (operador.html)
   Fluxo: INICIAR → escolher máquina → material → rodando → fim do dia
          → OK + quantidade → lançamento salvo no app principal.
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;
  const root = document.getElementById("app");

  const SEED_CONFIG = [{ id: "default", companyName: "CONTROLE DE PRODUÇÃO", sector: "Setor de Furação", defectLimit: 1, dailyGoal: 0, pinHash: "" }];
  const SEED_MACHINES = [
    { id: "auto-1", name: "Automática 1", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "auto-2", name: "Automática 2", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "auto-3", name: "Automática 3", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "man-1", name: "Manual 1", type: "manual", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "man-2", name: "Manual 2", type: "manual", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 }
  ];
  const SEED_PRODUCTS = [
    { id: "agenda-classica", name: "Agenda Clássica", hasModels: true, models: ["Espiral", "Wero", "Smart", "Ficario"], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "agenda-media", name: "Agenda Média", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-80", name: "Caderno 80 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-140", name: "Caderno 140 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-160", name: "Caderno 160 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 }
  ];

  let machines = [], products = [], config = SEED_CONFIG[0];

  const st = {
    phase: "idle",
    machId: "",
    opName: "",
    productId: "",
    model: "",
    startTime: "",
    qty: "",
    def: "",
    opPin: "",
    lastDone: null
  };
  let timer = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function lsObj(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }

  function nowHM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function minsSince(startHM) {
    const [h, m] = String(startHM || "0:0").split(":").map(Number);
    const d = new Date();
    let mins = d.getHours() * 60 + d.getMinutes() - (h * 60 + (m || 0));
    if (mins < 0) mins += 1440;
    return mins;
  }
  function fmtDur(mins) {
    const h = Math.floor(mins / 60), mm = mins % 60;
    return h + "h " + String(mm).padStart(2, "0") + "min";
  }
  function fmtClock(totalSec) {
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  try { st.machId = lsGet("cp_opmachine") || ""; } catch (e) { }
  try { st.opName = lsGet("cp_opname") || ""; } catch (e) { }

  /* ---------- INIT ---------- */
  function init() {
    S.on("config", d => { config = (d && d[0]) || SEED_CONFIG[0]; softRender(); });
    S.on("machines", d => { machines = d; softRender(); });
    S.on("products", d => { products = d; softRender(); });
    S.init("config", SEED_CONFIG);
    S.init("machines", SEED_MACHINES);
    S.init("products", SEED_PRODUCTS);
    machines = S.get("machines");
    products = S.get("products");
    const cfgArr = S.get("config");
    config = (cfgArr && cfgArr[0]) || SEED_CONFIG[0];
    root.addEventListener("click", onClick);
    const sess = lsObj("cp_opsession");
    if (sess && sess.machId && sess.productId) {
      if (machines.some(m => m.id === sess.machId) && products.some(p => p.id === sess.productId)) {
        st.machId = sess.machId;
        st.productId = sess.productId;
        st.model = sess.model || "";
        st.startTime = sess.startTime || nowHM();
        st.phase = "running";
      } else {
        lsDel("cp_opsession");
      }
    } else {
      lsDel("cp_opsession");
    }
    renderAll();
  }

  function softRender() {
    if (st.phase === "running" || st.phase === "finish") return;
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    renderAll();
  }

  function opLocked() {
    return !!(config && config.operatorPinHash &&
      (function () { try { return sessionStorage.getItem("cp_op_auth") !== "1"; } catch (e) { return true; } })());
  }

  /* ---------- RENDER ---------- */
  function renderAll() {
    clearTimer();
    if (opLocked()) {
      root.innerHTML = lockView();
      const pinEl = document.getElementById("op-pin");
      if (pinEl) {
        pinEl.value = st.opPin || "";
        pinEl.focus();
        pinEl.addEventListener("input", () => { st.opPin = pinEl.value; });
        pinEl.addEventListener("keydown", e => { if (e.key === "Enter") doOpLogin(); });
      }
      return;
    }
    const company = (config && config.companyName) || "CONTROLE DE PRODUÇÃO";
    root.innerHTML = `
      <div class="op-app">
        <div class="op-head">
          <div class="op-brand">
            <div class="brand-mark">${U.icon("target", "lg")}</div>
            <div>
              <div class="brand-name">OPERADOR</div>
              <div class="tiny dim" style="text-transform:uppercase">${U.esc(company)}</div>
            </div>
          </div>
          <a class="op-link" href="./index.html">${U.icon("dashboard", "sm")} Gestor</a>
        </div>
        <div class="op-body">
          ${phaseView()}
        </div>
        ${S.isRemote() ? "" : '<div class="tiny dim" style="text-align:center;margin-top:10px">Modo local · dados salvos neste aparelho</div>'}
      </div>`;
    wire();
    if (st.phase === "running") startTimer();
  }

  function phaseView() {
    if (st.phase === "material") return viewMaterial();
    if (st.phase === "running") return viewRunning();
    if (st.phase === "finish") return viewFinish();
    if (st.phase === "done") return viewDone();
    return viewIdle();
  }

  function lockView() {
    const company = (config && config.companyName) || "CONTROLE DE PRODUÇÃO";
    return `
      <div class="op-app">
        <div class="op-body">
          <div class="op-lock-card">
            <div class="op-lock-logo">${U.icon("lock")}</div>
            <div class="op-lock-title">Tela do funcionário</div>
            <p class="op-lock-sub">${U.esc(company)}<br/>Digite o PIN de operador para iniciar</p>
            <input id="op-pin" class="op-pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="••••" />
            <p class="op-pin-err" id="op-pin-err"></p>
            <button class="op-big go" data-act="op-login">${U.icon("checkc")} ENTRAR</button>
            <p style="margin-top:14px"><a class="op-link" href="./index.html">${U.icon("dashboard", "sm")} Painel do gestor</a></p>
          </div>
        </div>
      </div>`;
  }

  function viewIdle() {
    const m = machines.find(x => x.id === st.machId);
    return `
      <div class="op-center">
        <h2 class="op-title">Turno de hoje</h2>
        <p class="op-sub">${U.fmtDate(U.todayStr())}</p>
      </div>

      <div class="op-card">
        <p class="op-sub mb8">1 · Qual máquina você vai operar?</p>
        ${machines.length ? `
          <div class="op-grid">
            ${machines.map(mm => `
              <button class="op-chip ${st.machId === mm.id ? "sel" : ""}" data-mach="${mm.id}">
                ${U.icon("cog")}<span>${U.esc(mm.name)}</span></button>`).join("")}
          </div>` : '<div class="empty">Nenhuma máquina cadastrada.</div>'}
      </div>

      <div class="op-card">
        <p class="op-sub mb8">Seu nome (opcional)</p>
        <input class="op-input" id="op-name" type="text" value="${U.esc(st.opName)}" placeholder="Digite seu nome" />
      </div>

      <button class="op-big go" data-act="begin" ${st.machId ? "" : "disabled"}>
        ${U.icon("play")} INICIAR ${m ? U.esc(m.name) : ""}
      </button>`;
  }

  function viewMaterial() {
    const m = machines.find(x => x.id === st.machId);
    const hasModel = products.find(p => p.id === st.productId);
    const needsModel = hasModel && hasModel.hasModels;
    const ready = st.productId && (!needsModel || st.model);
    return `
      <div class="op-center">
        <h2 class="op-title">O que vai produzir?</h2>
        <p class="op-sub">Máquina: <b style="color:var(--amber2)">${m ? U.esc(m.name) : "—"}</b></p>
      </div>

      <div class="op-card">
        <p class="op-sub mb8">Produto</p>
        <div class="op-grid">
          ${products.map(p => `
            <button class="op-chip ${st.productId === p.id ? "sel" : ""}" data-prod="${p.id}">
              ${U.icon("package")}<span>${U.esc(p.name)}</span></button>`).join("")}
        </div>
        ${hasModel && hasModel.hasModels ? `
          <p class="op-sub mt12 mb8">Modelo de furação</p>
          <div class="op-grid">
            ${hasModel.models.map(mo => `
              <button class="op-chip ${st.model === mo ? "sel" : ""}" data-model="${U.esc(mo)}">
                ${U.icon("layers")}<span>${U.esc(mo)}</span></button>`).join("")}
          </div>` : ""}
        ${st.productId ? `
          <p class="op-sub mt12">Selecionado: <b style="color:var(--amber2)">${U.esc((hasModel ? hasModel.name : "") + (st.model ? " — " + st.model : ""))}</b></p>` : ""}
      </div>

      <button class="op-big go" data-act="confirm-material" ${ready ? "" : "disabled"}>
        ${U.icon("checkc")} CONFIRMAR E INICIAR
      </button>`;
  }

  function viewRunning() {
    const m = machines.find(x => x.id === st.machId);
    const p = products.find(x => x.id === st.productId);
    const mins = minsSince(st.startTime);
    return `
      <div class="op-center">
        <span class="op-run-led"></span>
        <h2 class="op-title" style="color:var(--ok);margin:8px 0 2px">PRODUZINDO</h2>
        <p class="op-sub">${m ? U.esc(m.name) : ""} · ${p ? U.esc(p.name) : ""}${st.model ? " — " + U.esc(st.model) : ""}</p>
      </div>

      <div class="op-card op-center">
        <div class="op-clock" id="op-clock">${fmtClock(mins * 60)}</div>
        <div class="op-run-info mt8">
          <span class="op-clock-start">Iniciou às ${U.esc(st.startTime)}</span>
          <span class="op-clock-start">Tempo de turno: ${fmtDur(mins)}</span>
        </div>
      </div>

      <button class="op-big safe" data-act="open-finish">${U.icon("checkc")} CONCLUIR TURNO — FIM DO DIA</button>
      <button class="op-big stop" data-act="cancel">${U.icon("power")} Encerrar sem salvar</button>`;
  }

  function viewFinish() {
    const m = machines.find(x => x.id === st.machId);
    const p = products.find(x => x.id === st.productId);
    const mins = minsSince(st.startTime);
    return `
      <div class="op-center">
        <h2 class="op-title">Fim do turno</h2>
        <p class="op-sub">Confira e lance a produção do dia</p>
      </div>

      <div class="op-sum">
        <div class="op-sum-item"><div class="sk">Data</div><div class="sv">${U.fmtDate(U.todayStr())}</div></div>
        <div class="op-sum-item"><div class="sk">Máquina</div><div class="sv">${m ? U.esc(m.name) : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Material</div><div class="sv" style="font-size:14px">${p ? U.esc(p.name) + (st.model ? " — " + U.esc(st.model) : "") : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Tempo</div><div class="sv">${fmtDur(mins)}</div></div>
      </div>

      <div class="op-card">
        <label>Quantidade produzida (un.)</label>
        <input class="op-num" id="op-qty" type="number" inputmode="numeric" min="0" value="${st.qty}" placeholder="0" />
        <label style="margin-top:12px">Defeitos (opcional, un.)</label>
        <input class="op-num" id="op-def" type="number" inputmode="numeric" min="0" value="${st.def}" placeholder="0" />
      </div>

      <button class="op-big go" data-act="save-finish">${U.icon("checkc")} SALVAR PRODUÇÃO</button>
      <button class="op-big ghost" data-act="cancel">Cancelar</button>`;
  }

  function viewDone() {
    const d = st.lastDone || {};
    return `
      <div class="op-center">
        <div class="op-done">${U.icon("checkc")}</div>
        <h2 class="op-title" style="color:var(--ok)">Produção registrada!</h2>
        <p class="op-sub">Já está no painel do gestor</p>
      </div>

      <div class="op-sum">
        <div class="op-sum-item"><div class="sk">Data</div><div class="sv">${U.fmtDate(U.todayStr())}</div></div>
        <div class="op-sum-item"><div class="sk">Máquina</div><div class="sv">${U.esc(d.machineName || "—")}</div></div>
        <div class="op-sum-item"><div class="sk">Material</div><div class="sv" style="font-size:14px">${U.esc(d.productName || "—")}</div></div>
        <div class="op-sum-item"><div class="sk">Quantidade</div><div class="sv" style="color:var(--ok)">${U.fmt(d.qty)}</div></div>
      </div>

      <button class="op-big go" data-act="new-day">${U.icon("play")} INICIAR NOVO TURNO</button>`;
  }

  /* ---------- WIRE / EVENTOS ---------- */
  function wire() {
    const nameEl = document.getElementById("op-name");
    if (nameEl) {
      nameEl.addEventListener("input", () => {
        st.opName = nameEl.value;
        try { localStorage.setItem("cp_opname", st.opName); } catch (e) { }
      });
    }
    const qtyEl = document.getElementById("op-qty");
    if (qtyEl) qtyEl.addEventListener("input", () => { st.qty = qtyEl.value; });
    const defEl = document.getElementById("op-def");
    if (defEl) defEl.addEventListener("input", () => { st.def = defEl.value; });
  }

  function onClick(e) {
    const machEl = e.target.closest("[data-mach]");
    if (machEl) {
      st.machId = machEl.getAttribute("data-mach");
      try { localStorage.setItem("cp_opmachine", st.machId); } catch (er) { }
      renderAll();
      return;
    }
    const prodEl = e.target.closest("[data-prod]");
    if (prodEl) {
      st.productId = prodEl.getAttribute("data-prod");
      st.model = "";
      renderAll();
      return;
    }
    const modelEl = e.target.closest("[data-model]");
    if (modelEl) {
      st.model = modelEl.getAttribute("data-model");
      renderAll();
      return;
    }
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const a = actEl.getAttribute("data-act");

    if (a === "begin") { if (st.machId) { st.phase = "material"; renderAll(); } }
    else if (a === "confirm-material") confirmMaterial();
    else if (a === "open-finish") { st.phase = "finish"; renderAll(); }
    else if (a === "save-finish") saveFinish();
    else if (a === "cancel") cancelTurn();
    else if (a === "new-day") {
      st.phase = "idle"; st.productId = ""; st.model = ""; st.qty = ""; st.def = ""; st.lastDone = null;
      renderAll();
    }
    else if (a === "op-login") doOpLogin();
  }

  async function doOpLogin() {
    const btn = root.querySelector('[data-act="op-login"]');
    const errEl = document.getElementById("op-pin-err");
    const pin = (st.opPin || "").trim();
    if (pin.length < 4) { if (errEl) errEl.textContent = "Digite o PIN de operador."; return; }
    if (btn) btn.disabled = true;
    const hash = await U.hashPin(pin);
    if (!config.operatorPinHash || config.operatorPinHash !== hash) {
      if (errEl) errEl.textContent = "PIN incorreto. Tente novamente.";
      if (btn) btn.disabled = false;
      return;
    }
    try { sessionStorage.setItem("cp_op_auth", "1"); } catch (e) { }
    st.opPin = "";
    renderAll();
  }

  async function confirmMaterial() {
    const m = machines.find(x => x.id === st.machId);
    const p = products.find(x => x.id === st.productId);
    if (!m || !p) return;
    st.startTime = nowHM();
    lsSet("cp_opsession", JSON.stringify({
      machId: st.machId, productId: st.productId, model: st.model || "",
      startTime: st.startTime, prevStatus: m.status || "parada"
    }));
    try {
      await S.update("machines", st.machId, {
        status: "produzindo",
        currentProduct: p.name,
        client: m.client || ""
      });
    } catch (e) { }
    st.phase = "running";
    renderAll();
  }

  async function cancelTurn() {
    const sess = lsObj("cp_opsession");
    if (sess && sess.machId && sess.prevStatus) {
      try { await S.update("machines", sess.machId, { status: sess.prevStatus }); } catch (e) { }
    }
    lsDel("cp_opsession");
    st.phase = "idle"; st.productId = ""; st.model = ""; st.startTime = ""; st.qty = ""; st.def = "";
    renderAll();
  }

  async function saveFinish() {
    if (st.qty === "" ) { toast("Informe a quantidade produzida."); return; }
    const qty = Number(st.qty) || 0;
    const def = Number(st.def) || 0;
    const m = machines.find(x => x.id === st.machId) || {};
    const p = products.find(x => x.id === st.productId) || {};
    const start = st.startTime || nowHM();
    const end = nowHM();
    const mins = minsSince(start);
    const hours = Math.round(mins / 60 * 100) / 100;
    const rate = qty > 0 ? def / qty * 100 : 0;
    const rec = {
      date: U.todayStr(),
      machineId: st.machId,
      machineName: m.name || "",
      productId: st.productId,
      productName: p.name || "",
      model: (p.hasModels) ? st.model : "",
      client: m.client || "",
      operator: st.opName || "Operador",
      startTime: start,
      endTime: end,
      quantityProduced: qty,
      defects: def,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      defectRate: rate,
      createdAt: Date.now()
    };
    lsDel("cp_opsession");
    try { await S.add("productions", rec); } catch (e) { }
    try { await S.update("machines", st.machId, { status: "parada", client: m.client || "" }); } catch (e) { }
    st.lastDone = { machineName: rec.machineName, productName: rec.productName, qty: qty };
    st.phase = "done"; st.qty = ""; st.def = "";
    renderAll();
    toast("Produção salva");
  }

  /* ---------- TIMER ---------- */
  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    clearTimer();
    const tick = () => {
      const el = document.getElementById("op-clock");
      if (!el) return;
      const d = new Date();
      const secs = minsSince(st.startTime) * 60 + d.getSeconds();
      el.textContent = fmtClock(secs);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ---------- TOAST ---------- */
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = "0"; }, 2200);
  }

  init();
})();