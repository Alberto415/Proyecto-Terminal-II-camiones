import { roadNodes } from "../app/lib/routing.ts";

// Una consulta por ejecución; no se usa este servicio al renderizar el mapa.
const mappedNodes = roadNodes.filter((node) => node.osmId);
const url = new URL("https://nominatim.openstreetmap.org/lookup");
url.searchParams.set("format", "jsonv2");
url.searchParams.set("osm_ids", mappedNodes.map((node) => node.osmId).join(","));
const response = await fetch(url, {
  headers: { "User-Agent": "MapaCamiones3D-location-audit/2.2.3", Accept: "application/json" },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Nominatim respondió HTTP ${response.status}; no se pudo verificar el catálogo.`);
const records = await response.json();
if (!Array.isArray(records)) throw new Error("La respuesta no contiene una lista de lugares.");
let failures = 0;
for (const node of mappedNodes) {
  const record = records.find((place) => `${place.osm_type[0].toUpperCase()}${place.osm_id}` === node.osmId);
  const latitude = Number(record?.lat);
  const longitude = Number(record?.lon);
  const meters = 111_195 * Math.hypot(latitude - node.lat, (longitude - node.lng) * Math.cos(node.lat * Math.PI / 180));
  // Se toleran ajustes cartográficos menores; un objeto ausente o desplazado exige revisión.
  const ok = Boolean(record?.name) && Number.isFinite(meters) && meters <= 25;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK" : "REVISAR"} | ${node.label} | ${node.osmId} | ${record?.name ?? "objeto ausente"} | diferencia ${Number.isFinite(meters) ? meters.toFixed(1) : "?"} m`);
}

// Open Location Code: decodificación de los cinco pares del código completo de Tacubaya.
const alphabet = "23456789CFGHJMPQRVWX";
const plusCode = "76F2CR26+HV";
const digits = plusCode.replace("+", "");
let latitude = -90;
let longitude = -180;
let resolution = 20;
for (let index = 0; index < digits.length; index += 2) {
  latitude += alphabet.indexOf(digits[index]) * resolution;
  longitude += alphabet.indexOf(digits[index + 1]) * resolution;
  if (index < digits.length - 2) resolution /= 20;
}
const tacubaya = roadNodes.find((node) => node.id === "tacubaya");
const plusCodeMatches = Math.abs(tacubaya.lat - (latitude + resolution / 2)) < 1e-8
  && Math.abs(tacubaya.lng - (longitude + resolution / 2)) < 1e-8;
console.log(`${plusCodeMatches ? "OK" : "REVISAR"} | Tacubaya | ${plusCode} | centro de la celda indicado por el usuario`);
if (!plusCodeMatches) failures += 1;
if (failures) process.exitCode = 1;
console.log(`${roadNodes.length - failures}/${roadNodes.length} ubicaciones coinciden con sus referencias.`);
