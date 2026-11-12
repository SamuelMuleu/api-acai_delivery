// Integration tests against a real PostgreSQL (embedded-postgres downloads the binaries on first run).
// Run with: npm test
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const dataDir = mkdtempSync(path.join(tmpdir(), "acai-pg-"));
const port = 54329;

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port, persistent: false });
await pg.initialise();
await pg.start();
await pg.createDatabase("acai_test");

process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${port}/acai_test`;
process.env.ADMIN_PASSWORD = "senha-de-teste";
process.env.ADMIN_TOKEN_SECRET = "x".repeat(40);
execSync("npx prisma migrate deploy", { cwd: root, stdio: "ignore", env: process.env });

const { prisma } = require("./dist/lib/prisma.js");
const { app } = require("./dist/app.js");
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

let failures = 0;
async function check(name, method, url, { body, token, expect, assert } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  const ok = res.status === expect && (!assert || assert(json));
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${method} ${url} -> ${res.status} ${text.slice(0, 110)}`);
  return json;
}

try {
  // Seed
  const produto = await prisma.produto.create({
    data: { nome: "Açaí Tradicional", tamanhos: [{ nome: "300ml", preco: 15 }, { nome: "500ml", preco: 20 }] },
  });
  const [granola, leiteNinho, inativo] = await Promise.all([
    prisma.complemento.create({ data: { nome: "Granola", tipo: "adicional", preco: 2 } }),
    prisma.complemento.create({ data: { nome: "Leite Ninho", tipo: "cobertura", preco: 3.5 } }),
    prisma.complemento.create({ data: { nome: "Kiwi", tipo: "fruta", preco: 4, ativo: false } }),
  ]);

  await check("health", "GET", "/health", { expect: 200 });
  await check("public menu", "GET", "/produtos", { expect: 200, assert: (j) => j.length === 1 });
  await check("public complements hide inactive", "GET", "/complementos", { expect: 200, assert: (j) => j.length === 2 });

  // Auth
  await check("orders need auth", "GET", "/pedidos", { expect: 401 });
  await check("delete needs auth", "DELETE", `/produtos/${produto.id}`, { expect: 401 });
  await check("wrong password", "POST", "/auth/login", { body: { password: "errada" }, expect: 401 });
  await check("forged token", "GET", "/pedidos", { token: "eyJyb2xlIjoiYWRtaW4ifQ.assinatura", expect: 401 });
  const { token } = await check("login", "POST", "/auth/login", { body: { password: "senha-de-teste" }, expect: 200, assert: (j) => !!j.token });
  await check("admin sees inactive", "GET", "/complementos", { token, expect: 200, assert: (j) => j.length === 3 });

  // Orders
  const pedidoBase = { nomeCliente: "Maria Souza", telefone: "(22) 99999-0000", endereco: "Rua A, 10", metodoPagamento: "pix" };
  await check("invalid phone", "POST", "/pedidos", { body: { ...pedidoBase, telefone: "123", produtos: [{ produtoId: produto.id, tamanho: "300ml" }] }, expect: 400 });
  await check("invalid payment", "POST", "/pedidos", { body: { ...pedidoBase, metodoPagamento: "boleto", produtos: [{ produtoId: produto.id, tamanho: "300ml" }] }, expect: 400 });
  await check("unknown size", "POST", "/pedidos", { body: { ...pedidoBase, produtos: [{ produtoId: produto.id, tamanho: "1L" }] }, expect: 400 });
  await check("inactive complement", "POST", "/pedidos", { body: { ...pedidoBase, produtos: [{ produtoId: produto.id, tamanho: "300ml", complementos: [inativo.id] }] }, expect: 400 });
  await check("change below total", "POST", "/pedidos", { body: { ...pedidoBase, metodoPagamento: "dinheiro", trocoPara: 10, produtos: [{ produtoId: produto.id, tamanho: "300ml" }] }, expect: 400 });

  // 2x 500ml (20) + granola (2) + ninho (3.5) = 2 * 25.5 = 51
  const pedido = await check("create order with quantity", "POST", "/pedidos", {
    body: { ...pedidoBase, metodoPagamento: "dinheiro", trocoPara: 60, produtos: [{ produtoId: produto.id, tamanho: "500ml", quantidade: 2, complementos: [granola.id, leiteNinho.id] }] },
    expect: 201,
    assert: (j) => j.total === 51 && j.produtos.length === 2 && j.trocoPara === 60 && j.telefone === "22999990000",
  });
  await check("public tracking hides contact", "GET", `/pedidos/${pedido.id}`, {
    expect: 200,
    assert: (j) => j.telefone === undefined && j.endereco === undefined && j.nomeCliente === "Maria" && j.total === 51,
  });
  await check("admin tracking shows contact", "GET", `/pedidos/${pedido.id}`, { token, expect: 200, assert: (j) => j.endereco === "Rua A, 10" });
  await check("list orders", "GET", "/pedidos", { token, expect: 200, assert: (j) => j.length === 1 && j[0].total === 51 });
  await check("status needs auth", "PATCH", `/pedidos/${pedido.id}/status`, { body: { status: "preparo" }, expect: 401 });
  await check("invalid status", "PATCH", `/pedidos/${pedido.id}/status`, { token, body: { status: "pronto" }, expect: 400 });
  await check("update status", "PATCH", `/pedidos/${pedido.id}/status`, { token, body: { status: "saiu" }, expect: 200, assert: (j) => j.status === "saiu" });
  await check("status missing order", "PATCH", "/pedidos/9999/status", { token, body: { status: "saiu" }, expect: 404 });
  await check("tracking missing", "GET", "/pedidos/9999", { expect: 404 });

  // Complements
  await check("create complement", "POST", "/complementos", { token, body: [{ nome: "Banana", tipo: "fruta", preco: 1.5 }], expect: 201 });
  await check("invalid complement type", "POST", "/complementos", { token, body: [{ nome: "X", tipo: "outro", preco: 1 }], expect: 400 });
  await check("used complement is deactivated", "DELETE", `/complementos/${granola.id}`, { token, expect: 200, assert: (j) => j.ativo === false });
  await check("update complement", "PATCH", `/complementos/${leiteNinho.id}`, { token, body: { preco: 4 }, expect: 200, assert: (j) => j.preco === 4 });

  // Products
  await check("product used in orders", "DELETE", `/produtos/${produto.id}`, { token, expect: 409 });
  const livre = await prisma.produto.create({ data: { nome: "Cupuaçu", tamanhos: [{ nome: "300ml", preco: 16 }] } });
  await check("delete free product", "DELETE", `/produtos/${livre.id}`, { token, expect: 204 });
  await check("unknown route", "GET", "/nada", { expect: 404 });
} finally {
  server.close();
  await prisma.$disconnect();
  await pg.stop();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
