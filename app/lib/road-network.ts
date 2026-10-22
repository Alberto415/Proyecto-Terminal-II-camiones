import type { GeoPoint, NodeId } from "./routing.ts";

// Referencias sobre calles transitables, separadas de los marcadores del inmueble.
// OSRM nearest/route/table, consulta 2026-10-14. No certifican acceso a carga.
export const ROAD_ACCESS: Record<NodeId, GeoPoint & { road: string }> = {
  uam: { lat: 19.353320, lng: -99.281907, road: "Prolongación Vasco de Quiroga" },
  "santa-fe": { lat: 19.360274, lng: -99.272791, road: "Prolongación Paseo de la Reforma" },
  vasco: { lat: 19.357552, lng: -99.272106, road: "Paseo de los Arquitectos" },
  reforma: { lat: 19.376532, lng: -99.254122, road: "Avenida Vasco de Quiroga" },
  bosques: { lat: 19.395289, lng: -99.246617, road: "Calle Bosque de Manzanos" },
  tacubaya: { lat: 19.401445, lng: -99.187827, road: "Avenida Jalisco" },
  periferico: { lat: 19.427159, lng: -99.203302, road: "Avenida Paseo de la Reforma" },
  observatorio: { lat: 19.397906, lng: -99.200323, road: "Avenida Río de Tacubaya" },
  logistico: { lat: 19.396167, lng: -99.200296, road: "Avenida de las Torres" },
};

export const ROAD_NETWORK_SOURCE = {
  checkedAt: "2026-10-14", provider: "OSRM / OpenStreetMap", profile: "driving",
  description: "Distancias y tiempos de referencia viales; no incluyen tráfico real ni un perfil certificado de camión.",
} as const;

const order: NodeId[] = ["uam", "santa-fe", "vasco", "reforma", "bosques", "tacubaya", "periferico", "observatorio", "logistico"];
// Matriz dirigida: ida y vuelta difieren por los sentidos de circulación.
const meters = [
  [0,2252.4,1631.5,4710.4,7714.3,12604.9,12814.2,11080.1,11357.9],
  [1423.9,0,1639.3,4718.1,7722.1,12612.6,12821.9,11087.9,11365.7],
  [1838.8,2182.1,0,3927.1,7643.9,12534.5,12743.8,11009.7,11287.5],
  [4632.5,3208.6,3130.9,0,3980,8797.5,9006.9,7272.8,7550.6],
  [7686.2,6262.3,6839.4,3785.6,0,8556,6851.2,7031.2,7309.1],
  [13120.4,11696.6,12273.6,7836.3,9034.3,0,4983.6,3065.2,2679.1],
  [14348.6,12924.7,13501.8,10448,10262.5,5248.3,0,6211.7,5825.6],
  [12295.8,10871.9,11449,8395.2,8209.7,2306.5,4882.3,0,2266.2],
  [11488,10064.2,10641.2,7587.5,7401.9,2692.5,5268.4,386.1,0],
];
const seconds = [
  [0,184.8,170.6,406.1,551,926.3,938.7,690,724.3],
  [152.2,0,151.4,386.9,531.8,907.1,919.5,670.8,705.1],
  [219.6,201,0,382,567.2,942.5,954.9,706.2,740.5],
  [399.4,247.2,321.3,0,410.1,787.7,800.1,551.4,585.7],
  [584.7,432.5,537.5,335.4,0,809.6,676.2,573.3,607.6],
  [973.9,821.7,926.7,724.5,792.2,0,422.7,293.4,257.4],
  [889.9,737.7,842.7,640.6,708.2,413,0,462.5,426.5],
  [880.9,728.7,833.7,631.6,699.2,284,472,0,243.8],
  [805.1,652.9,757.9,555.8,623.4,320,508,36,0],
];

export function roadMetrics(from: NodeId, to: NodeId) {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  return { distance: meters[a][b] / 1000, minutes: seconds[a][b] / 60 };
}

export function geographicDistanceKm(a: GeoPoint, b: GeoPoint) {
  const radians = Math.PI / 180;
  const lat = (b.lat - a.lat) * radians;
  const lng = (b.lng - a.lng) * radians;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
