import { geographicDistanceKm, ROAD_ACCESS, ROAD_NETWORK_SOURCE, roadMetrics } from "./road-network.ts";

export type NodeId = "uam" | "santa-fe" | "vasco" | "reforma" | "bosques" | "tacubaya" | "periferico" | "observatorio" | "logistico";

export type RoadNode = {
  id: NodeId;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  address: string;
  sourceLabel: string;
  sourceUrl: string;
  locationNote: string;
  osmId?: string;
  locationAccuracy: "verified-landmark" | "road-reference";
};

export type GeoPoint = { lat: number; lng: number };

export type RoadEdge = {
  id: string;
  from: NodeId;
  to: NodeId;
  distance: number;
  minutes: number;
  maxHeight: number;
  maxWeight: number;
  minWidth: number;
  grade: number;
  speedLimit?: number;
  maxAxleWeight?: number;
  maxTurnRadius?: number;
  toll?: number;
  signalized?: boolean;
  condition?: "normal" | "baches" | "obras";
  road: string;
  oneWay?: boolean;
  privateZone?: boolean;
  hazmatRestricted?: boolean;
};

export type CargoType = "general" | "refrigerada" | "peligrosa";

export type Vehicle = {
  height: number;
  width: number;
  length: number;
  weight: number;
  axles: number;
  turnRadius: number;
  fuelConsumption: number;
  cargoType: CargoType;
  authorizedPrivateZones: boolean;
};

export type RoutePreference = "corta" | "balanceada" | "rapida" | "economica" | "segura";
export type TrafficLevel = "fluido" | "moderado" | "intenso";

export type RoutingOptions = {
  trafficByEdge?: Record<string, TrafficLevel>;
  learnedPenalties?: Record<string, number>;
  preference?: RoutePreference;
};

export type RouteResult = {
  path: NodeId[];
  edgeIds: string[];
  distance: number;
  minutes: number;
  explored: number;
  rejected: Array<{ edge: RoadEdge; reason: string }>;
  riskScore: number;
  warnings: string[];
  calculationMs: number;
  fuelLiters: number;
  operatingCost: number;
  tollCost: number;
  signalCount: number;
};

export const PILOT_DATASET_METADATA = {
  name: "Corredor académico Poniente CDMX",
  version: "2026.10.14-vial",
  coverage: "Cuajimalpa, Santa Fe, Tacubaya y Observatorio",
  coordinateReference: "WGS84",
  geometrySources: ["OpenStreetMap/OSRM", "Cesium OSM Buildings", "Google Maps 3D opcional"],
  roadMetricsSource: ROAD_NETWORK_SOURCE,
  restrictionSource: "Valores sintéticos documentados para demostración académica",
  locationSource: "Ubicaciones verificadas contra objetos identificables de OpenStreetMap/Nominatim y direcciones institucionales; Tacubaya conserva el código Plus indicado por el usuario",
  locationsVerifiedAt: "2026-10-14",
  verifiedForNavigation: false,
} as const;

