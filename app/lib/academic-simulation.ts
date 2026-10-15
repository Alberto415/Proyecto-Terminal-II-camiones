import type { GeoPoint, TrafficLevel } from "./routing";
import { edgeFor, nodeFor, roadEdges } from "./routing";

export type SignalState = "verde" | "amarillo" | "rojo";
export type AgentState = "planeando" | "en-ruta" | "esperando-semaforo" | "recalculando" | "finalizado";
export type EventKind = "accidente" | "obra" | "manifestacion" | "bache";

export type AcademicRoadEvent = {
  id: string;
  edgeId: string;
  kind: EventKind;
  label: string;
  severity: "baja" | "media" | "alta";
  blocked: boolean;
  createdAt: number;
  expiresAt: number;
};

export const ACADEMIC_STORAGE = {
  session: "ruta-carga:academic-session",
  profiles: "ruta-carga:vehicle-profiles",
  history: "ruta-carga:route-history",
  learning: "ruta-carga:learned-penalties",
  camera: "ruta-carga:camera-mode",
  evaluation: "ruta-carga:evaluations",
} as const;

function seededValue(seed: number, index: number) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createTrafficSnapshot(seed: number): Record<string, TrafficLevel> {
  return Object.fromEntries(roadEdges.map((edge, index) => {
    const value = seededValue(seed, index);
    const level: TrafficLevel = value > 0.76 ? "intenso" : value > 0.38 ? "moderado" : "fluido";
    return [edge.id, level];
  }));
}

export function signalStateForTick(tick: number): SignalState {
  const phase = tick % 12;
  return phase < 6 ? "verde" : phase < 8 ? "amarillo" : "rojo";
}

export function eventLabel(kind: EventKind) {
  return {
    accidente: "Accidente simulado",
    obra: "Obras de mantenimiento",
    manifestacion: "Manifestación simulada",
    bache: "Bache reportado",
  }[kind];
}

export function createAcademicIncident(edgeIds: string[], seed = Date.now()): AcademicRoadEvent | null {
  if (!edgeIds.length) return null;
  const kinds: EventKind[] = ["accidente", "obra", "manifestacion", "bache"];
  const edgeId = edgeIds[Math.abs(seed) % edgeIds.length];
  const kind = kinds[Math.abs(seed + 3) % kinds.length];
  const severity = kind === "bache" ? "baja" : kind === "obra" ? "media" : "alta";
  return {
    id: `evt-${seed}-${edgeId}`,
    edgeId,
    kind,
    label: `${eventLabel(kind)} en ${edgeFor(edgeId).road}`,
    severity,
    blocked: severity === "alta" || kind === "obra",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60_000,
  };
}

export function interpolateGeoPath(path: GeoPoint[], progress: number): GeoPoint {
  if (!path.length) return { lat: nodeFor("uam").lat, lng: nodeFor("uam").lng };
  if (path.length === 1) return path[0];
  const scaled = Math.max(0, Math.min(0.9999, progress)) * (path.length - 1);
  const index = Math.floor(scaled);
  const ratio = scaled - index;
  return {
    lat: path[index].lat + (path[index + 1].lat - path[index].lat) * ratio,
    lng: path[index].lng + (path[index + 1].lng - path[index].lng) * ratio,
  };
}

export function trafficLabel(level: TrafficLevel) {
  return level === "intenso" ? "Tráfico intenso" : level === "moderado" ? "Tráfico moderado" : "Tráfico fluido";
}
