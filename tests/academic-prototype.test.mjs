import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("incluye las funciones del prototipo académico ampliado", async () => {
  const [page, routing, simulation, scene, session, evaluation, google3d, cesium3d] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/academic-simulation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TruckSimulation3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AcademicSessionGate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AcademicEvaluationPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/GooglePhotorealistic3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CesiumRoadMap3D.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(routing, /findRouteAlternatives/);
  assert.match(routing, /maxAxleWeight/);
  assert.match(routing, /maxTurnRadius/);
  assert.match(routing, /calculationMs/);
  assert.match(routing, /operatingCost/);
  assert.match(simulation, /createTrafficSnapshot/);
  assert.match(simulation, /signalStateForTick/);
  assert.match(page, /Eventos automáticos/);
  assert.match(page, /GPS simulado/);
  assert.match(page, /Confirmar ruta seleccionada/);
  assert.match(scene, /createSimulationWorld/);
  assert.match(scene, /SEMÁFORO/);
  assert.match(session, /Continuar como invitado/);
  assert.match(evaluation, /Ejecutar 100 cálculos/);
  assert.match(google3d, /TRUCK_MODEL_HEADING_OFFSET/);
  assert.match(cesium3d, /TRUCK_MODEL_HEADING_OFFSET/);
});
