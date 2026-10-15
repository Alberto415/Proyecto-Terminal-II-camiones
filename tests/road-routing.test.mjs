import test from "node:test";
import assert from "node:assert/strict";
import { findRoute, findRouteAlternatives, roadEdges, roadNodes, routeGeoWaypoints, routeEdgeCost, routeLocationMarkers } from "../app/lib/routing.ts";
import { geographicDistanceKm, ROAD_ACCESS, roadMetrics } from "../app/lib/road-network.ts";
import { fetchOpenRoadGeometry, openRoadRouteUrl, pointAlongRoad, selectCompactRoadRoute } from "../app/lib/road-geometry.ts";

const small = { height: 3, width: 2.4, length: 9, weight: 14, axles: 2, turnRadius: 8, fuelConsumption: 24, cargoType: "general", authorizedPrivateZones: false };
const tractor = { ...small, height: 4.25, width: 2.6, length: 18.5, weight: 42, axles: 5, turnRadius: 12.5 };

test("un camión compatible usa el enlace corto y un cierre obliga al desvío sin saltarse restricciones", () => {
  const direct = findRoute("uam", "vasco", small, [], { preference: "corta" });
  assert.deepEqual(direct.edgeIds, ["e02"]);
  assert.equal(direct.distance, 1.6);
  const detour = findRoute("uam", "vasco", small, ["e02"], { preference: "corta" });
  assert.deepEqual(detour.path, ["uam", "santa-fe", "vasco"]);
  assert.equal(detour.distance, 3.9);
  const heavy = findRoute("uam", "vasco", tractor, [], { preference: "corta" });
  assert.ok(!heavy.edgeIds.includes("e02"));
  assert.ok(heavy.rejected.some(({ edge }) => edge.id === "e02"));
  assert.equal(findRouteAlternatives("uam", "vasco", tractor, [], { preference: "corta" }).length, 1);
});

test("los sentidos viales reales producen distancias distintas en cada dirección", () => {
  assert.equal(findRoute("logistico", "observatorio", small, [], { preference: "corta" }).distance, 0.4);
  assert.equal(findRoute("observatorio", "logistico", small, [], { preference: "corta" }).distance, 2.3);
  for (const a of roadNodes) for (const b of roadNodes) {
    assert.ok(roadMetrics(a.id, b.id).distance + 0.001 >= geographicDistanceKm(ROAD_ACCESS[a.id], ROAD_ACCESS[b.id]));
  }
});

test("A* y el ranking coinciden con el costo mínimo de todos los caminos del grafo", () => {
  // Vehículo pequeño y autorizado: todas las aristas son compatibles, excepto cierres y sentidos.
  const vehicle = { ...small, height: 2, weight: 5, authorizedPrivateZones: true };
  for (const preference of ["corta", "balanceada", "rapida", "economica", "segura"]) {
    for (const [start, goal] of [["uam", "logistico"], ["logistico", "uam"], ["bosques", "vasco"]]) {
      const options = { preference, learnedPenalties: { e06: 3 }, trafficByEdge: { e08: "intenso" } };
      let minimum = Infinity;
      const visit = (current, visited, cost) => {
        if (current === goal) { minimum = Math.min(minimum, cost); return; }
        for (const edge of roadEdges) {
          if (edge.id === "e15") continue;
          const next = edge.from === current ? edge.to : !edge.oneWay && edge.to === current ? edge.from : null;
          if (!next || visited.has(next)) continue;
          visit(next, new Set([...visited, next]), cost + routeEdgeCost(edge, current, next, vehicle, options));
        }
      };
      visit(start, new Set([start]), 0);
      const route = findRoute(start, goal, vehicle, ["e15"], options);
      const score = route.edgeIds.reduce((sum, id, index) => sum + routeEdgeCost(roadEdges.find((edge) => edge.id === id), route.path[index], route.path[index + 1], vehicle, options), 0);
      assert.ok(Math.abs(score - minimum) < 1e-8, `${start} → ${goal} (${preference})`);
      const alternatives = findRouteAlternatives(start, goal, vehicle, ["e15"], options);
      assert.deepEqual(alternatives[0].edgeIds, route.edgeIds);
    }
  }
});

test("el trazado usa calles de referencia sin cambiar los marcadores de los inmuebles", () => {
  const points = routeGeoWaypoints(["uam", "santa-fe", "vasco"]);
  const url = new URL(openRoadRouteUrl(points));
  assert.ok(url.pathname.includes("-99.281907,19.35332;-99.272791,19.360274;-99.272106,19.357552"));
  assert.equal(url.searchParams.get("continue_straight"), "true");
  assert.deepEqual(routeLocationMarkers(points).map((marker) => marker.position), points);
});

test("elige una geometría compacta sin borrar giros legales ni escoger una alternativa excesivamente lenta", () => {
  const geometry = { coordinates: [[-99.2, 19.4], [-99.21, 19.41]] };
  const fastest = { distance: 3000, duration: 300, geometry };
  const shorter = { distance: 2400, duration: 330, geometry };
  const slow = { distance: 2000, duration: 900, geometry };
  assert.equal(selectCompactRoadRoute([fastest, shorter, slow]), shorter);
  assert.throws(() => selectCompactRoadRoute([]));
});

test("el avance depende de la distancia recorrida y no del número de vértices", () => {
  const path = [{ lat: 19, lng: -99 }, { lat: 19.001, lng: -99 }, { lat: 19.010, lng: -99 }];
  assert.ok(Math.abs(pointAlongRoad(path, 0.5).lat - 19.005) < 1e-6);
  assert.deepEqual(pointAlongRoad(path, 1), path.at(-1));
});

test("un proveedor fallido no se presenta como una ruta recta que atraviesa edificios", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(fetchOpenRoadGeometry([{ lat: 19.4, lng: -99.2 }, { lat: 19.41, lng: -99.21 }]), /HTTP 503/);
  } finally { globalThis.fetch = previousFetch; }
});