export const roadNodes: RoadNode[] = [
  {
    id: "uam", label: "UAM Cuajimalpa", shortLabel: "UAM Cuajimalpa", x: 10, y: 76,
    lat: 19.3519954, lng: -99.2826512,
    address: "Av. Vasco de Quiroga 4871, Santa Fe Cuajimalpa, Cuajimalpa de Morelos, C.P. 05348, CDMX",
    sourceLabel: "OpenStreetMap · campus UAM Cuajimalpa", sourceUrl: "https://www.openstreetmap.org/way/370898699", osmId: "W370898699",
    locationNote: "Punto representativo del campus; no identifica una caseta de acceso vehicular.", locationAccuracy: "verified-landmark",
  },
  {
    id: "santa-fe", label: "Centro Santa Fe", shortLabel: "Centro Santa Fe", x: 25, y: 55,
    lat: 19.3612975, lng: -99.2737949,
    address: "Av. Vasco de Quiroga 3800, Santa Fe, Cuajimalpa de Morelos, CDMX",
    sourceLabel: "OpenStreetMap · Centro Santa Fe", sourceUrl: "https://www.openstreetmap.org/way/30291947", osmId: "W30291947",
    locationNote: "Punto representativo del centro comercial; los accesos están en las vialidades perimetrales.", locationAccuracy: "verified-landmark",
  },
  {
    id: "vasco", label: "Parque La Mexicana", shortLabel: "La Mexicana", x: 34, y: 79,
    lat: 19.3568024, lng: -99.2716771,
    address: "Av. Luis Barragán 505, Santa Fe, Cuajimalpa de Morelos, C.P. 05348, CDMX",
    sourceLabel: "OpenStreetMap · Parque La Mexicana", sourceUrl: "https://www.openstreetmap.org/way/607127540", osmId: "W607127540",
    locationNote: "Punto representativo del parque; el recorrido vehicular llega a una calle cercana, no al interior peatonal.", locationAccuracy: "verified-landmark",
  },
  {
    id: "reforma", label: "Patio Santa Fe", shortLabel: "Patio Santa Fe", x: 47, y: 47,
    lat: 19.3772092, lng: -99.2545267,
    address: "Prol. Paseo de la Reforma 400, Santa Fe Peña Blanca, Álvaro Obregón, CDMX",
    sourceLabel: "OpenStreetMap · Patio Santa Fe", sourceUrl: "https://www.openstreetmap.org/way/444007401", osmId: "W444007401",
    locationNote: "Punto representativo del edificio; no acredita acceso a los andenes de carga.", locationAccuracy: "verified-landmark",
  },
  {
    id: "bosques", label: "Calle Bosque de Manzanos", shortLabel: "Bosque de Manzanos", x: 62, y: 26,
    lat: 19.3952891, lng: -99.2466165,
    address: "Calle Bosque de Manzanos, Bosques de las Lomas, Miguel Hidalgo, C.P. 11700, CDMX",
    sourceLabel: "OpenStreetMap · Calle Bosque de Manzanos", sourceUrl: "https://www.openstreetmap.org/way/656792738", osmId: "W656792738",
    locationNote: "Referencia de la calle identificada en el mapa; no representa toda la colonia ni el parque homónimo.", locationAccuracy: "road-reference",
  },
  {
    id: "tacubaya", label: "Tacubaya", shortLabel: "Tacubaya", x: 67, y: 66,
    lat: 19.4014375, lng: -99.1878125,
    address: "CR26+HV, Tacubaya, 11870 Ciudad de México, CDMX",
    sourceLabel: "Código Plus completo 76F2CR26+HV", sourceUrl: "https://plus.codes/76F2CR26+HV",
    locationNote: "Centro de la celda del código Plus indicado por el usuario; no es una entrada específica del Metro.", locationAccuracy: "verified-landmark",
  },
  {
    id: "periferico", label: "Fuente de Petróleos", shortLabel: "Fuente de Petróleos", x: 82, y: 39,
    lat: 19.4274474, lng: -99.2031066,
    address: "Anillo Periférico y Paseo de la Reforma, Miguel Hidalgo, CDMX",
    sourceLabel: "OpenStreetMap · Fuente de Petróleos", sourceUrl: "https://www.openstreetmap.org/way/98280658", osmId: "W98280658",
    locationNote: "Ubicación de la fuente; el camión circula por las calles próximas al monumento.", locationAccuracy: "verified-landmark",
  },
  {
    id: "observatorio", label: "Metro Observatorio", shortLabel: "Metro Observatorio", x: 50, y: 84,
    lat: 19.3982702, lng: -99.2004166,
    address: "Calzada Minas de Arena, Álvaro Obregón, C.P. 01120, CDMX",
    sourceLabel: "OpenStreetMap · estación STC Metro Observatorio", sourceUrl: "https://www.openstreetmap.org/way/217419203", osmId: "W217419203",
    locationNote: "Punto representativo de la estación del Metro; se distingue de la estación del tren El Insurgente.", locationAccuracy: "verified-landmark",
  },
  {
    id: "logistico", label: "Terminal Poniente", shortLabel: "Terminal Poniente", x: 89, y: 77,
    lat: 19.3962001, lng: -99.1997725,
    address: "Sur 122 y Av. Río Tacubaya, Terminal Central de Autobuses del Poniente, Álvaro Obregón, CDMX",
    sourceLabel: "OpenStreetMap · Terminal Central de Autobuses del Poniente", sourceUrl: "https://www.openstreetmap.org/way/30178858", osmId: "W30178858",
    locationNote: "Punto representativo de la terminal; los patios de autobuses no son un acceso autorizado para carga.", locationAccuracy: "verified-landmark",
  },
];

