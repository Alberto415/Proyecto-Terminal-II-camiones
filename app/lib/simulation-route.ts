import type { GeoPoint, TrafficLevel } from "./routing.ts";
import type { SignalState } from "./academic-simulation.ts";

export type ScenePoint = { x: number; z: number };
export type SimulationRoute = {
  origin: GeoPoint;
  points: ScenePoint[];
  distances: number[];
  length: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  sectors: Array<{ name: string; start: number; end: number; center: number }>;
};
export type TrafficCar = { id: number; distance: number; direction: 1 | -1; speed: number; desiredSpeed: number };
export const SIGNAL_POSITIONS = [0.33, 0.68];

export function buildSimulationRoute(coordinates: GeoPoint[]): SimulationRoute {
  const origin = coordinates[0] ?? { lat: 0, lng: 0 };
  const scale = Math.cos(origin.lat * Math.PI / 180);
  const points: ScenePoint[] = [];
  for (const coordinate of coordinates) {
    const p = { x: (coordinate.lng - origin.lng) * 111_195 * scale, z: -(coordinate.lat - origin.lat) * 111_195 };
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    const last = points[points.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.05) points.push(p);
  }
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z));
  }
  const length = distances[distances.length - 1] ?? 0;
  const count = Math.max(3, Math.min(8, Math.ceil(length / 700)));
  const sectors = Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? "Salida" : index === count - 1 ? "Llegada" : `Sector ${index + 1}`,
    start: index / count, end: (index + 1) / count, center: (index + 0.5) / count,
  }));
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return { origin, points, distances, length, sectors, bounds: {
    minX: Math.min(0, ...xs), maxX: Math.max(0, ...xs), minZ: Math.min(0, ...zs), maxZ: Math.max(0, ...zs),
  } };
}

export function sampleRoute(route: SimulationRoute, progress: number) {
  const target = Math.max(0, Math.min(1, progress)) * route.length;
  let low = 1;
  let high = route.points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (route.distances[middle] < target) low = middle + 1; else high = middle;
  }
  const a = route.points[Math.max(0, low - 1)] ?? { x: 0, z: 0 };
  const b = route.points[low] ?? a;
  const segment = Math.hypot(b.x - a.x, b.z - a.z);
  const ratio = segment ? Math.max(0, Math.min(1, (target - (route.distances[low - 1] ?? 0)) / segment)) : 0;
  const dx = segment ? (b.x - a.x) / segment : 0;
  const dz = segment ? (b.z - a.z) / segment : -1;
  return { x: a.x + (b.x - a.x) * ratio, z: a.z + (b.z - a.z) * ratio, dx, dz, rightX: -dz, rightZ: dx };
}

export function createTraffic(length: number, level: TrafficLevel): TrafficCar[] {
  const spacing = level === "intenso" ? 45 : level === "moderado" ? 85 : 140;
  const count = Math.max(8, Math.min(72, Math.floor(length / spacing)));
  return Array.from({ length: count }, (_, index) => ({
    id: index, distance: ((index + 0.55) / count) * length,
    direction: index % 3 === 0 ? -1 : 1,
    speed: 0, desiredSpeed: 7 + (index % 5) * 1.1,
  }));
}

export function trafficGap(cars: TrafficCar[], distance: number, direction: 1 | -1) {
  return cars.reduce((gap, car) => {
    const ahead = (car.distance - distance) * direction;
    return car.direction === direction && ahead > 0 ? Math.min(gap, ahead) : gap;
  }, Infinity);
}

export function stepTraffic(cars: TrafficCar[], dt: number, length: number, signal: SignalState, level: TrafficLevel, truckDistance: number, truckLength = 9) {
  const factor = level === "intenso" ? 0.45 : level === "moderado" ? 0.72 : 1;
  const seconds = Math.max(0, Math.min(0.1, dt));
  return cars.map((car) => {
    let gap = trafficGap(cars.filter((other) => other.id !== car.id), car.distance, car.direction) - 6;
    if (car.direction === 1 && truckDistance > car.distance) gap = Math.min(gap, truckDistance - car.distance - truckLength - 3);
    if ((car.direction === 1 && signal !== "verde") || (car.direction === -1 && signal === "verde")) {
      for (const ratio of SIGNAL_POSITIONS) {
        const toSignal = (ratio * length - car.distance) * car.direction - 5;
        if (toSignal >= -0.1) gap = Math.min(gap, Math.max(0, toSignal));
      }
    }
    const desired = Math.min(car.desiredSpeed * factor, Math.max(0, gap) / 1.4);
    const speed = car.speed + Math.max(-6 * seconds, Math.min(2 * seconds, desired - car.speed));
    const advance = Math.min(Math.max(0, speed * seconds), Math.max(0, gap));
    let distance = car.distance + advance * car.direction;
    if (distance > length + 5) distance = 0;
    if (distance < -5) distance = length;
    return { ...car, distance, speed };
  });
}

export function nextTruckProgress(progress: number, meters: number, route: SimulationRoute, cars: TrafficCar[], signal: SignalState) {
  let allowance = meters;
  const distance = progress * route.length;
  allowance = Math.min(allowance, Math.max(0, trafficGap(cars, distance, 1) - 13));
  if (signal !== "verde") {
    for (const ratio of SIGNAL_POSITIONS) {
      const gap = ratio * route.length - distance - 8;
      if (gap >= -0.1) allowance = Math.min(allowance, Math.max(0, gap));
    }
  }
  return route.length ? Math.min(1, progress + Math.max(0, allowance) / route.length) : 0;
}

export function driveTruck(progress: number, speed: number, dt: number, route: SimulationRoute, cars: TrafficCar[], signal: SignalState, length: number) {
  const at = sampleRoute(route, progress);
  const ahead = sampleRoute(route, Math.min(1, progress + 15 / route.length));
  const angle = Math.abs(Math.atan2(at.dx * ahead.dz - at.dz * ahead.dx, at.dx * ahead.dx + at.dz * ahead.dz));
  const curveLimit = angle > .04 ? Math.sqrt(1.3 * 15 / angle) * (length > 25 ? .8 : 1) : 11.1;
  const free = (nextTruckProgress(progress, 250, route, cars, signal) - progress) * route.length;
  const desired = Math.min(11.1, curveLimit, Math.sqrt(2 * 2 * Math.max(0, free)));
  const nextSpeed = Math.max(0, speed + Math.max(-3 * dt, Math.min(.85 * dt, desired - speed)));
  const next = nextTruckProgress(progress, nextSpeed * dt, route, cars, signal);
  return { progress: next, speed: next === progress ? 0 : nextSpeed, angle };
}

export function upcomingTurn(route: SimulationRoute, progress: number) {
  const distance = progress * route.length;
  for (let i=1;i<route.points.length-1;i++) {
    const gap=route.distances[i]-distance;
    if(gap < 10 || gap > 250) continue;
    const before=sampleRoute(route,Math.max(0,(route.distances[i]-8)/route.length));
    const after=sampleRoute(route,Math.min(1,(route.distances[i]+8)/route.length));
    const angle=Math.atan2(before.dx*after.dz-before.dz*after.dx,before.dx*after.dx+before.dz*after.dz);
    if(Math.abs(angle)>.45) return {text:Math.abs(angle)>2.4 ? "Cambio pronunciado de dirección" : angle>0 ? "Curva a la derecha" : "Curva a la izquierda",meters:Math.round(gap)};
  }
  return {text:route.length-distance<20 ? "Llegada al destino" : "Continúa por el recorrido",meters:Math.round(route.length-distance)};
}
