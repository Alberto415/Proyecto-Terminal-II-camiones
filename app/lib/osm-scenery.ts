import type { GeoPoint } from "./routing.ts";
import { sampleRoute, type SimulationRoute } from "./simulation-route.ts";

export type OsmElement = { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> };
export type OsmScenery = { elements: OsmElement[]; fetchedAt: string };
export function projectOsm(point: { lat: number; lon: number }, origin: GeoPoint) {
  return { x: (point.lon - origin.lng) * 111195 * Math.cos(origin.lat * Math.PI / 180), z: -(point.lat - origin.lat) * 111195 };
}
export function buildingHeight(tags: Record<string, string>) {
  const explicit = Number.parseFloat(tags.height ?? "");
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(250, explicit * (/ft|feet/.test(tags.height) ? .3048 : 1));
  const levels = Number.parseFloat(tags["building:levels"] ?? "");
  return Number.isFinite(levels) && levels > 0 ? Math.min(250, levels * 3.2) : 9.6;
}
export function sceneryCenters(route: SimulationRoute) {
  const count = Math.min(8, Math.max(2, Math.ceil(route.length / 450)));
  return Array.from({ length: count }, (_, index) => {
    const p = sampleRoute(route, index / (count - 1));
    return { lat: +(route.origin.lat - p.z / 111195).toFixed(5), lng: +(route.origin.lng + p.x / (111195 * Math.cos(route.origin.lat * Math.PI / 180))).toFixed(5) };
  });
}
const pending = new Map<string, Promise<OsmScenery>>();
export function fetchOsmScenery(route: SimulationRoute): Promise<OsmScenery> {
  const centers = sceneryCenters(route);
  const key = `rc-osm-v1:${JSON.stringify(centers)}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as OsmScenery;
        if (Array.isArray(parsed.elements) && Date.now() - Date.parse(parsed.fetchedAt) < 7 * 86400000) return parsed;
      }
    } catch { /* Storage can be disabled or full. */ }
    const response = await fetch("/api/scenery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centers }), signal: AbortSignal.timeout(55000) });
    if (!response.ok) throw new Error("El servicio OSM no está disponible; se conserva el escenario recreado.");
    const data = await response.json() as OsmScenery;
    if (!Array.isArray(data.elements)) throw new Error("Respuesta OSM incompleta.");
    try {
      const keys = Object.keys(localStorage).filter((item) => item.startsWith("rc-osm-v1:"));
      if (keys.length >= 8) localStorage.removeItem(keys[0]);
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* Nonessential cache. */ }
    return data;
  })();
  pending.set(key, request);
  request.finally(() => pending.delete(key)).catch(() => {});
  return request;
}