const demoRoadEdges: Omit<RoadEdge, "distance" | "minutes">[] = [
  { id: "e01", from: "uam", to: "santa-fe", maxHeight: 4.8, maxWeight: 60, minWidth: 3.8, grade: 6, road: "Av. Vasco de Quiroga", speedLimit: 50, maxAxleWeight: 11, maxTurnRadius: 15, signalized: true },
  { id: "e02", from: "uam", to: "vasco", maxHeight: 3.9, maxWeight: 28, minWidth: 3.1, grade: 9, road: "Camino del Bosque", speedLimit: 30, maxAxleWeight: 8, maxTurnRadius: 10, condition: "baches" },
  { id: "e03", from: "santa-fe", to: "vasco", maxHeight: 4.6, maxWeight: 80, minWidth: 3.9, grade: 5, road: "Prolongación Vasco" },
  { id: "e04", from: "santa-fe", to: "reforma", maxHeight: 4.4, maxWeight: 48, minWidth: 3.6, grade: 7, road: "Autopista Urbana Poniente", oneWay: true, speedLimit: 60, maxAxleWeight: 10, maxTurnRadius: 15, toll: 42 },
  { id: "e05", from: "vasco", to: "reforma", maxHeight: 4.8, maxWeight: 64, minWidth: 3.8, grade: 6, road: "Av. de los Poetas" },
  { id: "e06", from: "vasco", to: "observatorio", maxHeight: 4.5, maxWeight: 52, minWidth: 3.5, grade: 8, road: "Camino Real" },
  { id: "e07", from: "reforma", to: "bosques", maxHeight: 4.8, maxWeight: 65, minWidth: 4.1, grade: 5, road: "Paseo de los Ahuehuetes", privateZone: true },
  { id: "e08", from: "reforma", to: "tacubaya", maxHeight: 4.3, maxWeight: 65, minWidth: 3.7, grade: 4, road: "Constituyentes", hazmatRestricted: true, speedLimit: 50, maxAxleWeight: 11, maxTurnRadius: 16, signalized: true, condition: "obras" },
  { id: "e09", from: "reforma", to: "observatorio", maxHeight: 4.0, maxWeight: 32, minWidth: 3.2, grade: 10, road: "Calle Sur 122" },
  { id: "e10", from: "reforma", to: "periferico", maxHeight: 4.8, maxWeight: 80, minWidth: 4.2, grade: 3, road: "Viaducto Elevado", speedLimit: 80, maxAxleWeight: 12, maxTurnRadius: 18, toll: 58 },
  { id: "e11", from: "bosques", to: "periferico", maxHeight: 4.6, maxWeight: 58, minWidth: 3.9, grade: 5, road: "Bosques - Periférico" },
  { id: "e12", from: "tacubaya", to: "periferico", maxHeight: 3.9, maxWeight: 36, minWidth: 3.3, grade: 3, road: "Paso inferior Tacubaya", hazmatRestricted: true },
  { id: "e13", from: "tacubaya", to: "observatorio", maxHeight: 4.5, maxWeight: 55, minWidth: 3.6, grade: 4, road: "Av. Jalisco" },
  { id: "e14", from: "tacubaya", to: "logistico", maxHeight: 4.6, maxWeight: 52, minWidth: 3.7, grade: 3, road: "Viaducto Miguel Alemán", speedLimit: 50, maxAxleWeight: 10, maxTurnRadius: 15, signalized: true },
  { id: "e15", from: "periferico", to: "logistico", maxHeight: 4.8, maxWeight: 80, minWidth: 4.2, grade: 2, road: "Anillo Periférico" },
  { id: "e16", from: "observatorio", to: "logistico", maxHeight: 4.4, maxWeight: 46, minWidth: 3.5, grade: 5, road: "Eje 5 Poniente" },
];

