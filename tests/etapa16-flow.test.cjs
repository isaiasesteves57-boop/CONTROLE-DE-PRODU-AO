const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const data = {
  skus: [{ id: "sku-1", code: "AG C BCP 27", description: "Agenda Clássica", stock: 0 }],
  orders: [{ id: "order-1", number: "1254", client: "Papelaria", skuId: "sku-1", skuCode: "AG C BCP 27", product: "Agenda Clássica", quantity: 100, quantityProduced: 0, remainingQuantity: 100, status: "aguardando", createdAt: 1 }],
  ops: [{ id: "op-1", orderId: "order-1", number: "21234", quantity: 100, quantityProduced: 0, remainingQuantity: 100, status: "aguardando", priority: "media", createdAt: 1 }],
  productionOrders: [], productions: [], stockMovements: [], auditLogs: [], automationEvents: [],
  machines: [{ id: "machine-1", name: "Automática 1", status: "parada", client: "" }]
};

let sequence = 0;
const S = {
  get(name) { return (data[name] || []).slice(); },
  async add(name, item) {
    const row = Object.assign({}, item, { id: item.id || `${name}-${++sequence}` });
    (data[name] = data[name] || []).push(row);
    return row;
  },
  async update(name, id, patch) {
    const list = data[name] || [];
    const index = list.findIndex(row => row.id === id);
    assert.ok(index >= 0, `Registro ${name}/${id} não encontrado`);
    list[index] = Object.assign({}, list[index], patch);
  }
};

const window = { ProductionStore: S, console };
window.window = window;
const context = vm.createContext({ window, console, Date, Math, JSON, Promise, String, Number, Object, Array, RegExp, Error, setTimeout, clearTimeout });
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("js/utils.js");
load("js/comando-voz.js");
load("js/leitura-pedido.js");
load("js/fluxo-producao.js");
load("js/automacao-final.js");

(async () => {
  const ocr = window.LeituraPedido.parsePedido([
    "Pedido: 1254",
    "Cliente: Papelaria",
    "Código: AG C BCP 27",
    "Produto: Agenda Clássica",
    "Quantidade: 500"
  ].join("\n"));
  assert.equal(ocr.guessedOrderNumber, "1254");
  assert.equal(ocr.guessedClient, "Papelaria");
  assert.equal(ocr.guessedCode, "AG C BCP 27");
  assert.equal(ocr.guessedQuantity, 500);
  assert.equal(ocr.confidence, "alta");

  const parsed = window.ComandoVoz.parseComando("Pedido 1254, cliente Papelaria, código AG C BCP 27, produzi 20 unidades, 2 defeitos");
  assert.equal(parsed.numeroPedido, "1254");
  assert.equal(parsed.quantidade, 20);
  assert.equal(parsed.defeitos, 2);

  const first = await window.AutomacaoFinal.apontarPorVoz({
    parsed,
    machineId: "machine-1",
    employeeId: "employee-1",
    employeeName: "Ronaldo"
  });
  assert.equal(first.mode, "pedido_localizado");
  assert.equal(data.productions.length, 1);
  assert.equal(data.productions[0].quantityProduced, 20);
  assert.equal(data.productions[0].approved, 18);
  assert.equal(data.skus[0].stock, 18);
  assert.equal(data.stockMovements.filter(row => row.type === "ENTRADA_PRODUCAO").length, 1);
  assert.equal(data.orders[0].quantityProduced, 20);
  assert.equal(data.orders[0].remainingQuantity, 80);
  assert.equal(data.ops[0].quantityProduced, 20);
  assert.equal(data.ops[0].remainingQuantity, 80);

  await S.add("productionOrders", {
    id: "task-current", orderId: "order-1", opId: "op-1", machineId: "machine-1", machineName: "Automática 1",
    employeeId: "employee-1", employeeName: "Ronaldo", product: "Agenda Clássica", productId: "sku-1",
    plannedQuantity: 50, quantityProduced: 0, defects: 0, status: "em_producao", operacao: "producao", startedAt: Date.now(), createdAt: Date.now()
  });
  const second = await window.AutomacaoFinal.apontarPorVoz({
    parsed: window.ComandoVoz.parseComando("cliente Papelaria, código AG C BCP 27, produzi 10 unidades, 0 defeitos"),
    currentTaskId: "task-current", machineId: "machine-1", employeeId: "employee-1", employeeName: "Ronaldo"
  });
  assert.equal(second.mode, "tarefa_parcial");
  assert.equal(data.productions.length, 2);
  assert.equal(data.skus[0].stock, 28);
  assert.equal(data.orders[0].quantityProduced, 30);
  assert.equal(data.orders[0].remainingQuantity, 70);
  assert.equal(data.ops[0].quantityProduced, 30);
  assert.equal(data.ops[0].remainingQuantity, 70);
  assert.equal(data.productionOrders.find(row => row.id === "task-current").quantityProduced, 10);

  await assert.rejects(
    () => window.AutomacaoFinal.apontarPorVoz({
      parsed: window.ComandoVoz.parseComando("cliente Papelaria, código AG C BCP 27, produzi 1000 unidades"),
      currentTaskId: "task-current", machineId: "machine-1", employeeName: "Ronaldo"
    }),
    /saldo da tarefa/
  );
  assert.equal(data.productions.length, 2, "Comando recusado não pode gerar apontamento");
  assert.ok(data.auditLogs.some(row => row.entity === "Pedido" && row.action === "BAIXA_AUTOMATICA"));
  assert.ok(data.auditLogs.some(row => row.entity === "Estoque de produto" && row.action === "ENTRADA_AUTOMATICA"));
  assert.ok(data.auditLogs.some(row => row.entity === "Apontamento por voz" && row.action === "AUTOMACAO_CONCLUIDA"));
  assert.ok(data.automationEvents.some(row => row.type === "VOZ_APONTAMENTO" && row.status === "RECUSADO"));

  console.log("ETAPA 16 FLOW TESTS: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
