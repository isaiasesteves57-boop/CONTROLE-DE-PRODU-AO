/* =====================================================================
   CONTROLE DE PRODUÇÃO — Automação Final (Etapa 16)

   Camada de orquestração para ações disparadas automaticamente:
   • voz → apontamento real, sem preenchimento de campos;
   • rastreabilidade por correlação e eventos de automação;
   • proteção contra pedido ambíguo, quantidade excedente e duplicidade.

   Princípio de segurança operacional: apenas comandos com identificação
   inequívoca são gravados. Em caso de ambiguidade, o sistema não altera
   dados e orienta o operador a repetir a frase com cliente, código e,
   quando necessário, o número do pedido.
   ===================================================================== */
(function () {
  const S = window.ProductionStore;
  const U = window.U;

  function normText(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function normCode(value) {
    return String(value || "").trim().toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function simpleHash(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function correlationId(prefix) {
    return (prefix || "AUT") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  async function historico(action, entity, entityId, before, after, note, opts) {
    const extra = opts || {};
    const row = {
      action: action || "AUTOMACAO",
      entity: entity || "Sistema",
      entityId: entityId || "",
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      note: note || "",
      actor: extra.actor || "Automação",
      source: extra.source || "automacao",
      correlationId: extra.correlationId || "",
      createdAt: Date.now()
    };
    try { return await S.add("auditLogs", row); }
    catch (e) { console.warn("Falha ao registrar histórico da automação:", e); return row; }
  }

  async function registrarExecucao(type, status, payload) {
    const data = Object.assign({
      type: type || "AUTOMACAO",
      status: status || "SUCESSO",
      createdAt: Date.now()
    }, payload || {});
    try { return await S.add("automationEvents", data); }
    catch (e) { console.warn("Falha ao registrar evento de automação:", e); return data; }
  }

  function pedidosAbertos() {
    return S.get("orders").filter(o => !["finalizado", "cancelado"].includes(o.status));
  }

  function progressoPedido(orderId) {
    return S.get("productionOrders")
      .filter(t => t.orderId === orderId && (t.operacao || "producao") !== "retrabalho")
      .reduce((total, t) => total + (Number(t.quantityProduced) || 0), 0);
  }

  function saldoPedido(order) {
    return Math.max(0, (Number(order && order.quantity) || 0) - progressoPedido(order && order.id));
  }

  function encontrarPedidoPorVoz(parsed) {
    const p = parsed || {};
    let candidates = pedidosAbertos();
    const code = normCode(p.codigoRaw || p.codigo || "");
    const client = normText(p.clienteRaw || p.cliente || "");
    const number = String(p.numeroPedido || p.orderNumber || "").replace(/\D/g, "");

    if (number) {
      candidates = candidates.filter(o => String(o.number || "").replace(/\D/g, "") === number);
    }
    if (code) {
      candidates = candidates.filter(o => normCode(o.skuCode) === code);
    }
    if (client) {
      candidates = candidates.filter(o => {
        const current = normText(o.client);
        return current === client || current.includes(client) || client.includes(current);
      });
    }
    candidates = candidates.filter(o => saldoPedido(o) > 0)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return { candidates, code, client, number };
  }

  function comandoCompativelComTarefa(parsed, task, order) {
    const p = parsed || {};
    const spokenCode = normCode(p.codigoRaw || p.codigo || "");
    const spokenClient = normText(p.clienteRaw || p.cliente || "");
    if (spokenCode && order && normCode(order.skuCode) && spokenCode !== normCode(order.skuCode)) return false;
    if (spokenClient && order) {
      const expected = normText(order.client);
      if (expected && !(expected === spokenClient || expected.includes(spokenClient) || spokenClient.includes(expected))) return false;
    }
    return !!task;
  }

  /* Executa um apontamento de ponta a ponta com base na frase já
     reconhecida. A interface apenas informa o resultado; não há campos
     intermediários a preencher. */
  async function apontarPorVoz(opts) {
    const options = opts || {};
    const parsed = options.parsed || {};
    const qty = Number(parsed.quantidade != null ? parsed.quantidade : options.qty) || 0;
    const defectsRaw = parsed.defeitos != null && parsed.defeitos !== "" ? parsed.defeitos : options.defects;
    const defects = Number(defectsRaw) || 0;
    const rawText = parsed.rawText || options.rawText || "";
    const correlation = options.correlationId || correlationId("VOZ");

    if (qty <= 0) {
      await registrarExecucao("VOZ_APONTAMENTO", "RECUSADO", { correlationId: correlation, rawText, reason: "quantidade_ausente" });
      throw new Error("Não identifiquei a quantidade. Repita, por exemplo: produzi 500 unidades, 10 defeitos.");
    }
    if (defects < 0 || defects > qty) {
      await registrarExecucao("VOZ_APONTAMENTO", "RECUSADO", { correlationId: correlation, rawText, reason: "defeitos_invalidos" });
      throw new Error("A quantidade de defeitos precisa estar entre zero e a quantidade produzida.");
    }
    if (!options.machineId) throw new Error("Selecione a máquina antes de registrar por voz.");
    if (!window.FluxoProducao) throw new Error("Fluxo de produção indisponível.");

    const FP = window.FluxoProducao;
    const currentTask = options.currentTaskId
      ? S.get("productionOrders").find(t => t.id === options.currentTaskId)
      : null;

    try {
      let result;
      let order;
      let mode;

      if (currentTask) {
        order = S.get("orders").find(o => o.id === currentTask.orderId) || null;
        if (!comandoCompativelComTarefa(parsed, currentTask, order)) {
          throw new Error("O cliente ou código falado não corresponde à tarefa em andamento. Repita o comando para a tarefa correta.");
        }
        const detail = FP.obterDetalhe(currentTask.id);
        const remaining = detail ? Number(detail.remaining) || 0 : 0;
        if (remaining <= 0) throw new Error("A tarefa atual não possui saldo para apontar.");
        if (qty > remaining) throw new Error("A quantidade falada é maior que o saldo da tarefa. Restam " + U.fmt(remaining) + " unidades.");

        if (qty >= remaining) {
          result = await FP.finalizarTarefa({ taskId: currentTask.id, qty, defects, correlationId: correlation, source: "voz-automatica", rawText });
          mode = "tarefa_finalizada";
        } else {
          result = await FP.registrarProducaoParcial({ taskId: currentTask.id, qty, defects, correlationId: correlation, source: "voz-automatica", rawText });
          mode = "tarefa_parcial";
        }
        result = Object.assign({}, result, { rec: result.rec, concluida: !!result.concluida });
      } else {
        const match = encontrarPedidoPorVoz(parsed);
        if (!match.code) {
          throw new Error("Diga o código do produto para localizar o pedido automaticamente.");
        }
        if (match.candidates.length === 0) {
          throw new Error("Não encontrei pedido aberto para o cliente e código falados. Repita incluindo o código completo.");
        }
        if (match.candidates.length > 1) {
          throw new Error("Encontrei mais de um pedido compatível. Repita a frase incluindo o número do pedido.");
        }
        order = match.candidates[0];
        const remaining = saldoPedido(order);
        if (qty > remaining) throw new Error("A quantidade falada é maior que o saldo do pedido. Restam " + U.fmt(remaining) + " unidades.");
        result = await FP.registrarProducaoPorPedido({
          orderId: order.id, qty, defects, machineId: options.machineId,
          employeeId: options.employeeId || "", employeeName: options.employeeName || "Operador",
          rawText, correlationId: correlation, source: "voz-automatica"
        });
        mode = "pedido_localizado";
      }

      const rec = result && result.rec ? result.rec : null;
      await historico("AUTOMACAO_CONCLUIDA", "Apontamento por voz", rec && rec.id, null, rec,
        "Apontamento gerado automaticamente por comando de voz", { correlationId: correlation, source: "voz-automatica", actor: options.employeeName || "Operador" });
      await registrarExecucao("VOZ_APONTAMENTO", "SUCESSO", {
        correlationId: correlation, rawText, orderId: order && order.id || "", productionId: rec && rec.id || "", mode,
        quantity: qty, defects, machineId: options.machineId
      });

      return Object.assign({}, result, { order, mode, correlationId: correlation, qty, defects });
    } catch (error) {
      await historico("AUTOMACAO_RECUSADA", "Apontamento por voz", "", null, null,
        (error && error.message) || "Comando de voz recusado", { correlationId: correlation, source: "voz-automatica", actor: options.employeeName || "Operador" });
      await registrarExecucao("VOZ_APONTAMENTO", "RECUSADO", {
        correlationId: correlation, rawText, reason: (error && error.message) || "erro", machineId: options.machineId || ""
      });
      throw error;
    }
  }

  window.AutomacaoFinal = {
    normText,
    normCode,
    simpleHash,
    correlationId,
    historico,
    registrarExecucao,
    encontrarPedidoPorVoz,
    saldoPedido,
    apontarPorVoz
  };
})();