export const roadEdges: RoadEdge[] = demoRoadEdges.map((edge) => ({ ...edge, ...roadMetrics(edge.from, edge.to) }));

const nodeById = Object.fromEntries(roadNodes.map((node) => [node.id, node])) as Record<NodeId, RoadNode>;

function heuristic(a: NodeId, b: NodeId) {
  // Distancia geográfica admisible: no usa las posiciones del dibujo esquemático.
  return geographicDistanceKm(ROAD_ACCESS[a], ROAD_ACCESS[b]);
}

function edgeRejection(edge: RoadEdge, vehicle: Vehicle, blocked: Set<string>) {
  if (blocked.has(edge.id)) return "Incidente o cierre activo";
  if (edge.privateZone && !vehicle.authorizedPrivateZones) return "Zona privada sin autorización";
  if (edge.hazmatRestricted && vehicle.cargoType === "peligrosa") return "Material peligroso restringido";
  if (vehicle.height > edge.maxHeight) return `Altura máxima ${edge.maxHeight.toFixed(1)} m`;
  if (vehicle.weight > edge.maxWeight) return `Peso máximo ${edge.maxWeight.toFixed(0)} t`;
  if (vehicle.weight / Math.max(1, vehicle.axles) > (edge.maxAxleWeight ?? 10.5)) return `Peso por eje máximo ${(edge.maxAxleWeight ?? 10.5).toFixed(1)} t`;
  if (vehicle.width > edge.minWidth) return `Ancho disponible ${edge.minWidth.toFixed(1)} m`;
  if (vehicle.turnRadius > (edge.maxTurnRadius ?? 16)) return `Radio de giro máximo ${(edge.maxTurnRadius ?? 16).toFixed(1)} m`;
  if (vehicle.length > 22 && edge.grade >= 9) return `Pendiente ${edge.grade}% no apta para esta longitud`;
  return null;
}

function destinationFrom(edge: RoadEdge, current: NodeId): NodeId | null {
  if (edge.from === current) return edge.to;
  if (!edge.oneWay && edge.to === current) return edge.from;
  return null;
}

function routeWarnings(edges: RoadEdge[], vehicle: Vehicle) {
  const warnings: string[] = [];
  if (vehicle.cargoType === "peligrosa") warnings.push("Carga peligrosa: se evitaron pasos inferiores y zonas restringidas.");
  if (edges.some((edge) => edge.grade >= 7)) warnings.push("Ruta con pendiente elevada: mantener velocidad controlada.");
  if (edges.some((edge) => vehicle.height > edge.maxHeight - 0.25)) warnings.push("Gálibo justo en un tramo: margen menor a 25 cm.");
  if (edges.some((edge) => vehicle.weight > edge.maxWeight - 5)) warnings.push("Peso cercano al límite permitido en un tramo.");
  if (edges.some((edge) => edge.privateZone)) warnings.push("Incluye zona privada validada por autorización.");
  if (edges.some((edge) => edge.condition === "baches")) warnings.push("Tramo con baches simulados: reducir la velocidad.");
  if (edges.some((edge) => edge.condition === "obras")) warnings.push("Obras simuladas en la ruta: posible reducción de carriles.");
  if (edges.some((edge) => edge.signalized)) warnings.push("La ruta incluye semáforos simulados.");
  return warnings;
}

