export type NodeId = "uam" | "santa-fe" | "vasco" | "reforma" | "bosques" | "tacubaya" | "periferico" | "observatorio" | "logistico";

export type RoadNode = {
  id: NodeId;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
};

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
  road: string;
};

export type Vehicle = {
  height: number;
  width: number;
  length: number;
  weight: number;
};

export type RouteResult = {
  path: NodeId[];
  edgeIds: string[];
  distance: number;
  minutes: number;
  explored: number;
  rejected: Array<{ edge: RoadEdge; reason: string }>;
};

export const roadNodes: RoadNode[] = [
  { id: "uam", label: "UAM Cuajimalpa", shortLabel: "UAM", x: 10, y: 76 },
  { id: "santa-fe", label: "Santa Fe Centro", shortLabel: "Santa Fe", x: 25, y: 55 },
  { id: "vasco", label: "Vasco de Quiroga", shortLabel: "Vasco", x: 34, y: 79 },
  { id: "reforma", label: "Paseo de la Reforma", shortLabel: "Reforma", x: 47, y: 47 },
  { id: "bosques", label: "Bosques de las Lomas", shortLabel: "Bosques", x: 62, y: 26 },
  { id: "tacubaya", label: "Tacubaya", shortLabel: "Tacubaya", x: 67, y: 66 },
  { id: "periferico", label: "Anillo Periférico", shortLabel: "Periférico", x: 82, y: 39 },
  { id: "observatorio", label: "Observatorio", shortLabel: "Observatorio", x: 50, y: 84 },
  { id: "logistico", label: "Centro Logístico", shortLabel: "Destino", x: 89, y: 77 },
];

export const roadEdges: RoadEdge[] = [
  { id: "e01", from: "uam", to: "santa-fe", distance: 2.8, minutes: 7, maxHeight: 4.8, maxWeight: 60, minWidth: 3.8, grade: 6, road: "Av. Vasco de Quiroga" },
  { id: "e02", from: "uam", to: "vasco", distance: 2.1, minutes: 6, maxHeight: 3.9, maxWeight: 28, minWidth: 3.1, grade: 9, road: "Camino del Bosque" },
  { id: "e03", from: "santa-fe", to: "vasco", distance: 1.6, minutes: 4, maxHeight: 4.6, maxWeight: 80, minWidth: 3.9, grade: 5, road: "Prolongación Vasco" },
  { id: "e04", from: "santa-fe", to: "reforma", distance: 2.4, minutes: 6, maxHeight: 4.4, maxWeight: 48, minWidth: 3.6, grade: 7, road: "Autopista Urbana Poniente" },
  { id: "e05", from: "vasco", to: "reforma", distance: 2.2, minutes: 6, maxHeight: 4.8, maxWeight: 64, minWidth: 3.8, grade: 6, road: "Av. de los Poetas" },
  { id: "e06", from: "vasco", to: "observatorio", distance: 2.1, minutes: 7, maxHeight: 4.5, maxWeight: 52, minWidth: 3.5, grade: 8, road: "Camino Real" },
  { id: "e07", from: "reforma", to: "bosques", distance: 2.8, minutes: 6, maxHeight: 4.8, maxWeight: 65, minWidth: 4.1, grade: 5, road: "Paseo de los Ahuehuetes" },
  { id: "e08", from: "reforma", to: "tacubaya", distance: 3.1, minutes: 8, maxHeight: 4.3, maxWeight: 65, minWidth: 3.7, grade: 4, road: "Constituyentes" },
  { id: "e09", from: "reforma", to: "observatorio", distance: 2.6, minutes: 8, maxHeight: 4.0, maxWeight: 32, minWidth: 3.2, grade: 10, road: "Calle Sur 122" },
  { id: "e10", from: "reforma", to: "periferico", distance: 5.5, minutes: 9, maxHeight: 4.8, maxWeight: 80, minWidth: 4.2, grade: 3, road: "Viaducto Elevado" },
  { id: "e11", from: "bosques", to: "periferico", distance: 2.5, minutes: 6, maxHeight: 4.6, maxWeight: 58, minWidth: 3.9, grade: 5, road: "Bosques - Periférico" },
  { id: "e12", from: "tacubaya", to: "periferico", distance: 2.0, minutes: 5, maxHeight: 3.9, maxWeight: 36, minWidth: 3.3, grade: 3, road: "Paso inferior Tacubaya" },
  { id: "e13", from: "tacubaya", to: "observatorio", distance: 1.9, minutes: 5, maxHeight: 4.5, maxWeight: 55, minWidth: 3.6, grade: 4, road: "Av. Jalisco" },
  { id: "e14", from: "tacubaya", to: "logistico", distance: 2.3, minutes: 6, maxHeight: 4.6, maxWeight: 52, minWidth: 3.7, grade: 3, road: "Viaducto Miguel Alemán" },
  { id: "e15", from: "periferico", to: "logistico", distance: 2.8, minutes: 6, maxHeight: 4.8, maxWeight: 80, minWidth: 4.2, grade: 2, road: "Anillo Periférico" },
  { id: "e16", from: "observatorio", to: "logistico", distance: 3.4, minutes: 9, maxHeight: 4.4, maxWeight: 46, minWidth: 3.5, grade: 5, road: "Eje 5 Poniente" },
];

