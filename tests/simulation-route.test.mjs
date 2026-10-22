import test from "node:test";
import assert from "node:assert/strict";
import { buildSimulationRoute, createTraffic, nextTruckProgress, sampleRoute, stepTraffic } from "../app/lib/simulation-route.ts";

const route = buildSimulationRoute([{ lat: 19, lng: -99 }, { lat: 19.001, lng: -99 }, { lat: 19.010, lng: -99 }]);

test("la escena conserva el recorrido completo a escala métrica y lo divide sin huecos", () => {
  assert.ok(Math.abs(route.length - 1111.95) < 0.1);
  assert.equal(route.points.length, 3);
  assert.equal(route.sectors[0].start, 0);
  assert.equal(route.sectors.at(-1).end, 1);
  assert.ok(route.sectors.length >= 3 && route.sectors.length <= 8);
  for (let index = 1; index < route.sectors.length; index += 1) assert.equal(route.sectors[index - 1].end, route.sectors[index].start);
  assert.ok(Math.abs(sampleRoute(route, 0.5).z + route.length / 2) < 0.1);
  assert.equal(sampleRoute(route, 1).z, route.points.at(-1).z);
});

test("la ruta no redondea esquinas ni elimina vértices del trazado", () => {
  const bend = buildSimulationRoute([{ lat: 19, lng: -99 }, { lat: 19.001, lng: -99 }, { lat: 19.001, lng: -98.999 }]);
  const corner = sampleRoute(bend, bend.distances[1] / bend.length);
  assert.ok(Math.abs(corner.x) < 0.01);
  assert.ok(Math.abs(corner.z - bend.points[1].z) < 0.01);
  assert.equal(bend.points.length, 3);
  assert.equal(buildSimulationRoute([{ lat: 19, lng: -99 }, { lat: 19, lng: -99 }]).length, 0);
});

test("los vehículos esperan ante el semáforo y reanudan al ponerse verde", () => {
  let cars = [{ id: 0, distance: 300, direction: 1, speed: 9, desiredSpeed: 12 }];
  for (let tick = 0; tick < 600; tick += 1) cars = stepTraffic(cars, 0.05, 1000, "rojo", "fluido", 0);
  assert.ok(cars[0].distance <= 325.001);
  assert.ok(cars[0].speed < 0.1);
  const stopped = cars[0].distance;
  for (let tick = 0; tick < 80; tick += 1) cars = stepTraffic(cars, 0.05, 1000, "verde", "fluido", 0);
  assert.ok(cars[0].distance > stopped + 3);
});

test("el seguimiento de carril mantiene separación y respeta al camión", () => {
  let cars = [
    { id: 0, distance: 50, direction: 1, speed: 12, desiredSpeed: 12 },
    { id: 1, distance: 65, direction: 1, speed: 0, desiredSpeed: 0 },
  ];
  for (let tick = 0; tick < 100; tick += 1) {
    cars = stepTraffic(cars, 0.05, 1000, "verde", "moderado", 80);
    assert.ok(cars[1].distance - cars[0].distance >= 5.99);
  }
  assert.ok(cars[0].distance < 65);
  assert.deepEqual(stepTraffic(cars, 0, 1000, "verde", "moderado", 80), cars);
});

test("el camión de demostración no atraviesa una cola ni la línea roja", () => {
  const truckRoute = { ...route, length: 1000 };
  const cars = [{ id: 0, distance: 110, direction: 1, speed: 0, desiredSpeed: 0 }];
  const next = nextTruckProgress(0.09, 100, truckRoute, cars, "verde");
  assert.ok(next * 1000 <= 97.001);
  const red = nextTruckProgress(0.30, 100, truckRoute, [], "rojo");
  assert.ok(red * 1000 <= 322.001);
  assert.ok(nextTruckProgress(red, 20, truckRoute, [], "verde") > red);
});

test("la densidad aumenta el número de agentes y el tráfico contrario usa su sentido", () => {
  assert.ok(createTraffic(2500, "intenso").length > createTraffic(2500, "fluido").length);
  const car = { id: 0, distance: 800, direction: -1, speed: 5, desiredSpeed: 9 };
  assert.ok(stepTraffic([car], 0.05, 1000, "rojo", "fluido", 0)[0].distance < 800);
});