function routeRiskScore(edges: RoadEdge[], vehicle: Vehicle) {
  if (!edges.length) return 0;
  const total = edges.reduce((score, edge) => {
    const heightMargin = Math.max(0, edge.maxHeight - vehicle.height);
    const weightMargin = Math.max(0, edge.maxWeight - vehicle.weight);
    const widthMargin = Math.max(0, edge.minWidth - vehicle.width);
    return score
      + edge.grade * 3
      + (heightMargin < 0.35 ? 18 : 0)
      + (weightMargin < 8 ? 14 : 0)
      + (widthMargin < 0.45 ? 12 : 0)
      + (edge.privateZone ? 8 : 0)
      + (edge.oneWay ? 4 : 0);
  }, 0);
  return Math.min(100, Math.round(total / edges.length));
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function trafficMultiplier(level: TrafficLevel | undefined) {
  return level === "intenso" ? 1.75 : level === "moderado" ? 1.3 : 1;
}

export function routeEdgeCost(edge: RoadEdge, from: NodeId, to: NodeId, vehicle: Vehicle, options: RoutingOptions = {}) {
  const metrics = roadMetrics(from, to);
  const traffic = trafficMultiplier(options.trafficByEdge?.[edge.id]);
  const learnedPenalty = Math.max(0, options.learnedPenalties?.[edge.id] ?? 0);
  const preference = options.preference ?? "balanceada";
  if (preference === "corta") return metrics.distance;
  const timeWeight = preference === "rapida" ? 0.055 : preference === "economica" ? 0.018 : 0.032;
  const riskWeight = preference === "segura" ? 0.06 : 0.025;
  const tollWeight = preference === "economica" ? 0.02 : 0.004;
  return metrics.distance * (1 + Math.max(0, edge.grade - 5) * 0.018)
    + metrics.minutes * traffic * timeWeight
    + routeRiskScore([edge], vehicle) * riskWeight
    + (edge.toll ?? 0) * tollWeight
    + (edge.condition === "obras" ? 0.9 : edge.condition === "baches" ? 0.45 : 0)
    + learnedPenalty;
}

function totalRouteCost(route: RouteResult, vehicle: Vehicle, options: RoutingOptions) {
  return route.edgeIds.reduce((sum, id, index) => sum + routeEdgeCost(edgeFor(id), route.path[index], route.path[index + 1], vehicle, options), 0);
}

export function findRoute(
  start: NodeId,
  goal: NodeId,
  vehicle: Vehicle,
  blockedIds: string[] = [],
  options: RoutingOptions = {},
): RouteResult {
  const calculationStarted = nowMs();
  const blocked = new Set(blockedIds);
  const open = new Set<NodeId>([start]);
  const closed = new Set<NodeId>();
  const cameFrom = new Map<NodeId, { node: NodeId; edge: RoadEdge }>();
  const gScore = new Map<NodeId, number>([[start, 0]]);
  const timeScore = new Map<NodeId, number>([[start, 0]]);
  const rejected = new Map<string, { edge: RoadEdge; reason: string }>();

  while (open.size > 0) {
    let current = [...open][0];
    for (const candidate of open) {
      const currentScore = (gScore.get(current) ?? Infinity) + heuristic(current, goal);
      const candidateScore = (gScore.get(candidate) ?? Infinity) + heuristic(candidate, goal);
      if (candidateScore < currentScore) current = candidate;
    }

    if (current === goal) {
      const path: NodeId[] = [current];
      const edgeIds: string[] = [];
      while (cameFrom.has(current)) {
        const previous = cameFrom.get(current)!;
        edgeIds.unshift(previous.edge.id);
        current = previous.node;
        path.unshift(current);
      }
      const selectedEdges = edgeIds.map((id) => edgeFor(id));
      const distance = Number(selectedEdges.reduce((sum, _edge, index) => sum + roadMetrics(path[index], path[index + 1]).distance, 0).toFixed(1));
      const minutes = Math.round(timeScore.get(goal) ?? 0);
      const fuelLiters = Number(((distance / 100) * vehicle.fuelConsumption * (1 + selectedEdges.reduce((sum, edge) => sum + edge.grade, 0) / Math.max(1, selectedEdges.length) / 100)).toFixed(2));
      const tollCost = selectedEdges.reduce((sum, edge) => sum + (edge.toll ?? 0), 0);
      return {
        path,
        edgeIds,
        distance,
        minutes,
        explored: closed.size + 1,
        rejected: [...rejected.values()],
        riskScore: routeRiskScore(selectedEdges, vehicle),
        warnings: routeWarnings(selectedEdges, vehicle),
        calculationMs: Number((nowMs() - calculationStarted).toFixed(3)),
        fuelLiters,
        operatingCost: Number((fuelLiters * 25.4 + tollCost + minutes * 2.1).toFixed(2)),
        tollCost,
        signalCount: selectedEdges.filter((edge) => edge.signalized).length,
      };
    }

    open.delete(current);
    closed.add(current);

    for (const edge of roadEdges) {
      const neighbor = destinationFrom(edge, current);
      if (!neighbor || closed.has(neighbor)) continue;
      const reason = edgeRejection(edge, vehicle, blocked);
      if (reason) {
        rejected.set(edge.id, { edge, reason });
        continue;
      }

      const traffic = trafficMultiplier(options.trafficByEdge?.[edge.id]);
      const roadCost = routeEdgeCost(edge, current, neighbor, vehicle, options);
      const tentative = (gScore.get(current) ?? Infinity) + roadCost;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, { node: current, edge });
        gScore.set(neighbor, tentative);
        timeScore.set(neighbor, (timeScore.get(current) ?? 0) + roadMetrics(current, neighbor).minutes * traffic);
        open.add(neighbor);
      }
    }
  }

  return {
    path: [], edgeIds: [], distance: 0, minutes: 0, explored: closed.size,
    rejected: [...rejected.values()], riskScore: 0, warnings: [],
    calculationMs: Number((nowMs() - calculationStarted).toFixed(3)),
    fuelLiters: 0, operatingCost: 0, tollCost: 0, signalCount: 0,
  };
}

