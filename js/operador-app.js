/* =====================================================================
   CONTROLE DE PRODUÇÃO — App do Operador (operador.html)
   Fluxo (Módulo de acesso — Funcionários):
     PIN do funcionário → identifica quem é → mostra só as máquinas que
     ele tem permissão → "Qual máquina você está operando hoje?" →
     material → rodando → fim do dia → OK + quantidade → lançamento
     salvo no app principal (com funcionário + máquina + produto +
     quantidade + tempo).

     O funcionário NÃO fica fixo em uma máquina: a máquina é escolhida
     a cada novo turno, dentre as que ele estiver autorizado a operar.

     Se ainda não houver nenhum funcionário cadastrado (sistema recém
     instalado), a tela abre no modo livre antigo (escolha de máquina
     sem PIN) até que o gestor cadastre o primeiro funcionário.
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;
  const root = document.getElementById("app");

  const SEED_CONFIG = [{ id: "default", companyName: "CONTROLE DE PRODUÇÃO", sector: "Setor de Furação", defectLimit: 1, dailyGoal: 0, pinHash: "" }];
  const SEED_MACHINES = [
    { id: "auto-1", name: "Automática 1", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "auto-2", name: "Automática 2", type: "automatica", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
    { id: "escanteadeira", name: "Escanteadeira", type: "escanteadeira", status: "parada", currentProduct: "", client: "", capacityHour: 0, capacityDay: 0 },
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

  let machines = [], products = [], employees = [], config = SEED_CONFIG[0];
  /* Pedidos e Ordens de Produção (Módulo de pedidos): quando o gestor
     cria uma Ordem de Produção para a máquina escolhida, o operador
     recebe essa ordem em vez de escolher produto livremente. */
  let orders = [], productionOrders = [];

  const st = {
    phase: "idle",
    machId: "",
    opName: "",
    productId: "",
    model: "",
    startTime: "",
    qty: "",
    def: "",
    finishErr: "",
    opPin: "",
    lastDone: null,
    /* Login por funcionário (Módulo de acesso): identificação por PIN,
       sem vínculo fixo com máquina. */
    empPin: "",
    empId: "",
    /* Sessão vinculada a uma Ordem de Produção do módulo de pedidos. */
    productionOrderId: "",
    orderId: ""
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

  /* Ordem de Produção pendente (não finalizada) para a máquina escolhida,
     a mais antiga primeiro — é ela que o operador recebe ao iniciar. */
  function pendingPOForEmployee(employeeId) {
    return productionOrders
      .filter(po => po.employeeId === employeeId && po.status !== "finalizada")
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  function pendingPOForMachine(machineId) {
    return productionOrders
      .filter(po => po.machineId === machineId && !po.employeeId && po.status !== "finalizada")
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0] || null;
  }
  /* Saldo do pedido (item 3/4/8): sempre recalculado a partir da soma
     das produções já registradas — nunca um contador que é decrementado
     duas vezes. Retrabalho não conta para o saldo do pedido principal. */
  function pedidoInfo(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;
    const totalProduced = productionOrders
      .filter(x => x.orderId === orderId && x.operacao !== "retrabalho")
      .reduce((s, x) => s + (Number(x.quantityProduced) || 0), 0);
    const qty = Number(order.quantity) || 0;
    const remaining = Math.max(0, qty - totalProduced);
    return { order, qty, totalProduced, remaining };
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
    S.on("employees", d => { employees = d; softRender(); });
    S.on("orders", d => { orders = d; softRender(); });
    S.on("productionOrders", d => { productionOrders = d; softRender(); });
    S.init("config", SEED_CONFIG);
    S.init("machines", SEED_MACHINES);
    S.init("products", SEED_PRODUCTS);
    S.init("employees", []);
    S.init("orders", []);
    S.init("productionOrders", []);
    machines = S.get("machines");
    products = S.get("products");
    employees = S.get("employees");
    orders = S.get("orders");
    productionOrders = S.get("productionOrders");
    const cfgArr = S.get("config");
    config = (cfgArr && cfgArr[0]) || SEED_CONFIG[0];
    root.addEventListener("click", onClick);

    /* Existe pelo menos um funcionário ativo cadastrado? Se sim, o
       acesso passa a exigir login por PIN pessoal. Se não (sistema
       recém instalado, sem cadastro ainda), mantém o modo livre. */
    const hasActiveEmployees = employees.some(e => e.status === "ativo");

    const sess = lsObj("cp_opsession");
    if (sess && sess.machId && (sess.productionOrderId || sess.productId)) {
      const machineOk = machines.some(m => m.id === sess.machId);
      if (sess.productionOrderId) {
        if (machineOk && productionOrders.some(po => po.id === sess.productionOrderId)) {
          st.machId = sess.machId;
          st.productionOrderId = sess.productionOrderId;
          st.orderId = sess.orderId || "";
          st.startTime = sess.startTime || nowHM();
          st.phase = "running";
          st.opName = sess.opName || st.opName;
          st.empId = sess.empId || "";
        } else {
          lsDel("cp_opsession");
        }
      } else if (machineOk && products.some(p => p.id === sess.productId)) {
        st.machId = sess.machId;
        st.productId = sess.productId;
        st.model = sess.model || "";
        st.startTime = sess.startTime || nowHM();
        st.phase = "running";
        st.opName = sess.opName || st.opName;
        st.empId = sess.empId || "";
      } else {
        lsDel("cp_opsession");
      }
    } else {
      lsDel("cp_opsession");
    }

    if (st.phase === "idle" && hasActiveEmployees) st.phase = "pin-login";
    renderAll();
  }

  function softRender() {
    if (st.phase === "running" || st.phase === "finish") return;
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    renderAll();
  }

  function opLocked() {
    /* Quando já existe cadastro de funcionários ativo, a identificação
       por PIN individual (tela "Identifique-se") passa a ser o único
       controle de acesso — o PIN genérico de operador (legado) fica
       dispensado para não conflitar com o PIN pessoal de cada um. */
    const hasActiveEmployees = employees.some(e => e.status === "ativo");
    if (hasActiveEmployees) return false;
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
    const identified = st.empId && st.phase !== "pin-login";
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
          ${identified
            ? `<div class="tiny dim" style="text-align:right">${U.icon("user", "sm")} ${U.esc(st.opName)}</div>`
            : `<a class="op-link" href="./index.html">${U.icon("dashboard", "sm")} Gestor</a>`}
        </div>
        <div class="op-body">
          ${phaseView()}
        </div>
        ${S.isRemote() ? "" : '<div class="tiny dim" style="text-align:center;margin-top:10px">Modo local · dados salvos neste aparelho</div>'}
      </div>`;
    wire();
    if (st.phase === "pin-login") wirePinLogin();
    if (st.phase === "running") startTimer();
  }

  function phaseView() {
    if (st.phase === "pin-login") return viewPinLogin();
    if (st.phase === "machine-select") return viewMachineSelect();
    if (st.phase === "order-ready") return viewOrderReady();
    if (st.phase === "material") return viewMaterial();
    if (st.phase === "running") return viewRunning();
    if (st.phase === "finish") return viewFinish();
    if (st.phase === "done") return viewDone();
    return viewIdle();
  }

  /* ---------- 1) LOGIN DO FUNCIONÁRIO — identificação pelo PIN ---------- */
  function viewPinLogin() {
    return `
      <div class="op-center">
        <h2 class="op-title">Identifique-se</h2>
        <p class="op-sub">Digite seu PIN pessoal para continuar</p>
      </div>

      <div class="op-card">
        <label>PIN do funcionário</label>
        <input id="emp-pin" class="op-pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="••••" />
        <p class="op-pin-err" id="emp-pin-err"></p>
      </div>
      <button class="op-big go" data-act="emp-login">${U.icon("checkc")} ENTRAR</button>`;
  }

  function wirePinLogin() {
    const pinEl = document.getElementById("emp-pin");
    if (pinEl) {
      pinEl.value = st.empPin || "";
      pinEl.addEventListener("input", () => { st.empPin = pinEl.value; });
      pinEl.addEventListener("keydown", e => { if (e.key === "Enter") doEmpLogin(); });
      pinEl.focus();
    }
  }

  async function doEmpLogin() {
    const btn = root.querySelector('[data-act="emp-login"]');
    const errEl = document.getElementById("emp-pin-err");
    const pin = (st.empPin || "").trim();
    if (pin.length < 4) { if (errEl) errEl.textContent = "Digite o seu PIN."; return; }
    if (btn) btn.disabled = true;
    const hash = await U.hashPin(pin);
    const em = employees.find(x => x.status === "ativo" && x.pinHash === hash);
    if (!em) {
      if (errEl) errEl.textContent = "PIN não encontrado. Fale com o gestor.";
      if (btn) btn.disabled = false;
      st.empPin = "";
      const pinEl = document.getElementById("emp-pin");
      if (pinEl) pinEl.value = "";
      return;
    }
    st.empId = em.id;
    st.opName = em.name;
    st.empPin = "";
    st.machId = "";
    try { localStorage.setItem("cp_opname", st.opName); } catch (e) { }
    /* Se o gestor deixou uma tarefa atribuída a este funcionário,
       ela aparece imediatamente: o funcionário só precisa apertar PLAY. */
    const assigned = pendingPOForEmployee(em.id);
    if (assigned.length) {
      st.productionOrderId = assigned[0].id;
      st.orderId = assigned[0].orderId || "";
      st.machId = assigned[0].machineId || "";
      st.phase = "order-ready";
    } else {
      st.phase = "machine-select";
    }
    renderAll();
  }

  /* ---------- 2) ESCOLHA DA MÁQUINA — só as que o funcionário pode operar ---------- */
  function viewMachineSelect() {
    const em = employees.find(x => x.id === st.empId);
    const allowed = em ? (em.allowedMachines || []) : [];
    const list = machines.filter(m => allowed.indexOf(m.id) >= 0);
    return `
      <div class="op-center">
        <h2 class="op-title">Olá, ${em ? U.esc(em.name) : ""}</h2>
        <p class="op-sub">Qual máquina você está operando hoje?</p>
      </div>

      <div class="op-card">
        ${list.length ? `
          <div class="op-grid">
            ${list.map(m => `
              <button class="op-chip ${st.machId === m.id ? "sel" : ""}" data-mach="${m.id}">
                ${U.icon("cog")}<span>${U.esc(m.name)}</span></button>`).join("")}
          </div>` : '<div class="empty">Nenhuma máquina liberada para você. Fale com o gestor.</div>'}
      </div>

      ${list.length ? `
      <button class="op-big go" data-act="begin" ${st.machId ? "" : "disabled"}>${U.icon("play")} INICIAR</button>` : ""}

      <p style="text-align:center;margin-top:14px"><button class="op-link" data-act="logout-emp">${U.icon("logout", "sm")} Trocar de funcionário</button></p>`;
  }

  /* ---------- ORDEM DE PRODUÇÃO recebida do gestor (Módulo de pedidos) ----------
     Quando existe uma Ordem de Produção pendente para a máquina escolhida,
     o operador recebe direto o produto/cliente definidos pelo gestor —
     sem precisar escolher o material manualmente. */
  function viewOrderReady() {
    const m = machines.find(x => x.id === st.machId);
    const po = productionOrders.find(x => x.id === st.productionOrderId);
    const order = po ? orders.find(x => x.id === po.orderId) : null;
    const info = po ? pedidoInfo(po.orderId) : null;
    return `
      <div class="op-center">
        <h2 class="op-title">Tarefa</h2>
        <p class="op-sub">Confira os dados e inicie a produção</p>
      </div>

      <div class="op-sum">
        <div class="op-sum-item"><div class="sk">Produto</div><div class="sv" style="font-size:14px">${po ? U.esc(po.product) + (po.model ? " — " + U.esc(po.model) : "") : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Cliente</div><div class="sv" style="font-size:14px">${order ? U.esc(order.client) : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Máquina</div><div class="sv">${m ? U.esc(m.name) : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Operação</div><div class="sv">${po && po.operacao === "retrabalho" ? "Retrabalho" : "Produção"}</div></div>
      </div>

      ${info ? `
      <div class="op-sum mt8">
        <div class="op-sum-item"><div class="sk">Quantidade do pedido</div><div class="sv">${U.fmt(info.qty)}</div></div>
        <div class="op-sum-item"><div class="sk">Produzido anteriormente</div><div class="sv">${U.fmt(po.quantityProduced || 0)}</div></div>
        <div class="op-sum-item"><div class="sk">Saldo do pedido</div><div class="sv" style="color:var(--amber2)">${U.fmt(info.remaining)}</div></div>
      </div>` : ""}

      <button class="op-big go" data-act="confirm-order">${U.icon("play")} INICIAR PRODUÇÃO</button>
      <button class="op-big ghost" data-act="cancel">Cancelar</button>`;
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
    const po = st.productionOrderId ? productionOrders.find(x => x.id === st.productionOrderId) : null;
    const p = po ? null : products.find(x => x.id === st.productId);
    const order = po ? orders.find(x => x.id === po.orderId) : null;
    const label = po ? (po.product + (po.model ? " — " + po.model : "")) : (p ? p.name : "");
    const mins = minsSince(st.startTime);
    const info = po ? pedidoInfo(po.orderId) : null;
    return `
      <div class="op-center">
        <span class="op-run-led"></span>
        <h2 class="op-title" style="color:var(--ok);margin:8px 0 2px">PRODUZINDO</h2>
        <p class="op-sub">${m ? U.esc(m.name) : ""} · ${U.esc(label)}${!po && st.model ? " — " + U.esc(st.model) : ""}${po && order ? " · " + U.esc(order.client) : ""}</p>
      </div>

      <div class="op-card op-center">
        <div class="op-clock" id="op-clock">${fmtClock(mins * 60)}</div>
        <div class="op-run-info mt8">
          <span class="op-clock-start">Iniciou às ${U.esc(st.startTime)}</span>
          <span class="op-clock-start">Tempo de turno: ${fmtDur(mins)}</span>
        </div>
      </div>

      ${info ? `<div class="op-sum"><div class="op-sum-item"><div class="sk">Saldo do pedido</div><div class="sv" style="color:var(--amber2)">${U.fmt(info.remaining)}</div></div></div>` : ""}

      <button class="op-big safe" data-act="open-finish">${U.icon("checkc")} CONCLUIR TURNO — FIM DO DIA</button>
      <button class="op-big ghost" data-act="leave-running">${U.icon("logout")} SAIR E VOLTAR DEPOIS</button>
      <p class="tiny dim" style="text-align:center;margin-top:8px">Seu turno ficará salvo. Ao abrir o app novamente, você poderá continuar e finalizar o dia.</p>`;
  }

  function viewFinish() {
    const m = machines.find(x => x.id === st.machId);
    const po = st.productionOrderId ? productionOrders.find(x => x.id === st.productionOrderId) : null;
    const p = po ? null : products.find(x => x.id === st.productId);
    const mins = minsSince(st.startTime);
    const materialLabel = po ? (po.product + (po.model ? " — " + po.model : "")) : (p ? p.name + (st.model ? " — " + st.model : "") : "—");
    return `
      <div class="op-center">
        <h2 class="op-title">Fim do turno</h2>
        <p class="op-sub">Confira e lance a produção do dia</p>
      </div>

      <div class="op-sum">
        <div class="op-sum-item"><div class="sk">Data</div><div class="sv">${U.fmtDate(U.todayStr())}</div></div>
        <div class="op-sum-item"><div class="sk">Máquina</div><div class="sv">${m ? U.esc(m.name) : "—"}</div></div>
        <div class="op-sum-item"><div class="sk">Material</div><div class="sv" style="font-size:14px">${U.esc(materialLabel)}</div></div>
        <div class="op-sum-item"><div class="sk">Tempo</div><div class="sv">${fmtDur(mins)}</div></div>
      </div>

      ${po ? (() => {
        const info = pedidoInfo(po.orderId);
        return info ? `<div class="op-sum">
          <div class="op-sum-item"><div class="sk">Saldo do pedido</div><div class="sv" style="color:var(--amber2)">${U.fmt(info.remaining)}</div></div>
        </div>` : "";
      })() : ""}

      <div class="op-card">
        <label>Quantidade produzida (un.)</label>
        <input class="op-num" id="op-qty" type="number" inputmode="numeric" min="0" value="${st.qty}" placeholder="0" />
        <label style="margin-top:12px">Defeitos (opcional, un.)</label>
        <input class="op-num" id="op-def" type="number" inputmode="numeric" min="0" value="${st.def}" placeholder="0" />
        ${st.finishErr ? `<p class="op-pin-err" id="op-finish-err">${U.esc(st.finishErr)}</p>` : '<p class="op-pin-err" id="op-finish-err"></p>'}
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
    if (qtyEl) qtyEl.addEventListener("input", () => {
      st.qty = qtyEl.value;
      st.finishErr = "";
      const errEl = document.getElementById("op-finish-err");
      if (errEl) errEl.textContent = "";
    });
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

    if (a === "begin") {
      if (!st.machId) return;
      /* Se o gestor já criou uma tarefa para este funcionário, ela tem prioridade. */
      const assigned = st.empId ? pendingPOForEmployee(st.empId) : [];
      const po = assigned[0] || pendingPOForMachine(st.machId);
      if (po) {
        st.productionOrderId = po.id;
        st.orderId = po.orderId;
        st.productId = ""; st.model = "";
        st.phase = "order-ready";
      } else {
        st.productionOrderId = ""; st.orderId = "";
        st.phase = "material";
      }
      renderAll();
    }
    else if (a === "confirm-material") confirmMaterial();
    else if (a === "confirm-order") confirmOrder();
    else if (a === "open-finish") { st.finishErr = ""; st.phase = "finish"; renderAll(); }
    else if (a === "leave-running") { leaveRunning(); }
    else if (a === "save-finish") saveFinish();
    else if (a === "cancel") cancelTurn();
    else if (a === "new-day") {
      st.productId = ""; st.model = ""; st.qty = ""; st.def = ""; st.lastDone = null; st.machId = "";
      st.productionOrderId = ""; st.orderId = "";
      /* Não fica fixo em máquina: a cada novo turno, pergunta de novo
         qual máquina o funcionário vai operar (pode ser outra). */
      st.phase = st.empId ? "machine-select" : "idle";
      renderAll();
    }
    else if (a === "op-login") doOpLogin();
    else if (a === "emp-login") doEmpLogin();
    else if (a === "logout-emp") {
      st.empId = ""; st.opName = ""; st.machId = ""; st.empPin = "";
      lsDel("cp_opname");
      st.phase = "pin-login";
      renderAll();
    }
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
      startTime: st.startTime, prevStatus: m.status || "parada",
      opName: st.opName || "", empId: st.empId || ""
    }));
    try {
      await S.update("machines", st.machId, {
        status: "produzindo",
        currentProduct: p.name,
        client: m.client || ""
      });
    } catch (e) { toast(errMsg(e)); }
    st.phase = "running";
    renderAll();
  }

  /* Início de turno vinculado a uma Ordem de Produção (Módulo de pedidos):
     salva data, hora início, funcionário e máquina, como no fluxo livre. */
  async function confirmOrder() {
    const m = machines.find(x => x.id === st.machId);
    const po = productionOrders.find(x => x.id === st.productionOrderId);
    if (!m || !po) return;
    const order = orders.find(x => x.id === po.orderId);
    st.startTime = nowHM();
    lsSet("cp_opsession", JSON.stringify({
      machId: st.machId, productionOrderId: po.id, orderId: po.orderId,
      startTime: st.startTime, prevStatus: m.status || "parada",
      opName: st.opName || "", empId: st.empId || ""
    }));
    try {
      await S.update("machines", st.machId, {
        status: "produzindo",
        currentProduct: po.product,
        client: (order && order.client) || m.client || ""
      });
    } catch (e) { toast(errMsg(e)); }
    if (po.status === "aguardando") {
      try { await S.update("productionOrders", po.id, { status: "em_producao", startedAt: Date.now() }); } catch (e) { toast(errMsg(e)); }
    }
    st.phase = "running";
    renderAll();
  }

  function leaveRunning() {
    /* Não apaga cp_opsession: o turno continua aberto e será recuperado
       automaticamente quando o funcionário voltar ao app. */
    clearTimer();
    try { sessionStorage.setItem("cp_op_left", "1"); } catch (e) { }
    location.href = "./home.html";
  }

  async function cancelTurn() {
    const sess = lsObj("cp_opsession");
    if (sess && sess.machId && sess.prevStatus) {
      try { await S.update("machines", sess.machId, { status: sess.prevStatus }); } catch (e) { toast(errMsg(e)); }
    }
    lsDel("cp_opsession");
    st.productId = ""; st.model = ""; st.startTime = ""; st.qty = ""; st.def = ""; st.machId = "";
    st.productionOrderId = ""; st.orderId = "";
    /* Volta a perguntar a máquina (não fica fixo); se não estiver
       identificado, volta ao modo livre antigo. */
    st.phase = st.empId ? "machine-select" : "idle";
    renderAll();
  }

  async function saveFinish() {
    if (st.qty === "" ) { toast("Informe a quantidade produzida."); return; }
    /* Item 8: trava contra duplo clique/duplo toque no botão de
       finalizar produção — sem isso, dois cliques rápidos podiam
       gerar dois registros de produção para o mesmo lançamento. */
    if (st._savingFinish) return;
    st._savingFinish = true;
    const finishBtn = root.querySelector('[data-act="save-finish"]');
    if (finishBtn) finishBtn.disabled = true;
    try {
      await doSaveFinish();
    } finally {
      st._savingFinish = false;
    }
  }

  async function doSaveFinish() {
    const qty = Number(st.qty) || 0;
    const def = Number(st.def) || 0;
    const m = machines.find(x => x.id === st.machId) || {};
    const po = st.productionOrderId ? productionOrders.find(x => x.id === st.productionOrderId) : null;
    const p = po ? {} : (products.find(x => x.id === st.productId) || {});
    const order = po ? orders.find(x => x.id === po.orderId) : null;

    /* Item 8: não permitir informar mais do que o saldo disponível do
       pedido. O saldo é recalculado na hora — nunca um valor fixo salvo
       antes — para refletir produções de outros funcionários também. */
    if (po && order && po.operacao !== "retrabalho") {
      const info = pedidoInfo(order.id);
      if (info && qty > info.remaining) {
        st.finishErr = `A quantidade informada é maior que o saldo disponível deste pedido. Restam apenas ${U.fmt(info.remaining)} unidades.`;
        renderAll();
        return;
      }
    }

    const start = st.startTime || nowHM();
    const end = nowHM();
    const mins = minsSince(start);
    const hours = Math.round(mins / 60 * 100) / 100;
    const rate = qty > 0 ? def / qty * 100 : 0;
    const rec = {
      date: U.todayStr(),
      machineId: st.machId,
      machineName: m.name || "",
      productId: po ? "" : st.productId,
      productName: po ? (po.product + (po.model ? " — " + po.model : "")) : (p.name || ""),
      model: po ? (po.model || "") : ((p.hasModels) ? st.model : ""),
      client: po ? ((order && order.client) || "") : (m.client || ""),
      operator: st.opName || "Operador",
      employeeId: st.empId || "",
      startTime: start,
      endTime: end,
      quantityProduced: qty,
      defects: def,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      defectRate: rate,
      createdAt: Date.now(),
      orderId: po ? po.orderId : "",
      productionOrderId: po ? po.id : "",
      operacao: po ? po.operacao : ""
    };
    try {
      await S.add("productions", rec);
    } catch (e) {
      /* Registro principal não salvou — não avança a tela nem apaga a
         sessão, para o operador poder tentar de novo sem perder os dados
         digitados. */
      st.finishErr = errMsg(e);
      renderAll();
      return;
    }
    lsDel("cp_opsession");
    try { await S.update("machines", st.machId, { status: "parada", client: rec.client || m.client || "" }); } catch (e) { toast(errMsg(e)); }

    /* Atualiza a Ordem de Produção e o Pedido (Módulo de pedidos).
       Regra importante: retrabalho não é somado à produção principal
       do pedido — cada Ordem soma apenas dentro de si mesma. */
    if (po) {
      const newProduced = (Number(po.quantityProduced) || 0) + qty;
      const newDefects = (Number(po.defects) || 0) + def;
      const patchPO = { quantityProduced: newProduced, defects: newDefects };

      /* Item 4: o saldo do pedido é sempre "quantidade do pedido menos o
         total das produções registradas" — nunca um contador abatido de
         novo a cada tela aberta. Aqui só somamos esta produção uma vez,
         no lançamento que a originou. */
      let orderTotalAfter = null;
      if (order && po.operacao === "producao") {
        orderTotalAfter = productionOrders
          .filter(x => x.orderId === order.id && x.operacao === "producao")
          .reduce((s, x) => s + (x.id === po.id ? newProduced : (Number(x.quantityProduced) || 0)), 0);
      }

      if (orderTotalAfter !== null && (Number(order.quantity) || 0) > 0 && orderTotalAfter >= (Number(order.quantity) || 0)) {
        patchPO.status = "finalizada";
        patchPO.finishedAt = Date.now();
      } else if (po.status === "aguardando") {
        patchPO.status = "em_producao";
      }
      try { await S.update("productionOrders", po.id, patchPO); } catch (e) { toast(errMsg(e)); }

      if (orderTotalAfter !== null) {
        const patchOrder = {};
        if (orderTotalAfter >= (Number(order.quantity) || 0)) {
          if (order.status !== "finalizado") patchOrder.status = "finalizado";
        } else if (order.status === "aguardando") {
          patchOrder.status = "em_producao";
        }
        if (Object.keys(patchOrder).length) {
          try { await S.update("orders", order.id, patchOrder); } catch (e) { toast(errMsg(e)); }
        }
      }
    }

    st.lastDone = { machineName: rec.machineName, productName: rec.productName, qty: qty };
    st.phase = "done"; st.qty = ""; st.def = ""; st.finishErr = "";
    st.productionOrderId = ""; st.orderId = "";
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
  function errMsg(e) {
    const code = e && e.code ? String(e.code) : "";
    if (code.indexOf("permission-denied") >= 0) {
      return "Sem permissão para salvar no banco. Avise o administrador.";
    }
    if (code.indexOf("unavailable") >= 0) {
      return "Sem conexão com o servidor. Verifique a internet.";
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

  init();
})();