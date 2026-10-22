import type { OsmElement, OsmScenery } from "../../lib/osm-scenery";

const cache = new Map<string, { data: OsmScenery; time: number }>();
const requests = new Map<string, Promise<OsmScenery>>();
export async function POST(request: Request) {
  let centers: Array<{ lat: number; lng: number }>;
  try {
    const body = await request.json();
    if (!Array.isArray(body.centers) || body.centers.length < 1 || body.centers.length > 8) throw new Error();
    centers = body.centers.map((point: { lat: number; lng: number }) => {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 85 || Math.abs(point.lng) > 180) throw new Error();
      return { lat: +point.lat.toFixed(5), lng: +point.lng.toFixed(5) };
    });
  } catch { return Response.json({ error: "Coordenadas inválidas" }, { status: 400 }); }
  const key = JSON.stringify(centers);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 86400000) return Response.json(saved.data);
  let work = requests.get(key);
  if (!work) {
    work = (async () => {
      const queries = centers.map((point) => {
        const area = `(around:280,${point.lat},${point.lng})`;
        return `way[building]${area};way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"]${area};way[leisure~"^(park|garden|playground)$"]${area};way[natural=water]${area};node[natural=tree]${area};node[highway=bus_stop]${area};`;
      }).join("");
      const query = `[out:json][timeout:8];(${queries});out geom;`;
      for (const endpoint of ["https://overpass-api.de/api/interpreter"]) {
        try {
          const response = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, { headers: { "Accept": "application/json", "User-Agent": "RutaCarga3D/2.3 academic-local-simulator" }, signal: AbortSignal.timeout(10000) });
          if (!response.ok) continue;
          const json = await response.json();
          if (!Array.isArray(json.elements) || json.remark) continue;
          const data: OsmScenery = { elements: json.elements.slice(0, 4000), fetchedAt: new Date().toISOString() };
          if (cache.size >= 16) cache.delete(cache.keys().next().value!);
          cache.set(key, { data, time: Date.now() });
          return data;
        } catch { /* Fall back to bounded map extracts. */ }
      }
      // Small, cached map extracts also work when Overpass is unavailable.
      // Two workers limit simultaneous requests; coordinates never select arbitrary hosts.
      const features = new Map<string, OsmElement>();
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(2, centers.length) }, async () => {
        while (index < centers.length) {
          const point = centers[index++];
          const latRadius = .0025, lngRadius = .0025 / Math.cos(point.lat * Math.PI / 180);
          const bbox = [point.lng - lngRadius, point.lat - latRadius, point.lng + lngRadius, point.lat + latRadius].join(",");
          try {
            const response = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, { headers: { "User-Agent": "RutaCarga3D/2.3 academic-local-simulator" }, signal: AbortSignal.timeout(8000) });
            if (!response.ok) continue;
            const json = await response.json() as { elements: Array<OsmElement & { nodes?: number[] }> };
            if (!Array.isArray(json.elements)) continue;
            const nodes = new Map(json.elements.filter((element) => element.type === "node").map((element) => [element.id, element]));
            for (const element of json.elements) {
              const tags = element.tags ?? {};
              if (!tags.building && !tags.highway && !tags.leisure && tags.natural !== "tree" && tags.natural !== "water") continue;
              if (element.type === "way") {
                const geometry = (element.nodes ?? []).map((id) => nodes.get(id)).filter((node) => node && Number.isFinite(node.lat) && Number.isFinite(node.lon)).map((node) => ({ lat: node!.lat!, lon: node!.lon! }));
                // Missing vertices must not create a false building outline.
                if (geometry.length !== element.nodes?.length) continue;
                features.set(`way/${element.id}`, { type: "way", id: element.id, tags, geometry });
              } else if (element.type === "node") features.set(`node/${element.id}`, element);
            }
          } catch { /* Partial coverage is useful; the scene labels its limits. */ }
        }
      }));
      if (features.size) {
        const data = { elements: [...features.values()].slice(0, 4000), fetchedAt: new Date().toISOString() };
        if (cache.size >= 16) cache.delete(cache.keys().next().value!);
        cache.set(key, { data, time: Date.now() });
        return data;
      }
      throw new Error("OSM indisponible");
    })();
    requests.set(key, work);
  }
  try { return Response.json(await work); }
  catch { return Response.json({ error: "No se pudo consultar OSM" }, { status: 503 }); }
  finally { requests.delete(key); }
}
