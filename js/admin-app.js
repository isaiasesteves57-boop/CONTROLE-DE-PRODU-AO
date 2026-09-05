/* =====================================================================
   CONTROLE DE PRODUÇÃO — Administração (admin.html)
   Módulos: 2 Cadastro de máquinas · 3 Cadastro de produtos
           6 Capacidade produtiva · Ajustes (PIN / meta / dados)
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;
  const root = document.getElementById("app");

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
  const SEED_CONFIG = [{ id: "default", companyName: "CONTROLE DE PRODUÇÃO", sector: "Setor de Furação", defectLimit: 1, pinHash: "" }];

  let machines = [], products = [], productions = [], config = SEED_CONFIG[0];
  const draftMachine = {};
  const draftProduct = {};

  const state = {
    authed: false,
    tab: "maquinas",
    pin: "",
    newMachineForm: false,
    newProductForm: false,
    newMachine: { name: "", type: "automatica" },
    newProduct: { name: "", hasModels: false, modelsText: "" }
  };

  try { state.authed = sessionStorage.getItem("cp_auth") === "1"; } catch (e) { }

  const TABS = [
    ["maquinas", "Máquinas"],
    ["produtos", "Produtos"],
    ["capacidade", "Capacidade"],
    ["ajustes", "Ajustes"]
  ];

  /* ---------- INIT ---------- */
  function init() {
    S.on("config", d => { config = (d && d[0]) || SEED_CONFIG[0]; softRender(); });
    S.on("machines", d => { machines = d; softRender(); });
    S.on("products", d => { products = d; softRender(); });
    S.on("productions", d => { productions = d; softRender(); });
    S.init("config", SEED_CONFIG);
    S.init("machines", SEED_MACHINES);
    S.init("products", SEED_PRODUCTS);
    S.init("productions", []);
    machines = S.get("machines");
    products = S.get("products");
    productions = S.get("productions");
    const cfgArr = S.get("config");
    config = (cfgArr && cfgArr[0]) || SEED_CONFIG[0];
    root.addEventListener("click", onClickGlobal);
    renderAll();
  }

  function softRender() {
    if (!state.authed) { renderLogin(); return; }
    if (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    renderAll();
  }

  /* ---------- LOGIN ---------- */
  function renderLogin() {
    const cfg = config || SEED_CONFIG[0];
    root.innerHTML = `
      <div class="login">
        <div class="login-box">
          <div class="login-logo">${U.icon("lock", "lg")}</div>
          <h1 class="login-title">ADMINISTRAÇÃO<br><span class="rust">DA FÁBRICA</span></h1>
          <p class="login-sub">${U.esc(cfg.sector || "Setor de Furação")} · módulos 2, 3, 6</p>
          <input id="pinInput" type="password" inputmode="numeric" maxlength="12" class="login-pin" placeholder="••••" autocomplete="off"
            style="margin-bottom:4px" />
          <p class="login-hint">${cfg.pinHash ? "Digite seu PIN de acesso" : "Use o MESMO PIN do aplicativo principal"}</p>
          <p class="login-err" id="pinErr"></p>
          <button data-act="login" class="btn btn-primary btn-block">Entrar</button>
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

  /* ---------- SHELL ---------- */
  function renderAll() {
    if (!state.authed) { renderLogin(); return; }
    const titles = { maquinas: "Cadastro de máquinas", produtos: "Cadastro de produtos", capacidade: "Capacidade produtiva", ajustes: "Ajustes do sistema" };
    const company = (config && config.companyName) || "CONTROLE DE PRODUÇÃO";
    root.innerHTML = `
      <div class="shell">
        <header class="head">
          <div class="head-top">
            <div class="brand">
              <div class="brand-mark">${U.icon("sliders", "lg")}</div>
              <div>
                <div class="brand-name">CONTROLE DE <span class="rust">PRODUÇÃO</span></div>
                <div class="tiny dim" style="margin-top:2px">${U.esc(company).toUpperCase()} · ADMIN</div>
              </div>
            </div>
            <button class="icon-btn" data-act="go-index" title="Abrir painel do dia">${U.icon("dashboard")}</button>
          </div>
          <h2 class="page-title">${titles[state.tab]}</h2>
        </header>
        <div class="tabs">
          ${TABS.map(([id, label]) => `<button class="tab-btn ${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}
        </div>
        <main id="view" class="content"></main>
        <div class="hpad"></div>
        ${S.isRemote() ? "" : '<div class="banner">Modo local — dados salvos neste aparelho</div>'}
      </div>`;
    renderViewAdmin();
  }

  function renderViewAdmin() {
    const v = document.getElementById("view");
    if (!v) return;
    if (state.tab === "maquinas") renderMaquinas(v);
    else if (state.tab === "produtos") renderProdutos(v);
    else if (state.tab === "capacidade") renderCapacidade(v);
    else renderAjustes(v);
    bindAllAdmin();
  }

  /* ---------- MÁQUINAS ---------- */
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
    const d = draftMachine[m.id];
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
                <option value="manual" ${d.type === "manual" ? "selected" : ""}>Manual</option>
              </select>
            </div>
            <div class="field"><label>Status</label>
              <select data-k="status">
                <option value="produzindo" ${d.status === "produzindo" ? "selected" : ""}>Produzindo</option>
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
    const run = m.status === "produzindo";
    const typeLab = m.type === "automatica" ? "Automática" : "Manual";
    return `
      <div class="card pad">
        <div class="rowc">
          <div class="dot" style="background:${run ? "var(--ok)" : "var(--steel-dim)"}"></div>
          <div class="f1">
            <div class="small" style="font-weight:600">${U.esc(m.name)}</div>
            <div class="tiny dim">${typeLab}</div>
          </div>
          <span class="pill ${run ? "produzindo" : "parada"}">${run ? "Produzindo" : "Parada"}</span>
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
            <option value="manual" ${state.newMachine.type === "manual" ? "selected" : ""}>Manual</option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" data-act="save-new-mach">Adicionar máquina</button>
      </div>`;
  }

  /* ---------- PRODUTOS ---------- */
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
    const d = draftProduct[p.id];
    if (d) {
      return `
        <div class="card pad" data-edit-prod-id="${p.id}">
          <div class="rowc between mb12">
            <span class="small" style="font-weight:600">Editando: ${U.esc(p.name)}</span>
            <button class="btn-ghost" data-act="cancel-prod" data-id="${p.id}">Cancelar</button>
          </div>
          <div class="field"><label>Nome do produto</label><input data-k="name" value="${U.esc(d.name)}"></div>
          <label class="check-row"><input type="checkbox" data-k="hasModels"> Possui modelos de furação</label>
          <div class="field mt12" id="prod-models-field" style="${d.hasModels ? "" : "display:none"}">
            <label>Modelos (separados por vírgula)</label>
            <input data-k="modelsText" value="${U.esc(d.modelsText)}" placeholder="Espiral, Wero, Smart, Ficario">
          </div>
          <div class="field-row mt12">
            <div class="field"><label>Capacidade por dia (un., nominal)</label><input type="number" data-k="capacityDay" value="${d.capacityDay}"></div>
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

  /* ---------- CAPACIDADE PRODUTIVA (módulo 6) ---------- */
  function renderCapacidade(v) {
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

    v.innerHTML = `
      <div class="card pad" style="background:var(--panel)">
        <div class="rowc">${U.icon("info", "sm")}<span class="small dim">O sistema aprende com os lançamentos de produção. Estimativa = produção total ÷ dias com registro. Quanto mais dias, mais precisa.</span></div>
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

  /* ---------- AJUSTES ---------- */
  function renderAjustes(v) {
    const c = config || SEED_CONFIG[0];
    v.innerHTML = `
      <div class="card pad">
        <div class="section-label" style="margin-top:0">${U.icon("sliders", "sm")} Dados exibidos no aplicativo</div>
        <div class="field"><label>Nome da empresa / fábrica</label><input id="set-company" value="${U.esc(c.companyName || "")}"></div>
        <div class="field"><label>Setor</label><input id="set-sector" value="${U.esc(c.sector || "")}"></div>
        <div class="field-row">
          <div class="field"><label>Meta de defeito (%)</label><input type="number" id="set-limit" min="0" max="100" step="0.1" value="${c.defectLimit === undefined ? 1 : c.defectLimit}"></div>
        </div>
        <button class="btn btn-primary btn-block" data-act="save-config">Salvar ajustes</button>
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
        <div class="section-label" style="margin-top:0">${U.icon("info", "sm")} Sistema</div>
        <p class="small dim">Modo de dados: <b style="color:var(--text)">${S.isRemote() ? "Firestore (nuvem)" : "Local (este aparelho)"}</b></p>
        ${S.isRemote() ? "" : '<p class="small dim">Para compartilhar os dados entre aparelhos (Firebase), preencha as chaves em <span class="mono" style="color:var(--text)">js/firebase-config.js</span>.</p>'}
        <div class="space-y mt12">
          <button class="btn btn-outline btn-block" data-act="logout">${U.icon("logout", "sm")} Sair do painel</button>
          <button class="btn btn-outline btn-block" data-act="reset-local">Apagar dados deste aparelho</button>
        </div>
      </div>

      <div class="card pad mt12">
        <div class="section-label" style="margin-top:0">${U.icon("chart", "sm")} Próximos módulos</div>
        <p class="small dim">7 · Planejamento de produção · 8 · Controle de estoque · 9 · App dos operadores</p>
      </div>`;
  }

  /* ---------- BINDINGS ADMIN ---------- */
  function bindAllAdmin() {
    document.querySelectorAll("[data-edit-mach-id]").forEach(c => {
      const id = c.getAttribute("data-edit-mach-id");
      const d = draftMachine[id];
      if (!d) return;
      c.querySelectorAll("[data-k]").forEach(el => {
        const k = el.getAttribute("data-k");
        const ev = el.tagName === "SELECT" ? "change" : (el.type === "checkbox" ? "change" : "input");
        el.addEventListener(ev, () => { d[k] = el.type === "checkbox" ? el.checked : el.value; });
      });
    });
    document.querySelectorAll("[data-edit-prod-id]").forEach(c => {
      const id = c.getAttribute("data-edit-prod-id");
      const d = draftProduct[id];
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
  }

  /* ---------- AÇÕES ---------- */
  async function saveMachine(id) {
    const d = draftMachine[id];
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
    delete draftMachine[id];
    await S.update("machines", id, patch);
    toast("Máquina salva");
  }

  async function saveProduct(id) {
    const d = draftProduct[id];
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
    delete draftProduct[id];
    await S.update("products", id, patch);
    toast("Produto salvo");
  }

  async function addMachine() {
    const name = (state.newMachine.name || "").trim();
    if (!name) { toast("Informe o nome da máquina."); return; }
    await S.add("machines", {
      name, type: state.newMachine.type,
      status: "parada", currentProduct: "", client: "",
      capacityHour: 0, capacityDay: 0
    });
    state.newMachine = { name: "", type: "automatica" };
    state.newMachineForm = false;
    toast("Máquina adicionada");
  }

  async function addProduct() {
    const name = (state.newProduct.name || "").trim();
    if (!name) { toast("Informe o nome do produto."); return; }
    const models = state.newProduct.hasModels
      ? String(state.newProduct.modelsText || "").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    await S.add("products", {
      name, hasModels: state.newProduct.hasModels, models,
      capacityHour: 0, capacityDay: 0, maxDefectRate: Number(config.defectLimit) || 1
    });
    state.newProduct = { name: "", hasModels: false, modelsText: "" };
    state.newProductForm = false;
    toast("Produto adicionado");
  }

  function onClickGlobal(e) {
    const tabEl = e.target.closest("[data-tab]");
    if (tabEl) {
      state.tab = tabEl.getAttribute("data-tab");
      window.scrollTo(0, 0);
      renderAll();
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const a = act.getAttribute("data-act");
    const id = act.getAttribute("data-id");

    if (a === "login") doLogin();
    else if (a === "go-index") { location.href = "./index.html"; }
    else if (a === "edit-mach") {
      const m = machines.find(x => x.id === id);
      if (m) draftMachine[id] = {
        name: m.name, type: m.type, status: m.status,
        currentProduct: m.currentProduct || "", client: m.client || "",
        capacityHour: m.capacityHour || "", capacityDay: m.capacityDay || ""
      };
      renderViewAdmin();
    }
    else if (a === "cancel-mach") { delete draftMachine[id]; renderViewAdmin(); }
    else if (a === "save-mach") saveMachine(id);
    else if (a === "new-machine") { state.newMachineForm = true; state.newMachine = { name: "", type: "automatica" }; renderViewAdmin(); }
    else if (a === "cancel-new-mach") { state.newMachineForm = false; renderViewAdmin(); }
    else if (a === "save-new-mach") addMachine();
    else if (a === "edit-prod") {
      const p = products.find(x => x.id === id);
      if (p) draftProduct[id] = {
        name: p.name, hasModels: p.hasModels,
        modelsText: (p.models || []).join(", "),
        capacityHour: p.capacityHour || "", capacityDay: p.capacityDay || "",
        maxDefectRate: p.maxDefectRate === undefined ? 1 : p.maxDefectRate
      };
      renderViewAdmin();
    }
    else if (a === "cancel-prod") { delete draftProduct[id]; renderViewAdmin(); }
    else if (a === "save-prod") saveProduct(id);
    else if (a === "new-product") { state.newProductForm = true; state.newProduct = { name: "", hasModels: false, modelsText: "" }; renderViewAdmin(); }
    else if (a === "cancel-new-prod") { state.newProductForm = false; renderViewAdmin(); }
    else if (a === "save-new-prod") addProduct();
    else if (a === "save-config") saveConfig();
    else if (a === "change-pin") changePin();
    else if (a === "logout") { try { sessionStorage.removeItem("cp_auth"); } catch (e) { } location.reload(); }
    else if (a === "reset-local") {
      if (!confirm("Apagar TODOS os dados locais e recomeçar?")) return;
      ["cp_config", "cp_machines", "cp_products", "cp_productions"].forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
      location.reload();
    }
  }

  async function saveConfig() {
    const company = document.getElementById("set-company");
    const sector = document.getElementById("set-sector");
    const limit = document.getElementById("set-limit");
    await S.update("config", "default", {
      companyName: company ? company.value.trim() : config.companyName,
      sector: sector ? sector.value.trim() : config.sector,
      defectLimit: limit ? Number(limit.value) : (config.defectLimit || 1)
    });
    toast("Ajustes salvos");
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
    await S.update("config", "default", { pinHash: hash });
    p1.value = ""; p2.value = "";
    toast("PIN atualizado");
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