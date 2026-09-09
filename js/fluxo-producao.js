/* =====================================================================
   CONTROLE DE PRODUÇÃO — Fluxo Industrial (Etapa 8)

   Camada central do novo fluxo real de produção:

     Pedido → OP → Tarefa → Funcionário + Máquina → Apontamento →
     Qualidade → Baixa automática (Tarefa → OP → Pedido) → próxima
     produção da fila da máquina.

   Este módulo concentra as regras usadas pelas duas telas:
   • Gestor (index.html)  — Fila de máquinas, iniciar/finalizar produção
   • Operador (operador.html) — Minha produção (INICIAR/PAUSAR/FINALIZAR)

   A regra de saldo é sempre calculada — nunca um contador salvo. Restante
   de cada nível = planejado − produzido real (soma dos lançamentos).
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;

  const PRIO_ORDEM = { baixa: 0, media: 1, alta: 2 };

  /* ---------- LEITOS ---------- */
  function tasksAll() { return S.get("productionOrders"); }
  function task(id) { return tasksAll().find(p => p.id === id) || null; }
  function orderOf(po) { return S.get("orders").find(o => o.id === po.orderId) || null; }
  function opOf(po) { return S.get("ops").find(o => o.id === po.opId) || null; }
  function machine(id) { return S.get("machines").find(m => m.id === id) || null; }

  /* Produzido total de um pedido (retrabalho NÃO conta como produção
     nova — mesma regra do restante do sistema). */
  function producoesPedido(orderId) {
    return S.get("productions")
      .filter(p => p.orderId === orderId && (p.operacao || "producao") !== "retrabalho")
      .reduce((s, p) => s + (Number(p.quantityProduced) || 0), 0);
  }

  /* Produzido total de uma OP (soma das Tarefas vinculadas; retrabalho
     NÃO conta como produção nova). */
  function producoesOP(opId) {
    return tasksAll()
      .filter(p => p.opId === opId && (p.operacao || "producao") !== "retrabalho")
      .reduce((s, p) => s + (Number(p.quantityProduced) || 0), 0);
  }

  /* Quantidade PLANEJADA da tarefa. Prefere o campo planejado no cadastro.
     Se a tarefa foi criada sem planejado (fluxo antigo), usa o saldo da OP
     ou do pedido no momento da leitura. */
  function plannedOf(po) {
    if (po.plannedQuantity != null && Number(po.plannedQuantity) > 0) return Number(po.plannedQuantity);
    const op = opOf(po);
    const order = orderOf(po);
    if (op && Number(op.quantity) > 0) return Number(op.quantity);
    if (order) return Math.max(0, (Number(order.quantity) || 0) - producoesPedido(order.id));
    return 0;
  }

  function restanteTarefa(po) {
    return Math.max(0, plannedOf(po) - (Number(po.quantityProduced) || 0));
  }

  /* ---------- FILA POR MÁQUINA ----------
     Retorna a tarefa ATUAL (em produção ou pausa) e a PRÓXIMA da fila
     (aguardando). Fila ordenada por prioridade da OP e, em empate, pela
     ordem de criação. */
  function filaPorMaquina(machineId) {
    const pos = tasksAll().filter(po => po.machineId === machineId);
    const atual = pos.find(po => po.status === "em_producao" || po.status === "pausa") || null;
    const fila = pos.filter(po => po.status === "aguardando")
      .sort((a, b) => (Number(a.queuePosition) || 0) - (Number(b.queuePosition) || 0) ||
        (PRIO_ORDEM[b.priority] || 0) - (PRIO_ORDEM[a.priority] || 0) ||
        (a.createdAt || 0) - (b.createdAt || 0));
    return { atual, fila, proxima: fila[0] || null };
  }

  function filaPorFuncionario(employeeId) {
    const pos = tasksAll().filter(po => po.employeeId === employeeId && po.status !== "finalizada");
    const atual = pos.find(po => po.status === "em_producao" || po.status === "pausa") || null;
    const fila = pos.filter(po => po.status === "aguardando")
      .sort((a, b) => (Number(a.queuePosition) || 0) - (Number(b.queuePosition) || 0) ||
        (PRIO_ORDEM[b.priority] || 0) - (PRIO_ORDEM[a.priority] || 0) ||
        (a.createdAt || 0) - (b.createdAt || 0));
    return { atual, fila, proxima: fila[0] || null };
  }

  async function priorizarTarefa(opts) {
    const po = task(opts.taskId);
    if (!po || !po.employeeId) throw new Error("Tarefa não atribuída a um funcionário.");
    const f = filaPorFuncionario(po.employeeId).fila;
    let n = 1;
    for (const x of f) { if (x.id !== po.id) { await S.update("productionOrders", x.id, { queuePosition: n++ }); } }
    await S.update("productionOrders", po.id, { queuePosition: 0, priority: "alta" });
    return filaPorFuncionario(po.employeeId);
  }

  async function reordenarFilaFuncionario(employeeId, orderedIds) {
    const ids = Array.isArray(orderedIds) ? orderedIds : [];
    for (let i = 0; i < ids.length; i++) {
      const po = task(ids[i]);
      if (po && po.employeeId === employeeId && po.status !== "finalizada") {
        await S.update("productionOrders", po.id, { queuePosition: i + 1 });
      }
    }
    return filaPorFuncionario(employeeId);
  }

  /* ---------- INICIAR PRODUÇÃO ---------- */
  async function iniciar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    if (po.status === "em_producao") return obterDetalhe(po.id);
    const order = orderOf(po);
    const m = machine(po.machineId) || {};
    await S.update("productionOrders", po.id, {
      status: "em_producao",
      startedAt: Date.now(),
      pausedAt: null,
      finishedAt: null
    });
    await S.update("machines", po.machineId, {
      status: "produzindo",
      currentProduct: po.product + (po.model ? " — " + po.model : ""),
      client: (order && order.client) || m.client || ""
    });
    const op = opOf(po);
    if (op && op.status === "aguardando") {
      await S.update("ops", op.id, { status: "producao", startedAt: op.startedAt || Date.now() });
    }
    return obterDetalhe(po.id);
  }

  /* ---------- PAUSAR / RETOMAR ---------- */
  async function pausar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    await S.update("productionOrders", po.id, { status: "pausa", pausedAt: Date.now() });
    await S.update("machines", po.machineId, { status: "pausa" });
    return obterDetalhe(po.id);
  }

  async function retomar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    const pausedNow = po.pausedAt ? (Date.now() - po.pausedAt) : 0;
    const acumulado = (Number(po.pausedSeconds) || 0) + pausedNow;
    await S.update("productionOrders", po.id, { status: "em_producao", pausedAt: null, pausedSeconds: acumulado });
    await S.update("machines", po.machineId, { status: "produzindo" });
    return obterDetalhe(po.id);
  }

  /* ---------- FINALIZAR PRODUÇÃO + BAIXA AUTOMÁTICA ----------
     Registra o apontamento (productions), baixa a Tarefa, recalcula a OP
     e o Pedido e libera a máquina (parada / próxima da fila). */
  async function finalizar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    if (po.status === "finalizada") throw new Error("Esta tarefa já foi finalizada.");
    const qty = Number(opts.qty) || 0;
    const defects = Number(opts.defects) || 0;
    if (qty <= 0) throw new Error("Informe a quantidade produzida.");

    const order = orderOf(po);
    const op = opOf(po);
    const pausedMs = Number(po.pausedSeconds) || 0;
    const t0 = po.startedAt || Date.now();
    const t1Ms = Date.now();
    const mins = Math.max(0, Math.round((t1Ms - t0 - pausedMs) / 60000));
    const hours = Math.round(mins / 60 * 100) / 100;
    const rate = qty > 0 ? defects / qty * 100 : 0;

    const rec = {
      date: U.todayStr(),
      machineId: po.machineId,
      machineName: po.machineName,
      productId: po.productId || "",
      productName: po.product + (po.model ? " — " + po.model : ""),
      model: po.model || "",
      client: (order && order.client) || "",
      operator: po.employeeName || "Operador",
      employeeId: po.employeeId || "",
      startTime: fmtHM(t0),
      endTime: fmtHM(t1Ms),
      quantityProduced: qty,
      defects: defects,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      defectRate: rate,
      createdAt: t1Ms,
      orderId: po.orderId,
      productionOrderId: po.id,
      opId: po.opId || "",
      operacao: po.operacao || "producao",
      task: {
        planned: plannedOf(po),
        estMinutes: Number(po.estimatedMinutes) || 0,
        priority: po.priority || "media"
      }
    };

    await S.add("productions", rec);

    const newProduced = (Number(po.quantityProduced) || 0) + qty;
    const newDefects = (Number(po.defects) || 0) + defects;
    const planned = plannedOf(po);
    const concluida = newProduced >= planned && planned > 0;
    await S.update("productionOrders", po.id, {
      quantityProduced: newProduced,
      defects: newDefects,
      status: concluida ? "finalizada" : "pausa",
      finishedAt: concluida ? t1Ms : null,
      pausedAt: concluida ? null : t1Ms
    });
    await S.update("machines", po.machineId, { status: "parada" });

    /* Baixa automática: recalcula OP e Pedido a partir dos lançamentos. */
    await baixaAutomatica(opts.taskId || po.id);

    return {
      rec: rec,
      detalhe: obterDetalhe(po.id),
      filaMaquina: filaPorMaquina(po.machineId)
    };
  }

  /* Recalcula OP (concluida/producao/aguardando) e Pedido
     (finalizado/em_producao/aguardando) a partir da produção real. */
  async function baixaAutomatica(taskId) {
    const po = task(taskId);
    if (!po) return;
    const op = opOf(po);
    if (op) {
      const produced = producoesOP(op.id);
      const qty = Number(op.quantity) || 0;
      let status = op.status;
      if (qty > 0 && produced >= qty) status = "concluida";
      else if (produced > 0) status = "producao";
      if (status !== op.status) {
        const patch = { status: status };
        if (status === "concluida") patch.finishedAt = Date.now();
        if (status === "producao" && !op.startedAt) patch.startedAt = Date.now();
        await S.update("ops", op.id, patch);
      }
    }
    const order = orderOf(po);
    if (order) {
      const total = producoesPedido(order.id);
      const qty = Number(order.quantity) || 0;
      let status = order.status;
      if (qty > 0 && total >= qty) status = "finalizado";
      else if (total > 0) status = "em_producao";
      else status = "aguardando";
      if (status !== order.status) await S.update("orders", order.id, { status: status });
    }
  }

  /* ---------- DETALHE PARA AS TELAS ---------- */
  function obterDetalhe(taskId) {
    const po = task(taskId);
    if (!po) return null;
    const op = opOf(po);
    const order = orderOf(po);
    const planned = plannedOf(po);
    const produced = Number(po.quantityProduced) || 0;
    const remaining = restanteTarefa(po);
    const opQty = op ? (Number(op.quantity) || 0) : 0;
    const opProduced = op ? producoesOP(op.id) : 0;
    const orderQty = order ? (Number(order.quantity) || 0) : 0;
    const orderProduced = order ? producoesPedido(order.id) : 0;
    return {
      tarefa: po,
      planned: planned,
      produced: produced,
      remaining: remaining,
      op: op,
      opQty: opQty,
      opProduced: opProduced,
      opRemaining: Math.max(0, opQty - opProduced),
      order: order,
      orderQty: orderQty,
      orderProduced: orderProduced,
      orderRemaining: Math.max(0, orderQty - orderProduced),
      fila: filaPorMaquina(po.machineId)
    };
  }

  function fmtHM(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  window.FluxoProducao = {
    iniciarTarefa: iniciar,
    pausarTarefa: pausar,
    retomarTarefa: retomar,
    finalizarTarefa: finalizar,
    baixaAutomatica: baixaAutomatica,
    obterDetalhe: obterDetalhe,
    filaPorMaquina: filaPorMaquina,
    filaPorFuncionario: filaPorFuncionario,
    priorizarTarefa: priorizarTarefa,
    reordenarFilaFuncionario: reordenarFilaFuncionario,
    plannedOf: plannedOf,
    restanteTarefa: restanteTarefa,
    producoesPedido: producoesPedido,
    producoesOP: producoesOP
  };
})();