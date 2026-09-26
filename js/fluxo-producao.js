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

  const PRIO_ORDEM = { baixa: 0, media: 1, alta: 2, urgente: 3 };

  /* Toda alteração operacional passa por aqui. O mesmo formato é usado
     tanto por ação manual quanto pela automação de voz, deixando a trilha
     completa no Histórico de alterações. */
  async function registrarEventoFluxo(action, entity, entityId, before, after, note, meta) {
    const m = meta || {};
    try {
      await S.add("auditLogs", {
        action: action || "ALTERADO", entity: entity || "Produção", entityId: entityId || "",
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
        note: note || "", actor: m.actor || "Sistema",
        source: m.source || "fluxo-producao", correlationId: m.correlationId || "",
        createdAt: Date.now()
      });
    } catch (e) { console.warn("Falha ao registrar histórico do fluxo:", e); }
  }

  /* ---------- LEITOS ---------- */
  function tasksAll() { return S.get("productionOrders"); }
  function task(id) { return tasksAll().find(p => p.id === id) || null; }
  function orderOf(po) { return S.get("orders").find(o => o.id === po.orderId) || null; }
  function opOf(po) { return S.get("ops").find(o => o.id === po.opId) || null; }
  function machine(id) { return S.get("machines").find(m => m.id === id) || null; }
  function skuOf(id) { return id ? (S.get("skus").find(s => s.id === id) || null) : null; }

  /* ---------- ESTOQUE DO PRODUTO (Etapa 12, item 5) ----------
     Quantidade aprovada (produzida − defeitos) de uma produção dá
     entrada automática no estoque do item do catálogo (skus) ligado
     ao pedido. Não mexe no módulo de estoque de matéria-prima
     (materials/stockMovements), que continua funcionando à parte. */
  function aprovadoDe(qty, defects) {
    return Math.max(0, (Number(qty) || 0) - (Number(defects) || 0));
  }

  async function creditarEstoqueSku(order, approved, rec) {
    if (!order || !approved || approved <= 0) return;
    const sku = order.skuId ? skuOf(order.skuId) : null;
    if (!sku) return;
    const novoEstoque = (Number(sku.stock) || 0) + approved;
    await S.update("skus", sku.id, { stock: novoEstoque });
    await S.add("stockMovements", {
      materialId: "", skuId: sku.id, productId: sku.id,
      productCode: sku.code || order.skuCode || "",
      productName: sku.description || order.product || "",
      type: "ENTRADA_PRODUCAO", quantity: approved,
      date: U.todayStr(), time: fmtHM(Date.now()),
      orderId: order.id, operator: rec && rec.operator || "",
      employeeName: rec && rec.operator || "",
      machineId: rec && rec.machineId || "", opId: rec && rec.opId || "",
      observation: "Entrada automática de produção aprovada",
      productionId: rec && rec.id || "", correlationId: rec && rec.correlationId || "",
      createdAt: Date.now(), source: "production"
    });
    await registrarEventoFluxo("ENTRADA_AUTOMATICA", "Estoque de produto", sku.id, sku,
      Object.assign({}, sku, { stock: novoEstoque }), "Estoque creditado automaticamente pela produção aprovada", {
        actor: rec && rec.operator || "Sistema", source: rec && rec.source || "production",
        correlationId: rec && rec.correlationId || ""
      });
  }

  async function registrarHistoricoProducao(rec, op, note) {
    await registrarEventoFluxo("CRIADO", "Produção", rec.id || "", null,
      Object.assign({}, rec, { time: rec.endTime || fmtHM(Date.now()), opNumber: op ? (op.number || "") : "" }),
      note || "Apontamento de produção registrado", {
        actor: rec.operator || "Operador", source: rec.source || "production",
        correlationId: rec.correlationId || ""
      });
  }

  function employeeTasks(employeeId) {
    return tasksAll().filter(p => p.employeeId === employeeId && !["finalizada","concluida","cancelada"].includes(p.status))
      .sort((a,b) => (Number(a.queuePosition)||0) - (Number(b.queuePosition)||0) || (a.createdAt||0)-(b.createdAt||0));
  }

  async function normalizeEmployeeQueue(employeeId) {
    const list = employeeTasks(employeeId);
    for (let i=0;i<list.length;i++) {
      const desired=i+1;
      if (Number(list[i].queuePosition)!==desired) await S.update("productionOrders",list[i].id,{queuePosition:desired,updatedAt:Date.now()});
    }
    return list;
  }

  async function colocarComoProxima(opts) {
    const po=task(opts.taskId); if(!po) throw new Error("Tarefa não encontrada.");
    if (!po.employeeId) throw new Error("Tarefa sem funcionário.");
    const list=employeeTasks(po.employeeId).filter(x=>x.id!==po.id);
    const current=list.find(x=>x.status==="em_producao"||x.status==="pausa");
    const idx=current ? list.findIndex(x=>x.id===current.id)+1 : 0;
    list.splice(idx,0,po);
    for(let i=0;i<list.length;i++) {
      const patch={queuePosition:i+1,updatedAt:Date.now()};
      if(list[i].id===po.id && po.priority!=="urgente") patch.priority=po.priority||"media";
      await S.update("productionOrders",list[i].id,patch);
    }
    return task(po.id);
  }

  async function iniciarUrgenteAgora(opts) {
    const po=task(opts.taskId); if(!po) throw new Error("Tarefa não encontrada.");
    if(!po.employeeId) throw new Error("Tarefa sem funcionário.");
    const current=employeeTasks(po.employeeId).find(x=>x.status==="em_producao");
    if(current && current.id!==po.id) await pausar({taskId:current.id});
    await colocarComoProxima({taskId:po.id});
    return iniciar({taskId:po.id});
  }

  async function iniciarProximaFuncionario(employeeId) {
    const current=employeeTasks(employeeId).find(x=>x.status==="em_producao"||x.status==="pausa");
    if(current) return current;
    const next=employeeTasks(employeeId)[0];
    if(!next) return null;
    return iniciar({taskId:next.id});
  }

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
      .sort((a, b) =>
        (PRIO_ORDEM[b.priority] || 0) - (PRIO_ORDEM[a.priority] || 0) ||
        (a.createdAt || 0) - (b.createdAt || 0));
    return { atual, fila, proxima: fila[0] || null };
  }

  /* ---------- INICIAR PRODUÇÃO ---------- */
  async function iniciar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    if (po.status === "em_producao") return obterDetalhe(po.id);
    const order = orderOf(po);
    const m = machine(po.machineId) || {};
    const now = Date.now();
    const taskPatch = {
      status: "em_producao",
      startedAt: now,
      pausedAt: null,
      finishedAt: null,
      updatedAt: now
    };
    await S.update("productionOrders", po.id, taskPatch);
    await registrarEventoFluxo("INICIADO", "Tarefa", po.id, po, Object.assign({}, po, taskPatch),
      "Produção iniciada", { actor: po.employeeName || "Operador", source: opts.source || "manual", correlationId: opts.correlationId || "" });
    await S.update("machines", po.machineId, {
      status: "produzindo",
      currentProduct: po.product + (po.model ? " — " + po.model : ""),
      client: (order && order.client) || m.client || ""
    });
    const op = opOf(po);
    if (op && op.status === "aguardando") {
      await S.update("ops", op.id, { status: "producao", startedAt: op.startedAt || Date.now() });
      await registrarEventoFluxo("ALTERADO", "OP", op.id, op,
        Object.assign({}, op, { status: "producao", startedAt: op.startedAt || now }),
        "OP iniciada automaticamente pela primeira tarefa", { actor: po.employeeName || "Operador", source: opts.source || "manual", correlationId: opts.correlationId || "" });
    }
    return obterDetalhe(po.id);
  }

  /* ---------- PAUSAR / RETOMAR ---------- */
  async function pausar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    const patch = { status: "pausa", pausedAt: Date.now() };
    await S.update("productionOrders", po.id, patch);
    await S.update("machines", po.machineId, { status: "pausa" });
    await registrarEventoFluxo("PAUSADO", "Tarefa", po.id, po, Object.assign({}, po, patch),
      "Produção pausada", { actor: po.employeeName || "Operador", source: opts.source || "manual", correlationId: opts.correlationId || "" });
    return obterDetalhe(po.id);
  }

  async function retomar(opts) {
    const po = task(opts.taskId);
    if (!po) throw new Error("Tarefa não encontrada.");
    const pausedNow = po.pausedAt ? (Date.now() - po.pausedAt) : 0;
    const acumulado = (Number(po.pausedSeconds) || 0) + pausedNow;
    const patch = { status: "em_producao", pausedAt: null, pausedSeconds: acumulado };
    await S.update("productionOrders", po.id, patch);
    await S.update("machines", po.machineId, { status: "produzindo" });
    await registrarEventoFluxo("RETOMADO", "Tarefa", po.id, po, Object.assign({}, po, patch),
      "Produção retomada", { actor: po.employeeName || "Operador", source: opts.source || "manual", correlationId: opts.correlationId || "" });
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
    if (defects < 0) throw new Error("Defeitos inválidos.");
    if (defects > qty) throw new Error("A quantidade de defeitos não pode superar a quantidade produzida.");
    const remainingBefore = restanteTarefa(po);
    if (remainingBefore > 0 && qty > remainingBefore) {
      throw new Error("A quantidade informada é maior que o saldo da tarefa. Restam " + U.fmt(remainingBefore) + " unidades.");
    }

    const order = orderOf(po);
    const op = opOf(po);
    const pausedMs = Number(po.pausedSeconds) || 0;
    const t0 = po.startedAt || Date.now();
    const t1Ms = Date.now();
    const mins = Math.max(0, Math.round((t1Ms - t0 - pausedMs) / 60000));
    const hours = Math.round(mins / 60 * 100) / 100;
    const rate = qty > 0 ? defects / qty * 100 : 0;
    const approved = aprovadoDe(qty, defects);

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
      approved: approved,
      productionHours: hours,
      perHour: hours > 0 ? qty / hours : 0,
      defectRate: rate,
      createdAt: t1Ms,
      orderId: po.orderId,
      productionOrderId: po.id,
      opId: po.opId || "",
      operacao: po.operacao || "producao",
      source: opts.source || "manual",
      correlationId: opts.correlationId || "",
      rawText: opts.rawText || "",
      task: {
        planned: plannedOf(po),
        estMinutes: Number(po.estimatedMinutes) || 0,
        priority: po.priority || "media"
      }
    };

    const savedRec = await S.add("productions", rec);
    rec.id = savedRec.id;
    if ((po.operacao || "producao") !== "retrabalho") await creditarEstoqueSku(order, approved, rec);
    await registrarHistoricoProducao(rec, op, "Apontamento de produção finalizado");

    const newProduced = (Number(po.quantityProduced) || 0) + qty;
    const newDefects = (Number(po.defects) || 0) + defects;
    const planned = plannedOf(po);
    const complete = planned > 0 ? newProduced >= planned : true;
    await S.update("productionOrders", po.id, {
      quantityProduced: newProduced,
      defects: newDefects,
      status: complete ? "finalizada" : "em_producao",
      finishedAt: complete ? t1Ms : null,
      updatedAt: Date.now()
    });
    if (complete) await S.update("machines", po.machineId, { status: "parada" });

    /* Baixa automática: recalcula OP e Pedido a partir dos lançamentos. */
    await baixaAutomatica(opts.taskId || po.id, { source: opts.source || "manual", correlationId: opts.correlationId || "", actor: po.employeeName || "Operador" });
    if (complete && po.employeeId) {
      await normalizeEmployeeQueue(po.employeeId);
      await iniciarProximaFuncionario(po.employeeId);
    }

    return {
      rec: rec,
      detalhe: obterDetalhe(po.id),
      filaMaquina: filaPorMaquina(po.machineId),
      concluida: complete
    };
  }

  async function registrarProducaoParcial(opts) {
    const po=task(opts.taskId); if(!po) throw new Error("Tarefa não encontrada.");
    if(!["em_producao","pausa"].includes(po.status)) throw new Error("Inicie a tarefa antes de registrar produção.");
    const qty=Number(opts.qty)||0, defects=Number(opts.defects)||0;
    if(qty<=0) throw new Error("Informe a quantidade produzida.");
    if(defects<0) throw new Error("Perdas inválidas.");
    if(defects>qty) throw new Error("As perdas não podem superar a quantidade produzida.");
    const remainingBefore=restanteTarefa(po);
    if(remainingBefore>0 && qty>remainingBefore) throw new Error("A quantidade informada é maior que o saldo da tarefa. Restam "+U.fmt(remainingBefore)+" unidades.");
    const t0=po.startedAt||Date.now(), now=Date.now(), paused=Number(po.pausedSeconds)||0;
    const mins=Math.max(0,Math.round((now-t0-paused)/60000)), hours=Math.round(mins/60*100)/100;
    const order=orderOf(po);
    const approved=aprovadoDe(qty,defects);
    const rec={
      date:U.todayStr(), machineId:po.machineId, machineName:po.machineName,
      productId:po.productId||"", productName:po.product+(po.model?" — "+po.model:""),
      model:po.model||"", client:(order&&order.client)||"", operator:po.employeeName||"Operador",
      employeeId:po.employeeId||"", startTime:fmtHM(t0), endTime:fmtHM(now),
      quantityProduced:qty, defects:defects, approved:approved, productionHours:hours,
      perHour:hours>0?qty/hours:0, defectRate:qty>0?defects/qty*100:0,
      createdAt:now, orderId:po.orderId||"", productionOrderId:po.id, opId:po.opId||"",
      operacao:po.operacao||"producao", partial:true,
      source:opts.source||"manual", correlationId:opts.correlationId||"", rawText:opts.rawText||"",
      task:{planned:plannedOf(po),estMinutes:Number(po.estimatedMinutes)||0,priority:po.priority||"media"}
    };
    const savedRec=await S.add("productions",rec); rec.id=savedRec.id;
    if ((po.operacao||"producao")!=="retrabalho") await creditarEstoqueSku(order,approved,rec);
    await registrarHistoricoProducao(rec, opOf(po), "Apontamento parcial de produção registrado");
    const produced=(Number(po.quantityProduced)||0)+qty, newDef=(Number(po.defects)||0)+defects;
    const planned=plannedOf(po), complete=planned>0 && produced>=planned;
    await S.update("productionOrders",po.id,{
      quantityProduced:produced, defects:newDef,
      status:complete?"finalizada":po.status, finishedAt:complete?now:null, updatedAt:now
    });
    if(complete) await S.update("machines",po.machineId,{status:"parada"});
    await baixaAutomatica(po.id,{source:opts.source||"manual",correlationId:opts.correlationId||"",actor:po.employeeName||"Operador"});
    if(complete && po.employeeId) { await normalizeEmployeeQueue(po.employeeId); await iniciarProximaFuncionario(po.employeeId); }
    return {rec:rec,concluida:complete,detalhe:obterDetalhe(po.id)};
  }

  /* Recalcula OP (concluida/producao/aguardando) e Pedido
     (finalizado/em_producao/aguardando) a partir da produção real. */
  async function baixaAutomatica(taskId, meta) {
    const po = task(taskId);
    if (!po) return;
    const m = meta || {};
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
        patch.quantityProduced = produced;
        patch.remainingQuantity = Math.max(0, qty - produced);
        await S.update("ops", op.id, patch);
        await registrarEventoFluxo("BAIXA_AUTOMATICA", "OP", op.id, op, Object.assign({}, op, patch),
          "Saldo e status da OP recalculados pela produção", m);
      } else if (Number(op.quantityProduced) !== produced || Number(op.remainingQuantity) !== Math.max(0, qty - produced)) {
        const patch = { quantityProduced: produced, remainingQuantity: Math.max(0, qty - produced) };
        await S.update("ops", op.id, patch);
        await registrarEventoFluxo("BAIXA_AUTOMATICA", "OP", op.id, op, Object.assign({}, op, patch),
          "Saldo da OP recalculado pela produção", m);
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
      const orderPatch = { status: status, quantityProduced: total, remainingQuantity: Math.max(0, qty - total) };
      if (status !== order.status || Number(order.quantityProduced) !== total || Number(order.remainingQuantity) !== Math.max(0, qty - total)) {
        await S.update("orders", order.id, orderPatch);
        await registrarEventoFluxo("BAIXA_AUTOMATICA", "Pedido", order.id, order, Object.assign({}, order, orderPatch),
          "Saldo e status do pedido recalculados pela produção", m);
      }
    }
  }

  /* ---------- REGISTRO DIRETO POR VOZ, SEM TAREFA PRÉ-ATRIBUÍDA (Etapa 12) ----------
     Usado quando o operador registra produção por voz falando cliente
     e código, sem que o gestor tenha criado uma Tarefa antes. Em vez de
     duplicar a lógica de baixa, cria uma Tarefa "por trás" (vinculada à
     OP do pedido, se existir), a inicia e já a finaliza com a
     quantidade/defeitos informados — reaproveitando 100% de iniciar()
     e finalizar() (baixa automática, estoque, fila de máquina etc.). */
  async function registrarProducaoPorPedido(opts) {
    const order = S.get("orders").find(o => o.id === opts.orderId);
    if (!order) throw new Error("Pedido não encontrado.");
    if (!opts.machineId) throw new Error("Selecione a máquina.");
    const qty = Number(opts.qty) || 0;
    const defects = Number(opts.defects) || 0;
    if (qty <= 0) throw new Error("Informe a quantidade produzida.");
    if (defects < 0) throw new Error("Defeitos inválidos.");
    if (defects > qty) throw new Error("A quantidade de defeitos não pode superar a quantidade produzida.");

    const op = S.get("ops").find(o => o.orderId === order.id && o.status !== "concluida") || null;
    const plannedQuantity = Math.max(0, (Number(order.quantity) || 0) - producoesPedido(order.id));
    if (plannedQuantity <= 0) throw new Error("Este pedido não possui saldo pendente.");
    if (qty > plannedQuantity) throw new Error("A quantidade informada é maior que o saldo do pedido. Restam " + U.fmt(plannedQuantity) + " unidades.");
    const m = machine(opts.machineId) || {};

    const novaTarefa = await S.add("productionOrders", {
      orderId: order.id,
      opId: op ? op.id : "",
      employeeId: opts.employeeId || "",
      employeeName: opts.employeeName || "Operador",
      machineId: opts.machineId,
      machineName: m.name || "",
      product: order.product || "",
      model: order.model || "",
      productId: order.skuId || "",
      plannedQuantity: plannedQuantity,
      quantityProduced: 0,
      defects: 0,
      priority: op ? (op.priority || "media") : "media",
      status: "aguardando",
      operacao: "producao",
      origem: "voz-livre",
      voiceRawText: opts.rawText || "",
      source: opts.source || "voz-livre",
      correlationId: opts.correlationId || "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await registrarEventoFluxo("CRIADO", "Tarefa", novaTarefa.id, null, novaTarefa,
      "Tarefa criada automaticamente para apontamento por voz", { actor: opts.employeeName || "Operador", source: opts.source || "voz-livre", correlationId: opts.correlationId || "" });
    await iniciar({ taskId: novaTarefa.id, source: opts.source || "voz-livre", correlationId: opts.correlationId || "" });
    return finalizar({ taskId: novaTarefa.id, qty: qty, defects: defects, source: opts.source || "voz-livre", correlationId: opts.correlationId || "", rawText: opts.rawText || "" });
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
    plannedOf: plannedOf,
    restanteTarefa: restanteTarefa,
    producoesPedido: producoesPedido,
    producoesOP: producoesOP,
    registrarProducaoParcial: registrarProducaoParcial,
    registrarProducaoPorPedido: registrarProducaoPorPedido,
    colocarComoProxima: colocarComoProxima,
    iniciarUrgenteAgora: iniciarUrgenteAgora,
    iniciarProximaFuncionario: iniciarProximaFuncionario
  };
})();
