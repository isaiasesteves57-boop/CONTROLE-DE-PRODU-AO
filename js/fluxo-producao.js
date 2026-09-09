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

  function queueSort(a, b) {
    return (PRIO_ORDEM[b.priority] || 0) - (PRIO_ORDEM[a.priority] || 0) ||
      (Number(a.queuePosition) || 0) - (Number(b.queuePosition) || 0) ||
      (a.createdAt || 0) - (b.createdAt || 0);
  }

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
    const fila = pos
      .filter(po => po.status === "aguardando")
      .sort(queueSort);
    return { atual, fila, proxima: fila[0] || null };
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
    const remainingAfter = Math.max(0, plannedOf(po) - newProduced);
    const terminouTarefa = remainingAfter <= 0;

    /* Importante: "SALVAR PRODUÇÃO" encerra apenas o apontamento/turno.
       Se ainda existe saldo na tarefa, ela NÃO é finalizada: fica pausada
       e reaparece no próximo dia exatamente de onde parou. */
    await S.update("productionOrders", po.id, {
      quantityProduced: newProduced,
      defects: newDefects,
      status: terminouTarefa ? "finalizada" : "pausa",
      pausedAt: terminouTarefa ? null : t1Ms,
      finishedAt: terminouTarefa ? t1Ms : null
    });
    await S.update("machines", po.machineId, { status: "parada" });

    /* Baixa automática: recalcula OP e Pedido e, quando a tarefa realmente
       termina, inicia automaticamente a próxima da fila da mesma máquina. */
    const baixa = await baixaAutomatica(opts.taskId || po.id);
    let proximaIniciada = null;
    if (terminouTarefa) {
      const fila = filaPorMaquina(po.machineId);
      if (fila.proxima) {
        await iniciar({ taskId: fila.proxima.id });
        proximaIniciada = obterDetalhe(fila.proxima.id);
      }
    }

    return {
      rec: rec,
      detalhe: obterDetalhe(po.id),
      filaMaquina: filaPorMaquina(po.machineId),
      terminouTarefa,
      proximaIniciada,
      baixa
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
    return true;
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


  async function definirUrgencia(taskId) {
    const po = task(taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    const pos = tasksAll().filter(x => x.machineId === po.machineId && x.status === "aguardando");
    const minPos = pos.reduce((m, x) => Math.min(m, Number(x.queuePosition) || 0), 0);
    await S.update("productionOrders", po.id, { priority: "alta", queuePosition: minPos - 1 });

    /* Se já existe uma OP rodando nessa máquina, a urgência assume a frente:
       pausa a atual preservando o progresso e inicia a urgente imediatamente. */
    const atual = tasksAll().find(x => x.machineId === po.machineId && (x.status === "em_producao" || x.status === "pausa"));
    if (atual && atual.id !== po.id) {
      if (atual.status === "em_producao") {
        await S.update("productionOrders", atual.id, { status: "pausa", pausedAt: Date.now() });
      }
      await S.update("machines", po.machineId, { status: "parada" });
      await iniciar({ taskId: po.id });
    }
    return filaPorMaquina(po.machineId);
  }

  async function moverFila(taskId, direcao) {
    const po = task(taskId);
    if (!po || po.status !== "aguardando") throw new Error("Só tarefas aguardando podem ser reordenadas.");
    const fila = filaPorMaquina(po.machineId).fila;
    const idx = fila.findIndex(x => x.id === po.id);
    const alvoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || alvoIdx < 0 || alvoIdx >= fila.length) return filaPorMaquina(po.machineId);
    const alvo = fila[alvoIdx];
    const aPos = Number(po.queuePosition) || 0;
    const bPos = Number(alvo.queuePosition) || 0;
    await S.update("productionOrders", po.id, { queuePosition: bPos });
    await S.update("productionOrders", alvo.id, { queuePosition: aPos });
    return filaPorMaquina(po.machineId);
  }

  window.FluxoProducao = {
    iniciarTarefa: iniciar,
    pausarTarefa: pausar,
    retomarTarefa: retomar,
    finalizarTarefa: finalizar,
    baixaAutomatica: baixaAutomatica,
    obterDetalhe: obterDetalhe,
    filaPorMaquina: filaPorMaquina,
    plannedOf: plannedOf,
    restanteTarefa: restanteTarefa,
    producoesPedido: producoesPedido,
    producoesOP: producoesOP,
    definirUrgencia: definirUrgencia,
    moverFila: moverFila
  };
})();