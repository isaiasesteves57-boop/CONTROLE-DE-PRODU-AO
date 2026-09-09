/* =====================================================================
   CONTROLE DE PRODUÇÃO — Aplicativo principal (index.html)
   Módulos: Painel · Máquinas · Produtos · Lançamento · Relatórios
            Planejamento · Configurações · Pedidos · Ordens de Produção (OP)

   Camada industrial (OP): fica ENTRE o Pedido (origem comercial) e a
   Tarefa (execução na máquina). Não substitui nem remove os pedidos
   existentes — apenas organiza a produção em lotes controlados.
   Fluxo: Pedido → OP → Tarefa → Funcionário → Máquina → Apontamento →
          Qualidade → Relatórios.
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
  /* Ordem de Produção (OP): lote industrial criado a partir do saldo de
     um Pedido. Fica visível no Kanban (página "ops") e agrupa as
     Tarefas (productionOrders) que forem vinculadas a ela. */
  const SEED_OPS = [];
  const freshOrderDraft = () => ({ number: "", client: "", product: "", model: "", quantity: "", type: "completo" });
  const freshOPDraft = () => ({ orderId: "", number: "", product: "", model: "", sector: "", dueDate: "", quantity: "", priority: "media", selectedComponents: [], fichaProductId: "" });
  /* Geração de OP por componente (Etapa 2): quando o produto do pedido
     tem componentes de ficha técnica marcados como "gera OP própria",
     o gestor escolhe quais serão produzidos. O MESMO número de OP
     informado é reaproveitado para cada componente selecionado — nunca
     se cria um número novo. Cada componente vira um documento próprio
     em "ops" com o campo `component` preenchido (ex.: "Capa"), todos
     compartilhando orderId/number/product/quantidade/setor/prazo.
     OPs antigas (sem ficha técnica ou sem seleção) continuam sendo
     criadas exatamente como antes, com component: "". */
  /* Ficha técnica (Etapa 1): um produto pode ter componentes próprios
     (ex.: Capa, Contracapa, Miolo). Cada componente indica se, na
     prática de produção, ele gera sua própria OP separada ou não.
     Produtos antigos não têm "components" — sempre usar (p.components||[]). */
  const freshComponentDraft = () => ({ name: "", description: "", generatesOP: false });
  /* Nova Tarefa: o gestor só escolhe pedido, funcionário, máquina, produto
     e modelo — tudo por lista suspensa. NÃO existe quantidade digitada:
     a quantidade da tarefa vem sempre do saldo do pedido selecionado.
     opId (opcional) vincula a tarefa a uma Ordem de Produção. */
  const freshTaskDraft = () => ({ orderId: "", opId: "", employeeId: "", machineId: "", productId: "", model: "", process: "", plannedQuantity: "", estimatedMinutes: "", priority: "media", observation: "" });

  const STATUS = {
    produzindo: { label: "Produzindo", led: "ok", pill: "produzindo" },
    pausa: { label: "Parada programada", led: "warn", pill: "pausa" },
    parada: { label: "Parada", led: "danger", pill: "parada" }
  };

  const freshLance = () => ({
    date: U.todayStr(), machineId: "", productId: "", model: "", client: "", operator: "",
    startTime: "", endTime: "", quantityProduced: "", defects: ""
  });

  /* Registro de defeitos (Módulo de Qualidade — Etapa 7): cada lançamento
     de defeito é um registro próprio (não um número solto), com a causa
     (tipo), quem/onde/quando, para permitir as análises pedidas por
     categoria, produto, funcionário e máquina. */
  const DEFECT_TYPES = ["Capa danificada", "Furação", "Montagem", "Impressão", "Acabamento", "Outro"];
  const TURNOS = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  const freshDefectDraft = () => ({
    date: U.todayStr(), opId: "", productId: "", employeeId: "", machineId: "",
    defectType: DEFECT_TYPES[0], customType: "", quantity: "", turno: "manha", observation: ""
  });

  let machines = [], products = [], productions = [], employees = [], orders = [], productionOrders = [], ops = [], materials = [], stockMovements = [], defectRecords = [], config = SEED_CONFIG[0];

  const state = {
    authed: false,
    loginStep: "choose",
    page: "dashboard",
    sheet: false,
    dash: { date: U.todayStr() },
    lance: freshLance(),
    rel: { tab: "hist", date: "", machineId: "", productId: "", model: "", client: "", operator: "", editingId: "" },
    plan: { volume: "", days: "", startDate: U.todayStr(), jornada: 8 },
    planResult: null,
    draftMachine: {},
    draftProduct: {},
    newMachineForm: false,
    newProductForm: false,
    newMachine: { name: "", type: "automatica" },
    newProduct: { name: "", hasModels: false, modelsText: "", components: [] },
    draftEmployee: {},
    newEmployeeForm: false,
    selectedEmployeeId: "",
    selectedOPId: "",
    newEmployee: { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [], photoData: "" },
    pin: "",
    err: "",
    /* Pedidos e Ordens de Produção */
    newOrderForm: false,
    newOrder: freshOrderDraft(),
    draftOrder: {},
    openOrders: {},
    newTaskForm: false,
    newTask: freshTaskDraft(),
    newOPForm: false,
    newOP: freshOPDraft(),
    openOPs: {},
    /* Fila de máquinas: estado do formulário de finalização inline. */
    filaF: { taskId: "", qty: "", def: "", err: "" },
    stock: { materialId: "", dateFrom: "", dateTo: "", type: "", orderId: "", showForm: false, showMaterialForm: false, detailId: "" },
    newMaterial: { name: "", minStock: 0, productId: "" },
    newMovement: { materialId: "", quantity: "", date: U.todayStr(), type: "ENTRADA", orderId: "", observation: "" },
    /* Produtividade (Etapa 6): filtros da visão gerencial. */
    produt: { periodo: "7d", dateFrom: "", dateTo: "", productName: "", employeeKey: "", setor: "" },
    /* Qualidade (Etapa 7): filtros do módulo + formulário de registro de defeito. */
    quality: { periodo: "30d", dateFrom: "", dateTo: "", opId: "", productId: "", employeeId: "", machineId: "", showForm: false, opAnalysisId: "" },
    newDefect: freshDefectDraft()
  };

  try { state.authed = sessionStorage.getItem("cp_auth") === "1"; } catch (e) { }
  try {
    const h = (location.hash || "").replace("#", "");
    if (["dashboard", "industria", "relatorios", "planejamento", "pedidos", "ops", "fila", "estoque", "produtividade", "qualidade", "maquinas", "produtos", "funcionarios", "config"].indexOf(h) >= 0) state.page = h;
  } catch (e) { }

  if (state.page === "lance") state.page = "dashboard";

  const PAGES = [
    ["dashboard", "Painel", "dashboard", "painel"],
    ["industria", "Painel Indústria 4.0", "factory", "painel"],
    ["relatorios", "Relatórios", "chart", "painel"],
    ["planejamento", "Planejamento", "clipboard", "painel"],
    ["pedidos", "Pedidos", "package", "painel"],
    ["ops", "Ordens de Produção", "columns", "painel"],
    ["fila", "Fila de Máquinas", "cog", "painel"],
    ["produtividade", "Produtividade", "speed", "painel"],
    ["qualidade", "Qualidade", "alert", "painel"],
    ["estoque", "Estoque de materiais", "layers", "estoque"],
    ["maquinas", "Máquinas", "cog", "cadastros"],
    ["produtos", "Produtos", "box", "cadastros"],
    ["funcionarios", "Funcionários", "user", "cadastros"],
    ["config", "Configurações", "sliders", "sistema"]
  ];
  const TITLES = {
    dashboard: ["Painel do dia", "Visão geral da produção"],
    industria: ["Painel Indústria 4.0", "Produção, eficiência e qualidade em tempo real"],
    relatorios: ["Relatórios", "Lançamentos e capacidade produtiva"],
    planejamento: ["Planejamento", "Simular pedidos, prazos e máquinas"],
    pedidos: ["Pedidos", "Pedidos e ordens de produção"],
    ops: ["Ordens de Produção", "Fluxo Pedido → OP → Tarefa · Kanban de produção"],
    fila: ["Fila de Máquinas", "Produção atual e próxima por máquina"],
    produtividade: ["Produtividade", "Visão gerencial de produção, ranking e eficiência"],
    qualidade: ["Qualidade", "Controle de defeitos, rejeições e eficiência da produção"],
    estoque: ["Estoque de materiais", "Controle físico, consumo e necessidade dos pedidos"],
    maquinas: ["Máquinas", "Cadastro e status das máquinas"],
    produtos: ["Produtos", "Cadastro de produtos e modelos"],
    funcionarios: ["Funcionários", "Cadastro, PIN e permissões de acesso"],
    "funcionario-detalhe": ["Detalhe do funcionário", "Produção, médias e histórico individual"],
    "op-detalhe": ["Detalhe da OP", "Histórico completo, tarefas e apontamentos"],
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
    S.on("ops", d => { ops = d; softRender(); });
    S.on("materials", d => { materials = d; softRender(); });
    S.on("stockMovements", d => { stockMovements = d; softRender(); });
    S.on("defectRecords", d => { defectRecords = d; softRender(); });
    S.init("config", SEED_CONFIG);
    S.init("machines", SEED_MACHINES);
    S.init("products", SEED_PRODUCTS);
    S.init("productions", []);
    S.init("employees", SEED_EMPLOYEES);
    S.init("orders", SEED_ORDERS);
    S.init("productionOrders", SEED_PRODUCTION_ORDERS);
    S.init("ops", SEED_OPS);
    S.init("materials", []);
    S.init("stockMovements", []);
    S.init("defectRecords", []);
    machines = S.get("machines");
    products = S.get("products");
    productions = S.get("productions");
    employees = S.get("employees");
    orders = S.get("orders");
    productionOrders = S.get("productionOrders");
    ops = S.get("ops");
    materials = S.get("materials");
    stockMovements = S.get("stockMovements");
    defectRecords = S.get("defectRecords");
    const cfgArr = S.get("config");
    config = (cfgArr && cfgArr[0]) || SEED_CONFIG[0];
    root.addEventListener("click", onClickGlobal);
    root.addEventListener("change", onChangeGlobal);
    renderAll();
  }

  function softRender() {
    if (!state.authed) { renderLogin(); return; }
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
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
            ${sideItem("industria", "Painel Indústria 4.0", "factory")}
            ${sideItem("relatorios", "Relatórios", "chart")}
            ${sideItem("planejamento", "Planejamento", "clipboard")}
            ${sideItem("pedidos", "Pedidos", "package")}
            ${sideItem("ops", "Ordens de Produção", "columns")}
            ${sideItem("fila", "Fila de Máquinas", "cog")}
            ${sideItem("produtividade", "Produtividade", "speed")}
            ${sideItem("qualidade", "Qualidade", "alert")}
            <div class="lbl">Estoque</div>
            ${sideItem("estoque", "Estoque de materiais", "layers")}
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
      ["industria", "Painel Indústria 4.0", "factory"],
      ["pedidos", "Pedidos", "package"],
      ["ops", "Ordens de Produção", "columns"],
      ["fila", "Fila de Máquinas", "cog"],
      ["produtividade", "Produtividade", "speed"],
      ["qualidade", "Qualidade", "alert"],
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
    else if (state.page === "industria") renderIndustrial(v);
    else if (state.page === "relatorios") renderRelatorios(v);
    else if (state.page === "planejamento") renderPlanejamento(v);
    else if (state.page === "pedidos") renderPedidos(v);
    else if (state.page === "ops") renderOPs(v);
    else if (state.page === "fila") renderFilaMaquinas(v);
    else if (state.page === "produtividade") renderProdutividade(v);
    else if (state.page === "qualidade") renderQualidade(v);
    else if (state.page === "estoque") renderEstoque(v);
    else if (state.page === "maquinas") renderMaquinas(v);
    else if (state.page === "produtos") renderProdutos(v);
    else if (state.page === "funcionarios") renderFuncionarios(v);
    else if (state.page === "funcionario-detalhe") renderFuncionarioDetalhe(v);
    else if (state.page === "op-detalhe") renderOPDetalhe(v);
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

  /* ========== PAINEL INDÚSTRIA 4.0 (gráficos utilitários) ========== */
  const I4_PALETTE = ["var(--cyan)", "var(--ok)", "#a78bfa", "var(--amber2)", "#fb923c", "var(--steel)"];

  function i4Trend(curr, prev) {
    if (!prev) return '<span class="i4-trend flat">—</span>';
    const delta = (curr - prev) / prev * 100;
    const up = delta >= 0;
    return `<span class="i4-trend ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${U.fmt(Math.abs(delta), 1)}%</span>`;
  }

  function i4Card(opts) {
    return `<div class="i4-card" style="--c:${opts.color}">
      <div class="i4-card-lbl">${U.icon(opts.icon, "sm")}<span>${opts.label}</span></div>
      <div class="i4-card-val">${opts.value}<em>${opts.unit || ""}</em></div>
      <div class="i4-card-foot">${opts.foot || ""}</div>
    </div>`;
  }

  function lineChartHTML(labels, values, opts) {
    opts = opts || {};
    const w = 600, h = 200, padL = 8, padR = 8, padT = 22, padB = 24;
    const max = Math.max(1, ...values);
    const n = values.length;
    const stepX = n > 1 ? (w - padL - padR) / (n - 1) : 0;
    const pts = values.map((val, i) => {
      const x = padL + stepX * i;
      const y = padT + (h - padT - padB) * (1 - (max ? val / max : 0));
      return [x, y];
    });
    const pathD = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const areaD = pts.length ? pathD + ` L${pts[pts.length - 1][0].toFixed(1)},${h - padB} L${pts[0][0].toFixed(1)},${h - padB} Z` : "";
    const color = opts.color || "var(--cyan)";
    const grid = [0, 0.5, 1].map(f => {
      const y = padT + (h - padT - padB) * f;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    }).join("");
    const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${color}"/>`).join("");
    const valLbls = pts.map((p, i) => `<text x="${p[0].toFixed(1)}" y="${(p[1] - 9).toFixed(1)}" text-anchor="middle" class="chart-val-lbl">${U.fmt(values[i])}</text>`).join("");
    const xLbls = labels.map((lb, i) => `<text x="${pts[i][0].toFixed(1)}" y="${h - 6}" text-anchor="middle" class="chart-x-lbl">${U.esc(lb)}</text>`).join("");
    return `<svg viewBox="0 0 ${w} ${h}" class="line-chart" preserveAspectRatio="none">
      ${grid}
      ${areaD ? `<path d="${areaD}" fill="${color}" opacity=".14" stroke="none"/>` : ""}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${valLbls}${xLbls}
    </svg>`;
  }

  function barChartHTML(labels, values, opts) {
    opts = opts || {};
    const w = 600, h = 200, padL = 8, padR = 8, padT = 26, padB = 26;
    const max = Math.max(1, ...values);
    const n = Math.max(1, values.length);
    const slot = (w - padL - padR) / n;
    const barW = Math.min(52, slot * 0.5);
    const color = opts.color || "var(--cyan)";
    const bars = values.map((val, i) => {
      const cx = padL + slot * i + slot / 2;
      const bh = (h - padT - padB) * (max ? val / max : 0);
      const y = h - padB - bh;
      return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="4" fill="${color}"/>
        <text x="${cx.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" class="chart-val-lbl">${U.fmt(val)}</text>
        <text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="chart-x-lbl">${U.esc(labels[i] != null ? labels[i] : "")}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" class="bar-chart-v" preserveAspectRatio="none">${bars}</svg>`;
  }

  function donutMultiHTML(entries, unitLabel) {
    const total = entries.reduce((s, e) => s + e[1], 0) || 1;
    const r = 62, cx = 80, cy = 80, C = 2 * Math.PI * r;
    let offset = 0;
    const segs = entries.map((e, i) => {
      const pct = e[1] / total;
      const len = C * pct;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${I4_PALETTE[i % I4_PALETTE.length]}" stroke-width="20"
        stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return seg;
    }).join("");
    const legend = entries.map((e, i) => {
      const pct = total ? e[1] / total * 100 : 0;
      return `<div class="donut-leg-row"><span class="dot" style="background:${I4_PALETTE[i % I4_PALETTE.length]}"></span><span class="f1">${U.esc(e[0])}</span><b>${U.fmt(pct, 0)}%</b></div>`;
    }).join("");
    return `<div class="donut-multi-wrap">
      <svg viewBox="0 0 160 160" class="donut-multi">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card3)" stroke-width="20"/>
        ${segs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-center-val">${U.fmt(total)}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-center-sub">${unitLabel || "unidades"}</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
  }

  function renderIndustrial(v) {
    const today = U.todayStr();
    const yesterday = addDaysDS(today, -1);
    const aToday = dayAgg(today);
    const aYesterday = dayAgg(yesterday);
    const limit = Number(config.defectLimit) || 1;
    const metaRaw = Number(config.dailyGoal) || 0;
    const meta = metaRaw > 0 ? metaRaw : avgDailyProd();
    const effToday = meta > 0 ? aToday.total / meta * 100 : 0;
    const effYesterday = meta > 0 ? aYesterday.total / meta * 100 : 0;

    const ym = today.slice(0, 7);
    const ymPrev = addDaysDS(ym + "-01", -1).slice(0, 7);
    const monthTotal = productions.filter(p => String(p.date || "").slice(0, 7) === ym)
      .reduce((s, p) => s + (Number(p.quantityProduced) || 0), 0);
    const monthPrevTotal = productions.filter(p => String(p.date || "").slice(0, 7) === ymPrev)
      .reduce((s, p) => s + (Number(p.quantityProduced) || 0), 0);

    const days7 = [];
    for (let i = 6; i >= 0; i--) days7.push(addDaysDS(today, -i));
    const aggs7 = days7.map(d => dayAgg(d));
    const seriesProd = aggs7.map(a => a.total);
    const seriesEff = aggs7.map(a => meta > 0 ? Math.round(Math.min(200, a.total / meta * 100)) : 0);
    const seriesDef = aggs7.map(a => a.defects);
    const dayLbls = days7.map(d => U.fmtDate(d).slice(0, 5));

    const hourSamples = aggs7.filter(a => a.hours > 0);
    const avgPerHour = hourSamples.length ? hourSamples.reduce((s, a) => s + a.perHour, 0) / hourSamples.length : 0;

    const opsAndamento = ops.filter(o => o.status === "producao").length;
    const opsAguardando = ops.filter(o => o.status === "aguardando").length;
    const paradas = machines.filter(m => m.status === "parada").length;

    const byOperator = {};
    productions.filter(p => days7.indexOf(p.date) >= 0).forEach(p => {
      const name = (p.operator || "").trim() || "—";
      byOperator[name] = (byOperator[name] || 0) + (Number(p.quantityProduced) || 0);
    });
    const opEntries = Object.entries(byOperator).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const byProduct = {};
    productions.filter(p => String(p.date || "").slice(0, 7) === ym).forEach(p => {
      const name = p.productName || "—";
      byProduct[name] = (byProduct[name] || 0) + (Number(p.quantityProduced) || 0);
    });
    const prodEntries = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6);

    v.innerHTML = `
      <div class="rowc between mb12">
        <div class="rowc" style="gap:6px">
          <span class="tiny dim" style="font-weight:600;text-transform:uppercase;letter-spacing:.08em">${U.fmtDate(today)}</span>
          <span class="pill ${machines.filter(m => m.status === "produzindo").length ? "produzindo" : "parada"}">${machines.filter(m => m.status === "produzindo").length} máquina${machines.filter(m => m.status === "produzindo").length !== 1 ? "s" : ""} em produção</span>
        </div>
        <span class="tiny dim">${machines.length} máquina${machines.length !== 1 ? "s" : ""} no total</span>
      </div>

      <div class="i4-cards">
        ${i4Card({ icon: "package", color: "var(--ok)", label: "Produção hoje", value: U.fmt(aToday.total), unit: "un.", foot: i4Trend(aToday.total, aYesterday.total) + ' <span class="tiny dim">vs. ontem</span>' })}
        ${i4Card({ icon: "calendar", color: "var(--cyan)", label: "Produção mês", value: U.fmt(monthTotal), unit: "un.", foot: i4Trend(monthTotal, monthPrevTotal) + ' <span class="tiny dim">vs. mês anterior</span>' })}
        ${i4Card({ icon: "clock", color: "#a78bfa", label: "Média hora", value: U.fmt(avgPerHour, 0), unit: "un./h", foot: '<span class="tiny dim">média dos últimos 7 dias</span>' })}
        ${i4Card({ icon: "columns", color: "var(--amber2)", label: "OPs em andamento", value: U.fmt(opsAndamento), unit: "", foot: `<span class="tiny dim">${U.fmt(opsAguardando)} aguardando · ${U.fmt(ops.length)} no total</span>` })}
        ${i4Card({ icon: "speed", color: meta > 0 && effToday >= 100 ? "var(--ok)" : "var(--amber2)", label: "Eficiência", value: meta > 0 ? U.fmt(effToday, 1) : "—", unit: meta > 0 ? "%" : "", foot: meta > 0 ? i4Trend(effToday, effYesterday) + ' <span class="tiny dim">vs. dia anterior</span>' : '<span class="tiny dim">defina a meta diária</span>' })}
        ${i4Card({ icon: "alert", color: "var(--danger)", label: "Defeitos", value: U.fmt(aToday.defects), unit: "un.", foot: `<span class="tiny dim">${aToday.total ? U.fmt(aToday.defectPct, 1) + "% da produção" : "sem produção hoje"}</span>` })}
        ${i4Card({ icon: "cog", color: "var(--steel)", label: "Máquinas paradas", value: U.fmt(paradas), unit: "", foot: `<span class="tiny dim">de ${U.fmt(machines.length)} máquina${machines.length !== 1 ? "s" : ""}</span>` })}
      </div>

      <div class="i4-charts-row mt12">
        <div class="card pad i4-chart-wide">
          <div class="between mb8">
            <span class="section-label" style="margin:0">${U.icon("chart", "sm")} Produção por dia <span class="tiny dim" style="text-transform:none;font-weight:400">(últimos 7 dias)</span></span>
            <span class="tiny dim">total <b class="mono-val" style="color:var(--text)">${U.fmt(seriesProd.reduce((a, b) => a + b, 0))} un.</b></span>
          </div>
          ${lineChartHTML(dayLbls, seriesProd, { color: "var(--cyan)" })}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("user", "sm")} Produção por funcionário <span class="tiny dim" style="text-transform:none;font-weight:400">(semana)</span></span>
          ${opEntries.length ? barChartHTML(opEntries.map(e => e[0]), opEntries.map(e => e[1]), { color: "var(--ok)" }) : '<div class="empty">Sem lançamentos com operador nos últimos 7 dias.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("box", "sm")} Produtos mais produzidos <span class="tiny dim" style="text-transform:none;font-weight:400">(mês)</span></span>
          ${prodEntries.length ? donutMultiHTML(prodEntries) : '<div class="empty">Sem produção registrada no mês.</div>'}
        </div>
      </div>

      <div class="two-col mt12">
        <div class="card pad">
          <div class="between mb8">
            <span class="section-label" style="margin:0">${U.icon("speed", "sm")} Eficiência <span class="tiny dim" style="text-transform:none;font-weight:400">(últimos 7 dias)</span></span>
            ${meta > 0 ? `<span class="tiny dim">meta ${U.fmt(meta)} un./dia</span>` : ""}
          </div>
          ${meta > 0 ? lineChartHTML(dayLbls, seriesEff, { color: "var(--amber2)" }) : '<div class="empty">Defina a meta diária em Configurações para calcular a eficiência.</div>'}
        </div>
        <div class="card pad">
          <div class="between mb8">
            <span class="section-label" style="margin:0">${U.icon("alert", "sm")} Defeitos <span class="tiny dim" style="text-transform:none;font-weight:400">(últimos 7 dias)</span></span>
            <span class="tiny dim">limite <b class="mono-val" style="color:var(--text)">${U.fmt(limit, 2)}%</b></span>
          </div>
          ${barChartHTML(dayLbls, seriesDef, { color: "var(--danger)" })}
        </div>
      </div>`;
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
        <div class="card stat" data-go="ops" style="cursor:pointer">
          <div class="lbl">${U.icon("columns", "sm")} OPs em andamento</div>
          <div class="val">${U.fmt(ops.filter(o => o.status === "producao").length)}</div>
          <div class="foot">${U.fmt(ops.filter(o => o.status === "aguardando").length)} aguardando · ${U.fmt(ops.length)} no total</div>
        </div>
      </div>
      <div class="card pad mt12 stock-dashboard">
        <div class="between">
          <div><span class="section-label" style="margin:0">${U.icon("layers","sm")} Estoque</span><div class="tiny dim mt8">Visão rápida do estoque físico e das necessidades em aberto.</div></div>
          <button class="btn-ghost" data-go="estoque">Abrir estoque</button>
        </div>
        <div class="stock-dashboard-grid mt12">
          <div><span>Materiais cadastrados</span><b>${U.fmt(materials.length)}</b></div>
          <div><span>Estoque baixo</span><b>${U.fmt(materials.filter(m=>stockSummary(m.id).current <= (Number(m.minStock)||0)).length)}</b></div>
          <div><span>Em falta</span><b>${U.fmt(materials.filter(m=>stockSummary(m.id).deficit > 0).length)}</b></div>
          <div><span>Consumo total</span><b>${U.fmt(materials.reduce((a,m)=>a+stockSummary(m.id).productionConsumption+stockSummary(m.id).manualConsumption,0))}</b></div>
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


  /* ========== ESTOQUE DE MATERIAIS ========== */
  /*
     O estoque é independente do pedido. Produtos/modelos continuam sendo
     a referência operacional dos pedidos; materiais são entidades físicas
     próprias. O saldo físico vem exclusivamente das movimentações manuais
     + consumo derivado das produções vinculadas a pedidos.
  */
  function stockMaterialName(id) {
    const m = materials.find(x => x.id === id);
    return m ? m.name : "Material não encontrado";
  }

  function stockProductionConsumption(materialId) {
    /* Uma produção consumida para estoque usa quantityProduced exatamente
       uma vez. Defeitos são apenas informativos e NÃO são somados ao consumo,
       evitando dupla baixa quando quantityProduced já representa o retirado. */
    return productions
      .filter(p => p.orderId && p.operacao !== "retrabalho")
      .filter(p => {
        const order = orders.find(o => o.id === p.orderId);
        return order && stockMaterialIdForOrder(order, p) === materialId;
      })
      .reduce((sum, p) => sum + (Number(p.quantityProduced) || 0), 0);
  }

  function stockMaterialIdForOrder(order, production) {
    if (!order) return "";
    const exact = materials.find(m => m.id === order.materialId);
    if (exact) return exact.id;
    /* Compatibilidade: pedidos antigos não têm materialId. O vínculo seguro
       é pelo nome do produto, preservando o conceito de material único. */
    const name = String(order.product || production.productName || "").trim().toLowerCase();
    const found = materials.find(m => (m.productId && m.productId === order.productId) || String(m.name || "").trim().toLowerCase() === name);
    return found ? found.id : "";
  }

  function stockOrderNeed(materialId) {
    return orders
      .filter(o => o.status !== "finalizado" && o.status !== "cancelado")
      .reduce((sum, o) => {
        if (stockMaterialIdForOrder(o) !== materialId) return sum;
        const produced = orderProgress(o.id).produced;
        return sum + Math.max(0, (Number(o.quantity) || 0) - produced);
      }, 0);
  }

  function stockGrossOrderNeed(materialId) {
    return orders
      .filter(o => o.status !== "finalizado" && o.status !== "cancelado")
      .reduce((sum, o) => stockMaterialIdForOrder(o) === materialId ? sum + (Number(o.quantity) || 0) : sum, 0);
  }

  function stockSummary(materialId) {
    const movs = stockMovements.filter(m => m.materialId === materialId);
    let entries = 0, manualConsumption = 0, adjustments = 0, returns = 0;
    movs.forEach(m => {
      const q = Number(m.quantity) || 0;
      if (m.type === "ENTRADA") entries += q;
      else if (m.type === "CONSUMO/SAÍDA") manualConsumption += q;
      else if (m.type === "AJUSTE") adjustments += q;
      else if (m.type === "DEVOLUÇÃO") returns += q;
    });
    const productionConsumption = stockProductionConsumption(materialId);
    const current = Math.max(0, entries - manualConsumption + returns + adjustments - productionConsumption);
    const need = stockOrderNeed(materialId);
    const reserved = Math.min(current, need);
    const available = Math.max(0, current - reserved);
    const deficit = Math.max(0, need - current);
    const grossNeed = stockGrossOrderNeed(materialId);
    return { entries, manualConsumption, productionConsumption, adjustments, returns, current, need, reserved, available, deficit, grossNeed };
  }

  function stockAllMovements() {
    const derived = productions
      .filter(p => p.orderId && p.operacao !== "retrabalho")
      .map(p => {
        const order = orders.find(o => o.id === p.orderId);
        const materialId = stockMaterialIdForOrder(order, p);
        if (!materialId) return null;
        return {
          id: "prod-" + p.id,
          materialId,
          type: "CONSUMO/SAÍDA",
          quantity: Number(p.quantityProduced) || 0,
          date: p.date || "",
          orderId: p.orderId || "",
          employeeId: p.employeeId || "",
          employeeName: p.operator || p.employeeName || "",
          observation: "Consumo automático da produção",
          createdAt: p.createdAt || 0,
          source: "production",
          productionId: p.id
        };
      }).filter(Boolean);
    return stockMovements.concat(derived);
  }

  function stockMovementFiltered() {
    const f = state.stock;
    return stockAllMovements().filter(m => {
      if (f.materialId && m.materialId !== f.materialId) return false;
      if (f.type && m.type !== f.type) return false;
      if (f.orderId && m.orderId !== f.orderId) return false;
      if (f.dateFrom && String(m.date) < f.dateFrom) return false;
      if (f.dateTo && String(m.date) > f.dateTo) return false;
      return true;
    }).sort((a,b) => String(b.date + (b.createdAt || 0)).localeCompare(String(a.date + (a.createdAt || 0))));
  }

  function renderEstoque(v) {
    const rows = materials.map(m => {
      const x = stockSummary(m.id);
      const low = x.current <= (Number(m.minStock) || 0);
      const shortage = x.deficit > 0;
      return `
        <div class="card stock-card ${shortage ? "stock-danger" : (low ? "stock-warn" : "")}">
          <div class="between">
            <div>
              <div class="small" style="font-weight:700">${U.esc(m.name)}</div>
              <div class="tiny dim mt8">${x.grossNeed ? U.fmt(x.grossNeed) + " necessários em pedidos · " + U.fmt(x.need) + " pendentes" : "Nenhum pedido aberto vinculado"}</div>
            </div>
            <span class="pill ${shortage ? "bad" : (low ? "pausa" : "good")}">${shortage ? "Falta material" : (low ? "Estoque baixo" : "OK")}</span>
          </div>
          <div class="stock-kpis mt12">
            <div><span>Físico</span><b>${U.fmt(x.current)}</b></div>
            <div><span>Reservado</span><b>${U.fmt(x.reserved)}</b></div>
            <div><span>Disponível</span><b>${U.fmt(x.available)}</b></div>
            <div><span>Falta</span><b>${U.fmt(x.deficit)}</b></div>
          </div>
          <div class="stock-mini mt8">
            Entrada ${U.fmt(x.entries)} · Consumo manual ${U.fmt(x.manualConsumption)} · Produção ${U.fmt(x.productionConsumption)} · Devolução ${U.fmt(x.returns)}
          </div>
          <div class="rowc mt12" style="justify-content:flex-end;gap:6px">
            <button class="btn-ghost" data-act="stock-detail" data-id="${m.id}">Detalhes</button>
            <button class="btn btn-outline" data-act="stock-entry" data-id="${m.id}">+ Movimento</button>
          </div>
        </div>`;
    }).join("");

    const totalEntries = stockMovements.filter(x => x.type === "ENTRADA").reduce((a,x)=>a+(Number(x.quantity)||0),0);
    const totalConsumed = stockMovements.filter(x => x.type === "CONSUMO/SAÍDA").reduce((a,x)=>a+(Number(x.quantity)||0),0)
      + materials.reduce((a,m)=>a+stockSummary(m.id).productionConsumption,0);

    v.innerHTML = `
      <div class="grid-cards">
        <div class="card stat"><div class="lbl">${U.icon("box","sm")} Materiais cadastrados</div><div class="val">${U.fmt(materials.length)}</div><div class="foot">cadastro físico</div></div>
        <div class="card stat"><div class="lbl">${U.icon("alert","sm")} Estoque baixo</div><div class="val down">${U.fmt(materials.filter(m => stockSummary(m.id).current <= (Number(m.minStock)||0)).length)}</div><div class="foot">limite configurado</div></div>
        <div class="card stat"><div class="lbl">${U.icon("alert","sm")} Em falta</div><div class="val down">${U.fmt(materials.filter(m => stockSummary(m.id).deficit > 0).length)}</div><div class="foot">pedidos pendentes</div></div>
        <div class="card stat"><div class="lbl">${U.icon("plus","sm")} Entradas</div><div class="val up">${U.fmt(totalEntries)}</div><div class="foot">histórico total</div></div>
        <div class="card stat"><div class="lbl">${U.icon("package","sm")} Consumido</div><div class="val">${U.fmt(totalConsumed)}</div><div class="foot">manual + produção</div></div>
      </div>

      ${state.stock.showMaterialForm ? stockMaterialForm() : ""}
      ${state.stock.showForm ? stockMovementForm() : ""}

      <div class="card pad mt12">
        <div class="between mb12">
          <div>
            <span class="section-label" style="margin:0">${U.icon("layers","sm")} Materiais</span>
            <div class="tiny dim mt8">O estoque é por material físico, não por pedido, furação ou modelo.</div>
          </div>
          <button class="btn btn-primary" data-act="new-material">+ Material</button>
        </div>
        <div class="space-y">${rows || '<div class="empty">Nenhum material cadastrado. Cadastre o primeiro material para começar.</div>'}</div>
      </div>

      <div class="card pad mt12">
        <div class="between mb12"><span class="section-label" style="margin:0">${U.icon("chart","sm")} Filtros do histórico</span><button class="btn-ghost" data-act="stock-clear-filters">Limpar</button></div>
        <div class="field-row">
          <div class="field"><label>Material</label><select id="st-material"><option value="">Todos</option>${materials.map(m=>`<option value="${m.id}" ${state.stock.materialId===m.id?"selected":""}>${U.esc(m.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Tipo</label><select id="st-type"><option value="">Todos</option>${["ENTRADA","CONSUMO/SAÍDA","AJUSTE","DEVOLUÇÃO"].map(t=>`<option value="${t}" ${state.stock.type===t?"selected":""}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>De</label><input id="st-from" type="date" value="${state.stock.dateFrom}"></div>
          <div class="field"><label>Até</label><input id="st-to" type="date" value="${state.stock.dateTo}"></div>
        </div>
        <div class="field"><label>Pedido relacionado</label><select id="st-order"><option value="">Todos</option>${orders.map(o=>`<option value="${o.id}" ${state.stock.orderId===o.id?"selected":""}>${orderCode(o)} — ${U.esc(o.client)} — ${U.esc(o.product)}</option>`).join("")}</select></div>
        <div class="stock-history mt12">${stockMovementFiltered().map(m=>`
          <div class="stock-movement">
            <div><b>${U.esc(m.date || "—")}</b><span class="tiny dim"> · ${U.esc(stockMaterialName(m.materialId))}</span></div>
            <div class="stock-movement-right"><span class="chip">${U.esc(m.type)}</span><b>${m.type==="AJUSTE" && Number(m.quantity)<0 ? "" : "+"}${U.fmt(Number(m.quantity)||0)}</b></div>
            <div class="tiny dim">${m.orderId ? orderCode(orders.find(o=>o.id===m.orderId)||{}) + " · " : ""}${m.employeeName ? U.esc(m.employeeName) + " · " : ""}${U.esc(m.observation || "sem observação")}</div>
          </div>`).join("") || '<div class="empty">Nenhuma movimentação encontrada.</div>'}</div>
      </div>

      ${state.stock.detailId ? stockDetail(state.stock.detailId) : ""}
    `;
  }

  function stockMaterialForm() {
    return `<div class="card pad mt12 stock-form">
      <div class="between mb12"><span class="small" style="font-weight:700">Novo material</span><button class="btn-ghost" data-act="cancel-new-material">Cancelar</button></div>
      <div class="field"><label>Material físico</label><input id="sm-name" value="${U.esc(state.newMaterial.name)}" placeholder="Ex.: Agenda Clássica"></div>
      <div class="field"><label>Estoque mínimo</label><input id="sm-min" type="number" min="0" value="${Number(state.newMaterial.minStock)||0}"></div>
      <div class="field"><label>Produto/pedido correspondente <span class="tiny dim">(opcional)</span></label>
        <select id="sm-product"><option value="">Vincular automaticamente pelo nome</option>${products.map(p=>`<option value="${p.id}" ${state.newMaterial.productId===p.id?"selected":""}>${U.esc(p.name)}</option>`).join("")}</select>
      </div>
      <button class="btn btn-primary btn-block" data-act="save-new-material">Cadastrar material</button>
    </div>`;
  }

  function stockMovementForm() {
    const n = state.newMovement;
    return `<div class="card pad mt12 stock-form">
      <div class="between mb12"><span class="small" style="font-weight:700">Nova movimentação</span><button class="btn-ghost" data-act="cancel-stock-entry">Cancelar</button></div>
      <div class="field"><label>Material</label><select id="mv-material"><option value="">Selecione...</option>${materials.map(m=>`<option value="${m.id}" ${n.materialId===m.id?"selected":""}>${U.esc(m.name)}</option>`).join("")}</select></div>
      <div class="field-row">
        <div class="field"><label>Quantidade</label><input id="mv-qty" type="number" min="0" step="1" value="${U.esc(n.quantity)}" placeholder="0"></div>
        <div class="field"><label>Data</label><input id="mv-date" type="date" value="${U.esc(n.date)}"></div>
      </div>
      <div class="field"><label>Tipo</label><select id="mv-type">${["ENTRADA","CONSUMO/SAÍDA","AJUSTE","DEVOLUÇÃO"].map(t=>`<option value="${t}" ${n.type===t?"selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label>Pedido relacionado <span class="tiny dim">(opcional)</span></label><select id="mv-order"><option value="">Nenhum</option>${orders.map(o=>`<option value="${o.id}" ${n.orderId===o.id?"selected":""}>${orderCode(o)} — ${U.esc(o.client)} — ${U.esc(o.product)}</option>`).join("")}</select></div>
      <div class="field"><label>Observação</label><textarea id="mv-obs" rows="2" placeholder="Opcional">${U.esc(n.observation)}</textarea></div>
      <button class="btn btn-primary btn-block" data-act="save-stock-entry">Registrar movimentação</button>
    </div>`;
  }

  function stockDetail(materialId) {
    const m = materials.find(x=>x.id===materialId);
    if (!m) return "";
    const x = stockSummary(materialId);
    const movs = stockAllMovements().filter(z=>z.materialId===materialId).sort((a,b)=>String(b.date+(b.createdAt||0)).localeCompare(String(a.date+(a.createdAt||0))));
    const prodRows = productions.filter(p=>p.orderId && stockMaterialIdForOrder(orders.find(o=>o.id===p.orderId)||{},p)===materialId && p.operacao!=="retrabalho");
    const orderRows = orders.filter(o=>stockMaterialIdForOrder(o)===materialId);
    return `<div class="card pad mt12 stock-detail">
      <div class="between"><div><span class="section-label" style="margin:0">${U.icon("box","sm")} ${U.esc(m.name)}</span><div class="tiny dim mt8">Saldo atual: <b>${U.fmt(x.current)}</b> · Reservado: <b>${U.fmt(x.reserved)}</b> · Disponível: <b>${U.fmt(x.available)}</b></div></div><button class="btn-ghost" data-act="stock-close-detail">Fechar</button></div>
      <div class="stock-detail-grid mt12">
        <div><span>Entradas</span><b>${U.fmt(x.entries)}</b></div>
        <div><span>Consumo de produção</span><b>${U.fmt(x.productionConsumption)}</b></div>
        <div><span>Consumo manual</span><b>${U.fmt(x.manualConsumption)}</b></div>
        <div><span>Defeitos relacionados</span><b>${U.fmt(prodRows.reduce((a,p)=>a+(Number(p.defects)||0),0))}</b></div>
      </div>
      <div class="mt12"><span class="section-label">Pedidos que utilizam</span>${orderRows.length?orderRows.map(o=>`<div class="stock-line"><span>${orderCode(o)} · ${U.esc(o.client)} · ${U.esc(o.product)}</span><b>${U.fmt(o.quantity)} un. · ${U.fmt(Math.max(0,(Number(o.quantity)||0)-orderProgress(o.id).produced))} pend.</b></div>`).join(""):'<div class="empty">Nenhum pedido relacionado.</div>'}</div>
      <div class="mt12"><span class="section-label">Consumos de produção</span>${prodRows.length?prodRows.map(p=>`<div class="stock-line"><span>${U.esc(p.date||"—")} · ${orderCode(orders.find(o=>o.id===p.orderId)||{})} · ${U.esc(p.productName||"")}</span><b>${U.fmt(p.quantityProduced)} un.</b></div>`).join(""):'<div class="empty">Nenhum consumo de produção registrado.</div>'}</div>
      <div class="mt12"><span class="section-label">Movimentações</span>${movs.length?movs.map(z=>`<div class="stock-line"><span>${U.esc(z.date||"—")} · ${U.esc(z.type)}${z.observation?" · "+U.esc(z.observation):""}</span><b>${U.fmt(z.quantity)}</b></div>`).join(""):'<div class="empty">Nenhuma movimentação manual.</div>'}</div>
    </div>`;
  }

  async function addStockMaterial() {
    const name = String(state.newMaterial.name||"").trim();
    const minStock = Number(state.newMaterial.minStock)||0;
    if (!name) { toast("Informe o nome do material."); return; }
    if (materials.some(m=>String(m.name||"").trim().toLowerCase()===name.toLowerCase())) { toast("Esse material já está cadastrado."); return; }
    try {
      await S.add("materials",{ name, minStock, productId:state.newMaterial.productId||"", active:true, createdAt:Date.now() });
      state.newMaterial={name:"",minStock:0,productId:""};
      state.stock.showMaterialForm=false;
      toast("Material cadastrado");
      renderView();
    } catch(e) { toast(errMsg(e)); }
  }

  async function addStockMovement() {
    const n=state.newMovement;
    const q=Number(n.quantity)||0;
    if (!n.materialId || q<=0 || !n.date || !n.type) { toast("Preencha material, quantidade, data e tipo."); return; }
    let qty=q;
    if (n.type==="AJUSTE") {
      const signed = prompt("Ajuste de estoque: informe o valor. Use negativo para reduzir.", "0");
      if (signed===null) return;
      qty=Number(signed);
      if (!Number.isFinite(qty) || qty===0) { toast("Ajuste inválido."); return; }
    }
    if (n.type==="CONSUMO/SAÍDA" && qty>stockSummary(n.materialId).current) {
      if (!confirm("A saída é maior que o estoque físico atual. Registrar mesmo assim?")) return;
    }
    try {
      await S.add("stockMovements",{materialId:n.materialId,quantity:qty,date:n.date,type:n.type,orderId:n.orderId||"",observation:String(n.observation||"").trim(),createdAt:Date.now(),source:"gestor"});
      state.newMovement={materialId:"",quantity:"",date:U.todayStr(),type:"ENTRADA",orderId:"",observation:""};
      state.stock.showForm=false;
      toast("Movimentação registrada");
      renderView();
    } catch(e) { toast(errMsg(e)); }
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
    const editing = f.editingId ? productions.find(p => p.id === f.editingId) : null;
    box.innerHTML = `
      ${editing ? editLanceCard(editing) : ""}
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
                <td style="white-space:nowrap"><button class="icon-btn" data-act="edit-lance" data-id="${p.id}" title="Editar/Corrigir" style="width:28px;height:28px;border-radius:8px">✏️</button> <button class="icon-btn" data-act="del-lance" data-id="${p.id}" title="Excluir" style="width:28px;height:28px;border-radius:8px">${U.icon("trash", "sm")}</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  /* ---------- CORREÇÃO DE LANÇAMENTOS (editar/excluir) ----------
     O gestor pode corrigir ou excluir um lançamento registrado por
     engano (ex.: o funcionário lançou a quantidade errada). Sempre que
     um lançamento é editado ou excluído, a cadeia inteira é recalculada:
     Tarefa (productionOrders) ← lançamentos → OP → Pedido (saldo). */
  function editLanceCard(rec) {
    const st = rec;
    return `
      <div class="card pad" style="background:var(--panel);margin-bottom:12px">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Corrigindo lançamento${st.machineName ? " — " + U.esc(st.machineName) : ""}</span>
          <button class="btn-ghost" data-act="cancel-edit-lance" data-id="${st.id}">Cancelar</button>
        </div>
        <div class="field-row">
          <div class="field"><label>Data</label><input type="date" id="el-date" value="${st.date || ""}"></div>
          <div class="field"><label>Operador</label><input id="el-operator" value="${U.esc(st.operator || "")}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Quantidade produzida (un.)</label><input type="number" id="el-qty" min="0" value="${Number(st.quantityProduced) || 0}"></div>
          <div class="field"><label>Defeitos (un.)</label><input type="number" id="el-defects" min="0" value="${Number(st.defects) || 0}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Início</label><input type="time" id="el-start" value="${U.esc(st.startTime || "")}"></div>
          <div class="field"><label>Fim</label><input type="time" id="el-end" value="${U.esc(st.endTime || "")}"></div>
        </div>
        <button class="btn btn-primary btn-block mt12" data-act="save-edit-lance" data-id="${st.id}">SALVAR CORREÇÃO</button>
        <p class="tiny dim mt8">Ao salvar, a Tarefa, a OP e o saldo do Pedido são recalculados automaticamente.</p>
      </div>`;
  }

  /* Produzido/defeitos de uma Tarefa = soma dos lançamentos dela. */
  function taskProducedFromRows(poId) {
    const rows = productions.filter(p => p.productionOrderId === poId);
    const q = rows.reduce((s, r) => s + (Number(r.quantityProduced) || 0), 0);
    const d = rows.reduce((s, r) => s + (Number(r.defects) || 0), 0);
    return { q, d };
  }

  /* Recalcula a cadeia inteira após corrigir/excluir um lançamento:
     Tarefa ← lançamentos, OP ← tarefas, Pedido ← tarefas. */
  async function recalcularCadeia() {
    for (const po of productionOrders) {
      const { q, d } = taskProducedFromRows(po.id);
      const patch = {};
      if ((Number(po.quantityProduced) || 0) !== q) patch.quantityProduced = q;
      if ((Number(po.defects) || 0) !== d) patch.defects = d;
      if (q === 0 && po.status !== "aguardando") {
        patch.status = "aguardando";
        patch.finishedAt = null;
      } else if (q > 0 && po.status === "aguardando") {
        patch.status = "em_producao";
      }
      if (Object.keys(patch).length) {
        try { await S.update("productionOrders", po.id, patch); } catch (e) { toast(errMsg(e)); }
      }
    }
    for (const order of orders) {
      const prog = orderProgress(order.id);
      const qty = Number(order.quantity) || 0;
      let next;
      if (qty > 0 && prog.produced >= qty) next = "finalizado";
      else if (prog.produced > 0) next = "em_producao";
      else next = "aguardando";
      if (next !== order.status) {
        try { await S.update("orders", order.id, { status: next }); } catch (e) { toast(errMsg(e)); }
      }
    }
    for (const op of ops) {
      const prog = opProgress(op.id);
      const qty = Number(op.quantity) || 0;
      const taskEmExecucao = prog.pos.some(po => po.status === "em_producao" || po.status === "finalizada");
      let next;
      if (qty > 0 && prog.produced >= qty) next = "concluida";
      else if (prog.produced > 0) next = "producao";
      else if (!taskEmExecucao && (op.status === "producao" || op.status === "concluida")) next = "aguardando";
      else next = op.status;
      if (next !== op.status) {
        const patch = { status: next };
        if (next === "producao" && !op.startedAt) patch.startedAt = Date.now();
        if (next === "concluida") patch.finishedAt = Date.now();
        try { await S.update("ops", op.id, patch); } catch (e) { toast(errMsg(e)); }
      }
    }
  }

  async function excluirProducao(id) {
    try {
      await S.remove("productions", id);
    } catch (e) { toast(errMsg(e)); return; }
    try {
      await recalcularCadeia();
    } catch (e) { toast(errMsg(e)); }
    state.rel.editingId = "";
    toast("Lançamento excluído — saldos recalculados");
    renderView();
  }

  async function salvarEdicaoLance(id) {
    const rec = productions.find(p => p.id === id);
    if (!rec) return;
    const qty = Math.max(0, Number((document.getElementById("el-qty") || {}).value) || 0);
    const defects = Math.max(0, Number((document.getElementById("el-defects") || {}).value) || 0);
    const dateEl = document.getElementById("el-date");
    const opEl = document.getElementById("el-operator");
    const startEl = document.getElementById("el-start");
    const endEl = document.getElementById("el-end");
    const startTime = startEl.value;
    const endTime = endEl.value;
    const hours = (startTime && endTime) ? U.timeDiffHours(startTime, endTime) : (Number(rec.productionHours) || 0);
    const rate = qty > 0 ? defects / qty * 100 : 0;
    const patch = {
      quantityProduced: qty,
      defects: defects,
      defectRate: rate,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      startTime: startTime,
      endTime: endTime
    };
    if (dateEl.value) patch.date = dateEl.value;
    if (opEl.value) patch.operator = opEl.value;
    try {
      await S.update("productions", id, patch);
    } catch (e) { toast(errMsg(e)); return; }
    try {
      await recalcularCadeia();
    } catch (e) { toast(errMsg(e)); }
    state.rel.editingId = "";
    toast("Lançamento corrigido — saldos recalculados");
    renderView();
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

  /* Ordem de Produção (OP): status do lote industrial (independente do
     status da Tarefa/PO acima) e prioridade de execução. */
  const OP_STATUS = {
    aguardando: { label: "Aguardando", pill: "auto" },
    producao: { label: "Em produção", pill: "produzindo" },
    concluida: { label: "Concluída", pill: "good" }
  };
  const OP_PRIORITY = {
    baixa: { label: "Baixa", pill: "auto" },
    media: { label: "Média", pill: "pausa" },
    alta: { label: "Alta", pill: "parada" }
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

  /* Código curto e estável da OP: usa o número manual informado pelo
     gestor quando existe; senão cai para a ordem de criação (antigo). */
  function opCode(op) {
    if (op && op.number != null && String(op.number).trim() !== "") {
      const base = String(op.number).trim();
      /* Etapa 2: quando a OP é de um componente da ficha técnica (ex.:
         Capa), a identificação exibida é "OP 2027 | Capa" — o número
         nunca muda, só ganha o sufixo do componente. */
      return (op.component && String(op.component).trim()) ? base + " | " + String(op.component).trim() : base;
    }
    const ordered = ops.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const idx = ordered.findIndex(x => x.id === op.id);
    return "OP-" + String(idx >= 0 ? idx + 1 : 0).padStart(4, "0");
  }

  /* Etapa 2: todas as OPs que compartilham o mesmo pedido + mesmo número
     manual — ou seja, o "grupo" de componentes gerado a partir de uma
     única OP da fábrica (ex.: OP 2027 | Capa, OP 2027 | Miolo...). Para
     uma OP antiga/sem componente, o grupo tem só ela mesma. */
  function opGroupSiblings(op) {
    const numero = String((op && op.number) || "").trim();
    if (!numero) return [op].filter(Boolean);
    return ops.filter(x => x.orderId === op.orderId && String(x.number || "").trim() === numero)
      .slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  /* Progresso de uma OP: soma só as Tarefas (productionOrders) que foram
     vinculadas a ela (po.opId), com a mesma regra de retrabalho usada
     no progresso do pedido. */
  function opProgress(opId) {
    const pos = productionOrders.filter(po => po.opId === opId)
      .slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const mainPOs = pos.filter(po => po.operacao !== "retrabalho");
    const produced = mainPOs.reduce((s, po) => s + (Number(po.quantityProduced) || 0), 0);
    return { pos, produced };
  }

  /* OPs pertencentes a um pedido (mais antigas primeiro). */
  function opsForOrder(orderId) {
    return ops.filter(op => op.orderId === orderId)
      .slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
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
        ${state.newOPForm ? newOPForm() : ""}
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
          <div class="field"><label>N.º do pedido (manual, opcional)</label><input data-k="number" value="${U.esc(d.number)}" placeholder="Ex.: 1254"></div>
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
            <div class="small" style="font-weight:600">${o.number ? "Pedido " + U.esc(o.number) + " · " : ""}${orderCode(o)} — ${U.esc(o.client)}</div>
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
        <div class="rowc mt12" style="gap:8px;flex-wrap:wrap">
          <button class="btn-ghost" data-act="toggle-order" data-id="${o.id}">${open ? "Ocultar OPs" : "Ver OPs e tarefas (" + (opsForOrder(o.id).length + prog.pos.filter(po => !po.opId).length) + ")"}</button>
          ${remaining > 0 ? `<button class="btn-ghost" data-act="new-op-for-order" data-id="${o.id}">➕ Nova OP para este pedido</button>` : ""}
          
        </div>
        ${open ? orderOrdersBlock(o) : ""}
      </div>`;
  }

  function orderOrdersBlock(o) {
    const prog = orderProgress(o.id);
    const myOPs = opsForOrder(o.id);
    const looseTasks = prog.pos.filter(po => !po.opId);
    return `
      <div class="space-y3 mt12">
        ${myOPs.length ? myOPs.map(op => opCard(op)).join("") : ""}
        ${looseTasks.length ? `
          <div class="tiny dim" style="margin-top:4px">Tarefas avulsas (sem OP)</div>
          ${looseTasks.map(poCard).join("")}` : ""}
        ${!myOPs.length && !looseTasks.length ? '<div class="empty">Nenhuma OP ou tarefa criada para este pedido ainda.</div>' : ""}
      </div>`;
  }

  /* ========== FILA DE MÁQUINAS (Etapa 8) ==========
     Mostra, para cada máquina, a produção ATUAL e a PRÓXIMA da fila.
     O gestor pode: INICIAR PRODUÇÃO (quando não tem atual), PAUSAR/
     RETOMAR a atual e FINALIZAR PRODUÇÃO (com quantidade e defeitos).
     A baixa automática recalcula Tarefa → OP → Pedido e libera a fila. */
  function taskFilaInfo(po) {
    const op = ops.find(x => x.id === po.opId) || null;
    const order = orders.find(x => x.id === po.orderId) || null;
    const planned = Number(po.plannedQuantity) > 0 ? Number(po.plannedQuantity) : (op ? (Number(op.quantity) || 0) : 0);
    const produced = Number(po.quantityProduced) || 0;
    return {
      opCode: op ? opCode(op) : "",
      client: order ? order.client : "",
      product: po.product + (po.model ? " — " + po.model : "") + (po.operacao === "retrabalho" ? " (retrabalho)" : ""),
      planned: planned,
      produced: produced,
      remaining: Math.max(0, planned - produced),
      employee: po.employeeName || "",
      est: Number(po.estimatedMinutes) || 0,
      priority: po.priority || "media"
    };
  }

  function renderFilaMaquinas(v) {
    if (!window.FluxoProducao) {
      v.innerHTML = '<div class="empty">Módulo do fluxo de produção não carregado.</div>';
      return;
    }
    const FP = window.FluxoProducao;
    if (!machines.length) {
      v.innerHTML = '<div class="empty">Nenhuma máquina cadastrada.</div>';
      return;
    }
    v.innerHTML = `
      <div class="space-y">
        ${machines.map(m => {
          const st = STATUS[m.status] || STATUS.parada;
          const fila = FP.filaPorMaquina(m.id);
          const atual = fila.atual;
          const prox = fila.proxima;
          const typeLab = m.type === "automatica" ? "Automática" : (m.type === "escanteadeira" ? "Escanteadeira" : "Manual");
          const ai = atual ? taskFilaInfo(atual) : null;
          const pi = prox ? taskFilaInfo(prox) : null;
          const finishing = state.filaF.taskId && atual && state.filaF.taskId === atual.id;
          return `
            <div class="card pad">
              <div class="rowc">
                <div class="led ${st.led}"></div>
                <div class="f1">
                  <div class="small" style="font-weight:600">${U.esc(m.name)}</div>
                  <div class="tiny dim">${typeLab}</div>
                </div>
                <span class="pill ${st.pill}">${st.label}</span>
              </div>

              <div class="mt12">
                <div class="tiny dim" style="letter-spacing:.08em;text-transform:uppercase">Produção atual</div>
                ${atual ? (() => {
                  const statusLed = atual.status === "pausa" ? "warn" : "ok";
                  return `
                  <div class="card" style="background:var(--panel);margin-top:6px;padding:12px">
                    <div class="rowc">
                      <div class="led ${statusLed}"></div>
                      <div class="f1">
                        <div class="small" style="font-weight:600">${ai.opCode ? U.esc(ai.opCode) + " — " : ""}${U.esc(ai.product)}</div>
                        <div class="tiny dim">${ai.client ? U.esc(ai.client) : ""}${ai.employee ? " · " + U.esc(ai.employee) : ""} · ${atual.status === "pausa" ? "pausada" : "em produção"}</div>
                      </div>
                    </div>
                    <div class="kv mt8"><b>Planejado:</b> ${U.fmt(ai.planned)} un.</div>
                    <div class="kv"><b>Produzido:</b> ${U.fmt(ai.produced)} un.</div>
                    <div class="kv"><b>Restante:</b> <span style="color:var(--amber2)">${U.fmt(ai.remaining)} un.</span></div>
                    ${ai.est ? `<div class="kv"><b>Tempo estimado:</b> ${U.fmt(ai.est)} min</div>` : ""}
                    <div class="rowc mt12" style="gap:8px;flex-wrap:wrap">
                      ${atual.status === "em_producao"
                        ? `<button class="btn-ghost" data-act="fila-pause" data-id="${atual.id}">⏸ PAUSAR</button>`
                        : `<button class="btn-ghost" data-act="fila-resume" data-id="${atual.id}">▶ RETOMAR</button>`}
                      <button class="btn-ghost" data-act="fila-finish-open" data-id="${atual.id}">⏹ FINALIZAR PRODUÇÃO</button>
                    </div>
                    ${finishing ? `
                      <div class="mt12">
                        <div class="field-row">
                          <div class="field"><label>Quantidade produzida (un.)</label><input type="number" id="fila-qty" min="0" value="${state.filaF.qty}" placeholder="0"></div>
                          <div class="field"><label>Defeitos (un.)</label><input type="number" id="fila-def" min="0" value="${state.filaF.def}" placeholder="0"></div>
                        </div>
                        ${state.filaF.err ? `<p class="op-pin-err">${U.esc(state.filaF.err)}</p>` : ""}
                        <div class="rowc mt8" style="gap:8px">
                          <button class="btn btn-primary" data-act="fila-finish-save" data-id="${atual.id}">CONFIRMAR BAIXA</button>
                          <button class="btn-ghost" data-act="fila-finish-cancel">Cancelar</button>
                        </div>
                      </div>` : ""}
                  </div>`;
                })() : '<div class="kv mt6"><b>—</b> <span class="tiny dim">máquina livre</span></div>'}
              </div>

              <div class="mt12">
                <div class="tiny dim" style="letter-spacing:.08em;text-transform:uppercase">Próxima produção</div>
                ${prox ? (() => {
                  const prioridade = prox.priority === "alta" ? " · alta" : (prox.priority === "baixa" ? " · baixa" : " · média");
                  return `
                  <div class="card" style="background:var(--panel);margin-top:6px;padding:12px">
                    <div class="small" style="font-weight:600">${pi.opCode ? U.esc(pi.opCode) + " — " : ""}${U.esc(pi.product)}</div>
                    <div class="tiny dim">${pi.client ? U.esc(pi.client) : ""}${pi.employee ? " · " + U.esc(pi.employee) : ""}${prioridade}</div>
                    <div class="kv mt8"><b>Planejado:</b> ${U.fmt(pi.planned)} un.</div>
                    ${!atual ? `<button class="btn btn-primary btn-block mt12" data-act="fila-start" data-id="${prox.id}">▶ INICIAR PRODUÇÃO</button>` : ""}
                  </div>`;
                })() : '<div class="kv mt6"><b>—</b> <span class="tiny dim">fila vazia</span></div>'}
              </div>
            </div>`;
        }).join("")}
      </div>`;
    wireFila();
  }

  function wireFila() {
    const qtyEl = document.getElementById("fila-qty");
    if (qtyEl) qtyEl.addEventListener("input", () => { state.filaF.qty = qtyEl.value; state.filaF.err = ""; });
    const defEl = document.getElementById("fila-def");
    if (defEl) defEl.addEventListener("input", () => { state.filaF.def = defEl.value; state.filaF.err = ""; });
  }

  /* ---------- AÇÕES DA FILA ---------- */
  async function filaStart(taskId) {
    try {
      await FluxoProducao.iniciarTarefa({ taskId: taskId });
      toast("Produção iniciada");
    } catch (e) { toast((e && e.message) || "Erro ao iniciar produção."); }
    renderView();
  }

  async function filaPause(taskId) {
    try {
      await FluxoProducao.pausarTarefa({ taskId: taskId });
      toast("Produção pausada");
    } catch (e) { toast((e && e.message) || "Erro ao pausar."); }
    renderView();
  }

  async function filaResume(taskId) {
    try {
      await FluxoProducao.retomarTarefa({ taskId: taskId });
      toast("Produção retomada");
    } catch (e) { toast((e && e.message) || "Erro ao retomar."); }
    renderView();
  }

  async function filaFinish(taskId) {
    const qty = Number(state.filaF.qty) || 0;
    if (qty <= 0) {
      state.filaF.err = "Informe a quantidade produzida.";
      renderView();
      return;
    }
    try {
      const res = await FluxoProducao.finalizarTarefa({ taskId: taskId, qty: qty, defects: Number(state.filaF.def) || 0 });
      const ordemRest = res && res.detalhe ? res.detalhe.orderRemaining : null;
      state.filaF = { taskId: "", qty: "", def: "", err: "" };
      toast("Produção finalizada — baixa automática feita" + (ordemRest != null ? " · saldo do pedido: " + U.fmt(ordemRest) : ""));
      renderView();
    } catch (e) {
      toast((e && e.message) || "Erro ao finalizar produção.");
    }
  }

  /* ========== ORDENS DE PRODUÇÃO (OP) — Kanban ========== */
  function renderOPs(v) {
    const cols = [
      ["aguardando", "Aguardando"],
      ["producao", "Em produção"],
      ["concluida", "Concluída"]
    ];
    v.innerHTML = `
      <div class="space-y">
        ${state.newTaskForm ? newTaskForm() : (state.newOPForm ? newOPForm() : `<button class="btn btn-primary btn-block" data-act="new-op">➕ Nova Ordem de Produção</button>`)}
        ${!ops.length ? '<div class="empty">Nenhuma OP criada ainda. Crie uma OP a partir de um pedido com saldo pendente.</div>' : `
        <div class="kanban-board">
          ${cols.map(([key, label]) => `
            <div class="kanban-col">
              <div class="kanban-col-head">${label} <span class="tiny dim">(${ops.filter(x => x.status === key).length})</span></div>
              <div class="kanban-col-body">
                ${ops.filter(x => x.status === key).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(op => opCard(op, { showOrder: true })).join("") || '<div class="empty">Vazio</div>'}
              </div>
            </div>`).join("")}
        </div>`}
      </div>`;
  }

  /* Cartão de OP, reaproveitado no detalhe do Pedido e no Kanban. */
  function opCard(op, opts) {
    opts = opts || {};
    const order = orders.find(x => x.id === op.orderId);
    /* Produto/modelo: usa os campos gravados na própria OP; se a OP for
       antiga (criada antes desta etapa) cai para os dados do pedido. */
    const opProduct = op.product || (order && order.product) || "";
    const opModel = op.model || (order && order.model) || "";
    const stOP = OP_STATUS[op.status] || OP_STATUS.aguardando;
    const prOP = OP_PRIORITY[op.priority] || OP_PRIORITY.media;
    const prog = opProgress(op.id);
    const qty = Number(op.quantity) || 0;
    const saldo = Math.max(0, qty - prog.produced);
    const pct = qty > 0 ? Math.min(100, prog.produced / qty * 100) : 0;
    const open = !!state.openOPs[op.id];
    return `
      <div class="card pad" style="background:var(--panel)">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${opCode(op)}${opts.showOrder && order ? " — " + U.esc(order.client) : ""}</div>
            <div class="tiny dim">${opProduct ? U.esc(opProduct) + (opModel ? " — " + U.esc(opModel) : "") : "Produto não informado"}${op.component ? " · Componente: " + U.esc(op.component) : ""}${op.sector ? " · " + U.esc(op.sector) : ""}${op.dueDate ? " · prev.: " + U.fmtDate(op.dueDate) : ""}</div>
          </div>
          <span class="pill ${prOP.pill}">${prOP.label}</span>
          <span class="pill ${stOP.pill}">${stOP.label}</span>
        </div>
        <div class="kv mt12"><b>Data de criação:</b> ${op.createdAt ? U.fmtDate(msToDateStr(op.createdAt)) : "—"}</div>
        <div class="kv"><b>Planejado:</b> ${qty ? U.fmt(qty) + " un." : "—"}</div>
        <div class="kv"><b>Produzido:</b> ${U.fmt(prog.produced)} un.</div>
        <div class="kv"><b>Saldo:</b> ${U.fmt(saldo)} un.</div>
        ${qty ? `<div class="tick-row mt8"><div class="tick-fill ${pct >= 100 ? "ok" : ""}" style="width:${pct}%"></div></div>` : ""}
        <div class="rowc mt12" style="gap:8px;flex-wrap:wrap">
          <button class="btn-ghost" data-act="toggle-op" data-id="${op.id}">${open ? "Ocultar tarefas" : "Ver tarefas (" + prog.pos.length + ")"}</button>
          <button class="btn-ghost" data-act="open-op-detail" data-id="${op.id}">📊 Ver detalhe completo</button>
          
          ${op.status === "aguardando" ? `<button class="btn-ghost" data-act="op-status" data-id="${op.id}" data-status="producao">▶ Iniciar produção</button>` : ""}
          ${op.status === "producao" ? `<button class="btn-ghost" data-act="op-status" data-id="${op.id}" data-status="concluida">✔ Concluir OP</button>` : ""}
          ${op.status === "concluida" ? `<button class="btn-ghost" data-act="op-status" data-id="${op.id}" data-status="producao">↺ Reabrir</button>` : ""}
        </div>
        ${open ? `<div class="space-y3 mt12">${prog.pos.length ? prog.pos.map(poCard).join("") : '<div class="empty">Nenhuma tarefa criada para esta OP ainda.</div>'}</div>` : ""}
      </div>`;
  }

  /* Data/hora (timestamp em ms) formatada como "YYYY-MM-DD", no mesmo
     padrão de U.todayStr(), para reaproveitar U.fmtDate(). */
  function msToDateStr(ms) {
    if (!ms) return "";
    const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }

  /* Estatísticas completas de uma OP para a tela de detalhe: tarefas
     vinculadas, apontamentos (productions) ligados a essas tarefas via
     productionOrderId, funcionários/máquinas envolvidos, horas e
     eficiência. Reaproveita opProgress() — não duplica a regra de
     retrabalho. */
  function opFullStats(op) {
    const prog = opProgress(op.id);
    const mainPOs = prog.pos.filter(po => po.operacao !== "retrabalho");
    const defects = mainPOs.reduce((s, po) => s + (Number(po.defects) || 0), 0);
    const poIds = prog.pos.map(po => po.id);
    const rows = productions.filter(p => poIds.indexOf(p.productionOrderId) >= 0)
      .slice().sort((a, b) => String(b.date + (b.createdAt || 0)).localeCompare(String(a.date + (a.createdAt || 0))));
    const hours = rows.reduce((s, r) => s + (Number(r.productionHours) || 0), 0);
    const perHour = hours > 0 ? prog.produced / hours : 0;
    const employeeNames = Array.from(new Set(prog.pos.map(po => po.employeeName).filter(Boolean)));
    const machineNames = Array.from(new Set(prog.pos.map(po => po.machineName).filter(Boolean)));
    return { prog, defects, approved: Math.max(0, prog.produced - defects), rows, hours, perHour, employeeNames, machineNames };
  }

  /* ========== DETALHE COMPLETO DA OP (Etapa 4) ========== */
  function renderOPDetalhe(v) {
    const op = ops.find(x => x.id === state.selectedOPId);
    if (!op) {
      v.innerHTML = `<div class="empty">OP não encontrada.</div><button class="btn-ghost mt12" data-go="ops">← Voltar para Ordens de Produção</button>`;
      return;
    }
    const order = orders.find(x => x.id === op.orderId);
    const opProduct = op.product || (order && order.product) || "";
    const opModel = op.model || (order && order.model) || "";
    const stOP = OP_STATUS[op.status] || OP_STATUS.aguardando;
    const prOP = OP_PRIORITY[op.priority] || OP_PRIORITY.media;
    const stats = opFullStats(op);
    const qty = Number(op.quantity) || 0;
    const saldo = Math.max(0, qty - stats.prog.produced);
    const pct = qty > 0 ? Math.min(100, stats.prog.produced / qty * 100) : 0;
    const limit = Number(config.defectLimit) || 1;
    const defectPct = stats.prog.produced ? stats.defects / stats.prog.produced * 100 : 0;

    const tempoTotal = (() => {
      if (!op.startedAt) return "—";
      const end = op.finishedAt || Date.now();
      const mins = Math.max(0, Math.round((end - op.startedAt) / 60000));
      return Math.floor(mins / 60) + "h" + String(mins % 60).padStart(2, "0");
    })();

    v.innerHTML = `
      <button class="btn-ghost mb12" data-go="ops">← Voltar para Ordens de Produção</button>

      <div class="card pad">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:700;font-size:16px">${opCode(op)}</div>
            <div class="tiny dim">${order ? U.esc(order.client) + " · " : ""}${opProduct ? U.esc(opProduct) + (opModel ? " — " + U.esc(opModel) : "") : "Produto não informado"}</div>
          </div>
          <span class="pill ${prOP.pill}">${prOP.label}</span>
          <span class="pill ${stOP.pill}">${stOP.label}</span>
        </div>
        <div class="grid3 mt12">
          <div><span class="tiny dim">Data de criação</span><div class="mono-val">${op.createdAt ? U.fmtDate(msToDateStr(op.createdAt)) : "—"}</div></div>
          <div><span class="tiny dim">Início de produção</span><div class="mono-val">${op.startedAt ? U.fmtDate(msToDateStr(op.startedAt)) : "—"}</div></div>
          <div><span class="tiny dim">Finalização</span><div class="mono-val">${op.finishedAt ? U.fmtDate(msToDateStr(op.finishedAt)) : "—"}</div></div>
        </div>
        <div class="kv mt12"><b>Nº da OP:</b> ${opCode(op)}</div>
        <div class="kv"><b>Produto:</b> ${opProduct ? U.esc(opProduct) + (opModel ? " — " + U.esc(opModel) : "") : "—"}</div>
        ${op.component ? `<div class="kv"><b>Componente:</b> ${U.esc(op.component)}</div>` : ""}
        <div class="kv"><b>Setor:</b> ${U.esc(op.sector || "—")}</div>
        <div class="kv"><b>Data prevista:</b> ${op.dueDate ? U.fmtDate(op.dueDate) : "—"}</div>
        <div class="kv"><b>Tempo total:</b> ${tempoTotal}</div>
        <div class="kv"><b>Funcionários envolvidos:</b> ${stats.employeeNames.length ? U.esc(stats.employeeNames.join(", ")) : "—"}</div>
        <div class="kv"><b>Máquinas utilizadas:</b> ${stats.machineNames.length ? U.esc(stats.machineNames.join(", ")) : "—"}</div>
      </div>

      ${(() => {
        /* Etapa 2: se esta OP faz parte de um grupo por componente
           (mesmo pedido + mesmo número), mostra o progresso de cada
           componente do grupo — ex.: Capa 0/10000, Miolo 0/10000. */
        const group = opGroupSiblings(op);
        if (group.length <= 1) return "";
        return `
      <p class="section-label">${U.icon("layers", "sm")} Componentes da OP ${U.esc(String(op.number || "").trim())}</p>
      <div class="card pad">
        <div class="kv" style="margin-top:0"><b>Produto:</b> ${U.esc(opProduct || "—")}</div>
        <div class="space-y3 mt8">
          ${group.map(g => {
            const gProg = opProgress(g.id);
            const gQty = Number(g.quantity) || 0;
            const isCurrent = g.id === op.id;
            return `<div class="rowc between" style="padding:8px 0;border-bottom:1px solid var(--line)${isCurrent ? ";font-weight:700" : ""}">
              <span class="small" data-act="open-op-detail" data-id="${g.id}" style="cursor:pointer">${U.esc(g.component || "(sem componente)")}${isCurrent ? " · (esta OP)" : ""}</span>
              <span class="tiny dim">${U.fmt(gProg.produced)} / ${gQty ? U.fmt(gQty) : "—"}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;
      })()}

      <div class="grid-cards mt12">
        <div class="card stat"><div class="lbl">${U.icon("flag", "sm")} Planejado</div><div class="val">${qty ? U.fmt(qty) : "—"}<em>un.</em></div><div class="foot">quantidade da OP</div></div>
        <div class="card stat accent"><div class="lbl">${U.icon("package", "sm")} Produzido</div><div class="val amb">${U.fmt(stats.prog.produced)}<em>un.</em></div><div class="foot">${qty ? U.fmt(pct, 1) + "% do planejado" : "OP sem quantidade planejada"}</div></div>
        <div class="card stat"><div class="lbl">${U.icon("layers", "sm")} Saldo</div><div class="val">${qty ? U.fmt(saldo) : "—"}<em>un.</em></div><div class="foot">planejado − produzido</div></div>
        <div class="card stat"><div class="lbl">${U.icon("check", "sm")} Aprovado</div><div class="val up">${U.fmt(stats.approved)}<em>un.</em></div><div class="foot">produzido − defeitos</div></div>
        <div class="card stat"><div class="lbl">${U.icon("alert", "sm")} Rejeitado</div><div class="val ${stats.defects ? "down" : ""}">${U.fmt(stats.defects)}<em>un.</em></div><div class="foot">${stats.prog.produced ? U.fmt(defectPct, 2) + "% · limite " + U.fmt(limit, 2) + "%" : "sem produção"}</div></div>
        <div class="card stat"><div class="lbl">${U.icon("speed", "sm")} Eficiência</div><div class="val">${stats.hours > 0 ? U.fmt(stats.perHour, 1) : "—"}<em>${stats.hours > 0 ? "un./h" : ""}</em></div><div class="foot">${U.fmt(stats.hours, 2)} h apontadas</div></div>
      </div>

      <div class="card pad mt12">
        <div class="between mb8"><span class="section-label" style="margin:0">${U.icon("package", "sm")} Progresso da OP</span><span class="tiny dim">${qty ? U.fmt(pct, 1) + "%" : "—"}</span></div>
        <div class="tick-row"><div class="tick-fill ${pct >= 100 ? "ok" : ""}" style="width:${pct}%"></div></div>
      </div>

      <p class="section-label">${U.icon("chart", "sm")} Histórico de produção da OP</p>
      <div class="card pad">
        ${stats.rows.length ? `
        <div class="card tbl-wrap">
          <table>
            <thead><tr>
              <th>Data</th><th>Máquina</th><th>Funcionário</th><th>Horário</th>
              <th style="text-align:right">Horas</th><th style="text-align:right">Produzido</th>
              <th style="text-align:right">Aprovado</th><th style="text-align:right">Defeitos</th>
              <th style="text-align:right">Prod/h</th><th></th>
            </tr></thead>
            <tbody>
              ${stats.rows.map(r => {
                const q = Number(r.quantityProduced) || 0;
                const d = Number(r.defects) || 0;
                return `<tr>
                  <td>${U.fmtDate(r.date)}</td>
                  <td>${U.esc(r.machineName || "—")}</td>
                  <td>${U.esc(r.operator || "—")}</td>
                  <td>${r.startTime ? U.esc(r.startTime) + "–" + U.esc(r.endTime) : "—"}</td>
                  <td style="text-align:right">${U.fmt(r.productionHours, 2)}</td>
                  <td style="text-align:right">${U.fmt(q)}</td>
                  <td style="text-align:right">${U.fmt(q - d)}</td>
                  <td style="text-align:right">${d ? U.fmt(d) : "—"}</td>
                  <td style="text-align:right">${U.fmt(r.perHour, 1)}</td>
                  <td style="text-align:right;white-space:nowrap"><button class="icon-btn" data-act="del-lance" data-id="${r.id}" title="Excluir lançamento" style="width:28px;height:28px;border-radius:8px">${U.icon("trash", "sm")}</button></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>` : '<div class="empty">Nenhum apontamento registrado para esta OP ainda.</div>'}
      </div>

      <p class="section-label">${U.icon("clipboard", "sm")} Tarefas vinculadas (${stats.prog.pos.length})</p>
      <div class="space-y3">
        ${stats.prog.pos.length ? stats.prog.pos.map(poCard).join("") : '<div class="empty">Nenhuma tarefa criada para esta OP ainda.</div>'}
      </div>`;
  }

  /* CORREÇÃO (Etapa 2): antes, o produto da ficha técnica só era achado
     por comparação de texto entre o campo livre "Produto" do pedido e o
     nome cadastrado em Produtos (guessProductForOrder). Bastava uma
     pequena diferença de digitação (acento, plural, "160 folhas" etc.)
     para a busca falhar silenciosamente — o formulário simplesmente não
     mostrava os componentes, e a OP virava uma OP comum, sem os
     componentes participando da produção.
     Agora a Nova OP tem um seletor explícito de "Produto da ficha
     técnica" (state.newOP.fichaProductId). Se o gestor escolher um
     produto manualmente, ele SEMPRE vale — não depende de o texto do
     pedido bater. Sem escolha manual, cai para a detecção automática
     (guessProductForOrder) como antes, só que agora com aviso visível
     quando ela falha, em vez de sumir sem explicação. */
  function resolveFichaProduct(order) {
    if (state.newOP.fichaProductId) {
      return products.find(p => p.id === state.newOP.fichaProductId) || null;
    }
    return guessProductForOrder(order);
  }

  /* Componentes da ficha técnica de um produto que geram OP própria
     (generatesOP: true). Só esses viram checkbox na Nova OP — os
     demais componentes continuam sendo apenas informativos. */
  function opComponentsOf(product) {
    if (!product || !Array.isArray(product.components)) return [];
    return product.components.filter(c => c && c.generatesOP && String(c.name || "").trim());
  }

  function newOPForm() {
    const no = state.newOP;
    const pending = ordersWithBalance();
    const order = pending.find(x => x.id === no.orderId) || null;
    const defaultSector = (config && config.sector) || "Setor de Furação";
    const autoGuess = order ? guessProductForOrder(order) : null;
    const fichaProduct = order ? resolveFichaProduct(order) : null;
    const availableComponents = opComponentsOf(fichaProduct);
    return `
      <div class="card pad">
        <div class="rowc between mb12">
          <span class="small" style="font-weight:600">Nova Ordem de Produção</span>
          <button class="btn-ghost" data-act="cancel-new-op">Cancelar</button>
        </div>
        <div class="field"><label>Pedido</label>
          <select id="nop-order">
            <option value="">Selecione...</option>
            ${pending.map(x => `<option value="${x.id}" ${no.orderId === x.id ? "selected" : ""}>${x.number ? "Pedido " + U.esc(x.number) + " · " : ""}${orderCode(x)} — ${U.esc(x.client)} — ${U.fmt(x._remaining)} pendentes — ${U.esc(x.product)}</option>`).join("")}
          </select>
          ${!pending.length ? '<p class="tiny dim mt8">Nenhum pedido com saldo pendente. Cadastre um pedido primeiro.</p>' : ""}
        </div>
        <div class="field"><label>Número da OP (manual)</label>
          <input type="text" id="nop-number" value="${U.esc(no.number)}" placeholder="Ex.: 21234">
          <p class="tiny dim mt8" id="nop-number-err">Cada número é único por pedido — o sistema impede duplicar.</p>
        </div>
        ${order ? `
        <div class="field">
          <label>Produto da ficha técnica (para gerar OP por componente)</label>
          <select id="nop-ficha-product">
            <option value="">${autoGuess ? "Detectar automaticamente (" + U.esc(autoGuess.name) + ")" : "Detectar automaticamente — nenhum produto encontrado pelo nome do pedido"}</option>
            ${products.map(p => `<option value="${p.id}" ${no.fichaProductId === p.id ? "selected" : ""}>${U.esc(p.name)}${(p.components || []).some(c => c.generatesOP) ? " — tem componentes" : ""}</option>`).join("")}
          </select>
          ${!no.fichaProductId && !autoGuess ? `<p class="tiny dim mt8" style="color:var(--danger)">Não encontramos, pelo nome do pedido ("${U.esc(order.product)}"), um produto cadastrado igual em Produtos. Selecione acima o produto correto para habilitar a geração de OP por componente — sem isso, esta OP não terá os componentes da ficha técnica.</p>` : ""}
          ${fichaProduct && !availableComponents.length ? `<p class="tiny dim mt8">O produto "${U.esc(fichaProduct.name)}" não tem nenhum componente marcado como "Gera OP própria" em Produtos. Esta OP será criada sem divisão por componente.</p>` : ""}
        </div>` : ""}
        ${availableComponents.length ? `
        <div class="field">
          <label>Componentes da produção</label>
          <p class="tiny dim mb8">Escolha quais componentes da ficha técnica vão gerar produção. Cada um gera sua própria OP, usando o MESMO número informado acima (ex.: OP ${U.esc(String(no.number || "____").trim() || "____")} | Capa).</p>
          <div class="space-y3">
            ${availableComponents.map(c => `
              <label class="rowc" style="gap:8px;cursor:pointer">
                <input type="checkbox" data-act="toggle-op-component" data-name="${U.esc(c.name)}" ${(no.selectedComponents || []).indexOf(c.name) >= 0 ? "checked" : ""}>
                <span class="small">${U.esc(c.name)}</span>
              </label>`).join("")}
          </div>
        </div>` : ""}
        <div class="field-row">
          <div class="field"><label>Produto</label>
            <input type="text" id="nop-product" value="${U.esc(no.product)}" placeholder="Ex.: Caderno Universitário">
          </div>
          <div class="field"><label>Modelo (opcional)</label>
            <input type="text" id="nop-model" value="${U.esc(no.model)}" placeholder="Ex.: Espiral">
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Setor</label>
            <select id="nop-sector">
              <option value="${U.esc(defaultSector)}" ${no.sector === defaultSector ? "selected" : ""}>${U.esc(defaultSector)}</option>
              <option value="Furação" ${no.sector === "Furação" ? "selected" : ""}>Furação</option>
              <option value="Escanteamento" ${no.sector === "Escanteamento" ? "selected" : ""}>Escanteamento</option>
              <option value="Montagem" ${no.sector === "Montagem" ? "selected" : ""}>Montagem</option>
              <option value="Acabamento" ${no.sector === "Acabamento" ? "selected" : ""}>Acabamento</option>
            </select>
          </div>
          <div class="field"><label>Data prevista</label>
            <input type="date" id="nop-due" value="${no.dueDate}">
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Quantidade planejada da OP</label><input type="number" id="nop-quantity" min="0" value="${no.quantity}" placeholder="Ex.: 10000"></div>
          <div class="field"><label>Prioridade</label>
            <select id="nop-priority">
              <option value="baixa" ${no.priority === "baixa" ? "selected" : ""}>Baixa</option>
              <option value="media" ${no.priority === "media" ? "selected" : ""}>Média</option>
              <option value="alta" ${no.priority === "alta" ? "selected" : ""}>Alta</option>
            </select>
          </div>
        </div>
        ${order ? `<div class="kv mt12"><b>Saldo do pedido:</b> ${U.fmt(order._remaining)} un.</div>` : ""}
        <button class="btn btn-primary btn-block mt12" data-act="save-new-op">CRIAR OP</button>
      </div>`;
  }

  async function addOP() {
    const order = orders.find(x => x.id === state.newOP.orderId);
    if (!order) { toast("Selecione o pedido."); return; }
    const numero = String(state.newOP.number || "").trim();
    if (!numero) { toast("Informe o número da OP."); return; }
    const remaining = Math.max(0, (Number(order.quantity) || 0) - orderProgress(order.id).produced);
    if (remaining <= 0) { toast("Este pedido não tem mais saldo pendente."); return; }
    /* O número da OP continua único por pedido: o mesmo número nunca
       pode pertencer a outro pedido (mas pode ter várias OPs — uma por
       componente — dentro do mesmo pedido). */
    if (ops.some(x => String(x.number || "").trim() === numero && x.orderId !== order.id)) {
      toast("Este número de OP já está em uso em outro pedido.");
      return;
    }

    /* Etapa 2: se o produto tem componentes de ficha técnica marcados
       para gerar OP própria e o gestor selecionou algum, cria UMA OP
       por componente selecionado — todas com o MESMO número informado
       (a fábrica não usa números novos). Sem seleção (ou produto sem
       ficha técnica), mantém o comportamento antigo: uma única OP,
       sem componente. */
    const fichaProduct = resolveFichaProduct(order);
    const availableComponents = opComponentsOf(fichaProduct);
    const selected = availableComponents.length
      ? availableComponents.map(c => c.name).filter(name => (state.newOP.selectedComponents || []).indexOf(name) >= 0)
      : [];

    /* Produto/modelo ficam gravados na própria OP (além do pedido
       vinculado), com fallback para os dados do pedido quando o
       gestor deixa em branco — mantém OPs antigas (sem esses
       campos) funcionando via order.product/order.model. */
    const baseData = {
      orderId: order.id,
      number: numero,
      product: (state.newOP.product || "").trim() || order.product || "",
      model: (state.newOP.model || "").trim() || order.model || "",
      sector: (state.newOP.sector || "").trim() || ((config && config.sector) || "Setor de Furação"),
      dueDate: state.newOP.dueDate || "",
      quantity: Number(state.newOP.quantity) || 0,
      priority: state.newOP.priority || "media",
      status: "aguardando",
      startedAt: null,
      finishedAt: null
    };

    try {
      if (selected.length) {
        const dupComponent = selected.find(name => ops.some(x =>
          x.orderId === order.id && String(x.number || "").trim() === numero && String(x.component || "") === name
        ));
        if (dupComponent) {
          toast('Já existe a OP ' + numero + ' | ' + dupComponent + '. Informe outro número.');
          return;
        }
        for (const name of selected) {
          await S.add("ops", Object.assign({}, baseData, { component: name, createdAt: Date.now() }));
        }
        toast(selected.length + " OP(s) criada(s) para a OP " + numero);
      } else {
        if (ops.some(x => x.orderId === order.id && String(x.number || "").trim() === numero && !x.component)) {
          toast("Esta OP já existe. Informe outro número.");
          return;
        }
        await S.add("ops", Object.assign({}, baseData, { component: "", createdAt: Date.now() }));
        toast("OP criada");
      }
      state.newOPForm = false;
      state.newOP = freshOPDraft();
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  async function setOPStatus(id, status) {
    const patch = { status: status };
    if (status === "producao") patch.startedAt = Date.now();
    if (status === "concluida") patch.finishedAt = Date.now();
    try {
      await S.update("ops", id, patch);
      toast(status === "concluida" ? "OP concluída" : "OP atualizada");
    } catch (e) {
      toast(errMsg(e));
    }
  }

  function poCard(po) {
    const stPO = PO_STATUS[po.status] || PO_STATUS.aguardando;
    const planned = Number(po.plannedQuantity) > 0 ? Number(po.plannedQuantity) : 0;
    const produced = Number(po.quantityProduced) || 0;
    const remaining = Math.max(0, planned - produced);
    const est = Number(po.estimatedMinutes) || 0;
    return `
      <div class="card pad" style="background:var(--panel)">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(po.product)}${po.model ? " — " + U.esc(po.model) : ""}</div>
            <div class="tiny dim">${U.esc(po.machineName)} · ${po.employeeName ? "Funcionário: " + U.esc(po.employeeName) : ""}${po.operacao === "retrabalho" ? " · Retrabalho" : ""}</div>
          </div>
          <span class="pill ${stPO.pill}">${stPO.label}</span>
        </div>
        <div class="kv mt12"><b>Planejado:</b> ${planned ? U.fmt(planned) + " un." : "—"}</div>
        <div class="kv"><b>Produzido:</b> ${U.fmt(produced)} un.${po.defects ? " · " + U.fmt(po.defects) + " defeitos" : ""}</div>
        ${planned ? `<div class="kv"><b>Restante:</b> ${U.fmt(remaining)} un.</div>` : ""}
        ${est ? `<div class="kv"><b>Tempo estimado:</b> ${U.fmt(est)} min</div>` : ""}
        ${po.observation ? `<div class="kv"><b>Obs.:</b> ${U.esc(po.observation)}</div>` : ""}
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
        <div class="field"><label>N.º do pedido (manual, opcional)</label><input id="no-number" value="${U.esc(no.number)}" placeholder="Ex.: 1254"></div>
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
    const employee = employees.find(e => e.id === nt.employeeId) || null;
    const op = nt.opId ? ops.find(x => x.id === nt.opId) : null;
    const order = op ? (orders.find(o => o.id === op.orderId) || null) : null;
    const productId = nt.productId || (op && (op.productId || "")) || "";
    const product = products.find(p => p.id === productId) || null;
    const allowedMachines = (employee && (employee.allowedMachines || []).length)
      ? machines.filter(m => employee.allowedMachines.indexOf(m.id) >= 0) : machines;
    const openOps = ops.filter(o => o.status !== "concluida");
    const process = nt.process || (op && (op.process || op.operacao || "")) || "";
    const taskType = nt.taskType || "Produção";
    const planned = nt.plannedQuantity || (op && op.quantity ? op.quantity : "");
    return `
      <div class="card pad employee-task-form">
        <div class="rowc between mb12">
          <div>
            <div class="small" style="font-weight:700">➕ Criar tarefa</div>
            <div class="tiny dim">A tarefa será adicionada à programação de ${employee ? U.esc(employee.name) : "—"}.</div>
          </div>
          <button class="btn-ghost" data-act="cancel-new-task">Cancelar</button>
        </div>

        <div class="field"><label>Funcionário</label>
          <input value="${employee ? U.esc(employee.name) : "—"}" disabled>
          <div class="tiny dim mt8">Funcionário definido pelo perfil.</div>
        </div>

        <div class="field"><label>OP</label>
          <select id="nt-op">
            <option value="">Selecione uma OP...</option>
            ${openOps.map(o => {
              const od = orders.find(x => x.id === o.orderId);
              return `<option value="${o.id}" ${nt.opId === o.id ? "selected" : ""}>${U.esc(opCode(o))} — ${U.esc(o.product || (od && od.product) || "Produto")} — ${U.fmt(Number(o.quantity)||0)} un.</option>`;
            }).join("")}
          </select>
          ${!openOps.length ? '<p class="tiny dim mt8">Nenhuma OP disponível. Crie a OP primeiro em Ordens de Produção.</p>' : ""}
        </div>

        ${op ? `
          <div class="task-linked-info">
            <div><b>Pedido:</b> ${order ? U.esc(order.number || orderCode(order)) + " — " + U.esc(order.client || "") : "—"}</div>
            <div><b>Produto:</b> ${U.esc(op.product || (order && order.product) || "—")}${op.model ? " — " + U.esc(op.model) : ""}</div>
            ${op.component ? `<div><b>Componente:</b> ${U.esc(op.component)}</div>` : ""}
          </div>` : ""}

        <div class="field"><label>Tipo de tarefa</label>
          <select id="nt-type">
            ${["Produção","Furação","Corte","Montagem","Acabamento","Outra"].map(x => `<option ${taskType === x ? "selected" : ""}>${x}</option>`).join("")}
          </select>
        </div>

        <div class="field-row">
          <div class="field"><label>Processo</label>
            <input id="nt-process" value="${U.esc(process)}" placeholder="Ex.: Wero, Espiral, Smart...">
          </div>
          <div class="field"><label>Máquina</label>
            <select id="nt-machine">
              <option value="">Selecione...</option>
              ${allowedMachines.map(m => `<option value="${m.id}" ${nt.machineId === m.id ? "selected" : ""}>${U.esc(m.name)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="field"><label>Produto</label>
          <select id="nt-product">
            <option value="">Usar produto da OP...</option>
            ${products.map(p => `<option value="${p.id}" ${productId === p.id ? "selected" : ""}>${U.esc(p.name)}</option>`).join("")}
          </select>
        </div>

        ${product && product.hasModels ? `<div class="field"><label>Modelo</label>
          <select id="nt-model">
            <option value="">Selecione...</option>
            ${(product.models||[]).map(mo => `<option value="${U.esc(mo)}" ${nt.model === mo ? "selected" : ""}>${U.esc(mo)}</option>`).join("")}
          </select>
        </div>` : ""}

        <div class="field"><label>Quantidade</label>
          <input type="number" id="nt-planned" min="1" value="${U.esc(String(planned))}" placeholder="Ex.: 5000">
        </div>

        <div class="field"><label>Prioridade</label>
          <select id="nt-priority">
            <option value="baixa" ${nt.priority === "baixa" ? "selected" : ""}>Normal</option>
            <option value="media" ${nt.priority === "media" ? "selected" : ""}>Normal</option>
            <option value="alta" ${nt.priority === "alta" ? "selected" : ""}>Alta</option>
            <option value="urgente" ${nt.priority === "urgente" ? "selected" : ""}>⚡ Urgente</option>
          </select>
        </div>

        <div class="field"><label>Observação</label>
          <textarea id="nt-obs" rows="3" placeholder="Instruções para o funcionário...">${U.esc(nt.observation || "")}</textarea>
        </div>

        <button class="btn btn-primary btn-block mt12" data-act="save-new-task">CRIAR TAREFA</button>
      </div>`;
  }

  async function addTask() {
    if (state._savingTask) return;
    state._savingTask = true;
    try { await doAddTask(); } finally { state._savingTask = false; }
  }

  async function doAddTask() {
    const nt = state.newTask;
    const employee = employees.find(e => e.id === nt.employeeId);
    if (!employee || employee.status !== "ativo") { toast("Funcionário inválido."); return; }
    const op = ops.find(x => x.id === nt.opId);
    if (!op) { toast("Selecione uma OP existente."); return; }
    const order = orders.find(o => o.id === op.orderId) || null;
    const m = machines.find(x => x.id === nt.machineId);
    if (!m) { toast("Selecione a máquina."); return; }
    if ((employee.allowedMachines || []).length && !employee.allowedMachines.includes(m.id)) {
      toast("Esse funcionário não tem permissão para operar essa máquina."); return;
    }
    const opProductName = op.product || (order && order.product) || "";
    const product = products.find(p => p.id === (nt.productId || op.productId)) || null;
    const productName = product ? product.name : opProductName;
    if (!productName) { toast("A OP não possui produto definido."); return; }
    if (product && product.hasModels && !nt.model && !op.model) { toast("Selecione o modelo."); return; }
    const planned = Number(nt.plannedQuantity) || Number(op.quantity) || 0;
    if (planned <= 0) { toast("Informe uma quantidade maior que zero."); return; }

    const employeeTasks = productionOrders.filter(p => p.employeeId === employee.id && !["finalizada","concluida","cancelada"].includes(p.status));
    const maxPos = employeeTasks.reduce((mx,p) => Math.max(mx, Number(p.queuePosition)||0), 0);
    const isUrgent = nt.priority === "urgente";
    const now = Date.now();
    const process = (nt.process || op.process || op.operacao || "").trim();
    const task = {
      orderId: op.orderId || "",
      opId: op.id,
      machineId: m.id,
      machineName: m.name,
      employeeId: employee.id,
      employeeName: employee.name,
      productId: product ? product.id : (op.productId || ""),
      product: productName,
      model: nt.model || op.model || "",
      taskType: nt.taskType || "Produção",
      process: process,
      operacao: op.operacao || "producao",
      plannedQuantity: planned,
      estimatedMinutes: Number(nt.estimatedMinutes) || Number(op.estimatedMinutes) || 0,
      priority: isUrgent ? "urgente" : (nt.priority || "media"),
      observation: (nt.observation || "").trim(),
      queuePosition: isUrgent ? maxPos + 1 : maxPos + 1,
      status: "aguardando",
      quantityProduced: 0,
      defects: 0,
      startedAt: null,
      pausedAt: null,
      pausedSeconds: 0,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    try {
      const saved = await S.add("productionOrders", task);
      if (isUrgent) {
        await S.update("productionOrders", saved.id, { priority: "urgente", queuePosition: maxPos + 1 });
      }
      state.newTaskForm = false;
      state.newTask = freshTaskDraft();
      toast("Tarefa criada na programação");
      renderView();
    } catch (e) { toast(errMsg(e)); }
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
          ${componentsEditor(d.components, p.id)}
          <button class="btn btn-primary btn-block mt12" data-act="save-prod" data-id="${p.id}">Salvar produto</button>
        </div>`;
    }
    const comps = p.components || [];
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(p.name)}</div>
            <div class="tiny dim">${p.hasModels ? "Modelos de furação" : "Sem modelos"}${comps.length ? " · " + comps.length + " componente(s)" : ""}</div>
          </div>
          <button class="btn-ghost" data-act="edit-prod" data-id="${p.id}">Editar</button>
        </div>
        ${p.hasModels && (p.models || []).length ? `
          <div class="flex mt12" style="gap:6px;flex-wrap:wrap">
            ${p.models.map(mo => `<span class="chip">${U.esc(mo)}</span>`).join("")}
          </div>` : ""}
        <div class="kv mt12"><b>Capacidade nominal:</b> ${p.capacityDay ? U.fmt(p.capacityDay) + " un./dia" : "—"}</div>
        <div class="kv"><b>Máx. defeito:</b> ${U.fmt(p.maxDefectRate === undefined ? 1 : p.maxDefectRate, 2)}%</div>
        ${comps.length ? `
          <div class="mt12">
            <div class="tiny dim mb8"><b>Componentes (ficha técnica):</b></div>
            <div class="space-y3">
              ${comps.map(c => `
                <div class="kv" style="background:var(--panel);border-radius:8px;padding:8px">
                  <b>${U.esc(c.name)}</b>${c.generatesOP ? ' <span class="pill auto">Gera OP</span>' : ""}
                  ${c.description ? `<div class="tiny dim">${U.esc(c.description)}</div>` : ""}
                </div>`).join("")}
            </div>
          </div>` : ""}
      </div>`;
  }

  /* Editor de componentes reaproveitado no formulário de novo produto
     e na edição — lista simples com adicionar/remover linha. Cada
     componente tem: nome, descrição e se gera OP própria (sim/não). */
  function componentsEditor(components, scopeId) {
    const list = components || [];
    const scope = scopeId ? String(scopeId) : "new";
    return `
      <div class="mt12" data-comp-scope="${scope}">
        <label>Componentes do produto (ficha técnica)</label>
        <div class="space-y3 mt8">
          ${list.map((c, i) => `
            <div class="card pad" style="background:var(--panel)">
              <div class="rowc between mb8">
                <span class="tiny dim">Componente ${i + 1}</span>
                <button type="button" class="btn-ghost" data-act="remove-component" data-scope="${scope}" data-idx="${i}">Remover</button>
              </div>
              <div class="field"><label>Nome do componente</label><input data-comp-field="name" data-scope="${scope}" data-idx="${i}" value="${U.esc(c.name)}" placeholder="Ex.: Capa"></div>
              <div class="field mt8"><label>Descrição</label><input data-comp-field="description" data-scope="${scope}" data-idx="${i}" value="${U.esc(c.description)}" placeholder="Opcional"></div>
              <label class="check-row mt8"><input type="checkbox" data-comp-field="generatesOP" data-scope="${scope}" data-idx="${i}" ${c.generatesOP ? "checked" : ""}> Gera OP própria</label>
            </div>`).join("") || '<div class="empty tiny">Nenhum componente adicionado.</div>'}
        </div>
        <button type="button" class="btn-ghost mt8" data-act="add-component" data-scope="${scope}">+ Adicionar componente</button>
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
        ${componentsEditor(state.newProduct.components, "new")}
        <button class="btn btn-primary btn-block mt12" data-act="save-new-prod">Adicionar produto</button>
      </div>`;
  }

  /* ========== FUNCIONÁRIOS ========== */
  function renderFuncionarios(v) {
    v.innerHTML = `
      <div class="card pad employee-program-header">
        <div class="rowc between">
          <div>
            <div class="small" style="font-weight:700">👷 Funcionários</div>
            <div class="tiny dim">Abra um funcionário para ver a programação individual, produção e histórico.</div>
          </div>
          ${state.newEmployeeForm ? "" : `<button class="btn btn-primary" data-act="new-employee">+ Novo Funcionário</button>`}
        </div>
      </div>
      <div class="employee-grid mt12">
        ${employees.length ? employees.map(employeeCard).join("") : '<div class="empty">Nenhum funcionário cadastrado.</div>'}
      </div>
      ${state.newEmployeeForm ? newEmployeeFormHTML() : ""}`;
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
          <div class="employee-photo-editor">
            <div class="employee-avatar large">${d.photoData ? `<img src="${U.esc(d.photoData)}" alt="Foto de ${U.esc(d.name)}">` : U.icon("user", "lg")}</div>
            <div class="employee-photo-actions">
              <label class="btn btn-outline photo-upload-label">📷 Alterar foto<input type="file" accept="image/*" data-emp-photo="${em.id}" hidden></label>
              ${d.photoData ? '<button type="button" class="btn-ghost" data-act="remove-emp-photo" data-id="'+em.id+'">Remover foto</button>' : ''}
              <div class="tiny dim">JPG/PNG · será reduzida automaticamente.</div>
            </div>
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
    const empState = employeeComputedStatus(em.id);
    const empStateLabel = empState === "producao" ? "🟢 Em produção" : empState === "pausado" ? "🟡 Pausado" : "⚪ Livre";
    const perms = (em.allowedMachines || []).map(mid => {
      const m = machines.find(x => x.id === mid);
      return m ? m.name : null;
    }).filter(Boolean);
    return `
      <div class="card pad employee-card-click" data-act="open-emp-detail" data-id="${em.id}">
        <div class="rowc">
          <div class="employee-avatar">${em.photoData ? `<img src="${U.esc(em.photoData)}" alt="Foto de ${U.esc(em.name)}">` : U.icon("user", "sm")}</div>
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(em.name)}</div>
            <div class="tiny dim">${U.esc(em.role || "—")}</div>
          </div>
          <span class="pill ${active ? "produzindo" : "parada"}">${active ? "Ativo" : "Inativo"}</span>
          <span class="pill ${empState === "producao" ? "produzindo" : empState === "pausado" ? "pausa" : "auto"}">${empStateLabel}</span>
          <button class="btn-ghost" data-act="edit-emp" data-id="${em.id}" onclick="event.stopPropagation()">Editar</button>
        </div>
        <div class="kv mt12"><b>Máquinas permitidas:</b> ${perms.length ? U.esc(perms.join(", ")) : "nenhuma"}</div>
        <div class="rowc mt12" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" data-act="open-emp-detail" data-id="${em.id}">📋 Abrir programação</button>
          <button class="btn-ghost" data-act="toggle-emp-status" data-id="${em.id}" onclick="event.stopPropagation()">${active ? "Desativar" : "Ativar"}</button>
        </div>
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
        <div class="employee-photo-editor">
          <div class="employee-avatar large">${ne.photoData ? `<img src="${U.esc(ne.photoData)}" alt="Foto do funcionário">` : U.icon("user", "lg")}</div>
          <div class="employee-photo-actions">
            <label class="btn btn-outline photo-upload-label">📷 Escolher foto<input type="file" accept="image/*" id="ne-photo" hidden></label>
            ${ne.photoData ? '<button type="button" class="btn-ghost" data-act="remove-new-emp-photo">Remover foto</button>' : ''}
            <div class="tiny dim">JPG/PNG · será reduzida automaticamente.</div>
          </div>
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
        <div class="section-label" style="margin-top:0">${U.icon("package", "sm")} Dados de demonstração (Etapa 8)</div>
        <p class="tiny dim mb12">Cria, sem apagar nada, o cenário do teste do fluxo: <b>Pedido 1254</b> (30.000 cadernos), <b>OP 21234</b> (10.000), funcionário <b>Ronaldo</b> (Automática 1, 5.000) e <b>Roque</b> (Automática 2, 5.000). Itens já existentes são mantidos.</p>
        <button class="btn btn-outline btn-block" data-act="load-demo">Carregar dados de demonstração</button>
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
    /* Componentes (ficha técnica): campos dinâmicos por escopo
       ("new" = novo produto; id do produto = edição). Não dispara
       renderView() a cada tecla, só grava no estado — igual ao
       restante do formulário. */
    document.querySelectorAll("[data-comp-field]").forEach(el => {
      const scope = el.getAttribute("data-scope");
      const idx = Number(el.getAttribute("data-idx"));
      const field = el.getAttribute("data-comp-field");
      const target = scope === "new" ? state.newProduct : state.draftProduct[scope];
      if (!target || !target.components || !target.components[idx]) return;
      const ev = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, () => {
        target.components[idx][field] = el.type === "checkbox" ? el.checked : el.value;
      });
    });

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
    ["no-client", "no-number", "no-product", "no-model", "no-quantity", "no-type"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const k = id.replace("no-", "");
      const ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => { state.newOrder[k] = el.value; });
    });
    /* ---- Nova Ordem de Produção (OP) ---- */
    const nopOrder = document.getElementById("nop-order");
    if (nopOrder) nopOrder.addEventListener("change", () => {
      state.newOP.orderId = nopOrder.value;
      /* Ao escolher o pedido, pré-preenche produto/modelo da OP com os
         dados do pedido — o gestor ainda pode editar livremente. */
      const picked = orders.find(x => x.id === nopOrder.value);
      if (picked && !String(state.newOP.product || "").trim()) state.newOP.product = picked.product || "";
      if (picked && !String(state.newOP.model || "").trim()) state.newOP.model = picked.model || "";
      /* CORREÇÃO: trocar de pedido invalida a seleção de produto da
         ficha técnica e os componentes marcados do pedido anterior. */
      state.newOP.fichaProductId = "";
      state.newOP.selectedComponents = [];
      renderView();
    });
    const nopFichaProduct = document.getElementById("nop-ficha-product");
    if (nopFichaProduct) nopFichaProduct.addEventListener("change", () => {
      state.newOP.fichaProductId = nopFichaProduct.value;
      /* Trocar o produto da ficha técnica invalida a seleção anterior
         de componentes (podem não existir no novo produto). */
      state.newOP.selectedComponents = [];
      renderView();
    });
    const nopProduct = document.getElementById("nop-product");
    if (nopProduct) nopProduct.addEventListener("input", () => { state.newOP.product = nopProduct.value; });
    const nopModel = document.getElementById("nop-model");
    if (nopModel) nopModel.addEventListener("input", () => { state.newOP.model = nopModel.value; });
    const nopNumber = document.getElementById("nop-number");
    if (nopNumber) {
      nopNumber.addEventListener("input", () => {
        state.newOP.number = nopNumber.value;
        const errEl = document.getElementById("nop-number-err");
        if (errEl) {
          const numero = String(nopNumber.value).trim();
          const orderId = state.newOP.orderId;
          /* Mesmo número pode repetir dentro do MESMO pedido (uma OP por
             componente da ficha técnica) — só é duplicado de verdade se
             pertencer a outro pedido, ou se já existir uma OP sem
             componente com esse número neste pedido. */
          const dup = numero !== "" && ops.some(x => String(x.number || "").trim() === numero &&
            (x.orderId !== orderId || !x.component));
          errEl.style.color = dup ? "var(--danger)" : "";
          errEl.textContent = dup
            ? "Este número já está em uso. Informe outro número."
            : "Cada número é único por pedido — o sistema impede duplicar.";
        }
      });
    }
    const nopSector = document.getElementById("nop-sector");
    if (nopSector) nopSector.addEventListener("change", () => { state.newOP.sector = nopSector.value; });
    const nopDue = document.getElementById("nop-due");
    if (nopDue) nopDue.addEventListener("change", () => { state.newOP.dueDate = nopDue.value; });
    const nopQty = document.getElementById("nop-quantity");
    if (nopQty) nopQty.addEventListener("input", () => { state.newOP.quantity = nopQty.value; });
    const nopPriority = document.getElementById("nop-priority");
    if (nopPriority) nopPriority.addEventListener("change", () => { state.newOP.priority = nopPriority.value; });

    /* ---- Nova Tarefa: formulário fica exclusivamente no perfil do funcionário. ---- */
    const ntOp = document.getElementById("nt-op");
    if (ntOp) ntOp.addEventListener("change", () => {
      state.newTask.opId = ntOp.value;
      const op = ops.find(o=>o.id===ntOp.value);
      if (op) {
        state.newTask.orderId = op.orderId || "";
        state.newTask.productId = op.productId || "";
        state.newTask.model = op.model || "";
        state.newTask.process = op.process || op.operacao || "";
        if (!state.newTask.plannedQuantity) state.newTask.plannedQuantity = op.quantity || "";
      }
      renderView();
    });
    const ntType = document.getElementById("nt-type");
    if (ntType) ntType.addEventListener("change",()=>{state.newTask.taskType=ntType.value;});
    const ntProcess = document.getElementById("nt-process");
    if (ntProcess) ntProcess.addEventListener("input",()=>{state.newTask.process=ntProcess.value;});
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
    const ntPlanned = document.getElementById("nt-planned");
    if (ntPlanned) ntPlanned.addEventListener("input", () => { state.newTask.plannedQuantity = ntPlanned.value; });
    const ntEst = document.getElementById("nt-est");
    if (ntEst) ntEst.addEventListener("input", () => { state.newTask.estimatedMinutes = ntEst.value; });
    const ntPriority = document.getElementById("nt-priority");
    if (ntPriority) ntPriority.addEventListener("change", () => { state.newTask.priority = ntPriority.value; });
    const ntObs = document.getElementById("nt-obs");
    if (ntObs) ntObs.addEventListener("input", () => { state.newTask.observation = ntObs.value; });

    /* ---- Estoque ---- */
    [["st-material","materialId"],["st-type","type"],["st-from","dateFrom"],["st-to","dateTo"],["st-order","orderId"]].forEach(([id,k])=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener("change",()=>{ state.stock[k]=el.value; renderView(); });
    });
    [["sm-name","name"],["sm-min","minStock"],["sm-product","productId"]].forEach(([id,k])=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener("input",()=>{ state.newMaterial[k]=el.value; });
    });
    [["mv-material","materialId"],["mv-qty","quantity"],["mv-date","date"],["mv-type","type"],["mv-order","orderId"],["mv-obs","observation"]].forEach(([id,k])=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{ state.newMovement[k]=el.value; });
    });
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
    const components = (d.components || [])
      .map(c => ({ name: (c.name || "").trim(), description: (c.description || "").trim(), generatesOP: !!c.generatesOP }))
      .filter(c => c.name);
    const patch = {
      name: (d.name || "").trim() || orig.name,
      hasModels: !!d.hasModels,
      models: models,
      capacityDay: Number(d.capacityDay) || 0,
      capacityHour: Number(d.capacityHour) || (orig.capacityHour || 0),
      maxDefectRate: Number(d.maxDefectRate) > 0 ? Number(d.maxDefectRate) : 1,
      components: components
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
    const components = (state.newProduct.components || [])
      .map(c => ({ name: (c.name || "").trim(), description: (c.description || "").trim(), generatesOP: !!c.generatesOP }))
      .filter(c => c.name);
    try {
      await S.add("products", {
        name, hasModels: state.newProduct.hasModels, models,
        capacityHour: 0, capacityDay: 0, maxDefectRate: Number(config.defectLimit) || 1,
        components: components
      });
      state.newProduct = { name: "", hasModels: false, modelsText: "", components: [] };
      state.newProductForm = false;
      toast("Produto adicionado");
      renderView();
    } catch (e) {
      toast(errMsg(e));
    }
  }

  /* ========== DETALHE DO FUNCIONÁRIO ========== */
  /* Toda a produção de um funcionário vem do histórico de apontamentos
     (coleção "productions"), gravado pela tela do operador — é o único
     lugar com employeeId + quantidade + horas + defeitos por lançamento.
     productionOrderId liga cada apontamento à Tarefa/OP correspondente. */
  function employeeProductions(employeeId) {
    return productions.filter(p => p.employeeId === employeeId)
      .slice().sort((a, b) => String(b.date + (b.createdAt || 0)).localeCompare(String(a.date + (a.createdAt || 0))));
  }

  function employeeStats(employeeId) {
    const rows = employeeProductions(employeeId);
    const total = rows.reduce((s, r) => s + (Number(r.quantityProduced) || 0), 0);
    const defects = rows.reduce((s, r) => s + (Number(r.defects) || 0), 0);
    const hours = rows.reduce((s, r) => s + (Number(r.productionHours) || 0), 0);
    const days = [...new Set(rows.map(r => r.date).filter(Boolean))];
    const products = [...new Set(rows.map(r => r.productName).filter(Boolean))];
    const withHours = rows.filter(r => (Number(r.productionHours) || 0) > 0);
    const best = withHours.reduce((m, r) => Math.max(m, Number(r.perHour) || 0), 0);
    const worst = withHours.length ? withHours.reduce((m, r) => Math.min(m, Number(r.perHour) || 0), Infinity) : 0;
    return {
      rows, total, defects, hours,
      dayCount: days.length,
      productCount: products.length,
      avgDay: days.length ? total / days.length : 0,
      avgHour: hours > 0 ? total / hours : 0,
      best, worst: worst === Infinity ? 0 : worst
    };
  }

  /* Ranking de todos os funcionários ativos pela média de produção/hora,
     do maior para o menor — usado para mostrar a posição do funcionário. */
  function employeeRanking() {
    return employees
      .map(em => ({ id: em.id, name: em.name, avgHour: employeeStats(em.id).avgHour }))
      .filter(x => x.avgHour > 0)
      .sort((a, b) => b.avgHour - a.avgHour);
  }

  /* Tarefa em aberto do funcionário (dá "OP atual" e "máquina atual"). */
  function taskIsOpen(po) {
    return po && !["finalizada","concluida","cancelada"].includes(po.status);
  }
  function taskStatusLabel(po) {
    const s = po && po.status;
    return s === "em_producao" ? "Em andamento" :
      (s === "pausa" ? "Pausada" : s === "finalizada" || s === "concluida" ? "Concluída" : s === "cancelada" ? "Cancelada" : "Pendente");
  }
  function taskPriorityLabel(po) {
    return po && po.priority === "urgente" ? "⚡ URGENTE" :
      po && po.priority === "alta" ? "Alta" : "Normal";
  }
  function employeeQueue(employeeId) {
    return productionOrders.filter(po => po.employeeId === employeeId && taskIsOpen(po))
      .slice().sort((a,b) => (Number(a.queuePosition)||0) - (Number(b.queuePosition)||0) || (a.createdAt||0)-(b.createdAt||0));
  }
  function currentTaskForEmployee(employeeId) {
    return productionOrders
      .filter(po => po.employeeId === employeeId && (po.status === "em_producao" || po.status === "pausa"))
      .sort((a,b) => (Number(a.queuePosition)||0)-(Number(b.queuePosition)||0))[0] || null;
  }
  function employeeOpenTasks(employeeId) {
    return employeeQueue(employeeId);
  }
  function employeeComputedStatus(employeeId) {
    const t = currentTaskForEmployee(employeeId);
    return t ? (t.status === "pausa" ? "pausado" : "producao") : "livre";
  }
  async function ensureNextEmployeeTask(employeeId) {
    const current = currentTaskForEmployee(employeeId);
    if (current) return current;
    const next = employeeQueue(employeeId)[0];
    if (!next) return null;
    await FluxoProducao.iniciarTarefa({taskId: next.id});
    return next;
  }
  async function employeeStartTask(id) {
    try {
      const t = productionOrders.find(x=>x.id===id);
      if (!t) return;
      const current = currentTaskForEmployee(t.employeeId);
      if (current && current.id !== t.id) { toast("Já existe uma tarefa em andamento para este funcionário."); return; }
      await FluxoProducao.iniciarTarefa({taskId:id});
      toast("Tarefa iniciada");
    } catch(e) { toast(errMsg(e)); }
    renderView();
  }
  async function employeePauseTask(id) {
    try { await FluxoProducao.pausarTarefa({taskId:id}); toast("Tarefa pausada"); }
    catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeeResumeTask(id) {
    try { await FluxoProducao.retomarTarefa({taskId:id}); toast("Tarefa retomada"); }
    catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeePartialProduction(id) {
    const q = Number(prompt("Quantidade produzida agora:","")) || 0;
    if (q <= 0) return;
    const d = Number(prompt("Perdas/refugos (opcional):","0")) || 0;
    try {
      const res = await FluxoProducao.registrarProducaoParcial({taskId:id, qty:q, defects:d});
      toast(res && res.concluida ? "Produção registrada e tarefa concluída." : "Produção parcial registrada.");
    } catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeeFinishTask(id) {
    const t = productionOrders.find(x=>x.id===id);
    if (!t) return;
    const remaining = Math.max(0, Number(t.plannedQuantity||0) - Number(t.quantityProduced||0));
    const q = Number(prompt("Quantidade final produzida agora:", String(remaining || ""))) || 0;
    if (q <= 0) return;
    const d = Number(prompt("Perdas/refugos (opcional):","0")) || 0;
    try {
      const res = await FluxoProducao.finalizarTarefa({taskId:id, qty:q, defects:d});
      toast("Tarefa concluída");
    } catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeeMakeNext(id) {
    try {
      const t=productionOrders.find(x=>x.id===id); if(!t) return;
      await FluxoProducao.colocarComoProxima({taskId:id});
      toast("Tarefa colocada como próxima");
    } catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeeStartUrgentNow(id) {
    try {
      await FluxoProducao.iniciarUrgenteAgora({taskId:id});
      toast("Urgente iniciada agora; tarefa anterior foi pausada.");
    } catch(e){ toast(errMsg(e)); }
    renderView();
  }
  async function employeeCancelTask(id) {
    try { await S.update("productionOrders",id,{status:"cancelada",finishedAt:Date.now(),updatedAt:Date.now()}); toast("Tarefa cancelada"); }
    catch(e){ toast(errMsg(e)); }
    renderView();
  }

  function renderFuncionarioDetalhe(v) {
    const em = employees.find(e => e.id === state.selectedEmployeeId);
    if (!em) { v.innerHTML = `<div class="empty">Funcionário não encontrado.</div><button class="btn-ghost mt12" data-go="funcionarios">← Voltar para Funcionários</button>`; return; }
    const st = employeeStats(em.id);
    const queue = employeeQueue(em.id);
    const current = currentTaskForEmployee(em.id);
    const status = employeeComputedStatus(em.id);
    const statusText = status === "producao" ? "🟢 Em produção" : status === "pausado" ? "🟡 Pausado" : "⚪ Livre";
    const taskCard = (po, idx) => {
      const planned = Number(po.plannedQuantity)||0, produced=Number(po.quantityProduced)||0;
      const rem=Math.max(0,planned-produced), pct=planned?Math.min(100,produced/planned*100):0;
      const op=po.opId?ops.find(o=>o.id===po.opId):null, order=po.orderId?orders.find(o=>o.id===po.orderId):null;
      const isCurrent = po.id === (current && current.id);
      const urgent = po.priority === "urgente";
      return `<div class="card pad employee-task-card ${urgent ? "urgent-task" : ""}">
        <div class="rowc between">
          <div class="f1">
            <div class="small" style="font-weight:700">${isCurrent ? "🔄 EM ANDAMENTO" : idx===0 && !current ? "⏳ PRÓXIMA" : "⏳ NA FILA"}</div>
            <div class="task-op-title">${op ? U.esc(opCode(op)) : "Tarefa sem OP"}</div>
            <div class="tiny dim">${U.esc(po.product||"—")}${po.model ? " — "+U.esc(po.model) : ""}</div>
          </div>
          <span class="pill ${urgent ? "parada" : isCurrent ? "produzindo" : "auto"}">${taskPriorityLabel(po)}</span>
        </div>
        <div class="task-meta-grid">
          <div><span>Processo</span><b>${U.esc(po.process || po.operacao || "—")}</b></div>
          <div><span>Máquina</span><b>${U.esc(po.machineName || "—")}</b></div>
          <div><span>Quantidade</span><b>${U.fmt(planned)} un.</b></div>
          <div><span>Produzido</span><b>${U.fmt(produced)} / ${U.fmt(planned)}</b></div>
          <div><span>Restante</span><b>${U.fmt(rem)} un.</b></div>
          <div><span>Pedido</span><b>${order ? U.esc(order.number || orderCode(order)) : "—"}</b></div>
        </div>
        ${planned ? `<div class="tick-row mt8"><div class="tick-fill ${pct>=100?"ok":""}" style="width:${pct}%"></div></div>` : ""}
        ${po.observation ? `<div class="tiny dim mt8">Obs.: ${U.esc(po.observation)}</div>` : ""}
        <div class="rowc mt12" style="gap:8px;flex-wrap:wrap">
          ${po.status === "aguardando" ? `<button class="btn btn-primary" data-act="emp-start-task" data-id="${po.id}">▶ Iniciar</button>` : ""}
          ${po.status === "em_producao" ? `<button class="btn btn-outline" data-act="emp-pause-task" data-id="${po.id}">⏸ Pausar</button><button class="btn btn-outline" data-act="emp-partial" data-id="${po.id}">＋ Registrar produção</button>` : ""}
          ${po.status === "pausa" ? `<button class="btn btn-primary" data-act="emp-resume-task" data-id="${po.id}">▶ Retomar</button>` : ""}
          ${po.status === "em_producao" || po.status === "pausa" ? `<button class="btn btn-primary" data-act="emp-finish-task" data-id="${po.id}">✓ Concluir</button>` : ""}
          ${!isCurrent && po.status === "aguardando" ? `<button class="btn-ghost" data-act="emp-start-urgent" data-id="${po.id}">⚡ Iniciar urgente agora</button>` : ""}
          ${!isCurrent && po.status === "aguardando" ? `<button class="btn-ghost" data-act="emp-next" data-id="${po.id}">Colocar como próxima</button>` : ""}
        </div>
      </div>`;
    };
    const hist = productionOrders.filter(p=>p.employeeId===em.id && ["finalizada","concluida","cancelada"].includes(p.status))
      .sort((a,b)=>(b.finishedAt||b.createdAt||0)-(a.finishedAt||a.createdAt||0));

    const days14=[]; for(let i=13;i>=0;i--) days14.push(addDaysDS(U.todayStr(),-i));
    const seriesDaily=days14.map(d=>st.rows.filter(r=>r.date===d).reduce((s,r)=>s+(Number(r.quantityProduced)||0),0));
    const dayLbls14=days14.map(d=>U.fmtDate(d).slice(0,5));
    v.innerHTML=`
      <button class="btn-ghost mb12" data-go="funcionarios">← Voltar para Funcionários</button>
      <div class="card pad employee-profile-head">
        <div class="rowc">
          <div class="employee-avatar large">${em.photoData?`<img src="${U.esc(em.photoData)}" alt="Foto de ${U.esc(em.name)}">`:U.icon("user","lg")}</div>
          <div class="f1">
            <div class="small" style="font-weight:800;font-size:19px">${U.esc(em.name)}</div>
            <div class="tiny dim">${U.esc(em.role||"—")}${em.sector?" · "+U.esc(em.sector):""}</div>
            <div class="mt8"><span class="pill ${status==="producao"?"produzindo":status==="pausado"?"pausa":"auto"}">${statusText}</span></div>
          </div>
          <button class="btn btn-primary" data-act="new-task-for-employee" data-id="${em.id}">➕ CRIAR TAREFA</button>
        </div>
        <div class="grid3 mt12">
          <div class="kv"><b>Máquina/setor:</b> ${current?U.esc(current.machineName||"—"):"—"}</div>
          <div class="kv"><b>Tarefa atual:</b> ${current?U.esc(opCode(ops.find(o=>o.id===current.opId)||{})):"Nenhuma"}</div>
          <div class="kv"><b>Produção atual:</b> ${current?U.fmt(current.quantityProduced||0)+" / "+U.fmt(current.plannedQuantity||0):"—"}</div>
        </div>
      </div>

      ${state.newTaskForm ? newTaskForm() : ""}

      <p class="section-label mt12">📋 PROGRAMAÇÃO</p>
      <div class="space-y3">
        ${queue.length ? queue.map(taskCard).join("") : '<div class="empty">Nenhuma tarefa na programação.</div>'}
      </div>

      <p class="section-label mt12">📊 HISTÓRICO</p>
      <div class="card pad">
        ${hist.length ? `<div class="card tbl-wrap"><table><thead><tr><th>OP</th><th>Produto</th><th>Processo</th><th>Qtd.</th><th>Produção</th><th>Perdas</th><th>Concluída</th></tr></thead><tbody>
        ${hist.map(po=>{const op=po.opId?ops.find(o=>o.id===po.opId):null;return `<tr><td>${op?U.esc(opCode(op)):"—"}</td><td>${U.esc(po.product||"—")}</td><td>${U.esc(po.process||po.operacao||"—")}</td><td>${U.fmt(po.plannedQuantity||0)}</td><td>${U.fmt(po.quantityProduced||0)}</td><td>${U.fmt(po.defects||0)}</td><td>${po.finishedAt?new Date(po.finishedAt).toLocaleString("pt-BR"):"—"}</td></tr>`}).join("")}
        </tbody></table></div>` : '<div class="empty">Nenhuma tarefa concluída anteriormente.</div>'}
      </div>

      <div class="grid-cards mt12">
        <div class="card stat"><div class="lbl">Quantidade total</div><div class="val amb">${U.fmt(st.total)}<em>un.</em></div></div>
        <div class="card stat"><div class="lbl">Média diária</div><div class="val">${U.fmt(st.avgDay)}<em>un.</em></div></div>
        <div class="card stat"><div class="lbl">Média hora</div><div class="val">${U.fmt(st.avgHour,1)}<em>un./h</em></div></div>
        <div class="card stat"><div class="lbl">Dias trabalhados</div><div class="val">${U.fmt(st.dayCount)}</div></div>
      </div>`;
  }

  /* ========== PRODUTIVIDADE E RANKING GERENCIAL (ETAPA 6) ==========
     Visão gerencial que cruza dados já existentes de `productions`
     (apontamentos), `employees`, `products`, `machines` e `ops` — não
     cria nenhuma coleção nova nem duplica dados.

     "Setor": o cadastro não tem um campo próprio de setor por máquina ou
     por funcionário (só existe `config.sector`, um texto único da
     fábrica toda). Para o filtro/análise por setor pedido nesta etapa,
     reaproveitamos o campo `machine.type` (automatica/escanteadeira/
     manual), que já agrupa fisicamente as máquinas — sem inventar dado
     novo.

     "Eficiência": em vez de reusar a eficiência do Painel Indústria 4.0
     (que compara com a meta diária da fábrica — não faz sentido por
     funcionário/produto/setor), a Produtividade calcula performance
     real vs. a capacidade/hora já cadastrada em Produtos ou Máquinas
     (`capacityHour`). Quando nada está cadastrado, mostramos "—" em vez
     de inventar um número. */
  const SETOR_LABELS = { automatica: "Automáticas", escanteadeira: "Escanteadeira", manual: "Manuais" };
  function setorLabel(type) { return SETOR_LABELS[type] || (type ? type : "Sem setor"); }
  function setorOfMachine(machineId) {
    const m = machines.find(x => x.id === machineId);
    return m ? (m.type || "") : "";
  }

  function produtDateRange() {
    const f = state.produt;
    const today = U.todayStr();
    if (f.periodo === "hoje") return { from: today, to: today };
    if (f.periodo === "30d") return { from: addDaysDS(today, -29), to: today };
    if (f.periodo === "custom") return { from: f.dateFrom || today, to: f.dateTo || today };
    return { from: addDaysDS(today, -6), to: today }; // "7d" (padrão)
  }

  function produtRows() {
    const f = state.produt;
    const { from, to } = produtDateRange();
    return productions.filter(p => {
      if (!p.date || p.date < from || p.date > to) return false;
      if (f.productName && (p.productName || "—") !== f.productName) return false;
      if (f.employeeKey) {
        const key = p.employeeId ? p.employeeId : "txt:" + (p.operator || "").trim().toLowerCase();
        if (key !== f.employeeKey) return false;
      }
      if (f.setor && setorOfMachine(p.machineId) !== f.setor) return false;
      return true;
    });
  }

  /* Capacidade/hora "esperada" para o lançamento: prioriza o produto,
     depois a máquina usada — ambos campos já existentes no cadastro. */
  function expectedRateFor(row) {
    const prod = (row.productId && products.find(p => p.id === row.productId)) ||
      products.find(p => p.name === row.productName);
    if (prod && Number(prod.capacityHour) > 0) return Number(prod.capacityHour);
    const m = machines.find(x => x.id === row.machineId);
    if (m && Number(m.capacityHour) > 0) return Number(m.capacityHour);
    return 0;
  }

  /* Eficiência de um conjunto de lançamentos: produzido real vs. o que
     seria esperado (capacidade cadastrada × horas trabalhadas). Retorna
     null quando nenhum item do conjunto tem capacidade cadastrada. */
  function produtEfficiency(rows) {
    let qty = 0, expected = 0, hasCap = false;
    rows.forEach(r => {
      const h = Number(r.productionHours) || 0;
      const cap = expectedRateFor(r);
      qty += Number(r.quantityProduced) || 0;
      if (cap > 0 && h > 0) { expected += cap * h; hasCap = true; }
    });
    if (!hasCap || expected <= 0) return null;
    return qty / expected * 100;
  }

  function produtEffHTML(pct) {
    if (pct === null || pct === undefined) return "—";
    const col = pct >= 90 ? "var(--ok)" : (pct >= 70 ? "var(--amber2)" : "var(--danger)");
    return `<b style="color:${col}">${U.fmt(pct, 1)}%</b>`;
  }

  function produtSummary(rows) {
    const total = rows.reduce((s, r) => s + (Number(r.quantityProduced) || 0), 0);
    const defects = rows.reduce((s, r) => s + (Number(r.defects) || 0), 0);
    const hours = rows.reduce((s, r) => s + (Number(r.productionHours) || 0), 0);
    const participants = new Set(rows.filter(r => (Number(r.quantityProduced) || 0) > 0)
      .map(r => r.employeeId ? r.employeeId : "txt:" + (r.operator || "").trim().toLowerCase()));
    return { total, defects, hours, perHour: hours > 0 ? total / hours : 0, activeCount: participants.size };
  }

  /* Agrupamento por funcionário (chave employeeId, ou o texto do
     operador quando o apontamento é antigo e não tem employeeId). */
  function produtByEmployee(rows) {
    const map = {};
    rows.forEach(r => {
      const key = r.employeeId ? r.employeeId : "txt:" + (r.operator || "").trim().toLowerCase();
      if (!map[key]) {
        const em = r.employeeId ? employees.find(e => e.id === r.employeeId) : null;
        map[key] = {
          key, employeeId: r.employeeId || "", em,
          name: em ? em.name : ((r.operator || "").trim() || "—"),
          rows: [], setores: {}
        };
      }
      map[key].rows.push(r);
      const s = setorOfMachine(r.machineId);
      if (s) map[key].setores[s] = (map[key].setores[s] || 0) + 1;
    });
    return Object.values(map).map(x => {
      const st = produtSummary(x.rows);
      const topSetor = Object.entries(x.setores).sort((a, b) => b[1] - a[1])[0];
      return {
        key: x.key, employeeId: x.employeeId, em: x.em, name: x.name,
        setor: topSetor ? setorLabel(topSetor[0]) : "—",
        total: st.total, defects: st.defects, hours: st.hours,
        perHour: st.perHour, efficiency: produtEfficiency(x.rows)
      };
    }).sort((a, b) => b.perHour - a.perHour);
  }

  function produtByProduct(rows) {
    const map = {};
    rows.forEach(r => {
      const name = r.productName || "—";
      if (!map[name]) map[name] = { name, rows: [] };
      map[name].rows.push(r);
    });
    return Object.values(map).map(x => {
      const st = produtSummary(x.rows);
      const withHours = x.rows.filter(r => (Number(r.productionHours) || 0) > 0);
      const avgTime = withHours.length ? withHours.reduce((s, r) => s + Number(r.productionHours), 0) / withHours.length : 0;
      const employeesInvolved = new Set(x.rows.map(r => r.employeeId ? r.employeeId : "txt:" + (r.operator || "").trim().toLowerCase()));
      return {
        name: x.name, total: st.total, employeesCount: employeesInvolved.size,
        avgTime, perHour: st.perHour, defects: st.defects, efficiency: produtEfficiency(x.rows)
      };
    }).sort((a, b) => b.total - a.total);
  }

  function produtBySetor(rows) {
    const map = {};
    rows.forEach(r => {
      const type = setorOfMachine(r.machineId) || "outro";
      if (!map[type]) map[type] = { type, rows: [], machineIds: new Set() };
      map[type].rows.push(r);
      if (r.machineId) map[type].machineIds.add(r.machineId);
    });
    return Object.values(map).map(x => {
      const st = produtSummary(x.rows);
      const totalMachinesType = machines.filter(m => (m.type || "outro") === x.type).length;
      const paradas = machines.filter(m => (m.type || "outro") === x.type && m.status === "parada");
      return {
        type: x.type, label: setorLabel(x.type),
        equipe: st.activeCount, machinesUsed: x.machineIds.size, machinesTotal: totalMachinesType,
        total: st.total, perHour: st.perHour, efficiency: produtEfficiency(x.rows),
        gargalos: paradas.map(m => m.name)
      };
    }).sort((a, b) => b.total - a.total);
  }

  function produtDaysBetween(from, to) {
    const days = [];
    let d = from, guard = 0;
    while (d <= to && guard < 400) { days.push(d); d = addDaysDS(d, 1); guard++; }
    return days;
  }

  function renderProdutividade(v) {
    const f = state.produt;
    const { from, to } = produtDateRange();
    const rows = produtRows();
    const sum = produtSummary(rows);
    const byEmployee = produtByEmployee(rows);
    const byProduct = produtByProduct(rows);
    const bySetor = produtBySetor(rows);
    const effAll = produtEfficiency(rows);

    const productNames = [...new Set(productions.map(p => p.productName).filter(Boolean))].sort();
    const employeeOptions = produtByEmployee(productions.filter(p => p.date >= addDaysDS(U.todayStr(), -365)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const setorOptions = [...new Set(machines.map(m => m.type).filter(Boolean))];

    let days = produtDaysBetween(from, to);
    let dayLabels, seriesDaily;
    if (days.length <= 45) {
      dayLabels = days.map(d => U.fmtDate(d).slice(0, 5));
      seriesDaily = days.map(d => rows.filter(r => r.date === d).reduce((s, r) => s + (Number(r.quantityProduced) || 0), 0));
    } else {
      // Agrupa por semana para não poluir o gráfico em períodos longos.
      const weeks = {};
      days.forEach(d => {
        const dt = new Date(d + "T00:00:00");
        const day0 = new Date(dt); day0.setDate(dt.getDate() - dt.getDay());
        const wk = day0.toISOString().slice(0, 10);
        weeks[wk] = weeks[wk] || 0;
      });
      rows.forEach(r => {
        const dt = new Date(r.date + "T00:00:00");
        const day0 = new Date(dt); day0.setDate(dt.getDate() - dt.getDay());
        const wk = day0.toISOString().slice(0, 10);
        if (wk in weeks) weeks[wk] += Number(r.quantityProduced) || 0;
      });
      const wkKeys = Object.keys(weeks).sort();
      dayLabels = wkKeys.map(w => "sem " + U.fmtDate(w).slice(0, 5));
      seriesDaily = wkKeys.map(w => weeks[w]);
    }

    const empBarEntries = byEmployee.slice(0, 8);
    const prodDonutEntries = byProduct.slice(0, 6).map(p => [p.name, p.total]);
    const effBarEntries = byEmployee.filter(e => e.efficiency !== null).slice(0, 8);
    const defBarEntries = byEmployee.slice().sort((a, b) => b.defects - a.defects).slice(0, 8);

    v.innerHTML = `
      <div class="card pad">
        <div class="field-row">
          <div class="field"><label>Período</label>
            <select id="pr-periodo">
              <option value="hoje" ${f.periodo === "hoje" ? "selected" : ""}>Hoje</option>
              <option value="7d" ${f.periodo === "7d" ? "selected" : ""}>Últimos 7 dias</option>
              <option value="30d" ${f.periodo === "30d" ? "selected" : ""}>Últimos 30 dias</option>
              <option value="custom" ${f.periodo === "custom" ? "selected" : ""}>Personalizado</option>
            </select>
          </div>
          <div class="field"><label>Setor</label>
            <select id="pr-setor"><option value="">Todos</option>
              ${setorOptions.map(t => `<option value="${U.esc(t)}" ${t === f.setor ? "selected" : ""}>${U.esc(setorLabel(t))}</option>`).join("")}
            </select>
          </div>
        </div>
        ${f.periodo === "custom" ? `
        <div class="field-row">
          <div class="field"><label>De</label><input type="date" id="pr-datefrom" value="${U.esc(f.dateFrom || from)}"></div>
          <div class="field"><label>Até</label><input type="date" id="pr-dateto" value="${U.esc(f.dateTo || to)}"></div>
        </div>` : ""}
        <div class="field-row">
          <div class="field"><label>Produto</label>
            <select id="pr-product"><option value="">Todos</option>
              ${productNames.map(n => `<option value="${U.esc(n)}" ${n === f.productName ? "selected" : ""}>${U.esc(n)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Funcionário</label>
            <select id="pr-employee"><option value="">Todos</option>
              ${employeeOptions.map(e => `<option value="${U.esc(e.key)}" ${e.key === f.employeeKey ? "selected" : ""}>${U.esc(e.name)}</option>`).join("")}
            </select>
          </div>
        </div>
        <button class="btn-ghost" data-act="produt-clear">Limpar filtros</button>
      </div>

      <div class="i4-cards mt12">
        ${i4Card({ icon: "package", color: "var(--ok)", label: "Produção total", value: U.fmt(sum.total), unit: "un.", foot: `<span class="tiny dim">${U.fmtDate(from)} — ${U.fmtDate(to)}</span>` })}
        ${i4Card({ icon: "speed", color: "#a78bfa", label: "Média produção/hora", value: U.fmt(sum.perHour, 0), unit: "un./h", foot: `<span class="tiny dim">${U.fmt(sum.hours, 1)} h no total</span>` })}
        ${i4Card({ icon: "user", color: "var(--cyan)", label: "Funcionários ativos", value: U.fmt(sum.activeCount), unit: "", foot: `<span class="tiny dim">com produção no período</span>` })}
        ${i4Card({ icon: "checkc", color: effAll !== null && effAll >= 90 ? "var(--ok)" : "var(--amber2)", label: "Eficiência média", value: effAll !== null ? U.fmt(effAll, 1) : "—", unit: effAll !== null ? "%" : "", foot: effAll !== null ? '<span class="tiny dim">vs. capacidade/hora cadastrada</span>' : '<span class="tiny dim">cadastre a capacidade/hora em Produtos/Máquinas</span>' })}
        ${i4Card({ icon: "alert", color: "var(--danger)", label: "Total defeitos", value: U.fmt(sum.defects), unit: "un.", foot: `<span class="tiny dim">${sum.total ? U.fmt(sum.defects / sum.total * 100, 1) + "% da produção" : "sem produção no período"}</span>` })}
      </div>

      <p class="section-label">🏆 Ranking de produtividade</p>
      ${byEmployee.length ? `
      <div class="card tbl-wrap">
        <table>
          <thead><tr>
            <th></th><th>Funcionário</th><th>Setor</th>
            <th style="text-align:right">Produção</th><th style="text-align:right">Horas</th>
            <th style="text-align:right">Média/h</th><th style="text-align:right">Eficiência</th>
            <th style="text-align:right">Defeitos</th>
          </tr></thead>
          <tbody>
            ${byEmployee.slice(0, 10).map((e, i) => `
              <tr>
                <td>${i < 3 ? ["🥇", "🥈", "🥉"][i] : (i + 1) + "º"}</td>
                <td class="rowc" style="gap:8px">
                  <div class="employee-avatar" style="width:28px;height:28px">${e.em && e.em.photoData ? `<img src="${U.esc(e.em.photoData)}" alt="">` : U.icon("user", "sm")}</div>
                  <span>${U.esc(e.name)}</span>
                </td>
                <td class="tiny dim">${U.esc(e.setor)}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(e.total)}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(e.hours, 1)}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(e.perHour, 1)}</td>
                <td style="text-align:right">${produtEffHTML(e.efficiency)}</td>
                <td class="mono-val" style="text-align:right">${e.defects ? U.fmt(e.defects) : "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Nenhum lançamento de produção no período/filtros selecionados.</div>'}

      <div class="i4-charts-row mt12">
        <div class="card pad i4-chart-wide">
          <span class="section-label" style="margin:0 0 8px">${U.icon("chart", "sm")} Evolução da produção</span>
          ${seriesDaily.some(x => x > 0) ? lineChartHTML(dayLabels, seriesDaily, { color: "var(--cyan)" }) : '<div class="empty">Sem produção no período.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("user", "sm")} Produção por funcionário</span>
          ${empBarEntries.length ? barChartHTML(empBarEntries.map(e => e.name), empBarEntries.map(e => e.total), { color: "var(--ok)" }) : '<div class="empty">Sem dados.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("box", "sm")} Produção por produto</span>
          ${prodDonutEntries.length ? donutMultiHTML(prodDonutEntries) : '<div class="empty">Sem dados.</div>'}
        </div>
      </div>

      <div class="two-col mt12">
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("checkc", "sm")} Eficiência por funcionário</span>
          ${effBarEntries.length ? barChartHTML(effBarEntries.map(e => e.name), effBarEntries.map(e => Math.round(e.efficiency)), { color: "var(--amber2)" }) : '<div class="empty">Nenhum funcionário com capacidade/hora cadastrada para calcular.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("alert", "sm")} Defeitos por funcionário</span>
          ${defBarEntries.some(e => e.defects > 0) ? barChartHTML(defBarEntries.map(e => e.name), defBarEntries.map(e => e.defects), { color: "var(--danger)" }) : '<div class="empty">Sem defeitos registrados no período.</div>'}
        </div>
      </div>

      <p class="section-label">${U.icon("box", "sm")} Análise por produto</p>
      ${byProduct.length ? `
      <div class="card tbl-wrap">
        <table>
          <thead><tr>
            <th>Produto</th><th style="text-align:right">Produzido</th><th style="text-align:right">Funcionários</th>
            <th style="text-align:right">Tempo médio</th><th style="text-align:right">Média/h</th>
            <th style="text-align:right">Defeitos</th><th style="text-align:right">Eficiência</th>
          </tr></thead>
          <tbody>
            ${byProduct.map(p => `<tr>
              <td>${U.esc(p.name)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(p.total)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(p.employeesCount)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(p.avgTime, 2)} h</td>
              <td class="mono-val" style="text-align:right">${U.fmt(p.perHour, 1)}</td>
              <td class="mono-val" style="text-align:right">${p.defects ? U.fmt(p.defects) : "—"}</td>
              <td style="text-align:right">${produtEffHTML(p.efficiency)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Sem dados de produto no período/filtros selecionados.</div>'}

      <p class="section-label">${U.icon("factory", "sm")} Análise por setor</p>
      ${bySetor.length ? `
      <div class="card tbl-wrap">
        <table>
          <thead><tr>
            <th>Setor</th><th style="text-align:right">Equipe ativa</th><th style="text-align:right">Máquinas</th>
            <th style="text-align:right">Produção</th><th style="text-align:right">Média/h</th>
            <th style="text-align:right">Eficiência</th><th>Gargalos</th>
          </tr></thead>
          <tbody>
            ${bySetor.map(s => `<tr>
              <td>${U.esc(s.label)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(s.equipe)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(s.machinesUsed)}/${U.fmt(s.machinesTotal)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(s.total)}</td>
              <td class="mono-val" style="text-align:right">${U.fmt(s.perHour, 1)}</td>
              <td style="text-align:right">${produtEffHTML(s.efficiency)}</td>
              <td class="tiny">${s.gargalos.length ? '<span style="color:var(--danger)">' + s.gargalos.map(U.esc).join(", ") + " parada(s)</span>" : '<span class="dim">Nenhum identificado</span>'}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty">Sem dados de setor no período/filtros selecionados.</div>'}
    `;
    wireProdut();
  }

  function wireProdut() {
    const map = { "pr-periodo": "periodo", "pr-datefrom": "dateFrom", "pr-dateto": "dateTo", "pr-product": "productName", "pr-employee": "employeeKey", "pr-setor": "setor" };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        state.produt[map[id]] = el.value;
        renderView();
      });
    });
  }

  /* ========== MÓDULO QUALIDADE — CONTROLE DE QUALIDADE E DEFEITOS (ETAPA 7) ==========
     Integrado ao que já existe (OP, Funcionário, Produto, Máquina,
     apontamento de produção) — não é uma tela isolada.

     Duas fontes de dado ficam lado a lado, cada uma com seu papel:
     • `productions` (já existente) segue sendo a fonte da produção total
       apontada — não é duplicada aqui.
     • `defectRecords` (nova coleção desta etapa) é o REGISTRO detalhado
       de cada defeito (OP, produto, funcionário, máquina, tipo,
       quantidade, data, turno, observação) — informação que não existia
       antes (o apontamento só guardava um número solto de defeitos).
       "Total rejeitado"/"Aprovado" desta tela vêm do registro detalhado;
       o `defects` de cada apontamento (Lançamento/Painel) continua
       intacto e sem alteração de comportamento.
     Reaproveita funções já existentes: `produtEfficiency`, `produtDaysBetween`,
     `opFullStats`, `opCode`, `errMsg`, `toast`, `i4Card`, `barChartHTML`,
     `lineChartHTML`, `donutMultiHTML`. */

  function qualDefectTypeLabel(rec) {
    return rec.defectType === "Outro" ? (rec.customType || "Outro") : rec.defectType;
  }

  function qualDateRange() {
    const f = state.quality;
    const today = U.todayStr();
    if (f.periodo === "hoje") return { from: today, to: today };
    if (f.periodo === "7d") return { from: addDaysDS(today, -6), to: today };
    if (f.periodo === "custom") return { from: f.dateFrom || today, to: f.dateTo || today };
    return { from: addDaysDS(today, -29), to: today }; // "30d" (padrão)
  }

  /* OP de um apontamento de produção: vem da Tarefa (productionOrders)
     vinculada por productionOrderId — apontamento não guarda opId direto. */
  function opIdOfProduction(row) {
    if (!row.productionOrderId) return "";
    const po = productionOrders.find(x => x.id === row.productionOrderId);
    return po ? (po.opId || "") : "";
  }

  function qualProductionsFiltered() {
    const f = state.quality;
    const { from, to } = qualDateRange();
    return productions.filter(p => {
      if (!p.date || p.date < from || p.date > to) return false;
      if (f.opId && opIdOfProduction(p) !== f.opId) return false;
      if (f.productId) {
        const prod = products.find(x => x.id === f.productId);
        if (!prod || (p.productId !== f.productId && p.productName !== prod.name)) return false;
      }
      if (f.employeeId && p.employeeId !== f.employeeId) return false;
      if (f.machineId && p.machineId !== f.machineId) return false;
      return true;
    });
  }

  function qualDefectsFiltered() {
    const f = state.quality;
    const { from, to } = qualDateRange();
    return defectRecords.filter(d => {
      if (!d.date || d.date < from || d.date > to) return false;
      if (f.opId && d.opId !== f.opId) return false;
      if (f.productId && d.productId !== f.productId) return false;
      if (f.employeeId && d.employeeId !== f.employeeId) return false;
      if (f.machineId && d.machineId !== f.machineId) return false;
      return true;
    });
  }

  function qualSummary(prodRows, defRows) {
    const total = prodRows.reduce((s, r) => s + (Number(r.quantityProduced) || 0), 0);
    const rejected = defRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const approved = Math.max(0, total - rejected);
    const defectPct = total ? rejected / total * 100 : 0;
    return { total, rejected, approved, defectPct, efficiency: produtEfficiency(prodRows) };
  }

  function qualGroupBy(defRows, keyFn, labelFn) {
    const map = {};
    defRows.forEach(r => {
      const key = keyFn(r) || "—";
      if (!map[key]) map[key] = { key, label: labelFn(r), qty: 0 };
      map[key].qty += Number(r.quantity) || 0;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }

  function qualByType(defRows) { return qualGroupBy(defRows, r => qualDefectTypeLabel(r), r => qualDefectTypeLabel(r)); }
  function qualByProduct(defRows) { return qualGroupBy(defRows, r => r.productName || "—", r => r.productName || "Sem produto"); }
  function qualByEmployee(defRows) { return qualGroupBy(defRows, r => r.employeeId || r.employeeName || "—", r => r.employeeName || "—"); }
  function qualByMachine(defRows) { return qualGroupBy(defRows, r => r.machineId || r.machineName || "—", r => r.machineName || "—"); }

  function qualEvolution(defRows, from, to) {
    let days = produtDaysBetween(from, to);
    if (days.length <= 45) {
      return { labels: days.map(d => U.fmtDate(d).slice(0, 5)), values: days.map(d => defRows.filter(r => r.date === d).reduce((s, r) => s + (Number(r.quantity) || 0), 0)) };
    }
    const weeks = {};
    days.forEach(d => {
      const dt = new Date(d + "T00:00:00");
      const day0 = new Date(dt); day0.setDate(dt.getDate() - dt.getDay());
      weeks[day0.toISOString().slice(0, 10)] = weeks[day0.toISOString().slice(0, 10)] || 0;
    });
    defRows.forEach(r => {
      const dt = new Date(r.date + "T00:00:00");
      const day0 = new Date(dt); day0.setDate(dt.getDate() - dt.getDay());
      const wk = day0.toISOString().slice(0, 10);
      if (wk in weeks) weeks[wk] += Number(r.quantity) || 0;
    });
    const wkKeys = Object.keys(weeks).sort();
    return { labels: wkKeys.map(w => "sem " + U.fmtDate(w).slice(0, 5)), values: wkKeys.map(w => weeks[w]) };
  }

  /* Alertas: compara, para cada produto que aparece nos apontamentos do
     período/filtros, o índice de defeito real (registro de qualidade)
     contra o limite já cadastrado no produto (`product.maxDefectRate`,
     caindo para `config.defectLimit` quando o produto não tem o campo). */
  function qualAlerts(prodRows, defRows) {
    const byProdTotal = {};
    prodRows.forEach(r => { const n = r.productName || "—"; byProdTotal[n] = (byProdTotal[n] || 0) + (Number(r.quantityProduced) || 0); });
    const byProdRejected = {};
    defRows.forEach(r => { const n = r.productName || "—"; byProdRejected[n] = (byProdRejected[n] || 0) + (Number(r.quantity) || 0); });
    const names = new Set([...Object.keys(byProdTotal), ...Object.keys(byProdRejected)]);
    const globalLimit = Number(config.defectLimit) || 1;
    return Array.from(names).map(name => {
      const total = byProdTotal[name] || 0;
      const rejected = byProdRejected[name] || 0;
      const pct = total ? rejected / total * 100 : 0;
      const prod = products.find(p => p.name === name);
      const limit = prod && prod.maxDefectRate !== undefined ? Number(prod.maxDefectRate) : globalLimit;
      return { name, total, rejected, pct, limit };
    }).filter(x => x.total > 0 && x.pct > x.limit).sort((a, b) => b.pct - a.pct);
  }

  function renderQualidade(v) {
    const f = state.quality;
    const { from, to } = qualDateRange();
    const prodRows = qualProductionsFiltered();
    const defRows = qualDefectsFiltered();
    const sum = qualSummary(prodRows, defRows);
    const alerts = qualAlerts(prodRows, defRows);
    const byType = qualByType(defRows);
    const byProduct = qualByProduct(defRows);
    const byEmployee = qualByEmployee(defRows);
    const byMachine = qualByMachine(defRows);
    const evo = qualEvolution(defRows, from, to);
    const recent = defRows.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 25);

    const opsSorted = ops.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const opAnalysisOp = f.opAnalysisId ? ops.find(x => x.id === f.opAnalysisId) : null;
    const opAnalysisStats = opAnalysisOp ? opFullStats(opAnalysisOp) : null;
    const opAnalysisDefects = opAnalysisOp ? qualByType(defectRecords.filter(d => d.opId === opAnalysisOp.id)) : [];

    v.innerHTML = `
      <div class="card pad">
        <div class="field-row">
          <div class="field"><label>Período</label>
            <select id="ql-periodo">
              <option value="hoje" ${f.periodo === "hoje" ? "selected" : ""}>Hoje</option>
              <option value="7d" ${f.periodo === "7d" ? "selected" : ""}>Últimos 7 dias</option>
              <option value="30d" ${f.periodo === "30d" ? "selected" : ""}>Últimos 30 dias</option>
              <option value="custom" ${f.periodo === "custom" ? "selected" : ""}>Personalizado</option>
            </select>
          </div>
          <div class="field"><label>Ordem de Produção</label>
            <select id="ql-op"><option value="">Todas</option>
              ${opsSorted.map(op => `<option value="${op.id}" ${op.id === f.opId ? "selected" : ""}>${opCode(op)}</option>`).join("")}
            </select>
          </div>
        </div>
        ${f.periodo === "custom" ? `
        <div class="field-row">
          <div class="field"><label>De</label><input type="date" id="ql-datefrom" value="${U.esc(f.dateFrom || from)}"></div>
          <div class="field"><label>Até</label><input type="date" id="ql-dateto" value="${U.esc(f.dateTo || to)}"></div>
        </div>` : ""}
        <div class="field-row">
          <div class="field"><label>Produto</label>
            <select id="ql-product"><option value="">Todos</option>
              ${products.map(p => `<option value="${p.id}" ${p.id === f.productId ? "selected" : ""}>${U.esc(p.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Funcionário</label>
            <select id="ql-employee"><option value="">Todos</option>
              ${employees.map(e => `<option value="${e.id}" ${e.id === f.employeeId ? "selected" : ""}>${U.esc(e.name)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field"><label>Máquina</label>
          <select id="ql-machine"><option value="">Todas</option>
            ${machines.map(m => `<option value="${m.id}" ${m.id === f.machineId ? "selected" : ""}>${U.esc(m.name)}</option>`).join("")}
          </select>
        </div>
        <button class="btn-ghost" data-act="quality-clear">Limpar filtros</button>
      </div>

      <div class="i4-cards mt12">
        ${i4Card({ icon: "package", color: "var(--cyan)", label: "Total produzido", value: U.fmt(sum.total), unit: "un.", foot: `<span class="tiny dim">${U.fmtDate(from)} — ${U.fmtDate(to)}</span>` })}
        ${i4Card({ icon: "checkc", color: "var(--ok)", label: "Total aprovado", value: U.fmt(sum.approved), unit: "un.", foot: `<span class="tiny dim">produzido − rejeitado</span>` })}
        ${i4Card({ icon: "alert", color: "var(--danger)", label: "Total rejeitado", value: U.fmt(sum.rejected), unit: "un.", foot: `<span class="tiny dim">${defRows.length} registro(s) de defeito</span>` })}
        ${i4Card({ icon: "chart", color: sum.defectPct > (Number(config.defectLimit) || 1) ? "var(--danger)" : "var(--amber2)", label: "Índice de defeito", value: U.fmt(sum.defectPct, 2), unit: "%", foot: `<span class="tiny dim">limite padrão ${U.fmt(Number(config.defectLimit) || 1, 2)}%</span>` })}
        ${i4Card({ icon: "speed", color: sum.efficiency !== null && sum.efficiency >= 90 ? "var(--ok)" : "#a78bfa", label: "Eficiência da produção", value: sum.efficiency !== null ? U.fmt(sum.efficiency, 1) : "—", unit: sum.efficiency !== null ? "%" : "", foot: sum.efficiency !== null ? '<span class="tiny dim">vs. capacidade/hora cadastrada</span>' : '<span class="tiny dim">cadastre a capacidade/hora em Produtos/Máquinas</span>' })}
      </div>

      ${alerts.length ? `
      <p class="section-label">${U.icon("alert", "sm")} Alertas de qualidade</p>
      <div class="space-y3">
        ${alerts.map(a => `
          <div class="card pad" style="background:var(--danger-dim);border-color:#5c2622">
            <div class="rowc">${U.icon("alert")}<span class="small" style="color:#ffb4af">
              <b>${U.esc(a.name)}</b> — índice de defeito acima do limite: produto permitido ${U.fmt(a.limit, 2)}% · atual ${U.fmt(a.pct, 2)}% (${U.fmt(a.rejected)} de ${U.fmt(a.total)} un.)
            </span></div>
          </div>`).join("")}
      </div>` : ""}

      <div class="between mt12">
        <p class="section-label" style="margin:0">${U.icon("clipboard", "sm")} Registro de defeitos</p>
        <button class="btn btn-primary btn-sm" data-act="new-defect">+ Registrar defeito</button>
      </div>
      ${f.showForm ? qualDefectForm() : ""}

      ${recent.length ? `
      <div class="card tbl-wrap mt12">
        <table>
          <thead><tr>
            <th>Data</th><th>OP</th><th>Produto</th><th>Funcionário</th><th>Máquina</th>
            <th>Tipo</th><th style="text-align:right">Qtd.</th><th>Turno</th><th></th>
          </tr></thead>
          <tbody>
            ${recent.map(r => {
              const op = r.opId ? ops.find(x => x.id === r.opId) : null;
              return `<tr>
                <td>${U.fmtDate(r.date)}</td>
                <td class="tiny">${op ? opCode(op) : "—"}</td>
                <td>${U.esc(r.productName || "—")}</td>
                <td>${U.esc(r.employeeName || "—")}</td>
                <td>${U.esc(r.machineName || "—")}</td>
                <td>${U.esc(qualDefectTypeLabel(r))}</td>
                <td class="mono-val" style="text-align:right">${U.fmt(r.quantity)}</td>
                <td class="tiny dim">${U.esc(TURNOS[r.turno] || "—")}</td>
                <td><button class="btn-ghost" data-act="del-defect" data-id="${r.id}">Excluir</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>` : '<div class="empty mt12">Nenhum defeito registrado no período/filtros selecionados.</div>'}

      <div class="i4-charts-row mt12">
        <div class="card pad i4-chart-wide">
          <span class="section-label" style="margin:0 0 8px">${U.icon("chart", "sm")} Evolução de defeitos</span>
          ${evo.values.some(x => x > 0) ? lineChartHTML(evo.labels, evo.values, { color: "var(--danger)" }) : '<div class="empty">Sem defeitos no período.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("alert", "sm")} Defeitos por categoria</span>
          ${byType.length ? donutMultiHTML(byType.map(x => [x.label, x.qty])) : '<div class="empty">Sem dados.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("box", "sm")} Defeitos por produto</span>
          ${byProduct.length ? barChartHTML(byProduct.slice(0, 8).map(x => x.label), byProduct.slice(0, 8).map(x => x.qty), { color: "var(--danger)" }) : '<div class="empty">Sem dados.</div>'}
        </div>
      </div>

      <div class="two-col mt12">
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("user", "sm")} Defeitos por funcionário</span>
          ${byEmployee.length ? barChartHTML(byEmployee.slice(0, 8).map(x => x.label), byEmployee.slice(0, 8).map(x => x.qty), { color: "var(--amber2)" }) : '<div class="empty">Sem dados.</div>'}
        </div>
        <div class="card pad">
          <span class="section-label" style="margin:0 0 8px">${U.icon("cog", "sm")} Defeitos por máquina</span>
          ${byMachine.length ? barChartHTML(byMachine.slice(0, 8).map(x => x.label), byMachine.slice(0, 8).map(x => x.qty), { color: "#a78bfa" }) : '<div class="empty">Sem dados.</div>'}
        </div>
      </div>

      <p class="section-label">${U.icon("columns", "sm")} Análise por OP</p>
      <div class="card pad">
        <div class="field"><label>Selecione a OP</label>
          <select id="ql-op-analysis"><option value="">Selecione...</option>
            ${opsSorted.map(op => `<option value="${op.id}" ${op.id === f.opAnalysisId ? "selected" : ""}>${opCode(op)}</option>`).join("")}
          </select>
        </div>
        ${opAnalysisOp ? `
          <div class="grid-cards mt12">
            <div class="card stat"><div class="lbl">${U.icon("package", "sm")} Produção</div><div class="val">${U.fmt(opAnalysisStats.prog.produced)}<em>un.</em></div><div class="foot">quantidade produzida</div></div>
            <div class="card stat accent"><div class="lbl">${U.icon("check", "sm")} Aprovado</div><div class="val up">${U.fmt(opAnalysisStats.approved)}<em>un.</em></div><div class="foot">produzido − defeitos</div></div>
            <div class="card stat"><div class="lbl">${U.icon("alert", "sm")} Defeitos</div><div class="val ${opAnalysisStats.defects ? "down" : ""}">${U.fmt(opAnalysisStats.defects)}<em>un.</em></div><div class="foot">${opAnalysisStats.prog.produced ? U.fmt(opAnalysisStats.defects / opAnalysisStats.prog.produced * 100, 2) + "%" : "sem produção"}</div></div>
            <div class="card stat"><div class="lbl">${U.icon("speed", "sm")} Eficiência</div><div class="val">${opAnalysisStats.hours > 0 ? U.fmt(opAnalysisStats.perHour, 1) : "—"}<em>${opAnalysisStats.hours > 0 ? "un./h" : ""}</em></div><div class="foot">${U.fmt(opAnalysisStats.hours, 2)} h apontadas</div></div>
          </div>
          <div class="kv mt12"><b>Funcionários envolvidos:</b> ${opAnalysisStats.employeeNames.length ? U.esc(opAnalysisStats.employeeNames.join(", ")) : "—"}</div>
          <div class="kv"><b>Máquinas envolvidas:</b> ${opAnalysisStats.machineNames.length ? U.esc(opAnalysisStats.machineNames.join(", ")) : "—"}</div>
          <div class="mt12"><span class="section-label" style="margin:0 0 8px">Tipos de defeitos desta OP</span>
            ${opAnalysisDefects.length ? opAnalysisDefects.map(x => `<div class="stock-line"><span>${U.esc(x.label)}</span><b>${U.fmt(x.qty)} un.</b></div>`).join("") : '<div class="empty">Nenhum defeito detalhado registrado para esta OP.</div>'}
          </div>
          <button class="btn-ghost mt12" data-act="open-op-detail" data-id="${opAnalysisOp.id}">Ver detalhe completo da OP →</button>
        ` : '<div class="empty mt12">Selecione uma OP para ver a análise de qualidade.</div>'}
      </div>

      <p class="section-label">${U.icon("box", "sm")} Análise por produto</p>
      ${byProduct.length ? `
      <div class="card tbl-wrap">
        <table>
          <thead><tr><th>Produto</th><th style="text-align:right">Defeitos</th></tr></thead>
          <tbody>${byProduct.map(x => `<tr><td>${U.esc(x.label)}</td><td class="mono-val" style="text-align:right">${U.fmt(x.qty)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : '<div class="empty">Sem dados de produto no período/filtros selecionados.</div>'}
    `;
    wireQualidade();
  }

  function qualDefectForm() {
    const n = state.newDefect;
    const opsSorted = ops.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const activeEmployees = employees.filter(e => e.status === "ativo");
    return `<div class="card pad mt12 stock-form">
      <div class="between mb12"><span class="small" style="font-weight:700">Novo registro de defeito</span><button class="btn-ghost" data-act="cancel-new-defect">Cancelar</button></div>
      <div class="field-row">
        <div class="field"><label>Data</label><input type="date" id="qd-date" value="${U.esc(n.date)}"></div>
        <div class="field"><label>Turno</label>
          <select id="qd-turno">${Object.keys(TURNOS).map(k => `<option value="${k}" ${n.turno === k ? "selected" : ""}>${TURNOS[k]}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Ordem de Produção <span class="tiny dim">(opcional)</span></label>
        <select id="qd-op"><option value="">Nenhuma</option>${opsSorted.map(op => `<option value="${op.id}" ${n.opId === op.id ? "selected" : ""}>${opCode(op)}</option>`).join("")}</select>
      </div>
      <div class="field-row">
        <div class="field"><label>Produto</label>
          <select id="qd-product"><option value="">Selecione...</option>${products.map(p => `<option value="${p.id}" ${n.productId === p.id ? "selected" : ""}>${U.esc(p.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Máquina</label>
          <select id="qd-machine"><option value="">Selecione...</option>${machines.map(m => `<option value="${m.id}" ${n.machineId === m.id ? "selected" : ""}>${U.esc(m.name)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Funcionário responsável</label>
        <select id="qd-employee"><option value="">Selecione...</option>${activeEmployees.map(e => `<option value="${e.id}" ${n.employeeId === e.id ? "selected" : ""}>${U.esc(e.name)}</option>`).join("")}</select>
      </div>
      <div class="field-row">
        <div class="field"><label>Tipo de defeito</label>
          <select id="qd-type">${DEFECT_TYPES.map(t => `<option value="${t}" ${n.defectType === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Quantidade</label><input type="number" id="qd-qty" min="0" step="1" value="${U.esc(n.quantity)}" placeholder="0"></div>
      </div>
      ${n.defectType === "Outro" ? `<div class="field"><label>Descreva o tipo</label><input id="qd-customtype" value="${U.esc(n.customType)}" placeholder="Ex.: Corte torto"></div>` : ""}
      <div class="field"><label>Observação</label><textarea id="qd-obs" rows="2" placeholder="Opcional">${U.esc(n.observation)}</textarea></div>
      <button class="btn btn-primary btn-block" data-act="save-new-defect">Registrar defeito</button>
    </div>`;
  }

  function wireQualidade() {
    const filterMap = { "ql-periodo": "periodo", "ql-op": "opId", "ql-datefrom": "dateFrom", "ql-dateto": "dateTo", "ql-product": "productId", "ql-employee": "employeeId", "ql-machine": "machineId" };
    Object.keys(filterMap).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => { state.quality[filterMap[id]] = el.value; renderView(); });
    });
    const opAnalysisEl = document.getElementById("ql-op-analysis");
    if (opAnalysisEl) opAnalysisEl.addEventListener("change", () => { state.quality.opAnalysisId = opAnalysisEl.value; renderView(); });

    const formMap = { "qd-date": "date", "qd-op": "opId", "qd-product": "productId", "qd-machine": "machineId", "qd-employee": "employeeId", "qd-qty": "quantity", "qd-customtype": "customType", "qd-obs": "observation" };
    Object.keys(formMap).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const ev = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => { state.newDefect[formMap[id]] = el.value; });
    });
    const turnoEl = document.getElementById("qd-turno");
    if (turnoEl) turnoEl.addEventListener("change", () => { state.newDefect.turno = turnoEl.value; });
    const typeEl = document.getElementById("qd-type");
    if (typeEl) typeEl.addEventListener("change", () => { state.newDefect.defectType = typeEl.value; renderView(); });
  }

  async function addDefectRecord() {
    const n = state.newDefect;
    const qty = Number(n.quantity) || 0;
    if (!n.productId || !n.machineId || !n.employeeId || qty <= 0) {
      toast("Preencha produto, máquina, funcionário responsável e uma quantidade maior que zero.");
      return;
    }
    if (n.defectType === "Outro" && !String(n.customType || "").trim()) {
      toast("Descreva o tipo de defeito.");
      return;
    }
    const op = n.opId ? ops.find(x => x.id === n.opId) : null;
    const prod = products.find(x => x.id === n.productId);
    const mach = machines.find(x => x.id === n.machineId);
    const emp = employees.find(x => x.id === n.employeeId);
    try {
      await S.add("defectRecords", {
        date: n.date || U.todayStr(),
        opId: op ? op.id : "",
        productId: n.productId,
        productName: prod ? prod.name : "",
        employeeId: n.employeeId,
        employeeName: emp ? emp.name : "",
        machineId: n.machineId,
        machineName: mach ? mach.name : "",
        defectType: n.defectType,
        customType: n.defectType === "Outro" ? String(n.customType || "").trim() : "",
        quantity: qty,
        turno: n.turno || "manha",
        observation: String(n.observation || "").trim(),
        createdAt: Date.now()
      });
      state.newDefect = freshDefectDraft();
      state.quality.showForm = false;
      toast("Defeito registrado");
      renderView();
    } catch (e) { toast(errMsg(e)); }
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
        pinHash,
        photoData: state.newEmployee.photoData || ""
      });
      state.newEmployee = { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [], photoData: "" };
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
      allowedMachines: (d.allowedMachines || []).slice(),
      photoData: d.photoData || ""
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

  /* ========== DADOS DE DEMONSTRAÇÃO (Etapa 8) ==========
     Carrega o cenário padrão do teste do fluxo industrial sem apagar
     nada: o que já existe (funcionário, pedido, OP por número, tarefa) é
     reutilizado; só o que falta é criado. */
  async function loadDemoData() {
    const sector = (config && config.sector) || "Setor de Furação";
    const due = new Date(Date.now() + 7 * 86400000);
    const dueStr = [
      String(due.getFullYear()).padStart(4, "0"),
      String(due.getMonth() + 1).padStart(2, "0"),
      String(due.getDate()).padStart(2, "0")
    ].join("-");

    const m1 = S.get("machines").find(x => x.id === "auto-1") || null;
    const m2 = S.get("machines").find(x => x.id === "auto-2") || null;
    if (!m1 || !m2) { toast("Cadastre as máquinas Automática 1 e Automática 2 antes de carregar a demonstração."); return; }
    let product = S.get("products").find(p => p.id === "caderno-80");
    if (!product) {
      product = S.get("products").find(p => /caderno/i.test(p.name)) || null;
      if (!product) {
        await S.add("products", { id: "caderno-80", name: "Caderno 80 folhas", hasModels: false, models: [], capacityHour: 0, capacityDay: 0, maxDefectRate: 1 });
        product = S.get("products").find(p => p.id === "caderno-80");
      }
    }

    /* Funcionários Ronaldo e Roque (PINs 1111 e 2222). */
    let ronaldo = S.get("employees").find(e => e.name === "Ronaldo");
    let roque = S.get("employees").find(e => e.name === "Roque");
    if (!ronaldo) {
      await S.add("employees", { name: "Ronaldo", role: "Operador de máquina", status: "ativo", allowedMachines: ["auto-1"], photoData: "", pinHash: await U.hashPin("1111"), createdAt: Date.now() });
      ronaldo = S.get("employees").find(e => e.name === "Ronaldo");
    }
    if (!roque) {
      await S.add("employees", { name: "Roque", role: "Operador de máquina", status: "ativo", allowedMachines: ["auto-2"], photoData: "", pinHash: await U.hashPin("2222"), createdAt: Date.now() });
      roque = S.get("employees").find(e => e.name === "Roque");
    }
    if (!ronaldo || !roque) { toast("Não foi possível criar os funcionários Ronaldo e Roque."); return; }

    /* Pedido nº 1254 (30.000 Cadernos 80 folhas). */
    let order = S.get("orders").find(o => o.number === "1254");
    if (!order) {
      await S.add("orders", {
        number: "1254",
        client: "Demo — Pedido 1254",
        product: product.name,
        model: "",
        quantity: 30000,
        type: "completo",
        status: "aguardando",
        createdAt: Date.now()
      });
      order = S.get("orders").find(o => o.number === "1254");
    }
    if (!order) { toast("Não foi possível criar o Pedido 1254."); return; }

    /* OP 21234 (10.000) + OPs 21235 e 21236 (10.000 cada). */
    for (const num of ["21234", "21235", "21236"]) {
      if (S.get("ops").find(o => o.number === num)) continue;
      await S.add("ops", {
        number: num,
        orderId: order.id,
        sector: sector,
        quantity: 10000,
        priority: "media",
        dueDate: num === "21234" ? dueStr : "",
        status: "aguardando",
        createdAt: Date.now()
      });
    }
    const op = S.get("ops").find(o => o.number === "21234");
    if (!op) { toast("Não foi possível criar a OP 21234."); return; }

    /* Tarefas: Ronaldo → Automática 1 (5.000) e Roque → Automática 2 (5.000). */
    const demos = [
      { emp: ronaldo, m: m1, planned: 5000 },
      { emp: roque, m: m2, planned: 5000 }
    ];
    for (const d of demos) {
      const already = S.get("productionOrders").some(po =>
        po.orderId === order.id && po.opId === op.id &&
        po.employeeId === d.emp.id && po.machineId === d.m.id);
      if (already) continue;
      await S.add("productionOrders", {
        orderId: order.id,
        opId: op.id,
        machineId: d.m.id,
        machineName: d.m.name,
        employeeId: d.emp.id,
        employeeName: d.emp.name,
        productId: product.id,
        product: product.name,
        model: "",
        operacao: "producao",
        plannedQuantity: d.planned,
        estimatedMinutes: 0,
        priority: "media",
        observation: "",
        status: "aguardando",
        quantityProduced: 0,
        defects: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: Date.now()
      });
    }

    renderView();
    toast("Dados de demonstração carregados");
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

  async function compressEmployeePhoto(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) throw new Error("Selecione uma imagem válida.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Imagem inválida."));
        img.onload = () => {
          const max = 320;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .78));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onChangeGlobal(e) {
    const input = e.target;
    if (!input || input.type !== "file") return;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const data = await compressEmployeePhoto(file);
      const empId = input.getAttribute("data-emp-photo");
      if (empId && state.draftEmployee[empId]) state.draftEmployee[empId].photoData = data;
      else if (input.id === "ne-photo") state.newEmployee.photoData = data;
      renderView();
    } catch (e) { toast(e.message || "Não foi possível carregar a foto."); }
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
      if (confirm("Excluir este lançamento? Os saldos da Tarefa, da OP e do Pedido serão recalculados.")) excluirProducao(lid);
    }
    else if (a === "edit-lance") {
      state.rel.editingId = actWrap.getAttribute("data-id");
      refreshRel();
    }
    else if (a === "cancel-edit-lance") {
      state.rel.editingId = "";
      refreshRel();
    }
    else if (a === "save-edit-lance") salvarEdicaoLance(actWrap.getAttribute("data-id"));

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
        maxDefectRate: p.maxDefectRate === undefined ? 1 : p.maxDefectRate,
        components: (p.components || []).map(c => ({ name: c.name || "", description: c.description || "", generatesOP: !!c.generatesOP }))
      };
      renderView();
    }
    else if (a === "cancel-prod") { delete state.draftProduct[id]; renderView(); }
    else if (a === "save-prod") saveProduct(id);
    else if (a === "new-product") { state.newProductForm = true; state.newProduct = { name: "", hasModels: false, modelsText: "", components: [] }; renderView(); }
    else if (a === "cancel-new-prod") { state.newProductForm = false; renderView(); }
    else if (a === "save-new-prod") addProduct();

    else if (a === "add-component") {
      const scope = actWrap.getAttribute("data-scope");
      const target = scope === "new" ? state.newProduct : state.draftProduct[scope];
      if (target) {
        if (!target.components) target.components = [];
        target.components.push(freshComponentDraft());
        renderView();
      }
    }
    else if (a === "remove-component") {
      const scope = actWrap.getAttribute("data-scope");
      const idx = Number(actWrap.getAttribute("data-idx"));
      const target = scope === "new" ? state.newProduct : state.draftProduct[scope];
      if (target && target.components) {
        target.components.splice(idx, 1);
        renderView();
      }
    }

    else if (a === "new-employee") { state.newEmployeeForm = true; state.newEmployee = { name: "", role: "", pin: "", pin2: "", status: "ativo", allowedMachines: [], photoData: "" }; renderView(); }
    else if (a === "cancel-new-emp") { state.newEmployeeForm = false; renderView(); }
    else if (a === "remove-new-emp-photo") { state.newEmployee.photoData = ""; renderView(); }
    else if (a === "remove-emp-photo") { if (state.draftEmployee[id]) { state.draftEmployee[id].photoData = ""; renderView(); } }
    else if (a === "save-new-emp") addEmployee();
    else if (a === "edit-emp") {
      const em = employees.find(x => x.id === id);
      if (em) state.draftEmployee[id] = {
        name: em.name, role: em.role || "", pin: "", pin2: "",
        status: em.status || "ativo", allowedMachines: (em.allowedMachines || []).slice(),
        photoData: em.photoData || ""
      };
      renderView();
    }
    else if (a === "cancel-emp") { delete state.draftEmployee[id]; renderView(); }
    else if (a === "save-emp") saveEmployee(id);
    else if (a === "toggle-emp-status") toggleEmployeeStatus(id);
    else if (a === "open-emp-detail") { state.selectedEmployeeId = id; go("funcionario-detalhe"); }
    else if (a === "new-task-for-employee") { state.selectedEmployeeId = id; state.newTaskForm = true; state.newTask = freshTaskDraft(); state.newTask.employeeId = id; renderView(); }
    else if (a === "emp-start-task") employeeStartTask(id);
    else if (a === "emp-pause-task") employeePauseTask(id);
    else if (a === "emp-resume-task") employeeResumeTask(id);
    else if (a === "emp-partial") employeePartialProduction(id);
    else if (a === "emp-finish-task") employeeFinishTask(id);
    else if (a === "emp-next") employeeMakeNext(id);
    else if (a === "emp-start-urgent") employeeStartUrgentNow(id);
    else if (a === "open-op-detail") { state.selectedOPId = id; go("op-detalhe"); }

    else if (a === "toggle-order") { state.openOrders[id] = !state.openOrders[id]; renderView(); }
    else if (a === "edit-order") {
      const o = orders.find(x => x.id === id);
      if (o) state.draftOrder[id] = {
        client: o.client, number: o.number || "", product: o.product, model: o.model || "",
        quantity: o.quantity, type: o.type || "completo", status: o.status || "aguardando"
      };
      renderView();
    }
    else if (a === "cancel-order") { delete state.draftOrder[id]; renderView(); }
    else if (a === "save-order") saveOrder(id);
    else if (a === "new-order") { state.newOrderForm = true; state.newOrder = freshOrderDraft(); renderView(); }
    else if (a === "cancel-new-order") { state.newOrderForm = false; renderView(); }
    else if (a === "save-new-order") addOrder();

    else if (a === "new-material") { state.stock.showMaterialForm = true; renderView(); }
    else if (a === "cancel-new-material") { state.stock.showMaterialForm = false; renderView(); }
    else if (a === "save-new-material") addStockMaterial();
    else if (a === "stock-entry") { state.stock.showForm = true; state.newMovement = { materialId: id, quantity: "", date: U.todayStr(), type: "ENTRADA", orderId: "", observation: "" }; renderView(); }
    else if (a === "cancel-stock-entry") { state.stock.showForm = false; renderView(); }
    else if (a === "save-stock-entry") addStockMovement();
    else if (a === "stock-detail") { state.stock.detailId = id; renderView(); }
    else if (a === "stock-close-detail") { state.stock.detailId = ""; renderView(); }
    else if (a === "stock-clear-filters") { state.stock = { materialId:"", dateFrom:"", dateTo:"", type:"", orderId:"", showForm:false, showMaterialForm:false, detailId:state.stock.detailId }; renderView(); }
    else if (a === "produt-clear") { state.produt = { periodo: "7d", dateFrom: "", dateTo: "", productName: "", employeeKey: "", setor: "" }; renderView(); }

    else if (a === "new-defect") { state.quality.showForm = true; state.newDefect = freshDefectDraft(); renderView(); }
    else if (a === "cancel-new-defect") { state.quality.showForm = false; renderView(); }
    else if (a === "save-new-defect") addDefectRecord();
    else if (a === "del-defect") {
      const did = actWrap.getAttribute("data-id");
      if (confirm("Excluir este registro de defeito?")) S.remove("defectRecords", did).catch(er => toast(errMsg(er)));
    }
    else if (a === "quality-clear") { state.quality = { periodo: "30d", dateFrom: "", dateTo: "", opId: "", productId: "", employeeId: "", machineId: "", showForm: state.quality.showForm, opAnalysisId: state.quality.opAnalysisId }; renderView(); }

    else if (a === "finish-po") finishProductionOrder(id);

    else if (a === "new-op") { state.newOPForm = true; state.newOP = freshOPDraft(); renderView(); }
    else if (a === "new-op-for-order") {
      state.newOPForm = true;
      state.newOP = freshOPDraft();
      state.newOP.orderId = id;
      renderView();
    }
    else if (a === "cancel-new-op") { state.newOPForm = false; renderView(); }
    else if (a === "save-new-op") addOP();
    else if (a === "toggle-op-component") {
      /* Etapa 2: marca/desmarca um componente da ficha técnica na Nova OP. */
      const name = actWrap.getAttribute("data-name");
      const list = state.newOP.selectedComponents || (state.newOP.selectedComponents = []);
      const idx = list.indexOf(name);
      if (idx >= 0) list.splice(idx, 1); else list.push(name);
      renderView();
    }
    else if (a === "toggle-op") { state.openOPs[id] = !state.openOPs[id]; renderView(); }
    else if (a === "op-status") { setOPStatus(id, actWrap.getAttribute("data-status")); }
    else if (a === "fila-start") filaStart(actWrap.getAttribute("data-id"));
    else if (a === "fila-pause") filaPause(actWrap.getAttribute("data-id"));
    else if (a === "fila-resume") filaResume(actWrap.getAttribute("data-id"));
    else if (a === "fila-finish-open") {
      state.filaF = { taskId: actWrap.getAttribute("data-id"), qty: "", def: "", err: "" };
      renderView();
    }
    else if (a === "fila-finish-cancel") {
      state.filaF = { taskId: "", qty: "", def: "", err: "" };
      renderView();
    }
    else if (a === "fila-finish-save") filaFinish(actWrap.getAttribute("data-id"));
    else if (a === "save-config") saveConfig();
    else if (a === "load-demo") loadDemoData();
    else if (a === "change-pin") changePin();
    else if (a === "set-op-pin") setOpPin();
    else if (a === "clear-op-pin") clearOpPin();
    else if (a === "logout") { try { sessionStorage.removeItem("cp_auth"); } catch (er) { } location.reload(); }
    else if (a === "reset-local") {
      if (!confirm("Apagar TODOS os dados locais e recomeçar?")) return;
      ["cp_config", "cp_machines", "cp_products", "cp_productions", "cp_employees", "cp_orders", "cp_productionOrders", "cp_ops", "cp_materials", "cp_stockMovements", "cp_defectRecords"].forEach(k => { try { localStorage.removeItem(k); } catch (er) { } });
      location.reload();
    }
  }

  init();
})();