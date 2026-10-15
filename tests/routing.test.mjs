import assert from "node:assert/strict";
import test from "node:test";
import {
  findRoute,
  findRouteAlternatives,
  PILOT_DATASET_METADATA,
  roadEdges,
  roadNodes,
  routeGeoWaypoints,
  routeLocationMarkers,
} from "../app/lib/routing.ts";

const c2 = {
  height: 3.6,
  width: 2.5,
  length: 10.5,
  weight: 18,
  axles: 2,
  turnRadius: 8.5,
  fuelConsumption: 26,
  cargoType: "general",
  authorizedPrivateZones: false,
};

test("A* encuentra una ruta y calcula métricas operativas", () => {
  const route = findRoute("uam", "logistico", c2);
  assert.ok(route.path.length > 1);
  assert.ok(route.distance > 0);
  assert.ok(route.minutes > 0);
  assert.ok(route.fuelLiters > 0);
  assert.ok(route.operatingCost > 0);
});

test("los marcadores preservan las coordenadas del lugar y el orden de la ruta", () => {
  const path = ["uam", "vasco", "bosques", "tacubaya"];
  const waypoints = routeGeoWaypoints(path);
  const markers = routeLocationMarkers(waypoints);
  assert.deepEqual(markers.map((marker) => marker.position), waypoints);
  assert.deepEqual(markers.map((marker) => marker.endpoint), [true, false, false, true]);
  assert.match(markers[0].label, /^Origen · UAM Cuajimalpa$/);
  assert.match(markers[1].label, /^Paso · Parque La Mexicana$/);
  assert.match(markers.at(-1).label, /^Destino · Tacubaya$/);
  assert.deepEqual(routeLocationMarkers([]), []);
  assert.match(routeLocationMarkers([waypoints[0]])[0].label, /^Origen \/ destino/);
});

test("una arista de sentido único solo puede recorrerse de origen a destino", () => {
  const blockedExceptE04 = roadEdges.filter((edge) => edge.id !== "e04").map((edge) => edge.id);
  const forward = findRoute("santa-fe", "reforma", c2, blockedExceptE04);
  const reverse = findRoute("reforma", "santa-fe", c2, blockedExceptE04);
  assert.deepEqual(forward.edgeIds, ["e04"]);
  assert.deepEqual(reverse.path, []);
});

test("las restricciones físicas eliminan rutas incompatibles", () => {
  const oversized = { ...c2, height: 5.2, weight: 90 };
  const route = findRoute("uam", "logistico", oversized);
  assert.deepEqual(route.path, []);
  assert.ok(route.rejected.some(({ reason }) => reason.startsWith("Altura máxima") || reason.startsWith("Peso máximo")));
});

test("las alternativas son únicas y están limitadas", () => {
  const alternatives = findRouteAlternatives("uam", "logistico", c2, [], { preference: "balanceada" }, 3);
  assert.ok(alternatives.length >= 1 && alternatives.length <= 3);
  assert.equal(new Set(alternatives.map((route) => route.edgeIds.join("|"))).size, alternatives.length);
});

test("el conjunto piloto declara procedencia y limitación académica", () => {
  assert.equal(PILOT_DATASET_METADATA.coordinateReference, "WGS84");
  assert.equal(PILOT_DATASET_METADATA.verifiedForNavigation, false);
  assert.match(PILOT_DATASET_METADATA.restrictionSource, /sintéticos/i);
  assert.match(PILOT_DATASET_METADATA.locationSource, /verificadas/i);
});

test("cada nodo representa una ubicación identificable con procedencia", () => {
  assert.equal(roadNodes.length, 9);
  assert.ok(roadNodes.every((node) => node.address && node.sourceUrl.startsWith("https://")));
  const uam = roadNodes.find((node) => node.id === "uam");
  assert.ok(Math.abs(uam.lat - 19.3519954) < 0.000001);
  assert.ok(Math.abs(uam.lng - -99.2826512) < 0.000001);
  assert.match(uam.address, /Vasco de Quiroga 4871/);
  const tacubaya = roadNodes.find((node) => node.id === "tacubaya");
  assert.ok(tacubaya);
  assert.equal(tacubaya.label, "Tacubaya");
  assert.equal(tacubaya.lat, 19.4014375);
  assert.equal(tacubaya.lng, -99.1878125);
  assert.match(tacubaya.address, /CR26\+HV.*11870/);
});