export function findRouteAlternatives(
  start: NodeId,
  goal: NodeId,
  vehicle: Vehicle,
  blockedIds: string[] = [],
  options: RoutingOptions = {},
  limit = 3,
) {
  const primary = findRoute(start, goal, vehicle, blockedIds, options);
  if (!primary.path.length) return [primary];
  const alternatives = [primary];
  const signatures = new Set([primary.edgeIds.join("|")]);
  for (const edgeId of primary.edgeIds) {
    const candidate = findRoute(start, goal, vehicle, [...blockedIds, edgeId], options);
    const signature = candidate.edgeIds.join("|");
    const compact = candidate.distance <= primary.distance * 1.6
      || candidate.minutes < primary.minutes * 0.8
      || (options.preference === "segura" && candidate.riskScore < primary.riskScore * 0.65);
    if (candidate.path.length && compact && !signatures.has(signature)) {
      signatures.add(signature);
      alternatives.push(candidate);
    }
    if (alternatives.length >= limit) break;
  }
  // La misma función objetivo que A*: no promover un rodeo por otro ranking.
  return alternatives.sort((a, b) => totalRouteCost(a, vehicle, options) - totalRouteCost(b, vehicle, options));
}

export function nearestNode(point: GeoPoint) {
  return roadNodes.reduce((closest, node) => {
    const distance = Math.hypot(node.lat - point.lat, node.lng - point.lng);
    const closestDistance = Math.hypot(closest.lat - point.lat, closest.lng - point.lng);
    return distance < closestDistance ? node : closest;
  }, roadNodes[0]);
}

export function nodeFor(id: NodeId) {
  return nodeById[id];
}

export function routeGeoWaypoints(path: NodeId[]): GeoPoint[] {
  return path.map((id) => {
    const node = nodeById[id];
    return { lat: node.lat, lng: node.lng };
  });
}

export function roadWaypointsForLocations(waypoints: GeoPoint[]): GeoPoint[] {
  return waypoints.map((point) => {
    const node = roadNodes.find((candidate) => candidate.lat === point.lat && candidate.lng === point.lng);
    const access = node ? ROAD_ACCESS[node.id] : point;
    return { lat: access.lat, lng: access.lng };
  });
}

// Los marcadores conservan el punto del lugar aunque el proveedor ajuste la ruta a otra calle.
export function routeLocationMarkers(waypoints: GeoPoint[]) {
  return waypoints.map((position, index) => {
    const node = roadNodes.find((candidate) => candidate.lat === position.lat && candidate.lng === position.lng);
    const role = waypoints.length === 1 ? "Origen / destino" : index === 0 ? "Origen" : index === waypoints.length - 1 ? "Destino" : "Paso";
    return { position, label: `${role}${node ? ` · ${node.label}` : ""}`, endpoint: index === 0 || index === waypoints.length - 1 };
  });
}

export function edgeMidpoint(edge: RoadEdge): GeoPoint {
  const from = nodeById[edge.from];
  const to = nodeById[edge.to];
  return { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
}

export function edgeFor(id: string) {
  return roadEdges.find((edge) => edge.id === id)!;
}
