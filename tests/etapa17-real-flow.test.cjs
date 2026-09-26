const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const data = {
  skus: [{ id: "sku-agenda", code: "AG C BCP 27", description: "Agenda Clássica Basic Preto", stock: 0 }],
  orders: [{
    id: "order-real-1254", number: "1254", client: "Papelaria", skuId: "sku-agenda",
    skuCode: "AG C BCP 27", product: "Agenda Clássica Basic Preto", quantity: 1932,
    quantityProduced: 0, remainingQuantity: 1932, status: "aguardando", createdAt: 1
  }],
  ops: [{
    id: "op-real-1254", orderId: "order-real-1254", number: "OP-1254", quantity: 1932,
    quantityProduced: 0, remainingQuantity: 1932, status: "aguardando", priority: "media", createdAt: 1
  }],
  productionOrders: [], productions: [], stockMovements: [], auditLogs: [], automationEvents: [],
  machines: [{ id: "machine-real-1", name: "Automática 1", status: "parada", client: "" }]
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
const context = vm.createContext({
  window, console, Date, Math, JSON, Promise, String, Number, Object, Array,
  RegExp, Error, setTimeout, clearTimeout
});
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("js/utils.js");
load("js/comando-voz.js");
load("js/leitura-pedido.js");
load("js/fluxo-producao.js");
load("js/automacao-final.js");

(async () => {
  const pedidoTexto = [
    "Pedido: 1254",
    "Cliente: Papelaria",
    "Código: AG C BCP 27",
    "Descrição: Agenda Clássica Basic Preto",
    "Quantidade: 1932"
  ].join("\n");
  const ocr = window.LeituraPedido.parsePedido(pedidoTexto);
  assert.equal(ocr.guessedOrderNumber, "1254");
  assert.equal(ocr.guessedClient, "Papelaria");
  assert.equal(ocr.guessedCode, "AG C BCP 27");
  assert.equal(ocr.guessedQuantity, 1932);
  assert.equal(ocr.confidence, "alta");

  const frase = "Cliente Papelaria, código AG C BCP 27, produzi 500 unidades, 10 defeitos.";
  const parsed = window.ComandoVoz.parseComando(frase);
  assert.equal(parsed.clienteRaw, "Papelaria");
  assert.equal(parsed.codigoRaw, "AG C BCP 27");
  assert.equal(parsed.quantidade, 500);
  assert.equal(parsed.defeitos, 10);

  const result = await window.AutomacaoFinal.apontarPorVoz({
    parsed,
    machineId: "machine-real-1",
    employeeId: "employee-ronaldo",
    employeeName: "Ronaldo",
    rawText: frase
  });

  const order = data.orders[0];
  const op = data.ops[0];
  const production = data.productions[0];
  const task = data.productionOrders[0];
  const movement = data.stockMovements.find(row => row.type === "ENTRADA_PRODUCAO");

  assert.equal(result.mode, "pedido_localizado");
  assert.equal(production.quantityProduced, 500);
  assert.equal(production.defects, 10);
  assert.equal(production.approved, 490);
  assert.equal(production.operator, "Ronaldo");
  assert.equal(production.machineId, "machine-real-1");
  assert.equal(production.client, "Papelaria");
  assert.equal(production.opId, "op-real-1254");
  assert.equal(task.orderId, "order-real-1254");
  assert.equal(task.opId, "op-real-1254");
  assert.equal(order.quantityProduced, 500);
  assert.equal(order.remainingQuantity, 1432);
  assert.equal(order.status, "em_producao");
  assert.equal(op.quantityProduced, 500);
  assert.equal(op.remainingQuantity, 1432);
  assert.equal(op.status, "producao");
  assert.equal(data.skus[0].stock, 490);
  assert.equal(movement.quantity, 490);
  assert.equal(movement.operator, "Ronaldo");
  assert.equal(movement.machineId, "machine-real-1");
  assert.equal(movement.orderId, "order-real-1254");
  assert.equal(movement.productionId, production.id);

  const beforeRejected = { productions: data.productions.length, stock: data.skus[0].stock };
  await assert.rejects(
    () => window.AutomacaoFinal.apontarPorVoz({
      parsed: window.ComandoVoz.parseComando("Cliente Papelaria, código AG C BCP 27, produzi 1500 unidades"),
      machineId: "machine-real-1", employeeName: "Ronaldo"
    }),
    /saldo do pedido/
  );
  assert.equal(data.productions.length, beforeRejected.productions, "Comando acima do saldo não pode criar produção");
  assert.equal(data.skus[0].stock, beforeRejected.stock, "Comando recusado não pode mexer no estoque");
  assert.ok(data.automationEvents.some(row => row.type === "VOZ_APONTAMENTO" && row.status === "RECUSADO"));
  assert.ok(data.auditLogs.some(row => row.entity === "Produção" && row.after && row.after.approved === 490));
  assert.ok(data.auditLogs.some(row => row.entity === "Estoque de produto" && row.after && row.after.stock === 490));

  const operatorSource = fs.readFileSync(path.join(root, "js/operador-app.js"), "utf8");
  assert.match(operatorSource, /function confirmarApontamentoVoz/);
  assert.match(operatorSource, /if \(!confirmarApontamentoVoz\(r\)\)/);

  console.log("ETAPA 17 REAL FLOW TESTS: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
