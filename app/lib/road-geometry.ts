import type { GeoPoint } from "./routing.ts";
import { roadWaypointsForLocations } from "./routing.ts";
import { geographicDistanceKm } from "./road-network.ts";

type OpenRoadRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs?: Array<{ steps?: Array<{ maneuver?: { modifier?: string } }> }>;
};

const roadCache = new Map<string, Promise<GeoPoint[]>>();

export function openRoadRouteUrl(waypoints: GeoPoint[]) {
  const coordinates = roadWaypointsForLocations(waypoints).map((point) => `${point.lng},${point.lat}`).join(";");
  return `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=true&continue_straight=true`;
}

export function selectCompactRoadRoute(routes: OpenRoadRoute[]) {
  const usable = routes.filter((route) => Number.isFinite(route.distance) && Number.isFinite(route.duration)
    && route.geometry?.coordinates?.length > 1
    && route.geometry.coordinates.every(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng)));
  if (!usable.length) throw new Error("No se recibió una ruta vial válida.");
  const fastest = Math.min(...usable.map((route) => route.duration));
  const score = (route: OpenRoadRoute) => {
    const uturns = route.legs?.flatMap((leg) => leg.steps ?? []).filter((step) => step.maneuver?.modifier === "uturn").length ?? 0;
    return route.distance + uturns * 100;
  };
  // Acortar y reducir retornos sin elegir una alternativa desproporcionadamente lenta.
  return usable.filter((route) => route.duration <= fastest * 1.25 + 30).sort((a, b) => score(a) - score(b))[0];
}

export async function fetchOpenRoadGeometry(waypoints: GeoPoint[]): Promise<GeoPoint[]> {
  if (waypoints.length < 2) return roadWaypointsForLocations(waypoints);
  const url = openRoadRouteUrl(waypoints);
  let request = roadCache.get(url);
  if (!request) {
    request = (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`No se pudo calcular la geometría vial: HTTP ${response.status}`);
      const data = await response.json();
      if (data.code !== "Ok") throw new Error("No hay una ruta vial disponible para estos puntos.");
      const route = selectCompactRoadRoute(data.routes ?? []);
      return route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    })();
    if (roadCache.size >= 32) roadCache.delete(roadCache.keys().next().value!);
    roadCache.set(url, request);
    request.catch(() => { roadCache.delete(url); });
  }
  return request;
}

const distancesCache = new WeakMap<GeoPoint[], number[]>();

export function pointAlongRoad(path: GeoPoint[], progress: number): GeoPoint | undefined {
  if (!path.length) return undefined;
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  let cumulative = distancesCache.get(path);
  if (!cumulative) {
    cumulative = [0];
    for (let index = 1; index < path.length; index += 1) {
      cumulative.push(cumulative[index - 1] + geographicDistanceKm(path[index - 1], path[index]));
    }
    distancesCache.set(path, cumulative);
  }
  const target = progress * cumulative[cumulative.length - 1];
  for (let index = 1; index < path.length; index += 1) {
    if (cumulative[index] < target) continue;
    const length = cumulative[index] - cumulative[index - 1];
    const ratio = length ? (target - cumulative[index - 1]) / length : 0;
    return {
      lat: path[index - 1].lat + (path[index].lat - path[index - 1].lat) * ratio,
      lng: path[index - 1].lng + (path[index].lng - path[index - 1].lng) * ratio,
    };
  }
  return path[path.length - 1];
}
