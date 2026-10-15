import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renderiza la aplicación Ruta Carga 3D", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Ruta Carga 3D/);
  assert.match(html, /PLANIFICADOR ESPECIALIZADO/);
  assert.match(html, /Calcular ruta segura/);
  assert.match(html, /SIMULADOR DE AGENTE/);
  assert.match(html, /Mapa 3D/);
  assert.match(html, /Seguimiento/);
  assert.match(html, /Órbita/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