const nodeById = Object.fromEntries(roadNodes.map((node) => [node.id, node])) as Record<NodeId, RoadNode>;

function heuristic(a: NodeId, b: NodeId) {
  const from = nodeById[a];
  const to = nodeById[b];
  return Math.hypot(from.x - to.x, from.y - to.y) * 0.055;
}

function edgeRejection(edge: RoadEdge, vehicle: Vehicle, blocked: Set<string>) {
  if (blocked.has(edge.id)) return "Incidente o cierre activo";
  if (vehicle.height > edge.maxHeight) return `Altura máxima ${edge.maxHeight.toFixed(1)} m`;
  if (vehicle.weight > edge.maxWeight) return `Peso máximo ${edge.maxWeight.toFixed(0)} t`;
  if (vehicle.width > edge.minWidth) return `Ancho disponible ${edge.minWidth.toFixed(1)} m`;
  if (vehicle.length > 22 && edge.grade >= 9) return `Pendiente ${edge.grade}% no apta para esta longitud`;
  return null;
}

export function findRoute(start: NodeId, goal: NodeId, vehicle: Vehicle, blockedIds: string[] = []): RouteResult {
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
      return {
        path,
        edgeIds,
        distance: Number((gScore.get(goal) ?? 0).toFixed(1)),
        minutes: Math.round(timeScore.get(goal) ?? 0),
        explored: closed.size + 1,
        rejected: [...rejected.values()],
      };
    }

    open.delete(current);
    closed.add(current);

    for (const edge of roadEdges) {
      const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!neighbor || closed.has(neighbor)) continue;
      const reason = edgeRejection(edge, vehicle, blocked);
      if (reason) {
        rejected.set(edge.id, { edge, reason });
        continue;
      }

      const roadCost = edge.distance * (1 + Math.max(0, edge.grade - 5) * 0.018);
      const tentative = (gScore.get(current) ?? Infinity) + roadCost;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, { node: current, edge });
        gScore.set(neighbor, tentative);
        timeScore.set(neighbor, (timeScore.get(current) ?? 0) + edge.minutes);
        open.add(neighbor);
      }
    }
  }

  return { path: [], edgeIds: [], distance: 0, minutes: 0, explored: closed.size, rejected: [...rejected.values()] };
}

export function nodeFor(id: NodeId) {
  return nodeById[id];
}

export function edgeFor(id: string) {
  return roadEdges.find((edge) => edge.id === id)!;
}
