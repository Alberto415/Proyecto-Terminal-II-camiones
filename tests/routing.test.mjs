import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("incluye el motor A* y restricciones físicas", async () => {
  const source = await readFile(new URL("../app/lib/routing.ts", import.meta.url), "utf8");
  assert.match(source, /findRoute/);
  assert.match(source, /vehicle\.height > edge\.maxHeight/);
  assert.match(source, /vehicle\.weight > edge\.maxWeight/);
  assert.match(source, /Incidente o cierre activo/);
});
