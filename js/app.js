/* =====================================================================
   CONTROLE DE PRODUÇÃO — Aplicativo principal (index.html)
   Módulos: Painel · Máquinas · Produtos · Lançamento · Relatórios
            Planejamento · Configurações
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;
  const root = document.getElementById("app");

  const SEED_MACHINES = [
    { id: "auto-1", name: "Automática 1", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "auto-2", name: "Automática 2", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "escanteadeira", name: "Escanteadeira", type: "escanteadeira", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "man-1", name: "Manual 1", type: "manual", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "man-2", name: "Manual 2", type: "manual", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 }
  ];
  /* Funcionários: cadastro e permissões (Módulo de acesso — etapa 1).
     O funcionário não fica preso a uma máquina; a vinculação acontece
     apenas no momento em que ele faz login na tela do operador. */
  const SEED_EMPLOYEES = [];
  const SEED_PRODUCTS = [
    { id: "agenda-classica", name: "Agenda Clássica", hasModels: true, models: ["Espiral", "Wero", "Smart", "Ficario"], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "agenda-media", name: "Agenda Média", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-80", name: "Caderno 80 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-140", name: "Caderno 140 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 },
    { id: "caderno-160", name: "Caderno 160 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 }
  ];
  const SEED_CONFIG = [{ id: "default", companyName: "CONTROLE DE PRODUÇÃO", sector: "Setor de Furação", defectLimit: 1, dailyGoal: 0, pinHash: "" }];
  /* Módulo de Pedidos e Ordens de Produção: o pedido é o que a empresa
     recebeu do cliente; a Ordem de Produção é o que vai para a máquina.
     Uma Ordem de operação "retrabalho" (ex.: escanteamento de parte do
     miolo) não soma como produção nova do pedido — só a operação
     "producao" conta para o total produzido/restante. */
  const SEED_ORDERS = [];
  const SEED_PRODUCTION_ORDERS = [];
  const freshOrderDraft = () => ({ client: "", product: "", model: "", quantity: "", type: "completo" });
  /* Nova Tarefa: o gestor só escolhe pedido, funcionário, máquina, produto
     e modelo — tudo por lista suspensa. NÃO existe quantidade digitada:
     a quantidade da tarefa vem sempre do saldo do pedido selecionado. */
  const freshTaskDraft = () => ({ orderId: "", employeeId: "", machineId: "", productId: "", model: "" });

  const STATUS = {
    produzindo: { label: "Produzindo", led: "ok", pill: "produzindo" },
    pausa: { label: "Parada programada", led: "warn", pill: "pausa" },
    parada: { label: "Parada", led: "danger", pill: "parada" }
  };

  const freshLance = () => ({
    date: U.todayStr(), machineId: "", productId: "", model: "", client: "", operator: "",
    startTime: "", endTime: "", quantityProduced: "", defects: ""
  });

  let machines = [], products = [], productions = [], employees = [], orders = [], productionOrders = [], config = SEED_CONFIG[0];

  const state = {
    authed: false,
    loginStep: "choose",
    page: "dashboard",
    sheet: false,
    dash: { date: U.todayStr() },
    lance: freshLance(),
    rel: { tab: "hist", date: "", machineId: "", productId: "", model: "", client: "", operator: "" },
    plan: { volume: "", days: "", startDate: U.todayStr(), jornada: 8 },
    planResult: null,
    draftMachine: {},
    draftProduct: {},
    newMachineForm: false,
    newProductForm: false,
    newMachine: { name: "", type: "automatica" },
    newProduct: { name: "", hasModels: false, modelsText: "" },
    draftEmployee: {},
    newEmployeeForm: false,
    newEmployee: { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [] },
    pin: "",
    err: "",
    /* Pedidos e Ordens de Produção */
    newOrderForm: false,
    newOrder: freshOrderDraft(),
    draftOrder: {},
    openOrders: {},
    newTaskForm: false,
    newTask: freshTaskDraft()
  };

  try { state.authed = sessionStorage.getItem("cp_auth") === "1"; } catch (e) { }
  try {
    const h = (location.hash || "").replace("#", "");
    if (["dashboard", "lance", "relatorios", "planejamento", "pedidos", "maquinas", "produtos", "funcionarios", "config"].indexOf(h) >= 0) state.page = h;
  } catch (e) { }

  const PAGES = [
    ["dashboard", "Painel", "dashboard", "painel"],
    ["lance", "Lançar", "plus", "painel"],
    ["relatorios", "Relatórios", "chart", "painel"],
    ["planejamento", "Planejamento", "clipboard", "painel"],
    ["pedidos", "Pedidos", "package", "painel"],
    ["maquinas", "Máquinas", "cog", "cadastros"],
    ["produtos", "Produtos", "box", "cadastros"],
    ["funcionarios", "Funcionários", "user", "cadastros"],
    ["config", "Configurações", "sliders", "sistema"]
  ];
  const TITLES = {
    dashboard: ["Painel do dia", "Visão geral da produção"],
    lance: ["Lançar produção", "Registrar produção, defeitos e operador"],
    relatorios: ["Relatórios", "Lançamentos e capacidade produtiva"],
    planejamento: ["Planejamento", "Simular pedidos, prazos e máquinas"],
    pedidos: ["Pedidos", "Pedidos e ordens de produção"],
    maquinas: ["Máquinas", "Cadastro e status das máquinas"],
    produtos: ["Produtos", "Cadastro de produtos e modelos"],
    funcionarios: ["Funcionários", "Cadastro, PIN e permissões de acesso"],
    config: ["Configurações", "Ajustes do sistema"]
  };

  /* ---------- INIT ---------- */
  function init() {
    S.on("config", d => { config = (d && d[0]) || SEED_CONFIG[0]; softRender(); });
    S.on("machines", d => { machines = d; softRender(); });
    S.on("products", d => { products = d; softRender(); });
    S.on("productions", d => { productions = d; softRender(); });
    S.on("employees", d => { employees = d; softRender(); });
    S.on("orders", d => { orders = d; softRender(); });
    S.on("productionOrders", d => { productionOrders = d; softRender(); });
    S.init("config", SEED_CONFIG);
    S.init("machines", SEED_MACHINES);
    S.init("products", SEED_PRODUCTS);
    S.init("productions", []);
    S.init("employees", SEED_EMPLOYEES);
    S.init("orders", SEED_ORDERS);
    S.init("productionOrders", SEED_PRODUCTION_ORDERS);
    machines = S.get("machines");
    products = S.get("products");
    productions = S.get("productions");
    employees = S.get("employees");
    orders = S.get("orders");
    productionOrders = S.get("productionOrders");
    const cfgArr = S.get("config");
    config = (cfgArr && cfgArr[0]) || SEED_CONFIG[0];
    root.addEventListener("click", onClickGlobal);
    renderAll();
  }

  function softRender() {
    if (!state.authed) { renderLogin(); return; }
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      if (state.page === "lance") refreshCalc();
      return;
    }
    renderAll();
  }

  /* ---------- SHELL ---------- */
  function renderAll() {
    if (!state.authed) { renderLogin(); return; }
    const company = (config && config.companyName) || "CONTROLE DE PRODUÇÃO";
    root.innerHTML = `
      <div class="shell">
        <aside class="side">
          <div class="side-brand">
            <div class="brand-mark">${U.icon("target", "lg")}</div>
            <div>
              <div class="brand-name">CONTROLE DE<br><span class="amber-word">PRODUÇÃO</span></div>
              <div class="tiny dim" style="margin-top:2px;text-transform:uppercase">${U.esc(company)}</div>
            </div>
          </div>
          <nav class="side-nav">
            <div class="lbl">Produção</div>
            ${sideItem("dashboard", "Painel", "dashboard")}
            ${sideItem("lance", "Lançar produção", "plus")}
            ${sideItem("relatorios", "Relatórios", "chart")}
            ${sideItem("planejamento", "Planejamento", "clipboard")}
            ${sideItem("pedidos", "Pedidos", "package")}
            <div class="lbl">Cadastros</div>
            ${sideItem("maquinas", "Máquinas", "cog")}
            ${sideItem("produtos", "Produtos", "box")}
            ${sideItem("funcionarios", "Funcionários", "user")}
            <div class="lbl">Sistema</div>
            ${sideItem("config", "Configurações", "sliders")}
          </nav>
          <div class="side-foot">
            <div class="side-status">
              <div class="led ${S.isRemote() ? "ok" : "warn"}"></div>
              <span>${S.isRemote() ? "Nuvem conectada" : "Modo local"}</span>
            </div>
          </div>
        </aside>
        <div class="main-col">
          <header class="head">
            <div class="head-top">
              <div class="brand" style="display:${window.innerWidth >= 900 ? "none" : "flex"}">
                <div class="brand-mark">${U.icon("target", "lg")}</div>
                <div>
                  <div class="brand-name">CONTROLE DE <span class="amber-word">PRODUÇÃO</span></div>
                  <div class="tiny dim" style="margin-top:2px;text-transform:uppercase">${U.esc(company)}</div>
                </div>
              </div>
              <button class="icon-btn" data-act="open-config" title="Configurações" style="display:${window.innerWidth >= 900 ? "none" : "flex"}">${U.icon("sliders")}</button>
            </div>
            <h2 class="page-title">${TITLES[state.page][0]}
              <span class="sub">${TITLES[state.page][1]}</span>
            </h2>
          </header>
          <main id="view" class="content"></main>
          <div class="hpad"></div>
        </div>
        <nav class="navb">
          <div class="navb-in"><div class="navb-bar">
            ${bNavItem("dashboard", "Painel", "dashboard")}
            ${bNavItem("lance", "Lançar", "plus", true)}
            ${bNavItem("relatorios", "Relatórios", "chart")}
            ${bNavItem("planejamento", "Plan.", "clipboard")}
            <button class="nav-item ${state.sheet ? "active" : ""}" data-act="toggle-sheet">
              ${U.icon("menu")}<span>Menu</span><div class="ndot"></div></button>
          </div></div>
        </nav>
        ${state.sheet ? sheetHTML() : ""}
        ${S.isRemote() ? "" : '<div class="banner">Modo local — dados salvos neste aparelho</div>'}
      </div>`;
    renderView();
  }

  function sideItem(id, label, ic) {
    return `<button class="side-item ${state.page === id ? "active" : ""}" data-go="${id}">
      ${U.icon(ic)}<span>${label}</span>${state.page === id ? '<div class="bulk">●</div>' : ""}</button>`;
  }

  function bNavItem(id, label, ic, launch) {
    return `<button class="nav-item ${state.page === id ? "active" : ""} ${launch ? "launch" : ""}" data-go="${id}">
      ${U.icon(ic)}<span>${label}</span><div class="ndot"></div></button>`;
  }

  function sheetHTML() {
    const extra = [
      ["pedidos", "Pedidos", "package"],
      ["maquinas", "Máquinas", "cog"],
      ["produtos", "Produtos", "box"],
      ["funcionarios", "Funcionários", "user"],
      ["config", "Configurações", "sliders"]
    ];
    return `<div class="sheet-wrap" data-act="close-sheet">
      <div class="sheet" data-act="noop">
        <div class="sheet-grip"></div>
        <div class="sheet-title">Menu</div>
        ${extra.map(([id, label, ic]) => `
          <button class="sheet-row" data-go="${id}">${U.icon(ic)}<span>${label}</span>
            <span class="rk">${state.page === id ? "atual" : ""}</span></button>`).join("")}
        <button class="sheet-cancel" data-act="close-sheet">Fechar</button>
      </div>
    </div>`;
  }

  function renderView() {
    const v = document.getElementById("view");
    if (!v) return;
    if (state.page === "dashboard") renderDashboard(v);
    else if (state.page === "lance") renderLance(v);
    else if (state.page === "relatorios") renderRelatorios(v);
    else if (state.page === "planejamento") renderPlanejamento(v);
    else if (state.page === "pedidos") renderPedidos(v);
    else if (state.page === "maquinas") renderMaquinas(v);
    else if (state.page === "produtos") renderProdutos(v);
    else if (state.page === "funcionarios") renderFuncionarios(v);
    else renderConfig(v);
    bindAllExtra();
  }

  /* ========== LOGIN ========== */
  function renderLogin() {
    if (state.loginStep !== "pin") { renderProfileChoice(); return; }
    const cfg = config || SEED_CONFIG[0];
    root.innerHTML = `
      <div class="login">
        <div class="login-box">
          <div class="login-logo">${U.icon("target", "lg")}</div>
          <h1 class="login-title">CONTROLE DE<br><span class="amber-word">PRODUÇÃO</span></h1>
          <p class="login-sub">${U.esc(cfg.sector || "Setor de Furação")} · Acesso do Gestor</p>
          <input id="pinInput" type="password" inputmode="numeric" maxlength="12" class="login-pin" placeholder="••••" autocomplete="off"
            style="margin-bottom:4px" />
          <p class="login-hint">${cfg.pinHash ? "Digite seu PIN de acesso" : "Primeiro acesso — defina um PIN de 4 dígitos"}</p>
          <p class="login-err" id="pinErr"></p>
          <button data-act="login" class="btn btn-primary btn-block">Entrar</button>
          <button data-act="back-choice" class="btn-ghost btn-block mt12">‹ Voltar</button>
        </div>
      </div>`;
    state.pin = "";
    const pinEl = document.getElementById("pinInput");
    if (pinEl) {
      pinEl.addEventListener("input", () => { state.pin = pinEl.value; });
      pinEl.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
      pinEl.focus();
    }
  }

  /* Tela inicial: escolha entre acesso do Gestor (PIN administrativo,
     com o cadastro de funcionários e demais módulos) e Funcionário
     (segue direto para a identificação por PIN pessoal em operador.html —
     sem passar por Configurações nem pelo login do Gestor). */
  function renderProfileChoice() {
    const cfg = config || SEED_CONFIG[0];
    root.innerHTML = `
      <div class="login">
        <div class="login-box">
          <div class="login-logo">${U.icon("target", "lg")}</div>
          <h1 class="login-title">CONTROLE DE<br><span class="amber-word">PRODUÇÃO</span></h1>
          <p class="login-sub">${U.esc(cfg.sector || "Setor de Furação")} · Escolha seu acesso</p>
          <div class="space-y mt12">
            <button class="btn btn-outline btn-block" data-act="choose-funcionario">👷 Funcionário</button>
            <button class="btn btn-primary btn-block" data-act="choose-gestor">👨‍💼 Gestor</button>
          </div>
        </div>
      </div>`;
  }

  async function doLogin() {
    const btn = root.querySelector('[data-act="login"]');
    const errEl = document.getElementById("pinErr");
    const pin = (state.pin || "").trim();
    if (pin.length < 4) { if (errEl) errEl.textContent = "Digite um PIN com pelo menos 4 dígitos."; return; }
    if (btn) btn.disabled = true;
    const hash = await U.hashPin(pin);
    if (!config.pinHash) {
      try { await S.update("config", "default", { pinHash: hash }); } catch (e) { }
      setAuthed();
      return;
    }
    if (config.pinHash !== hash) {
      if (errEl) errEl.textContent = "PIN incorreto. Tente novamente.";
      if (btn) btn.disabled = false;
      return;
    }
    setAuthed();
  }

  function setAuthed() {
    state.authed = true;
    try { sessionStorage.setItem("cp_auth", "1"); } catch (e) { }
    renderAll();
  }

  /* ---------- HELPERS DE DADOS ---------- */
  function dayAgg(date) {
    const day = productions.filter(p => p.date === date);
    let total = 0, defects = 0, hours = 0;
    const byMachine = {};
    day.forEach(p => {
      total += Number(p.quantityProduced) || 0;
      defects += Number(p.defects) || 0;
      hours += Number(p.productionHours) || 0;
      const bm = byMachine[p.machineId] || (byMachine[p.machineId] = { name: p.machineName || "?", prod: 0, def: 0, hrs: 0 });
      bm.prod += Number(p.quantityProduced) || 0;
      bm.def += Number(p.defects) || 0;
      bm.hrs += Number(p.productionHours) || 0;
    });
    const defectPct = total ? defects / total * 100 : 0;
    const perHour = hours > 0 ? total / hours : 0;
    return { day, total, defects, hours, byMachine, defectPct, perHour };
  }

  function avgDailyProd() {
    const byDate = {};
    productions.forEach(p => {
      if (!p.date) return;
      byDate[p.date] = (byDate[p.date] || 0) + (Number(p.quantityProduced) || 0);
    });
    const dates = Object.keys(byDate).sort().slice(-30);
    if (!dates.length) return 0;
    return Math.round(dates.reduce((s, d) => s + byDate[d], 0) / dates.length);
  }

  function addDaysDS(ds, n) {
    const parts = String(ds).split("-").map(Number);
    if (parts.length !== 3) return ds;
    const t = new Date(parts[0], parts[1] - 1, parts[2] + n);
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }

  function planCalc() {
    const vol = Number(state.plan.volume) || 0;
    const start = state.plan.startDate || U.todayStr();
    const hours = Number(state.plan.jornada) || 8;
    const prazo = Number(state.plan.days) || 0;
    const mCount = machines.length || 1;
    let capDayTotal = machines.reduce((s, m) => s + ((Number(m.capacityHour) || 0) * hours), 0);
    if (!capDayTotal) capDayTotal = avgDailyProd();
    if (!capDayTotal) capDayTotal = machines.reduce((s, m) => s + (Number(m.capacityDay) || 0), 0);
    const perMach = capDayTotal / mCount;
    const daysAll = capDayTotal > 0 ? Math.ceil(vol / capDayTotal) : 0;
    let needed = mCount, days = daysAll;
    if (prazo > 0 && perMach > 0 && vol > 0) {
      needed = Math.min(mCount, Math.max(1, Math.ceil(vol / (perMach * prazo))));
      days = prazo;
    }
    return {
      done: vol > 0,
      vol, capDayTotal: Math.round(capDayTotal), days, needed, perMach: Math.round(perMach),
      delivery: addDaysDS(start, days), prazo
    };
  }

  /* ========== DASHBOARD ========== */
  function donutHTML(pct, threshold, label, units) {
    const r = 68, cx = 90, cy = 90, C = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, pct));
    const th = Math.max(0, Math.min(100, threshold));
    const len = C * p / 100;
    const ok = pct >= threshold;
    const col = ok ? "var(--ok)" : "var(--danger)";
    const thOn = pct >= th;
    return `<svg viewBox="0 0 180 180" class="gauge-donut">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card3)" stroke-width="11"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${len} ${C}" transform="rotate(-90 ${cx} ${cy})"/>
      <line x1="${cx}" y1="${cy - r + 1}" x2="${cx}" y2="${cy - r + 7}" stroke="${thOn ? col : "var(--steel)"}" stroke-width="3" stroke-linecap="round" transform="rotate(${th * 3.6 - 90} ${cx} ${cy})"/>
      <text x="${cx}" y="${cx - 8}" text-anchor="middle" class="gauge-center-val" fill="${col}">${U.fmt(pct, 2)}${units}</text>
      <text x="${cx}" y="${cx + 12}" text-anchor="middle" class="gauge-center-sub">${label}</text>
    </svg>`;
  }

  function renderDashboard(v) {
    const date = state.dash.date;
    const limit = Number(config.defectLimit) || 1;
    const metaRaw = Number(config.dailyGoal) || 0;
    const meta = metaRaw > 0 ? metaRaw : avgDailyProd();
    const a = dayAgg(date);
    const eff = meta > 0 ? a.total / meta * 100 : 0;
    const quality = 100 - a.defectPct;
    const machinesWorking = machines.filter(m => m.status === "produzindo").length;
    const maxProd = Math.max(1, ...Object.values(a.byMachine).map(bm => bm.prod));
    const recent = productions.slice()
      .sort((x, y) => String(y.date + (y.createdAt || 0)).localeCompare(String(x.date + (x.createdAt || 0))))
      .slice(0, 5);
    const pc = state.planResult || planCalc();

    v.innerHTML = `
      <div class="rowc between mb12">
        <div class="rowc" style="gap:6px">
          <span class="tiny dim" style="font-weight:600;text-transform:uppercase;letter-spacing:.08em">Dia do painel</span>
          <span class="pill ${machinesWorking ? "produzindo" : "parada"}">${machinesWorking} ativa${machinesWorking !== 1 ? "s" : ""}</span>
        </div>
        <input type="date" id="dashDate" value="${date}" style="width:auto;padding:7px 10px;font-size:12px" />
      </div>

      <div class="grid-cards">
        <div class="card stat accent">
          <div class="lbl">${U.icon("package", "sm")} Produção do dia</div>
          <div class="val amb">${U.fmt(a.total)}<em>un.</em></div>
          <div class="foot">${a.hours > 0 ? U.fmt(a.hours, 2) + " h na linha · " : ""}${a.perHour > 0 ? U.fmt(a.perHour, 1) + " un./h" : "sem horas"}</div>
        </div>
        <div class="card stat">
          <div class="lbl">${U.icon("flag", "sm")} Meta diária</div>
          <div class="val">${meta > 0 ? U.fmt(meta) : "—"}<em>un.</em></div>
          <div class="foot">${meta > 0 ? U.fmt(eff, 1) + "% atingido" : "defina em Configurações"}</div>
        </div>
        <div class="card stat">
          <div class="lbl">${U.icon("speed", "sm")} Eficiência</div>
          <div class="val ${eff >= 100 ? "up" : (meta > 0 ? "down" : "")}">${meta > 0 ? U.fmt(eff, 1) + "%" : "—"}</div>
          <div class="foot">produção ÷ meta diária</div>
        </div>
        <div class="card stat">
          <div class="lbl">${U.icon("check", "sm")} Qualidade</div>
          <div class="val ${quality >= (100 - limit) ? "up" : "down"}">${U.fmt(quality, 2) + "%"}</div>
          <div class="foot">100 − índice de defeito</div>
        </div>
        <div class="card stat">
          <div class="lbl">${U.icon("alert", "sm")} Defeitos</div>
          <div class="val down">${U.fmt(a.defects)}<em>un.</em></div>
          <div class="foot">${a.total ? U.fmt(a.defectPct, 2) + "% · limite " + U.fmt(limit, 2) + "%" : "sem produção"}</div>
        </div>
      </div>

      <div class="two-col mt12">
        <div class="card ck pad">
          <div class="between mb8">
            <span class="section-label" style="margin:0">${U.icon("check", "sm")} Qualidade do dia</span>
            <span class="pill ${a.defectPct > limit ? "bad" : "good"}">${a.defectPct > limit ? "fora" : "meta"}</span>
          </div>
          ${donutHTML(quality, Math.max(0, 100 - limit), "QUALIDADE", "%")}
          <div class="rowc" style="justify-content:space-between;max-width:230px;margin:8px auto 0">
            <div class="tiny dim">${U.fmt(a.defects)} defeitos</div>
            <div class="tiny dim">limite <b class="mono-val" style="color:var(--text)">${U.fmt(limit, 2)}%</b></div>
          </div>
        </div>

        <div class="card">
          <div class="pad" style="padding-bottom:6px">
            <span class="section-label" style="margin:0">${U.icon("layers", "sm")} Monitor de máquinas</span>
          </div>
          ${machines.length ? machines.map(m => {
            const st = STATUS[m.status] || STATUS.parada;
            const bm = a.byMachine[m.id];
            const prod = bm ? bm.prod : 0;
            const target = (Number(m.capacityDay) || 0) > 0 ? Number(m.capacityDay) : (meta > 0 ? meta / Math.max(1, machines.length) : 0);
            const pct = target > 0 ? Math.min(100, prod / target * 100) : 0;
            return `<div class="mac-row">
              <div class="led ${st.led}"></div>
              <div class="f1">
                <div class="between">
                  <span class="mname">${U.esc(m.name)}</span>
                  <span class="mono-val" style="font-size:12px;color:${prod ? "var(--amber2)" : "var(--text-dim)"}">${U.fmt(prod)}</span>
                </div>
                <div class="msub">
                  <b>${st.label}</b>
                  ${m.currentProduct ? `<span>${U.icon("box", "sm")} ${U.esc(m.currentProduct)}</span>` : ""}
                  ${m.currentProduct && m.client ? "<span>·</span>" : ""}
                  ${m.client ? `<span>${U.esc(m.client)}</span>` : ""}
                </div>
                ${target > 0 ? `<div class="tick-row mt8"><div class="tick-fill ${pct >= 100 ? "ok" : ""}" style="width:${pct}%"></div></div>` : ""}
              </div>
            </div>`;
          }).join("") : '<div class="empty">Nenhuma máquina cadastrada.</div>'}
        </div>
      </div>

      <p class="section-label">${U.icon("chart", "sm")} Produção por máquina</p>
      <div class="card pad space-y3">
        ${machines.length ? machines.map(m => {
          const bm = a.byMachine[m.id];
          const prod = bm ? bm.prod : 0;
          const hrs = bm ? bm.hrs : 0;
          const pct = maxProd ? Math.min(100, prod / maxProd * 100) : 0;
          const ph = hrs > 0 ? prod / hrs : 0;
          const st = STATUS[m.status] || STATUS.parada;
          return `<div class="rowc">
            <div class="led ${st.led} sm"></div>
            <div class="f1">
              <div class="between">
                <span class="small" style="font-weight:600">${U.esc(m.name)}</span>
                <span class="mono-val tiny dim">${U.fmt(prod)} un.${hrs ? " · " + U.fmt(hrs, 1) + " h" : ""}${ph ? " · " + U.fmt(ph, 0) + "/h" : ""}</span>
              </div>
              <div class="rowc mt8" style="gap:8px">
                <div class="f1 chart-bar track"><div class="chart-bar" style="width:${pct}%;height:100%"></div></div>
              </div>
            </div>
          </div>`;
        }).join("") : '<div class="empty">Nenhuma máquina cadastrada.</div>'}
      </div>

      <p class="section-label">${U.icon("clipboard", "sm")} Planejamento rápido</p>
      <div class="card pad">
        <div class="rowc" style="gap:8px">
          <div class="f1"><label>Volume do pedido</label><input type="number" id="qplan" min="0" value="${state.plan.volume}" placeholder="Ex.: 200000"></div>
          <button class="btn btn-primary btn-sm" data-act="qplan-calc" style="align-self:flex-end;margin-bottom:12px;height:41px">Calcular</button>
        </div>
        ${pc.done ? `
          <div class="grid3 mt12">
            <div class="plan-kpi"><div class="pk">Dias</div><div class="pv">${pc.days}</div></div>
            <div class="plan-kpi"><div class="pk">Máquinas</div><div class="pv">${pc.needed}</div></div>
            <div class="plan-kpi"><div class="pk">Entrega</div><div class="pv warn" style="font-size:16px">${U.fmtDate(pc.delivery)}</div></div>
          </div>` : ""}
        ${pc.done ? `<button class="btn-ghost mt12" data-act="go-plan">${U.icon("clipboard", "sm")} Abrir planejamento completo</button>`
          : `<p class="tiny dim">Informe o volume do pedido para estimar dias, máquinas e data de entrega.</p>`}
      </div>

      <p class="section-label">${U.icon("clock", "sm")} Últimos lançamentos</p>
      <div class="card divide-y">
        ${recent.length ? recent.map(p => `
          <div class="rowc pad">
            <div class="f1">
              <div class="small" style="font-weight:600">${U.esc(p.productName || "—")} <span class="dim tiny">· ${U.esc(p.machineName || "")}</span></div>
              <div class="kv">${U.fmtDate(p.date)}${p.startTime ? " · " + U.esc(p.startTime) + "–" + U.esc(p.endTime) : ""} · ${U.esc(p.operator || "—")}</div>
            </div>
            <div class="f1" style="flex:none">
              <div class="mono-val" style="text-align:right">${U.fmt(p.quantityProduced)}</div>
              <div class="kv" style="text-align:right;color:${(Number(p.defectRate) || 0) > limit ? "var(--danger)" : "var(--ok)"}">${p.defectRate ? U.fmt(p.defectRate, 2) + "% defeito" : "—"}</div>
            </div>
          </div>`).join("") : '<div class="empty">Nenhum lançamento registrado.</div>'}
      </div>`;

    const dp = document.getElementById("dashDate");
    if (dp) dp.addEventListener("change", e => { state.dash.date = e.target.value; renderView(); });
    const qp = document.getElementById("qplan");
    if (qp) qp.addEventListener("input", e => { state.plan.volume = e.target.value; state.planResult = null; });
  }

  /* ========== LANÇAMENTO ========== */
  function renderLance(v) {
    const f = state.lance;
    const p = products.find(x => x.id === f.productId);
    v.innerHTML = `
      <div class="card pad">
        <div class="field"><label>Data</label><input type="date" id="f-date" value="${f.date}"></div>
        <div class="field"><label>Máquina</label>
          <select id="f-machine">
            <option value="">Selecione...</option>
            ${machines.map(m => `<option value="${m.id}" ${m.id === f.machineId ? "selected" : ""}>${U.esc(m.name)} — ${STATUS[m.status] ? STATUS[m.status].label : ""}</option>`).join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Produto</label>
            <select id="f-product">
              <option value="">Selecione...</option>
              ${products.map(x => `<option value="${x.id}" ${x.id === f.productId ? "selected" : ""}>${U.esc(x.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Modelo de furação</label>
            <select id="f-model" ${(p && p.hasModels) ? "" : "disabled"}>
              <option value="">${(p && p.hasModels) ? "Selecione..." : "N/A"}</option>
              ${p && p.hasModels ? p.models.map(mo => `<option value="${U.esc(mo)}" ${mo === f.model ? "selected" : ""}>${U.esc(mo)}</option>`).join("") : ""}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Cliente</label><input id="f-client" value="${U.esc(f.client)}" placeholder="Ex.: Lojas Americanas"></div>
          <div class="field"><label>Operador</label><input id="f-operator" value="${U.esc(f.operator)}" placeholder="Nome do funcionário"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Hora início</label><input type="time" id="f-start" value="${f.startTime}"></div>
          <div class="field"><label>Hora fim</label><input type="time" id="f-end" value="${f.endTime}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Qtd. produzida</label><input type="number" id="f-qty" min="0" value="${f.quantityProduced}" placeholder="0"></div>
          <div class="field"><label>Qtd. defeitos</label><input type="number" id="f-def" min="0" value="${f.defects}" placeholder="0"></div>
        </div>
      </div>

      <p class="section-label">${U.icon("speed", "sm")} Cálculo automático</p>
      <div class="card pad grid3 mb12" id="calcPanel"></div>
      <div id="calcAlert"></div>

      <button data-act="save-lance" class="btn btn-primary btn-block">Salvar lançamento</button>`;
    wireLance();
  }

  function wireLance() {
    const simple = {
      "f-date": "date", "f-client": "client", "f-operator": "operator",
      "f-start": "startTime", "f-end": "endTime", "f-qty": "quantityProduced", "f-def": "defects"
    };
    Object.keys(simple).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
        state.lance[simple[id]] = el.value;
        refreshCalc();
      });
    });
    const selMachine = document.getElementById("f-machine");
    if (selMachine) selMachine.addEventListener("change", () => {
      state.lance.machineId = selMachine.value;
      const m = machines.find(x => x.id === state.lance.machineId);
      if (m) {
        if (!state.lance.client && m.client) state.lance.client = m.client;
        if (m.currentProduct && !state.lance.productId) state.lance.productId = m.currentProduct;
      }
      renderView();
    });
    const selProduct = document.getElementById("f-product");
    if (selProduct) selProduct.addEventListener("change", () => {
      state.lance.productId = selProduct.value;
      state.lance.model = "";
      renderView();
    });
    const selModel = document.getElementById("f-model");
    if (selModel) selModel.addEventListener("change", () => { state.lance.model = selModel.value; refreshCalc(); });
    refreshCalc();
  }

  function refreshCalc() {
    const f = state.lance;
    const hours = U.timeDiffHours(f.startTime, f.endTime);
    const qty = Number(f.quantityProduced) || 0;
    const def = Number(f.defects) || 0;
    const perHour = hours > 0 ? qty / hours : 0;
    const rate = qty > 0 ? def / qty * 100 : 0;
    const limit = Number(config.defectLimit) || 1;
    const alert = qty > 0 && rate > limit;

    const panel = document.getElementById("calcPanel");
    if (panel) {
      panel.innerHTML = `
        <div><div class="tiny dim mb8">Tempo</div><div class="mono-val">${hours > 0 ? U.fmt(hours, 2) + "h" : "—"}</div></div>
        <div><div class="tiny dim mb8">Produção/h</div><div class="mono-val">${hours > 0 ? U.fmt(perHour, 1) : "—"}</div></div>
        <div><div class="tiny dim mb8">Defeito</div><div class="mono-val" style="color:${qty > 0 ? (alert ? "var(--danger)" : "var(--ok)") : "inherit"}">${qty > 0 ? U.fmt(rate, 2) + "%" : "—"}</div></div>`;
    }
    const alertEl = document.getElementById("calcAlert");
    if (alertEl) {
      alertEl.innerHTML = alert
        ? `<div class="card pad mt12" style="background:var(--danger-dim);border-color:#5c2622">
             <div class="rowc">${U.icon("alert")}<span class="small" style="color:#ffb4af">Índice de defeito acima de ${U.fmt(limit, 2)}% — fora da meta.</span></div>
           </div>`
        : "";
    }
  }

  async function saveLance() {
    const f = state.lance;
    const m = machines.find(x => x.id === f.machineId);
    const p = products.find(x => x.id === f.productId);
    if (!f.date || !f.machineId || !f.productId || !f.operator || !f.startTime || !f.endTime || f.quantityProduced === "") {
      toast("Preencha os campos obrigatórios.");
      return;
    }
    const hours = U.timeDiffHours(f.startTime, f.endTime);
    const qty = Number(f.quantityProduced) || 0;
    const def = Number(f.defects) || 0;
    const rate = qty > 0 ? def / qty * 100 : 0;
    const rec = {
      date: f.date,
      machineId: f.machineId,
      machineName: m ? m.name : "",
      productId: f.productId,
      productName: p ? p.name : "",
      model: (p && p.hasModels) ? f.model : "",
      client: (f.client || "").trim(),
      operator: (f.operator || "").trim(),
      startTime: f.startTime,
      endTime: f.endTime,
      quantityProduced: qty,
      defects: def,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      defectRate: rate,
      createdAt: Date.now()
    };
    try {
      await S.add("productions", rec);
      if (m) {
        await S.update("machines", m.id, {
          status: "produzindo",
          currentProduct: p ? p.name : "",
          client: rec.client || m.client || ""
        });
      }
      state.lance = freshLance();
      toast("Lançamento salvo");
      renderAll();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  /* ========== RELATÓRIOS ========== */
  function renderRelatorios(v) {
    v.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${state.rel.tab === "hist" ? "active" : ""}" data-rel-tab="hist">Lançamentos</button>
        <button class="tab-btn ${state.rel.tab === "cap" ? "active" : ""}" data-rel-tab="cap">Capacidade</button>
      </div>
      <div id="relBox" class="mt8"></div>`;
    refreshRel();
  }

  function refreshRel() {
    const box = document.getElementById("relBox");
    if (!box) return;
    box.innerHTML = "";
    if (state.rel.tab === "cap") renderCapacidade(box);
    else renderRelHist(box);
  }

  function renderRelHist(box) {
    const f = state.rel;
    const clients = [...new Set(productions.map(p => p.client).filter(Boolean))].sort();
    const operators = [...new Set(productions.map(p => p.operator).filter(Boolean))].sort();
    const models = [...new Set(products.flatMap(p => p.models || []))].sort();
    box.innerHTML = `
      <div class="card pad">
        <div class="field-row">
          <div class="field"><label>Data</label><input type="date" id="h-date" value="${f.date}"></div>
          <div class="field"><label>Máquina</label>
            <select id="h-machine"><option value="">Todas</option>
              ${machines.map(m => `<option value="${m.id}" ${m.id === f.machineId ? "selected" : ""}>${U.esc(m.name)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Produto</label>
            <select id="h-product"><option value="">Todos</option>
              ${products.map(x => `<option value="${x.id}" ${x.id === f.productId ? "selected" : ""}>${U.esc(x.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Modelo</label>
            <select id="h-model"><option value="">Todos</option>
              ${models.map(x => `<option value="${U.esc(x)}" ${x === f.model ? "selected" : ""}>${U.esc(x)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Cliente</label>
            <select id="h-client"><option value="">Todos</option>
              ${clients.map(c => `<option value="${U.esc(c)}" ${c === f.client ? "selected" : ""}>${U.esc(c)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Operador</label>
            <select id="h-operator"><option value="">Todos</option>
              ${operators.map(o => `<option value="${U.esc(o)}" ${o === f.operator ? "selected" : ""}>${U.esc(o)}</option>`).join("")}
            </select>
          </div>
        </div>
        <button class="btn-ghost" data-act="clear-hist">Limpar filtros</button>
      </div>
      <div id="histResults" class="mt12"></div>`;
    wireHist();
    refreshHistRows();
  }

  function wireHist() {
    const map = { "h-date": "date", "h-machine": "machineId", "h-product": "productId", "h-model": "model", "h-client": "client", "h-operator": "operator" };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        state.rel[map[id]] = el.value;
        refreshHistRows();
      });
    });
  }

  function refreshHistRows() {
    const box = document.getElementById("histResults");
    if (!box) return;
    const f = state.rel;
    const limit = Number(config.defectLimit) || 1;
    const rows = productions
      .filter(p => !f.date || p.date === f.date)
      .filter(p => !f.machineId || p.machineId === f.machineId)
      .filter(p => !f.productId || p.productId === f.productId)
      .filter(p => !f.model || p.model === f.model)
      .filter(p => !f.client || p.client === f.client)
      .filter(p => !f.operator || p.operator === f.operator)
      .slice()
      .sort((a, b) => String(b.date + (b.createdAt || 0)).localeCompare(String(a.date + (a.createdAt || 0))));

    let total = 0, defs = 0, hrs = 0;
    rows.forEach(r => { total += Number(r.quantityProduced) || 0; defs += Number(r.defects) || 0; hrs += Number(r.productionHours) || 0; });

    if (!rows.length) {
      box.innerHTML = '<div class="empty">Nenhum lançamento encontrado.</div>';
      return;
    }
    box.innerHTML = `
      <div class="grid2 mb12">
        <div class="card pad stat" style="padding:10px 12px"><div class="lbl">${U.icon("package", "sm")} Total</div><div class="val amb" style="font-size:22px">${U.fmt(total)}<em>un.</em></div></div>
        <div class="card pad stat" style="padding:10px 12px"><div class="lbl">${U.icon("alert", "sm")} Defeitos</div><div class="val down" style="font-size:22px">${U.fmt(defs)}<em>un.</em> · ${total ? U.fmt(defs / total * 100, 2) : "0"}%</div></div>
      </div>
      <p class="tiny dim mb8">${rows.length} lançamento${rows.length !== 1 ? "s" : ""}${hrs ? " · " + U.fmt(hrs, 2) + " h" : ""}</p>
      <div class="card tbl-wrap">
        <table>
          <thead><tr>
            <th>Data</th><th>Máquina</th><th>Produto</th><th>Modelo</th><th>Cliente</th><th>Operador</th>
            <th style="text-align:right">Quant.</th><th style="text-align:right">Def.</th>
            <th style="text-align:right">%</th><th style="text-align:right">Prod/h</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(p => {
              const rate = Number(p.defectRate) || 0;
              return `<tr>
                <td>${U.fmtDate(p.date)}</td>
                <td>${U.esc(p.machineName || "—")}</td>
                <td>${U.esc(p.productName || "—")}</td>
                <td>${U.esc(p.model || "—")}</td>
                <td>${U.esc(p.client || "—")}</td>
                <td>${U.esc(p.operator || "—")}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(p.quantityProduced)}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(p.defects)}</td>
                <td class="mono-val" style="text-align:right;color:${rate > limit ? "var(--danger)" : "var(--ok)"}">${U.fmt(rate, 2)}%</td>
                <td class="mono-val" style="text-align:right">${p.perHour ? U.fmt(p.perHour, 1) : "—"}</td>
                <td><button class="icon-btn" data-act="del-lance" data-id="${p.id}" title="Excluir" style="width:28px;height:28px;border-radius:8px">${U.icon("trash", "sm")}</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderCapacidade(box) {
    const byProd = {}, byCombo = {};
    productions.forEach(p => {
      const qty = Number(p.quantityProduced) || 0;
      if (!qty || !p.date) return;
      const keyP = p.productId || p.productName;
      const bp = byProd[keyP] || (byProd[keyP] = { name: p.productName || "?", total: 0, dates: new Set(), count: 0 });
      bp.total += qty; bp.dates.add(p.date); bp.count++;
      const keyC = (p.machineId || "") + "|" + keyP + "|" + (p.model || "");
      const bc = byCombo[keyC] || (byCombo[keyC] = { machine: p.machineName || "?", product: p.productName || "?", model: p.model || "", total: 0, dates: new Set(), count: 0 });
      bc.total += qty; bc.dates.add(p.date); bc.count++;
    });

    const prodRows = Object.values(byProd)
      .map(b => Object.assign({}, b, { avg: b.total / b.dates.size }))
      .sort((a, b) => b.avg - a.avg);
    const combos = Object.values(byCombo)
      .map(b => Object.assign({}, b, { avg: b.total / b.dates.size }))
      .sort((a, b) => b.avg - a.avg);
    const zeroProducts = products.filter(p => !byProd[p.id]);

    box.innerHTML = `
      <div class="card pad" style="background:var(--panel)">
        <div class="rowc">${U.icon("info", "sm")}<span class="small dim">O sistema aprende com os lançamentos. Estimativa = produção total ÷ dias com registro. Quanto mais dias, mais precisa.</span></div>
      </div>

      <p class="section-label">${U.icon("package", "sm")} Capacidade diária por produto</p>
      <div class="space-y">
        ${prodRows.map(r => {
          const prod = products.find(x => x.id === r.name || x.name === r.name);
          const nominal = prod ? (Number(prod.capacityDay) || 0) : 0;
          return `
            <div class="card pad">
              <div class="between">
                <span class="small" style="font-weight:600">${U.esc(r.name)}</span>
                <span class="mono-val" style="font-size:15px">${U.fmt(r.avg)}<em class="tiny dim" style="font-style:normal"> un./dia</em></span>
              </div>
              <div class="kv">${r.count} lançamento${r.count !== 1 ? "s" : ""} · ${r.dates.size} dia${r.dates.size !== 1 ? "s" : ""} de registro${nominal ? " · nominal " + U.fmt(nominal) + "/dia" : ""}</div>
            </div>`;
        }).join("")}
        ${zeroProducts.map(p => `
          <div class="card pad">
            <div class="between">
              <span class="small" style="font-weight:600">${U.esc(p.name)}</span>
              <span class="mono-val dim">sem registros</span>
            </div>
          </div>`).join("")}
        ${prodRows.length === 0 && zeroProducts.length === 0 ? '<div class="empty">Ainda sem produções lançadas.</div>' : ""}
      </div>

      <p class="section-label">${U.icon("cog", "sm")} Detalhe por máquina e produto</p>
      <div class="card tbl-wrap">
        <table>
          <thead><tr><th>Máquina</th><th>Produto</th><th>Modelo</th><th style="text-align:right">Média/dia</th><th style="text-align:right">Registros</th><th style="text-align:right">Dias</th></tr></thead>
          <tbody>
            ${combos.map(c => `
              <tr>
                <td>${U.esc(c.machine)}</td>
                <td>${U.esc(c.product)}</td>
                <td>${U.esc(c.model || "—")}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(c.avg)}</td>
                <td class="mono-val" style="text-align:right">${c.count}</td>
                <td class="mono-val" style="text-align:right">${c.dates.size}</td>
              </tr>`).join("")}
            ${combos.length === 0 ? '<tr><td colspan="6" class="empty">Registre produção para gerar as estimativas.</td></tr>' : ""}
          </tbody>
        </table>
      </div>`;
  }

  /* ========== PLANEJAMENTO ========== */
  function renderPlanejamento(v) {
    const p = state.plan;
    const pc = state.planResult || planCalc();
    v.innerHTML = `
      <div class="card pad">
        <div class="section-label" style="margin-top:0">${U.icon("clipboard", "sm")} Dados do pedido</div>
        <div class="field"><label>Volume (unidades)</label><input type="number" id="pl-vol" min="0" value="${p.volume}" placeholder="Ex.: 200000"></div>
        <div class="field-row">
          <div class="field"><label>Prazo desejado (dias)</label><input type="number" id="pl-days" min="0" value="${p.days}" placeholder="Opcional"></div>
          <div class="field"><label>Jornada (h/dia)</label><input type="number" id="pl-jornada" min="1" max="24" value="${p.jornada}"></div>
        </div>
        <div class="field"><label>Início previsto</label><input type="date" id="pl-start" value="${p.startDate}"></div>
      </div>

      <p class="section-label">${U.icon("speed", "sm")} Simulação automática</p>
      <div id="planBox">${planKPIs(pc)}</div>

      <div class="card pad mt12">
        <div class="rowc">${U.icon("info", "sm")}<span class="small dim">
          ${pc.perMach
            ? `Cada máquina produz cerca de <b class="mono-val" style="color:var(--text)">${U.fmt(pc.perMach)} un./dia</b>.
              ${pc.prazo > 0 && pc.vol > 0
                ? `Para entregar em ${pc.prazo} dia${pc.prazo !== 1 ? "s" : ""}, são necessárias ${pc.needed} máquina${pc.needed !== 1 ? "s" : ""} trabalhando em paralelo.`
                : `Todas as ${machines.length} máquinas em paralelo entregam o pedido em ${pc.days} dia${pc.days !== 1 ? "s" : ""}.`}`
            : `Cadastre a capacidade horária/diária das máquinas (em Configurações externas não há) ou registre lançamentos para o sistema aprender.`}
        </span></div>
      </div>`;
    wirePlan();
  }

  function planKPIs(pc) {
    return `<div class="plan-calc">
      <div class="plan-kpi"><div class="pk">Capacidade</div><div class="pv">${pc.capDayTotal ? U.fmt(pc.capDayTotal) : "—"}</div><div class="tiny dim" style="margin-top:2px">un./dia</div></div>
      <div class="plan-kpi"><div class="pk">Dias estimados</div><div class="pv">${pc.days ? pc.days : "—"}</div><div class="tiny dim" style="margin-top:2px">com todas as máquinas</div></div>
      <div class="plan-kpi"><div class="pk">Máquinas</div><div class="pv">${pc.needed}</div><div class="tiny dim" style="margin-top:2px">de ${machines.length} cadastradas</div></div>
      <div class="plan-kpi"><div class="pk">Previsão de entrega</div><div class="pv warn" style="font-size:19px">${pc.done ? U.fmtDate(pc.delivery) : "—"}</div><div class="tiny dim" style="margin-top:2px">a partir de ${U.fmtDate(state.plan.startDate)}</div></div>
    </div>`;
  }

  function wirePlan() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        state.plan[key] = el.value;
        state.planResult = planCalc();
        renderPlanejamentoPanel();
      });
    };
    bind("pl-vol", "volume");
    bind("pl-days", "days");
    bind("pl-jornada", "jornada");
    const st = document.getElementById("pl-start");
    if (st) st.addEventListener("change", () => {
      state.plan.startDate = st.value;
      state.planResult = planCalc();
      renderPlanejamentoPanel();
    });
  }

  function renderPlanejamentoPanel() {
    const box = document.getElementById("planBox");
    if (!box) return;
    box.innerHTML = planKPIs(state.planResult || planCalc());
  }

  /* ========== PEDIDOS E ORDENS DE PRODUÇÃO ========== */
  const ORDER_STATUS = {
    aguardando: { label: "Aguardando produção", pill: "auto" },
    em_producao: { label: "Em produção", pill: "produzindo" },
    finalizado: { label: "Finalizado", pill: "good" }
  };
  const PO_STATUS = {
    aguardando: { label: "Aguardando", pill: "auto" },
    em_producao: { label: "Em produção", pill: "produzindo" },
    finalizada: { label: "Finalizada", pill: "good" }
  };

  /* Regra importante: não duplicar produção. Uma Ordem de Produção com
     operação "retrabalho" (ex.: escanteamento de parte do miolo já
     furado) não é somada ao total produzido do pedido — só ordens de
     operação "producao" contam para produzido/restante. */
  function orderProgress(orderId) {
    const pos = productionOrders.filter(po => po.orderId === orderId)
      .slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const mainPOs = pos.filter(po => po.operacao === "retrabalho" ? false : true);
    const reworkPOs = pos.filter(po => po.operacao === "retrabalho");
    const produced = mainPOs.reduce((s, po) => s + (Number(po.quantityProduced) || 0), 0);
    const reworkProduced = reworkPOs.reduce((s, po) => s + (Number(po.quantityProduced) || 0), 0);
    return { pos, mainPOs, reworkPOs, produced, reworkProduced };
  }

  /* Código curto e estável do pedido para exibir nas listas suspensas,
     baseado na ordem de criação (não muda se pedidos forem editados). */
  function orderCode(o) {
    const ordered = orders.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const idx = ordered.findIndex(x => x.id === o.id);
    return "#" + String(idx >= 0 ? idx + 1 : 0).padStart(4, "0");
  }

  /* Pedidos que ainda têm saldo pendente — só esses aparecem na lista
     suspensa de "Pedido" da Nova Tarefa. */
  function ordersWithBalance() {
    return orders
      .map(o => Object.assign({}, o, { _remaining: Math.max(0, (Number(o.quantity) || 0) - orderProgress(o.id).produced) }))
      .filter(o => o.status !== "finalizado" && o._remaining > 0)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  /* Filtro inteligente (item 13): tenta casar o produto/modelo já
     descritos no pedido com o cadastro de produtos, só para pré-marcar
     a seleção — nunca bloqueia o gestor de escolher outro produto. */
  function guessProductForOrder(order) {
    if (!order || !order.product) return null;
    const norm = s => (s || "").trim().toLowerCase();
    const target = norm(order.product);
    if (!target) return null;
    return products.find(p => norm(p.name) === target)
      || products.find(p => target.indexOf(norm(p.name)) >= 0 || norm(p.name).indexOf(target) >= 0)
      || null;
  }
  function guessModelForOrder(order, product) {
    if (!order || !product || !product.hasModels) return "";
    const norm = s => (s || "").trim().toLowerCase();
    const target = norm(order.model);
    if (!target) return "";
    const match = (product.models || []).find(m => norm(m) === target);
    return match || "";
  }

  function renderPedidos(v) {
    v.innerHTML = `
      <div class="space-y">
        ${state.newTaskForm ? newTaskForm() : `<button class="btn btn-primary btn-block" data-act="new-task">➕ Nova Tarefa</button>`}
        ${orders.length ? orders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(orderCard).join("") : '<div class="empty">Nenhum pedido cadastrado.</div>'}
        ${state.newOrderForm ? newOrderForm() : `<button class="btn btn-outline btn-block" data-act="new-order">+ Novo Pedido</button>`}
      </div>`;
  }

  function orderCard(o) {
    const d = state.draftOrder[o.id];
    if (d) {
      return `
        <div class="card pad" data-edit-order-id="${o.id}">
          <div class="rowc between mb12">
            <span class="small" style="font-weight:600">Editando pedido</span>
            <button class="btn-ghost" data-act="cancel-order" data-id="${o.id}">Cancelar</button>
          </div>
          <div class="field"><label>Cliente</label><input data-k="client" value="${U.esc(d.client)}"></div>
          <div class="field-row">
            <div class="field"><label>Produto</label><input data-k="product" value="${U.esc(d.product)}"></div>
            <div class="field"><label>Modelo</label><input data-k="model" value="${U.esc(d.model)}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Quantidade do pedido</label><input type="number" data-k="quantity" min="0" value="${d.quantity}"></div>
            <div class="field"><label>Tipo</label>
              <select data-k="type">
                <option value="completo" ${d.type === "completo" ? "selected" : ""}>Caderno completo</option>
                <option value="refil" ${d.type === "refil" ? "selected" : ""}>Refil</option>
              </select>
            </div>
          </div>
          <div class="field"><label>Status</label>
            <select data-k="status">
              <option value="aguardando" ${d.status === "aguardando" ? "selected" : ""}>Aguardando produção</option>
              <option value="em_producao" ${d.status === "em_producao" ? "selected" : ""}>Em produção</option>
              <option value="finalizado" ${d.status === "finalizado" ? "selected" : ""}>Finalizado</option>
            </select>
          </div>
          <button class="btn btn-primary btn-block" data-act="save-order" data-id="${o.id}">Salvar pedido</button>
        </div>`;
    }
    const prog = orderProgress(o.id);
    const qty = Number(o.quantity) || 0;
    const remaining = Math.max(0, qty - prog.produced);
    const pct = qty > 0 ? Math.min(100, prog.produced / qty * 100) : 0;
    const stO = ORDER_STATUS[o.status] || ORDER_STATUS.aguardando;
    const open = !!state.openOrders[o.id];
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${orderCode(o)} — ${U.esc(o.client)}</div>
            <div class="tiny dim">${U.esc(o.product)}${o.model ? " — " + U.esc(o.model) : ""} · ${o.type === "refil" ? "Refil" : "Caderno completo"}</div>
          </div>
          <span class="pill ${stO.pill}">${stO.label}</span>
          <button class="btn-ghost" data-act="edit-order" data-id="${o.id}">Editar</button>
        </div>
        <div class="kv mt12"><b>Pedido:</b> ${U.fmt(qty)} un.</div>
        <div class="kv"><b>Produzido:</b> ${U.fmt(prog.produced)} un.${prog.reworkProduced ? " · Retrabalho: " + U.fmt(prog.reworkProduced) + " un." : ""}</div>
        <div class="kv"><b>Saldo:</b> ${U.fmt(remaining)} un.</div>
        <div class="tick-row mt8"><div class="tick-fill ${pct >= 100 ? "ok" : ""}" style="width:${pct}%"></div></div>
        ${pct >= 100 ? `<div class="kv mt8" style="color:var(--ok)"><b>🟢 PEDIDO CONCLUÍDO</b></div>` : ""}
        <div class="rowc mt12" style="gap:8px">
          <button class="btn-ghost" data-act="toggle-order" data-id="${o.id}">${open ? "Ocultar tarefas" : "Ver tarefas (" + prog.pos.length + ")"}</button>
          ${remaining > 0 ? `<button class="btn-ghost" data-act="new-task-for-order" data-id="${o.id}">➕ Nova tarefa para este pedido</button>` : ""}
        </div>
        ${open ? orderOrdersBlock(o) : ""}
      </div>`;
  }

  function orderOrdersBlock(o) {
    const prog = orderProgress(o.id);
    return `
      <div class="space-y3 mt12">
        ${prog.pos.length ? prog.pos.map(poCard).join("") : '<div class="empty">Nenhuma tarefa criada para este pedido ainda.</div>'}
      </div>`;
  }

  function poCard(po) {
    const stPO = PO_STATUS[po.status] || PO_STATUS.aguardando;
    const produced = Number(po.quantityProduced) || 0;
    return `
      <div class="card pad" style="background:var(--panel)">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(po.product)}${po.model ? " — " + U.esc(po.model) : ""}</div>
            <div class="tiny dim">${U.esc(po.machineName)} · ${po.employeeName ? "Funcionário: " + U.esc(po.employeeName) : ""}${po.operacao === "retrabalho" ? " · Retrabalho" : ""}</div>
          </div>
          <span class="pill ${stPO.pill}">${stPO.label}</span>
        </div>
        <div class="kv mt12"><b>Produzido:</b> ${U.fmt(produced)} un.${po.defects ? " · " + U.fmt(po.defects) + " defeitos" : ""}</div>
        ${po.status !== "finalizada" ? `<button class="btn-ghost mt12" data-act="finish-po" data-id="${po.id}">Marcar como finalizada</button>` : ""}
      </div>`;
  }

  function newOrderForm() {
    const no = state.newOrder;
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Novo Pedido</span>
          <button class="btn-ghost" data-act="cancel-new-order">Cancelar</button>
        </div>
        <div class="field"><label>Cliente</label><input id="no-client" value="${U.esc(no.client)}" placeholder="Ex.: Lojas Americanas"></div>
        <div class="field-row">
          <div class="field"><label>Produto</label><input id="no-product" value="${U.esc(no.product)}" placeholder="Ex.: Caderno Universitário 160 folhas"></div>
          <div class="field"><label>Modelo</label><input id="no-model" value="${U.esc(no.model)}" placeholder="Ex.: Smart"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Quantidade do pedido</label><input type="number" id="no-quantity" min="0" value="${no.quantity}" placeholder="Ex.: 50000"></div>
          <div class="field"><label>Tipo</label>
            <select id="no-type">
              <option value="completo" ${no.type === "completo" ? "selected" : ""}>Caderno completo</option>
              <option value="refil" ${no.type === "refil" ? "selected" : ""}>Refil</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-block" data-act="save-new-order">Adicionar pedido</button>
      </div>`;
  }

  /* NOVA TAREFA — item 1/12/14: tudo por lista suspensa, sem digitação
     nenhuma (nem de quantidade: ela vem do saldo do pedido escolhido). */
  function newTaskForm() {
    const nt = state.newTask;
    const pending = ordersWithBalance();
    const order = pending.find(o => o.id === nt.orderId) || null;
    const employee = employees.find(e => e.id === nt.employeeId) || null;
    const allowedMachines = (employee && (employee.allowedMachines || []).length)
      ? machines.filter(m => employee.allowedMachines.indexOf(m.id) >= 0)
      : machines;
    const product = products.find(p => p.id === nt.productId) || null;
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Nova Tarefa</span>
          <button class="btn-ghost" data-act="cancel-new-task">Cancelar</button>
        </div>

        <div class="field"><label>Pedido</label>
          <select id="nt-order">
            <option value="">Selecione...</option>
            ${pending.map(o => `<option value="${o.id}" ${nt.orderId === o.id ? "selected" : ""}>${orderCode(o)} — ${U.esc(o.client)} — ${U.fmt(o._remaining)} pendentes — ${U.esc(o.product)}</option>`).join("")}
          </select>
          ${!pending.length ? '<p class="tiny dim mt8">Nenhum pedido com saldo pendente. Cadastre um pedido primeiro.</p>' : ""}
        </div>

        <div class="field"><label>Funcionário</label>
          <select id="nt-employee">
            <option value="">Selecione...</option>
            ${employees.filter(e => e.status === "ativo").map(e => `<option value="${e.id}" ${nt.employeeId === e.id ? "selected" : ""}>${U.esc(e.name)}</option>`).join("")}
          </select>
        </div>

        <div class="field"><label>Máquina</label>
          <select id="nt-machine">
            <option value="">Selecione...</option>
            ${allowedMachines.map(m => `<option value="${m.id}" ${nt.machineId === m.id ? "selected" : ""}>${U.esc(m.name)}</option>`).join("")}
          </select>
          ${employee && !allowedMachines.length ? '<p class="tiny dim mt8">Esse funcionário não tem nenhuma máquina liberada.</p>' : ""}
        </div>

        <div class="field-row">
          <div class="field"><label>Produto</label>
            <select id="nt-product">
              <option value="">Selecione...</option>
              ${products.map(p => `<option value="${p.id}" ${nt.productId === p.id ? "selected" : ""}>${U.esc(p.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Modelo</label>
            <select id="nt-model" ${(product && product.hasModels) ? "" : "disabled"}>
              <option value="">${(product && product.hasModels) ? "Selecione..." : "N/A"}</option>
              ${product && product.hasModels ? product.models.map(mo => `<option value="${U.esc(mo)}" ${nt.model === mo ? "selected" : ""}>${U.esc(mo)}</option>`).join("") : ""}
            </select>
          </div>
        </div>

        ${order ? `<div class="kv mt12"><b>Quantidade disponível do pedido:</b> ${U.fmt(order._remaining)} un.</div>` : ""}

        <button class="btn btn-primary btn-block mt12" data-act="save-new-task">CRIAR TAREFA</button>
      </div>`;
  }

  async function addOrder() {
    const client = (state.newOrder.client || "").trim();
    const product = (state.newOrder.product || "").trim();
    const quantity = Number(state.newOrder.quantity) || 0;
    if (!client) { toast("Informe o cliente."); return; }
    if (!product) { toast("Informe o produto."); return; }
    if (quantity <= 0) { toast("Informe a quantidade do pedido."); return; }
    try {
      await S.add("orders", {
        client, product,
        model: (state.newOrder.model || "").trim(),
        quantity,
        type: state.newOrder.type || "completo",
        status: "aguardando",
        createdAt: Date.now()
      });
      state.newOrder = freshOrderDraft();
      state.newOrderForm = false;
      toast("Pedido cadastrado");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function saveOrder(id) {
    const d = state.draftOrder[id];
    if (!d) return;
    const orig = orders.find(x => x.id === id) || {};
    const patch = {
      client: (d.client || "").trim() || orig.client,
      product: (d.product || "").trim() || orig.product,
      model: (d.model || "").trim(),
      quantity: Number(d.quantity) || 0,
      type: d.type || "completo",
      status: d.status || "aguardando"
    };
    try {
      await S.update("orders", id, patch);
      delete state.draftOrder[id];
      toast("Pedido salvo");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  /* NOVA TAREFA (item 15): a tarefa é só uma referência ao pedido — não
     carrega quantidade própria. A quantidade "oficial" é sempre calculada
     a partir das produções (productionOrders) vinculadas ao pedido, então
     não há como duplicar ou digitar estoque paralelo aqui. */
  async function addTask() {
    /* Item 8: trava contra duplo clique ao criar tarefa — evita duas
       Ordens de Produção iguais se o gestor clicar "Criar" duas vezes. */
    if (state._savingTask) return;
    state._savingTask = true;
    try {
      await doAddTask();
    } finally {
      state._savingTask = false;
    }
  }

  async function doAddTask() {
    const nt = state.newTask;
    const order = orders.find(o => o.id === nt.orderId);
    if (!order) { toast("Selecione o pedido."); return; }
    const remaining = Math.max(0, (Number(order.quantity) || 0) - orderProgress(order.id).produced);
    if (remaining <= 0) { toast("Este pedido não tem mais saldo pendente."); return; }
    const employee = employees.find(e => e.id === nt.employeeId);
    if (!employee || employee.status !== "ativo") { toast("Selecione o funcionário."); return; }
    const m = machines.find(x => x.id === nt.machineId);
    if (!m) { toast("Selecione a máquina."); return; }
    if ((employee.allowedMachines || []).length && (employee.allowedMachines || []).indexOf(m.id) < 0) {
      toast("Esse funcionário não tem permissão para operar essa máquina."); return;
    }
    const product = products.find(p => p.id === nt.productId);
    if (!product) { toast("Selecione o produto."); return; }
    if (product.hasModels && !nt.model) { toast("Selecione o modelo."); return; }
    try {
      await S.add("productionOrders", {
        orderId: order.id,
        machineId: m.id,
        machineName: m.name,
        employeeId: employee.id,
        employeeName: employee.name,
        productId: product.id,
        product: product.name,
        model: product.hasModels ? nt.model : "",
        operacao: "producao",
        status: "aguardando",
        quantityProduced: 0,
        defects: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: Date.now()
      });
      state.newTaskForm = false;
      state.newTask = freshTaskDraft();
      toast("Tarefa criada");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function finishProductionOrder(id) {
    try {
      await S.update("productionOrders", id, { status: "finalizada", finishedAt: Date.now() });
      toast("Ordem marcada como finalizada");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  /* ========== MÁQUINAS ========== */
  function renderMaquinas(v) {
    v.innerHTML = `
      <div class="space-y">
        ${machines.map(machineCard).join("")}
        ${state.newMachineForm
          ? newMachineForm()
          : `<button class="btn btn-outline btn-block" data-act="new-machine">+ Nova máquina</button>`}
      </div>`;
  }

  function machineCard(m) {
    const d = state.draftMachine[m.id];
    if (d) {
      return `
        <div class="card pad" data-edit-mach-id="${m.id}">
          <div class="rowc between mb12">
            <span class="small" style="font-weight:600">Editando: ${U.esc(m.name)}</span>
            <button class="btn-ghost" data-act="cancel-mach" data-id="${m.id}">Cancelar</button>
          </div>
          <div class="field"><label>Nome</label><input data-k="name" value="${U.esc(d.name)}"></div>
          <div class="field-row">
            <div class="field"><label>Tipo</label>
              <select data-k="type">
                <option value="automatica" ${d.type === "automatica" ? "selected" : ""}>Automática</option>
                <option value="escanteadeira" ${d.type === "escanteadeira" ? "selected" : ""}>Escanteadeira</option>
                <option value="manual" ${d.type === "manual" ? "selected" : ""}>Manual</option>
              </select>
            </div>
            <div class="field"><label>Status</label>
              <select data-k="status">
                <option value="produzindo" ${d.status === "produzindo" ? "selected" : ""}>Produzindo</option>
                <option value="pausa" ${d.status === "pausa" ? "selected" : ""}>Parada programada</option>
                <option value="parada" ${d.status === "parada" ? "selected" : ""}>Parada</option>
              </select>
            </div>
          </div>
          <div class="field"><label>Produto atual</label>
            <select data-k="currentProduct">
              <option value="">—</option>
              ${products.map(p => `<option value="${U.esc(p.name)}" ${d.currentProduct === p.name ? "selected" : ""}>${U.esc(p.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Cliente</label><input data-k="client" value="${U.esc(d.client)}"></div>
          <div class="field-row">
            <div class="field"><label>Capacidade por hora (un.)</label><input type="number" data-k="capacityHour" value="${d.capacityHour}"></div>
            <div class="field"><label>Capacidade por dia (un.)</label><input type="number" data-k="capacityDay" value="${d.capacityDay}"></div>
          </div>
          <button class="btn btn-primary btn-block" data-act="save-mach" data-id="${m.id}">Salvar máquina</button>
        </div>`;
    }
    const st = STATUS[m.status] || STATUS.parada;
    const typeLab = m.type === "automatica" ? "Automática" : (m.type === "escanteadeira" ? "Escanteadeira" : "Manual");
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="led ${st.led}"></div>
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(m.name)}</div>
            <div class="tiny dim">${typeLab}</div>
          </div>
          <span class="pill ${st.pill}">${st.label}</span>
          <button class="btn-ghost" data-act="edit-mach" data-id="${m.id}">Editar</button>
        </div>
        <div class="kv mt12"><b>Produto atual:</b> ${U.esc(m.currentProduct || "—")}</div>
        <div class="kv"><b>Cliente:</b> ${U.esc(m.client || "—")}</div>
        <div class="kv"><b>Capacidade:</b> ${m.capacityHour ? U.fmt(m.capacityHour) + " un./h" : "—"} · ${m.capacityDay ? U.fmt(m.capacityDay) + " un./dia" : "—"}</div>
      </div>`;
  }

  function newMachineForm() {
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Nova máquina</span>
          <button class="btn-ghost" data-act="cancel-new-mach">Cancelar</button>
        </div>
        <div class="field"><label>Nome</label><input id="nm-name" value="${U.esc(state.newMachine.name)}" placeholder="Ex.: Automática 4"></div>
        <div class="field"><label>Tipo</label>
          <select id="nm-type">
            <option value="automatica" ${state.newMachine.type === "automatica" ? "selected" : ""}>Automática</option>
            <option value="escanteadeira" ${state.newMachine.type === "escanteadeira" ? "selected" : ""}>Escanteadeira</option>
            <option value="manual" ${state.newMachine.type === "manual" ? "selected" : ""}>Manual</option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" data-act="save-new-mach">Adicionar máquina</button>
      </div>`;
  }

  /* ========== PRODUTOS ========== */
  function renderProdutos(v) {
    v.innerHTML = `
      <div class="space-y">
        ${products.map(productCard).join("")}
        ${state.newProductForm
          ? newProductForm()
          : `<button class="btn btn-outline btn-block" data-act="new-product">+ Novo produto</button>`}
      </div>`;
  }

  function productCard(p) {
    const d = state.draftProduct[p.id];
    if (d) {
      return `
        <div class="card pad" data-edit-prod-id="${p.id}">
          <div class="rowc between mb12">
            <span class="small" style="font-weight:600">Editando: ${U.esc(p.name)}</span>
            <button class="btn-ghost" data-act="cancel-prod" data-id="${p.id}">Cancelar</button>
          </div>
          <div class="field"><label>Nome do produto</label><input data-k="name" value="${U.esc(d.name)}"></div>
          <label class="check-row"><input type="checkbox" data-k="hasModels" ${d.hasModels ? "checked" : ""}> Possui modelos de furação</label>
          <div class="field mt12" id="prod-models-field" style="${d.hasModels ? "" : "display:none"}">
            <label>Modelos (separados por vírgula)</label>
            <input data-k="modelsText" value="${U.esc(d.modelsText)}" placeholder="Espiral, Wero, Smart, Ficario">
          </div>
          <div class="field-row mt12">
            <div class="field"><label>Capacidade nominal (un./dia)</label><input type="number" data-k="capacityDay" value="${d.capacityDay}"></div>
            <div class="field"><label>Máx. defeito (%)</label><input type="number" data-k="maxDefectRate" min="0" max="100" step="0.1" value="${d.maxDefectRate}"></div>
          </div>
          <button class="btn btn-primary btn-block mt12" data-act="save-prod" data-id="${p.id}">Salvar produto</button>
        </div>`;
    }
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(p.name)}</div>
            <div class="tiny dim">${p.hasModels ? "Modelos de furação" : "Sem modelos"}</div>
          </div>
          <button class="btn-ghost" data-act="edit-prod" data-id="${p.id}">Editar</button>
        </div>
        ${p.hasModels && (p.models || []).length ? `
          <div class="flex mt12" style="gap:6px;flex-wrap:wrap">
            ${p.models.map(mo => `<span class="chip">${U.esc(mo)}</span>`).join("")}
          </div>` : ""}
        <div class="kv mt12"><b>Capacidade nominal:</b> ${p.capacityDay ? U.fmt(p.capacityDay) + " un./dia" : "—"}</div>
        <div class="kv"><b>Máx. defeito:</b> ${U.fmt(p.maxDefectRate === undefined ? 1 : p.maxDefectRate, 2)}%</div>
      </div>`;
  }

  function newProductForm() {
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Novo produto</span>
          <button class="btn-ghost" data-act="cancel-new-prod">Cancelar</button>
        </div>
        <div class="field"><label>Nome do produto</label><input id="np-name" value="${U.esc(state.newProduct.name)}" placeholder="Ex.: Agenda Executiva"></div>
        <label class="check-row"><input type="checkbox" id="np-hasModels" ${state.newProduct.hasModels ? "checked" : ""}> Possui modelos de furação</label>
        <div class="field mt12" id="np-models-field" style="${state.newProduct.hasModels ? "" : "display:none"}">
          <label>Modelos (separados por vírgula)</label>
          <input id="np-modelsText" value="${U.esc(state.newProduct.modelsText)}" placeholder="Espiral, Wero">
        </div>
        <button class="btn btn-primary btn-block mt12" data-act="save-new-prod">Adicionar produto</button>
      </div>`;
  }

  /* ========== FUNCIONÁRIOS ========== */
  function renderFuncionarios(v) {
    v.innerHTML = `
      <div class="card pad" style="background:var(--panel);margin-bottom:12px">
        <div class="rowc">${U.icon("info", "sm")}<span class="small dim">O funcionário não fica preso a uma máquina fixa: ele escolhe a máquina somente ao fazer login na tela do operador, entre as que estiver autorizado a operar.</span></div>
      </div>
      <div class="space-y">
        ${employees.length ? employees.map(employeeCard).join("") : '<div class="empty">Nenhum funcionário cadastrado.</div>'}
        ${state.newEmployeeForm ? newEmployeeFormHTML() : `<button class="btn btn-outline btn-block" data-act="new-employee">+ Novo Funcionário</button>`}
      </div>`;
  }

  function employeeCard(em) {
    const d = state.draftEmployee[em.id];
    if (d) {
      return `
        <div class="card pad" data-edit-emp-id="${em.id}">
          <div class="rowc between mb12">
            <span class="small" style="font-weight:600">Editando: ${U.esc(em.name)}</span>
            <button class="btn-ghost" data-act="cancel-emp" data-id="${em.id}">Cancelar</button>
          </div>
          <div class="field"><label>Nome</label><input data-k="name" value="${U.esc(d.name)}" placeholder="Ex.: Roque"></div>
          <div class="field"><label>Função</label><input data-k="role" value="${U.esc(d.role)}" placeholder="Ex.: Operador de máquina"></div>
          <div class="field"><label>Status</label>
            <select data-k="status">
              <option value="ativo" ${d.status === "ativo" ? "selected" : ""}>Ativo</option>
              <option value="inativo" ${d.status === "inativo" ? "selected" : ""}>Inativo</option>
            </select>
          </div>
          <div class="field-row">
            <div class="field"><label>Novo PIN (opcional)</label><input type="password" data-k="pin" inputmode="numeric" maxlength="12" placeholder="Deixe em branco para manter"></div>
            <div class="field"><label>Confirmar PIN</label><input type="password" data-k="pin2" inputmode="numeric" maxlength="12"></div>
          </div>
          <label class="tiny dim" style="display:block;margin:12px 0 6px">Permissões de máquinas</label>
          <div class="space-y3">
            ${machines.map(m => `
              <label class="check-row"><input type="checkbox" data-mach-perm="${m.id}" ${d.allowedMachines.indexOf(m.id) >= 0 ? "checked" : ""}> ${U.esc(m.name)}</label>`).join("")}
          </div>
          <button class="btn btn-primary btn-block mt12" data-act="save-emp" data-id="${em.id}">Salvar funcionário</button>
        </div>`;
    }
    const active = em.status === "ativo";
    const perms = (em.allowedMachines || []).map(mid => {
      const m = machines.find(x => x.id === mid);
      return m ? m.name : null;
    }).filter(Boolean);
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(em.name)}</div>
            <div class="tiny dim">${U.esc(em.role || "—")}</div>
          </div>
          <span class="pill ${active ? "produzindo" : "parada"}">${active ? "Ativo" : "Inativo"}</span>
          <button class="btn-ghost" data-act="edit-emp" data-id="${em.id}">Editar</button>
        </div>
        <div class="kv mt12"><b>Máquinas permitidas:</b> ${perms.length ? U.esc(perms.join(", ")) : "nenhuma"}</div>
        <button class="btn-ghost mt12" data-act="toggle-emp-status" data-id="${em.id}">${active ? "Desativar" : "Ativar"}</button>
      </div>`;
  }

  function newEmployeeFormHTML() {
    const ne = state.newEmployee;
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Novo Funcionário</span>
          <button class="btn-ghost" data-act="cancel-new-emp">Cancelar</button>
        </div>
        <div class="field"><label>Nome</label><input id="ne-name" value="${U.esc(ne.name)}" placeholder="Ex.: Roque"></div>
        <div class="field"><label>Função</label><input id="ne-role" value="${U.esc(ne.role)}" placeholder="Ex.: Operador de máquina"></div>
        <div class="field-row">
          <div class="field"><label>PIN</label><input type="password" id="ne-pin" inputmode="numeric" maxlength="12" placeholder="Ex.: 1234"></div>
          <div class="field"><label>Confirmar PIN</label><input type="password" id="ne-pin2" inputmode="numeric" maxlength="12"></div>
        </div>
        <div class="field"><label>Status</label>
          <select id="ne-status">
            <option value="ativo" ${ne.status === "ativo" ? "selected" : ""}>Ativo</option>
            <option value="inativo" ${ne.status === "inativo" ? "selected" : ""}>Inativo</option>
          </select>
        </div>
        <label class="tiny dim" style="display:block;margin:12px 0 6px">Permissões de máquinas</label>
        <div class="space-y3">
          ${machines.map(m => `
            <label class="check-row"><input type="checkbox" data-ne-perm="${m.id}" ${ne.allowedMachines.indexOf(m.id) >= 0 ? "checked" : ""}> ${U.esc(m.name)}</label>`).join("")}
        </div>
        <button class="btn btn-primary btn-block mt12" data-act="save-new-emp">Adicionar funcionário</button>
      </div>`;
  }

  /* ========== CONFIGURAÇÕES ========== */
  function renderConfig(v) {
    const c = config || SEED_CONFIG[0];
    v.innerHTML = `
      <div class="card pad">
        <div class="section-label" style="margin-top:0">${U.icon("sliders", "sm")} Dados do sistema</div>
        <div class="field"><label>Nome da empresa / fábrica</label><input id="set-company" value="${U.esc(c.companyName || "")}"></div>
        <div class="field"><label>Setor</label><input id="set-sector" value="${U.esc(c.sector || "")}"></div>
        <div class="field-row">
          <div class="field"><label>Meta de defeito (%)</label><input type="number" id="set-limit" min="0" max="100" step="0.1" value="${c.defectLimit === undefined ? 1 : c.defectLimit}"></div>
          <div class="field"><label>Meta diária (un./dia)</label><input type="number" id="set-goal" min="0" step="1" value="${c.dailyGoal || 0}" placeholder="0 = automática"></div>
        </div>
        <p class="tiny dim mb12">Meta diária 0 (zero) usa a média calculada dos lançamentos do mês.</p>
        <button class="btn btn-primary btn-block" data-act="save-config">Salvar ajustes</button>
      </div>

      <div class="card pad mt12">
        <div class="section-label" style="margin-top:0">${U.icon("play", "sm")} Tela do funcionário</div>
        <p class="tiny dim mb12">O operador escolhe a máquina, inicia o turno (PLAY) e, no fim do dia, lança a quantidade — vira lançamento no painel.</p>
        <a class="btn btn-primary btn-block" href="./operador.html">${U.icon("play", "sm")} Abrir tela do funcionário</a>
      </div>

      <div class="card pad mt12">
        <div class="section-label" style="margin-top:0">${U.icon("lock", "sm")} Alterar PIN de acesso</div>
        <div class="field-row">
          <div class="field"><label>Novo PIN</label><input type="password" id="pin1" inputmode="numeric" maxlength="12"></div>
          <div class="field"><label>Confirmar PIN</label><input type="password" id="pin2" inputmode="numeric" maxlength="12"></div>
        </div>
        <button class="btn btn-primary btn-block" data-act="change-pin">Definir novo PIN</button>
      </div>

      <div class="card pad mt12">
        <div class="section-label" style="margin-top:0">${U.icon("user", "sm")} PIN do operador (tela do funcionário)</div>
        <p class="tiny dim mb12">${c.operatorPinHash ? "Um PIN de operador está <b style=\"color:var(--ok)\">definido</b>. A tela do funcionário pedirá esse PIN antes de iniciar." : "Ainda <b>sem PIN</b> — a tela do funcionário abre livremente."}</p>
        <div class="field-row">
          <div class="field"><label>Novo PIN do operador</label><input type="password" id="op1" inputmode="numeric" maxlength="12"></div>
          <div class="field"><label>Confirmar PIN</label><input type="password" id="op2" inputmode="numeric" maxlength="12"></div>
        </div>
        <div class="space-y3">
          <button class="btn btn-primary btn-block" data-act="set-op-pin">Definir PIN do operador</button>
          ${c.operatorPinHash ? '<button class="btn btn-outline btn-block" data-act="clear-op-pin">Remover PIN do operador</button>' : ""}
        </div>
      </div>

      <div class="card pad mt12">
        <div class="section-label" style="margin-top:0">${U.icon("info", "sm")} Sistema</div>
        <p class="small dim">Modo de dados: <b style="color:var(--text)">${S.isRemote() ? "Firestore (nuvem)" : "Local (este aparelho)"}</b></p>
        <p class="small dim">Versão: <b style="color:var(--text)">cp-v5</b> · PWA instalável no Android</p>
        ${S.isRemote() ? "" : '<p class="small dim">Para compartilhar os dados entre aparelhos (Firebase), preencha as chaves em <span class="mono" style="color:var(--text)">js/firebase-config.js</span>.</p>'}
        <div class="space-y mt12">
          <button class="btn btn-outline btn-block" data-act="logout">${U.icon("logout", "sm")} Sair do painel</button>
          <button class="btn btn-danger btn-block" data-act="reset-local">Apagar dados deste aparelho</button>
        </div>
      </div>`;
  }

  /* ========== BINDINGS CRUD ========== */
  function bindAllExtra() {
    document.querySelectorAll("[data-edit-mach-id]").forEach(c => {
      const id = c.getAttribute("data-edit-mach-id");
      const d = state.draftMachine[id];
      if (!d) return;
      c.querySelectorAll("[data-k]").forEach(el => {
        const k = el.getAttribute("data-k");
        const ev = el.tagName === "SELECT" ? "change" : "input";
        el.addEventListener(ev, () => { d[k] = el.value; });
      });
    });
    document.querySelectorAll("[data-edit-prod-id]").forEach(c => {
      const id = c.getAttribute("data-edit-prod-id");
      const d = state.draftProduct[id];
      if (!d) return;
      c.querySelectorAll("[data-k]").forEach(el => {
        const k = el.getAttribute("data-k");
        const ev = el.tagName === "SELECT" ? "change" : (el.type === "checkbox" ? "change" : "input");
        el.addEventListener(ev, () => {
          d[k] = el.type === "checkbox" ? el.checked : el.value;
          const field = c.querySelector("#prod-models-field");
          if (field) field.style.display = d.hasModels ? "" : "none";
        });
      });
    });
    ["nm-name", "nm-type"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const k = id.replace("nm-", "");
      const ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => { state.newMachine[k] = el.value; });
    });
    const nph = document.getElementById("np-hasModels");
    if (nph) {
      nph.addEventListener("change", () => {
        state.newProduct.hasModels = nph.checked;
        const f = document.getElementById("np-models-field");
        if (f) f.style.display = nph.checked ? "" : "none";
      });
    }
    const npn = document.getElementById("np-name");
    if (npn) npn.addEventListener("input", () => { state.newProduct.name = npn.value; });
    const npt = document.getElementById("np-modelsText");
    if (npt) npt.addEventListener("input", () => { state.newProduct.modelsText = npt.value; });

    document.querySelectorAll("[data-edit-emp-id]").forEach(c => {
      const id = c.getAttribute("data-edit-emp-id");
      const d = state.draftEmployee[id];
      if (!d) return;
      c.querySelectorAll("[data-k]").forEach(el => {
        const k = el.getAttribute("data-k");
        const ev = el.tagName === "SELECT" ? "change" : "input";
        el.addEventListener(ev, () => { d[k] = el.value; });
      });
      c.querySelectorAll("[data-mach-perm]").forEach(el => {
        el.addEventListener("change", () => {
          const mid = el.getAttribute("data-mach-perm");
          const idx = d.allowedMachines.indexOf(mid);
          if (el.checked && idx < 0) d.allowedMachines.push(mid);
          else if (!el.checked && idx >= 0) d.allowedMachines.splice(idx, 1);
        });
      });
    });
    ["ne-name", "ne-role", "ne-pin", "ne-pin2", "ne-status"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const k = id.replace("ne-", "");
      const ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => { state.newEmployee[k] = el.value; });
    });
    document.querySelectorAll("[data-ne-perm]").forEach(el => {
      el.addEventListener("change", () => {
        const mid = el.getAttribute("data-ne-perm");
        const idx = state.newEmployee.allowedMachines.indexOf(mid);
        if (el.checked && idx < 0) state.newEmployee.allowedMachines.push(mid);
        else if (!el.checked && idx >= 0) state.newEmployee.allowedMachines.splice(idx, 1);
      });
    });

    /* ---- Pedidos / Ordens de Produção ---- */
    document.querySelectorAll("[data-edit-order-id]").forEach(c => {
      const id = c.getAttribute("data-edit-order-id");
      const d = state.draftOrder[id];
      if (!d) return;
      c.querySelectorAll("[data-k]").forEach(el => {
        const k = el.getAttribute("data-k");
        const ev = el.tagName === "SELECT" ? "change" : "input";
        el.addEventListener(ev, () => { d[k] = el.value; });
      });
    });
    ["no-client", "no-product", "no-model", "no-quantity", "no-type"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const k = id.replace("no-", "");
      const ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => { state.newOrder[k] = el.value; });
    });
    /* ---- Nova Tarefa (item 1/12/14): tudo lista suspensa, com
       dependências entre campos — por isso cada mudança re-renderiza
       a view (renderView), como no formulário de Lançamento. ---- */
    const ntOrder = document.getElementById("nt-order");
    if (ntOrder) ntOrder.addEventListener("change", () => {
      state.newTask.orderId = ntOrder.value;
      const order = orders.find(o => o.id === state.newTask.orderId);
      if (order && !state.newTask.productId) {
        const guess = guessProductForOrder(order);
        if (guess) {
          state.newTask.productId = guess.id;
          state.newTask.model = guessModelForOrder(order, guess);
        }
      }
      renderView();
    });
    const ntEmployee = document.getElementById("nt-employee");
    if (ntEmployee) ntEmployee.addEventListener("change", () => {
      state.newTask.employeeId = ntEmployee.value;
      const employee = employees.find(e => e.id === state.newTask.employeeId);
      if (employee && (employee.allowedMachines || []).length && employee.allowedMachines.indexOf(state.newTask.machineId) < 0) {
        state.newTask.machineId = "";
      }
      renderView();
    });
    const ntMachine = document.getElementById("nt-machine");
    if (ntMachine) ntMachine.addEventListener("change", () => { state.newTask.machineId = ntMachine.value; });
    const ntProduct = document.getElementById("nt-product");
    if (ntProduct) ntProduct.addEventListener("change", () => {
      state.newTask.productId = ntProduct.value;
      state.newTask.model = "";
      renderView();
    });
    const ntModel = document.getElementById("nt-model");
    if (ntModel) ntModel.addEventListener("change", () => { state.newTask.model = ntModel.value; });
  }

  /* ========== AÇÕES CRUD ========== */
  async function saveMachine(id) {
    const d = state.draftMachine[id];
    if (!d) return;
    const orig = machines.find(x => x.id === id) || {};
    const patch = {
      name: (d.name || "").trim() || orig.name,
      type: d.type || "automatica",
      status: d.status || "parada",
      currentProduct: d.currentProduct || "",
      client: (d.client || "").trim(),
      capacityHour: Number(d.capacityHour) || 0,
      capacityDay: Number(d.capacityDay) || 0
    };
    try {
      await S.update("machines", id, patch);
      delete state.draftMachine[id];
      toast("Máquina salva");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function saveProduct(id) {
    const d = state.draftProduct[id];
    if (!d) return;
    const orig = products.find(x => x.id === id) || {};
    const models = d.hasModels
      ? String(d.modelsText || "").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const patch = {
      name: (d.name || "").trim() || orig.name,
      hasModels: !!d.hasModels,
      models: models,
      capacityDay: Number(d.capacityDay) || 0,
      capacityHour: Number(d.capacityHour) || (orig.capacityHour || 0),
      maxDefectRate: Number(d.maxDefectRate) > 0 ? Number(d.maxDefectRate) : 1
    };
    try {
      await S.update("products", id, patch);
      delete state.draftProduct[id];
      toast("Produto salvo");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function addMachine() {
    const name = (state.newMachine.name || "").trim();
    if (!name) { toast("Informe o nome da máquina."); return; }
    try {
      await S.add("machines", {
        name, type: state.newMachine.type,
        status: "parada", currentProduct: "", client: "",
        capacityHour: 0, capacityDay: 0
      });
      state.newMachine = { name: "", type: "automatica" };
      state.newMachineForm = false;
      toast("Máquina adicionada");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function addProduct() {
    const name = (state.newProduct.name || "").trim();
    if (!name) { toast("Informe o nome do produto."); return; }
    const models = state.newProduct.hasModels
      ? String(state.newProduct.modelsText || "").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    try {
      await S.add("products", {
        name, hasModels: state.newProduct.hasModels, models,
        capacityHour: 0, capacityDay: 0, maxDefectRate: Number(config.defectLimit) || 1
      });
      state.newProduct = { name: "", hasModels: false, modelsText: "" };
      state.newProductForm = false;
      toast("Produto adicionado");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function addEmployee() {
    const name = (state.newEmployee.name || "").trim();
    const pin = (state.newEmployee.pin || "").trim();
    const pin2 = (state.newEmployee.pin2 || "").trim();
    if (!name) { toast("Informe o nome do funcionário."); return; }
    if (pin.length < 4) { toast("O PIN deve ter pelo menos 4 dígitos."); return; }
    if (pin !== pin2) { toast("Os PINs não conferem."); return; }
    const pinHash = await U.hashPin(pin);
    if (config.pinHash && pinHash === config.pinHash) { toast("Esse PIN é o mesmo do administrador. Escolha um PIN diferente para o funcionário."); return; }
    if (employees.some(x => x.pinHash === pinHash)) { toast("Esse PIN já está em uso por outro funcionário. Escolha outro."); return; }
    try {
      await S.add("employees", {
        name,
        role: (state.newEmployee.role || "").trim(),
        status: state.newEmployee.status || "ativo",
        allowedMachines: (state.newEmployee.allowedMachines || []).slice(),
        pinHash
      });
      state.newEmployee = { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [] };
      state.newEmployeeForm = false;
      toast("Funcionário cadastrado");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function saveEmployee(id) {
    const d = state.draftEmployee[id];
    if (!d) return;
    const orig = employees.find(x => x.id === id) || {};
    const p1 = (d.pin || "").trim();
    const p2 = (d.pin2 || "").trim();
    if (p1 || p2) {
      if (p1.length < 4) { toast("O novo PIN deve ter pelo menos 4 dígitos."); return; }
      if (p1 !== p2) { toast("Os PINs não conferem."); return; }
    }
    const patch = {
      name: (d.name || "").trim() || orig.name,
      role: (d.role || "").trim(),
      status: d.status || "ativo",
      allowedMachines: (d.allowedMachines || []).slice()
    };
    if (p1) {
      const newHash = await U.hashPin(p1);
      if (config.pinHash && newHash === config.pinHash) { toast("Esse PIN é o mesmo do administrador. Escolha um PIN diferente para o funcionário."); return; }
      if (employees.some(x => x.id !== id && x.pinHash === newHash)) { toast("Esse PIN já está em uso por outro funcionário. Escolha outro."); return; }
      patch.pinHash = newHash;
    }
    try {
      await S.update("employees", id, patch);
      delete state.draftEmployee[id];
      toast("Funcionário salvo");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function toggleEmployeeStatus(id) {
    const em = employees.find(x => x.id === id);
    if (!em) return;
    const next = em.status === "ativo" ? "inativo" : "ativo";
    try {
      await S.update("employees", id, { status: next });
      toast(next === "ativo" ? "Funcionário ativado" : "Funcionário desativado");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function saveConfig() {
    const company = document.getElementById("set-company");
    const sector = document.getElementById("set-sector");
    const limit = document.getElementById("set-limit");
    const goal = document.getElementById("set-goal");
    try {
      await S.update("config", "default", {
        companyName: company ? company.value.trim() : config.companyName,
        sector: sector ? sector.value.trim() : config.sector,
        defectLimit: limit ? Number(limit.value) : (config.defectLimit || 1),
        dailyGoal: goal ? Number(goal.value) : 0
      });
      toast("Ajustes salvos");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function changePin() {
    const p1 = document.getElementById("pin1");
    const p2 = document.getElementById("pin2");
    if (!p1 || !p2) return;
    const v1 = (p1.value || "").trim();
    const v2 = (p2.value || "").trim();
    if (v1.length < 4) { toast("PIN deve ter pelo menos 4 dígitos."); return; }
    if (v1 !== v2) { toast("Os PINs não conferem."); return; }
    const hash = await U.hashPin(v1);
    if (employees.some(x => x.pinHash === hash)) { toast("Esse PIN já é usado por um funcionário. Escolha um PIN diferente para o administrador."); return; }
    try {
      await S.update("config", "default", { pinHash: hash });
      p1.value = ""; p2.value = "";
      toast("PIN atualizado");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function setOpPin() {
    const p1 = document.getElementById("op1");
    const p2 = document.getElementById("op2");
    if (!p1 || !p2) return;
    const v1 = (p1.value || "").trim();
    const v2 = (p2.value || "").trim();
    if (v1.length < 4) { toast("PIN deve ter pelo menos 4 dígitos."); return; }
    if (v1 !== v2) { toast("Os PINs não conferem."); return; }
    const hash = await U.hashPin(v1);
    try {
      await S.update("config", "default", { operatorPinHash: hash });
      p1.value = ""; p2.value = "";
      renderView();
      toast("PIN do operador definido");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function clearOpPin() {
    if (!confirm("Remover o PIN do operador? A tela do funcionário abrirá livremente.")) return;
    try {
      await S.update("config", "default", { operatorPinHash: "" });
      renderView();
      toast("PIN do operador removido");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  /* ========== GLOBAL / TOAST ========== */
  function errMsg(e) {
    const code = e && e.code ? String(e.code) : "";
    if (code.indexOf("permission-denied") >= 0) {
      return "Sem permissão para salvar no banco (regras do Firestore). Fale com o administrador do sistema.";
    }
    if (code.indexOf("unavailable") >= 0) {
      return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    }
    return "Erro ao salvar: " + ((e && e.message) || "tente novamente.");
  }

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

  function go(page) {
    state.page = page;
    state.sheet = false;
    window.scrollTo(0, 0);
    renderAll();
  }

  function onClickGlobal(e) {
    const goEl = e.target.closest("[data-go]");
    if (goEl) { go(goEl.getAttribute("data-go")); return; }

    const tabEl = e.target.closest("[data-rel-tab]");
    if (tabEl) {
      state.rel.tab = tabEl.getAttribute("data-rel-tab");
      renderView();
      return;
    }

    const actWrap = e.target.closest("[data-act]");
    if (!actWrap) return;
    const a = actWrap.getAttribute("data-act");
    const id = actWrap.getAttribute("data-id");

    if (a === "login") doLogin();
    else if (a === "choose-gestor") { state.loginStep = "pin"; renderAll(); }
    else if (a === "choose-funcionario") { location.href = "./operador.html"; }
    else if (a === "back-choice") { state.loginStep = "choose"; renderAll(); }
    else if (a === "noop") { return; }
    else if (a === "toggle-sheet") { state.sheet = !state.sheet; renderAll(); }
    else if (a === "close-sheet") { state.sheet = false; renderAll(); }
    else if (a === "open-config") { go("config"); }

    else if (a === "save-lance") saveLance();
    else if (a === "clear-hist") {
      state.rel = { tab: "hist", date: "", machineId: "", productId: "", model: "", client: "", operator: "" };
      refreshRel();
    }
    else if (a === "del-lance") {
      const lid = actWrap.getAttribute("data-id");
      if (confirm("Excluir este lançamento?")) S.remove("productions", lid).catch(er => toast(errMsg(er)));
    }

    else if (a === "qplan-calc") {
      const q = document.getElementById("qplan");
      if (q) state.plan.volume = q.value;
      state.planResult = planCalc();
      renderView();
    }
    else if (a === "go-plan") { go("planejamento"); }

    else if (a === "edit-mach") {
      const m = machines.find(x => x.id === id);
      if (m) state.draftMachine[id] = {
        name: m.name, type: m.type, status: m.status,
        currentProduct: m.currentProduct || "", client: m.client || "",
        capacityHour: m.capacityHour || "", capacityDay: m.capacityDay || ""
      };
      renderView();
    }
    else if (a === "cancel-mach") { delete state.draftMachine[id]; renderView(); }
    else if (a === "save-mach") saveMachine(id);
    else if (a === "new-machine") { state.newMachineForm = true; state.newMachine = { name: "", type: "automatica" }; renderView(); }
    else if (a === "cancel-new-mach") { state.newMachineForm = false; renderView(); }
    else if (a === "save-new-mach") addMachine();

    else if (a === "edit-prod") {
      const p = products.find(x => x.id === id);
      if (p) state.draftProduct[id] = {
        name: p.name, hasModels: p.hasModels,
        modelsText: (p.models || []).join(", "),
        capacityHour: p.capacityHour || "", capacityDay: p.capacityDay || "",
        maxDefectRate: p.maxDefectRate === undefined ? 1 : p.maxDefectRate
      };
      renderView();
    }
    else if (a === "cancel-prod") { delete state.draftProduct[id]; renderView(); }
    else if (a === "save-prod") saveProduct(id);
    else if (a === "new-product") { state.newProductForm = true; state.newProduct = { name: "", hasModels: false, modelsText: "" }; renderView(); }
    else if (a === "cancel-new-prod") { state.newProductForm = false; renderView(); }
    else if (a === "save-new-prod") addProduct();

    else if (a === "new-employee") { state.newEmployeeForm = true; state.newEmployee = { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [] }; renderView(); }
    else if (a === "cancel-new-emp") { state.newEmployeeForm = false; renderView(); }
    else if (a === "save-new-emp") addEmployee();
    else if (a === "edit-emp") {
      const em = employees.find(x => x.id === id);
      if (em) state.draftEmployee[id] = {
        name: em.name, role: em.role || "", pin: "", pin2: "",
        status: em.status || "ativo", allowedMachines: (em.allowedMachines || []).slice()
      };
      renderView();
    }
    else if (a === "cancel-emp") { delete state.draftEmployee[id]; renderView(); }
    else if (a === "save-emp") saveEmployee(id);
    else if (a === "toggle-emp-status") toggleEmployeeStatus(id);

    else if (a === "toggle-order") { state.openOrders[id] = !state.openOrders[id]; renderView(); }
    else if (a === "edit-order") {
      const o = orders.find(x => x.id === id);
      if (o) state.draftOrder[id] = {
        client: o.client, product: o.product, model: o.model || "",
        quantity: o.quantity, type: o.type || "completo", status: o.status || "aguardando"
      };
      renderView();
    }
    else if (a === "cancel-order") { delete state.draftOrder[id]; renderView(); }
    else if (a === "save-order") saveOrder(id);
    else if (a === "new-order") { state.newOrderForm = true; state.newOrder = freshOrderDraft(); renderView(); }
    else if (a === "cancel-new-order") { state.newOrderForm = false; renderView(); }
    else if (a === "save-new-order") addOrder();

    else if (a === "new-task") { state.newTaskForm = true; state.newTask = freshTaskDraft(); renderView(); }
    else if (a === "new-task-for-order") {
      state.newTaskForm = true;
      state.newTask = freshTaskDraft();
      state.newTask.orderId = id;
      const order = orders.find(o => o.id === id);
      if (order) {
        const guess = guessProductForOrder(order);
        if (guess) { state.newTask.productId = guess.id; state.newTask.model = guessModelForOrder(order, guess); }
      }
      renderView();
    }
    else if (a === "cancel-new-task") { state.newTaskForm = false; renderView(); }
    else if (a === "save-new-task") addTask();
    else if (a === "finish-po") finishProductionOrder(id);

    else if (a === "save-config") saveConfig();
    else if (a === "change-pin") changePin();
    else if (a === "set-op-pin") setOpPin();
    else if (a === "clear-op-pin") clearOpPin();
    else if (a === "logout") { try { sessionStorage.removeItem("cp_auth"); } catch (er) { } location.reload(); }
    else if (a === "reset-local") {
      if (!confirm("Apagar TODOS os dados locais e recomeçar?")) return;
      ["cp_config", "cp_machines", "cp_products", "cp_productions", "cp_employees", "cp_orders", "cp_productionOrders"].forEach(k => { try { localStorage.removeItem(k); } catch (er) { } });
      location.reload();
    }
  }

  init();
})();